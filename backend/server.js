const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const db = require('./db');
const { initWhatsApp, getClient, getStatus, sanitizeId, MEDIA_DIR, logoutWhatsApp } = require('./whatsappService');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

initWhatsApp(io);

// API Endpoints

app.post('/logout', async (req, res) => {
    try {
        await logoutWhatsApp(io);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/status', (req, res) => {
    res.json({ ready: getStatus() });
});

// Get recent chats/contacts (unique authors from messages)
app.get('/chats', (req, res) => {
    db.all(`
        SELECT m.author, MAX(m.timestamp) as lastActivity,
               c.name, c.pushname, ct.tag, c.id as contactId
        FROM messages m
        LEFT JOIN contacts c ON m.author = c.id OR m.author = c.number || '@lid' OR m.author = c.number || '@c.us'
        LEFT JOIN chat_tags ct ON m.author = ct.chatId
        GROUP BY m.author 
        ORDER BY lastActivity DESC, m.author ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get messages for a specific chat
app.get('/messages/:author', (req, res) => {
    const author = req.params.author;
    db.all(`SELECT * FROM messages WHERE author = ? ORDER BY timestamp ASC`, [author], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Download Media - serves audio files from the local media folder
app.get('/media/:msgId', async (req, res) => {
    try {
        const msgId = req.params.msgId;
        const safeId = sanitizeId(msgId);
        const mediaPath = path.join(MEDIA_DIR, `${safeId}.ogg`);
        
        if (fs.existsSync(mediaPath)) {
            // Set proper headers for audio streaming
            const stat = fs.statSync(mediaPath);
            res.set({
                'Content-Type': 'audio/ogg',
                'Content-Length': stat.size,
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'no-cache'
            });
            const stream = fs.createReadStream(mediaPath);
            stream.pipe(res);
        } else {
            console.log(`Media file not found: ${mediaPath}`);
            res.status(404).json({ error: 'Media not found on disk' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Tag a chat
app.post('/tag', (req, res) => {
    const { chatId, tag } = req.body;
    db.run(`INSERT OR REPLACE INTO chat_tags (chatId, tag) VALUES (?, ?)`, [chatId, tag], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

// Delete a message by ID
app.delete('/messages/:msgId', (req, res) => {
    const msgId = req.params.msgId;
    db.run(`DELETE FROM messages WHERE id = ?`, [msgId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, deleted: this.changes });
    });
});

// Force sync missing group names
app.get('/sync-missing-groups', (req, res) => {
    db.all(`SELECT DISTINCT m.author FROM messages m LEFT JOIN contacts c ON m.author = c.id WHERE m.author LIKE '%@g.us' AND (c.name IS NULL OR c.id IS NULL)`, [], async (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        console.log(`Found ${rows.length} missing groups to sync.`);
        let updated = 0;
        for (let row of rows) {
            try {
                const client = require('./whatsappService').getClient();
                console.log(`Client exists? ${!!client}`);
                if (client) {
                    const chat = await client.getChatById(row.author);
                    console.log(`Chat ${row.author} fetched. Name: ${chat ? chat.name : 'null'}`);
                    if (chat && chat.name) {
                        db.run(`INSERT OR REPLACE INTO contacts (id, name) VALUES (?, ?)`, [row.author, chat.name]);
                        updated++;
                    }
                }
            } catch (e) {
                console.error('Failed to sync group:', row.author, e.message);
            }
        }
        res.json({ success: true, updated });
    });
});

// Send a message
app.post('/send', async (req, res) => {
    const { chatId, text } = req.body;
    const client = getClient();
    if (!client || !getStatus()) return res.status(500).json({ error: 'Client not ready' });
    
    try {
        await client.sendMessage(chatId, text);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Record time spent on a chat
app.post('/session', (req, res) => {
    const { chatId, startTime, endTime } = req.body;
    const duration = endTime - startTime;
    db.run(`INSERT INTO sessions (chatId, startTime, endTime, duration) VALUES (?, ?, ?, ?)`,
        [chatId, startTime, endTime, duration], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

// Transcribe endpoint
app.post('/transcribe', async (req, res) => {
    const { msgId } = req.body;
    console.log(`[Transcribe] Request received for message ID: ${msgId}`);
    
    try {
        const safeId = sanitizeId(msgId);
        const mediaPath = path.join(MEDIA_DIR, `${safeId}.ogg`);
        console.log(`[Transcribe] Media path: ${mediaPath}`);
        
        if (!fs.existsSync(mediaPath)) {
            console.error(`[Transcribe] OGG file not found on disk at: ${mediaPath}`);
            return res.status(404).json({ error: 'Audio file not found. The audio may not have finished downloading yet. Please try again in a few seconds.' });
        }
        
        // Use a sanitized temp file name too
        const tempWav = path.join(__dirname, `temp_${safeId}.wav`);
        
        // Convert to 16kHz wav (Whisper optimal) using direct exec of ffmpeg-static
        const ffmpegCmd = `"${ffmpegPath}" -i "${mediaPath}" -ar 16000 -ac 1 -y "${tempWav}"`;
        console.log(`[Transcribe] Converting audio with FFmpeg: ${ffmpegCmd}`);
        
        exec(ffmpegCmd, (ffErr, ffStdout, ffStderr) => {
            if (ffErr) {
                console.error('[Transcribe] FFmpeg conversion error:', ffErr);
                console.error('[Transcribe] FFmpeg stderr:', ffStderr);
                return res.status(500).json({ error: 'Audio conversion failed' });
            }
            console.log(`[Transcribe] FFmpeg conversion complete. Created temp WAV: ${tempWav}`);
            
            // Now run python script
            const ffmpegDir = path.dirname(ffmpegPath);
            const scriptPath = path.join(__dirname, 'transcribe.py');
            const runCmd = `python "${scriptPath}" "${tempWav}" "${ffmpegDir}"`;
            console.log(`[Transcribe] Executing Whisper Python script: ${runCmd}`);
            
            exec(runCmd, { cwd: __dirname }, (error, stdout, stderr) => {
                // Clean up temp file
                try { fs.unlinkSync(tempWav); } catch(e){}
                
                if (error) {
                    console.error('[Transcribe] Python script error:', error);
                    console.error('[Transcribe] Python stderr:', stderr);
                    return res.status(500).json({ error: 'Transcription failed: ' + stderr });
                }
                
                const transcription = stdout.trim();
                console.log(`[Transcribe] Python script successful. Transcription text: "${transcription}"`);
                
                db.run(`UPDATE messages SET transcription = ? WHERE id = ?`, [transcription, msgId], function(err) {
                    if (err) {
                        console.error('[Transcribe] DB update error:', err.message);
                        return res.status(500).json({ error: err.message });
                    }
                    
                    io.emit('transcription_updated', { msgId, transcription });
                    console.log('[Transcribe] Socket broadcasted and DB updated.');
                    res.json({ success: true, transcription });
                });
            });
        });
            
    } catch (error) {
        console.error('[Transcribe] Unexpected error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Stats endpoint
app.get('/stats', (req, res) => {
    const stats = {};
    db.get(`SELECT COUNT(*) as totalMessages FROM messages`, (err, row) => {
        if (row) stats.totalMessages = row.totalMessages;
        
        db.get(`SELECT SUM(duration) as totalTime FROM sessions`, (err, row) => {
            if (row) stats.totalTime = row.totalTime || 0;
            
            db.all(`SELECT tag, COUNT(*) as count FROM chat_tags WHERE tag IS NOT NULL GROUP BY tag`, (err, rows) => {
                stats.tags = rows || [];
                res.json(stats);
            });
        });
    });
});

// Debug endpoint to list saved media files
app.get('/debug/media', (req, res) => {
    try {
        const files = fs.readdirSync(MEDIA_DIR);
        res.json({ mediaDir: MEDIA_DIR, files, count: files.length });
    } catch(e) {
        res.json({ error: e.message });
    }
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
    console.log(`Media directory: ${MEDIA_DIR}`);
});
