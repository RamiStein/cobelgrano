const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
const { db } = require('./firebase');
const { doc, updateDoc, addDoc, collection } = require('firebase/firestore');
const classifierService = require('./classifierService');

const ffmpegDir = path.dirname(ffmpegPath);
const scriptPath = path.join(__dirname, 'transcribe.py');
const tempDir = path.join(__dirname, 'temp_audio');

if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

let isTranscribing = false;
const queue = [];

async function processQueue() {
    if (isTranscribing || queue.length === 0) return;
    isTranscribing = true;

    const task = queue.shift();
    try {
        await executeTranscription(task);
    } catch (err) {
        console.error('[WhisperService] Error procesando tarea:', err.message);
    } finally {
        isTranscribing = false;
        if (queue.length > 0) {
            setImmediate(processQueue);
        }
    }
}

async function executeTranscription({ audioBase64, mimeType, msgId, senderName, sourceName, chatId, workspaceId }) {
    if (!audioBase64 || !msgId) return;
    const safeId = msgId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const inputPath = path.join(tempDir, `${safeId}_in.ogg`);
    const wavPath = path.join(tempDir, `${safeId}.wav`);

    try {
        console.log(`[WhisperService] Iniciando transcripción para mensaje ${safeId}...`);
        
        // 1. Guardar archivo ogg temporal
        const buffer = Buffer.from(audioBase64, 'base64');
        fs.writeFileSync(inputPath, buffer);

        // 2. Convertir a 16kHz mono WAV con FFmpeg
        const ffmpegCmd = `"${ffmpegPath}" -i "${inputPath}" -ar 16000 -ac 1 -y "${wavPath}"`;
        await new Promise((resolve, reject) => {
            exec(ffmpegCmd, (err, stdout, stderr) => {
                if (err) return reject(new Error(`FFmpeg error: ${stderr || err.message}`));
                resolve();
            });
        });

        // 3. Ejecutar transcribe.py con Python y Whisper
        const pyCmd = `python "${scriptPath}" "${wavPath}" "${ffmpegDir}"`;
        const transcriptionText = await new Promise((resolve, reject) => {
            exec(pyCmd, { cwd: __dirname, timeout: 60000 }, (err, stdout, stderr) => {
                if (err) return reject(new Error(`Whisper error: ${stderr || err.message}`));
                resolve(stdout ? stdout.trim() : '');
            });
        });

        console.log(`[WhisperService] ✅ Transcripción exitosa para ${safeId}: "${transcriptionText}"`);

        // 4. Actualizar Firestore
        await updateDoc(doc(db, 'messages', msgId), {
            transcription: transcriptionText,
            transcriptionStatus: 'completed'
        });

        // 5. Si es espacio personal y hay texto, clasificar para el Organizador Inteligente
        if (transcriptionText && (workspaceId === 'personal' || !workspaceId)) {
            const note = classifierService.classifyMessage(transcriptionText, senderName, sourceName, 'personal', chatId);
            if (note) {
                console.log(`[Whisper -> Organizer] 🎯 Nota extraída de audio: [${note.category.toUpperCase()}] "${note.title}"`);
                await addDoc(collection(db, 'smart_notes'), {
                    workspaceId: 'personal',
                    category: note.category,
                    title: note.title,
                    originalText: `[Audio transcrito]: ${note.originalText}`,
                    sourceName: note.sourceName,
                    senderName: note.senderName,
                    chatId: chatId,
                    status: 'pendiente',
                    priority: note.priority || 'media',
                    intent: note.intent || 'general',
                    subKeyword: note.subKeyword || null,
                    timestamp: Math.floor(Date.now() / 1000),
                    createdAt: Date.now()
                });
            }
        }
    } catch (err) {
        console.error(`[WhisperService] Error en transcripción de ${safeId}:`, err.message);
        await updateDoc(doc(db, 'messages', msgId), {
            transcriptionStatus: 'error',
            transcriptionError: err.message
        }).catch(() => {});
    } finally {
        try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch (e) {}
        try { if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath); } catch (e) {}
    }
}

function queueTranscription(task) {
    queue.push(task);
    processQueue();
}

module.exports = {
    queueTranscription,
    transcribeDirect: executeTranscription
};
