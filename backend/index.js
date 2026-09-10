const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const { app, db, storage } = require('./firebase');
const { doc, setDoc, onSnapshot, collection, query, orderBy, deleteDoc, updateDoc, getDocs, where } = require('firebase/firestore');
const { ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const qrcode = require('qrcode-terminal');

let client;

function getSerializedId(idObj) {
    if (!idObj) return null;
    return idObj._serialized || idObj['$1'] || `${idObj.fromMe}_${idObj.remote}_${idObj.id}`;
}

async function uploadMediaWithRetry(msg, safeId, serializedId, maxRetries = 5) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const delayMs = attempt === 1 ? 2500 : 4000 * attempt;
            console.log(`[Audio] Esperando ${delayMs}ms antes de descargar audio ${safeId} (intento ${attempt}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));

            if (msg.id) {
                msg.id._serialized = serializedId;
            }

            const media = await msg.downloadMedia();
            if (media && media.data) {
                console.log(`[Audio] Descargado ${safeId} exitosamente, guardando audio en Firestore...`);
                const dataUrl = `data:${media.mimetype || 'audio/ogg; codecs=opus'};base64,${media.data}`;
                
                // Store data URL directly in Firestore so audio plays immediately without 404 bucket errors
                await updateDoc(doc(db, "messages", serializedId), { 
                    mediaUrl: dataUrl 
                });
                console.log(`[Audio] ¡Audio listo y sincronizado en Firestore para ${safeId}!`);

                // Also try Storage upload in background if bucket exists
                try {
                    const buffer = Buffer.from(media.data, 'base64');
                    const storageRef = ref(storage, `audios/${safeId}.ogg`);
                    await uploadBytes(storageRef, buffer, { contentType: media.mimetype || 'audio/ogg; codecs=opus' });
                    const url = await getDownloadURL(storageRef);
                    await updateDoc(doc(db, "messages", serializedId), { mediaUrl: url });
                    console.log(`[Audio] URL permanente de Storage actualizada: ${url}`);
                } catch (e) {
                    // Storage bucket not created yet in console, dataUrl in Firestore already works perfectly
                }

                return dataUrl;
            } else {
                console.log(`[Audio] Intento ${attempt}: media aún no disponible en WhatsApp Web.`);
            }
        } catch (e) {
            console.error(`[Audio] Error en intento ${attempt} para ${safeId}:`, e.message);
        }
    }
    return null;
}

async function start() {
    console.log("Iniciando motor de WhatsApp...");
    client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
    });

    client.on('loading_screen', (percent, message) => {
        console.log(`[WhatsApp] Cargando: ${percent}% - ${message}`);
    });

    client.on('authenticated', () => {
        console.log('[WhatsApp] Autenticado con éxito.');
    });

    client.on('auth_failure', (msg) => {
        console.error('[WhatsApp] Fallo de autenticación:', msg);
    });

    client.on('qr', (qr) => {
        console.log('SCAN THIS QR CODE TO LOGIN:');
        qrcode.generate(qr, { small: true });
        setDoc(doc(db, "system", "status"), { qr, isReady: false });
    });

    client.on('ready', async () => {
        console.log('WhatsApp Client is Ready!');
        setDoc(doc(db, "system", "status"), { qr: null, isReady: true });

        try {
            const pendingQuery = query(collection(db, 'messages'), where('isAudio', '==', true));
            const pendingSnap = await getDocs(pendingQuery);
            for (const docSnap of pendingSnap.docs) {
                const data = docSnap.data();
                if (!data.mediaUrl) {
                    const msgId = docSnap.id;
                    const safeId = msgId.replace(/[^a-zA-Z0-9_-]/g, '_');
                    console.log(`[Audio Recovery] Intentando recuperar audio pendiente: ${msgId}`);
                    try {
                        const msgObj = await client.getMessageById(msgId);
                        if (msgObj) {
                            uploadMediaWithRetry(msgObj, safeId, msgId);
                        }
                    } catch (err) {
                        console.error(`[Audio Recovery] No se pudo obtener mensaje ${msgId}:`, err.message);
                    }
                }
            }
        } catch (err) {
            console.error('[Audio Recovery] Error buscando audios pendientes:', err);
        }
    });

    client.on('message', async (msg) => {
        if (msg.isStatus || msg.from === 'status@broadcast') return;
        
        const serializedId = getSerializedId(msg.id);
        if (!serializedId) return;

        const isAudio = (msg.type === 'ptt' || msg.type === 'audio');
        const hasMedia = msg.hasMedia;

        let contactName = msg.from;
        let senderName = msg.author ? msg.author.split('@')[0] : msg.from.split('@')[0];
        try {
            const contact = await msg.getContact();
            const notifyName = (msg._data && msg._data.notifyName) || null;
            contactName = contact.name || contact.pushname || notifyName || msg.from;
            const contactId = getSerializedId(contact.id);
            if (contactId) {
                setDoc(doc(db, "contacts", contactId), {
                    name: contact.name || null,
                    pushname: contact.pushname || notifyName || null,
                    number: contact.number || null,
                    lastActivity: msg.timestamp
                }, { merge: true });
            }
            if (msg.author) {
                const senderContact = await client.getContactById(msg.author);
                senderName = senderContact.name || senderContact.pushname || notifyName || senderContact.number || msg.author.split('@')[0];
            } else {
                senderName = contactName;
            }
        } catch(e) {}

        const msgData = {
            id: serializedId,
            fromMe: msg.fromMe,
            author: msg.from,
            contactName,
            senderName,
            body: msg.body,
            timestamp: msg.timestamp,
            type: msg.type,
            hasMedia,
            isAudio,
            mediaUrl: null
        };

        await setDoc(doc(db, "messages", serializedId), msgData);

        if (isAudio && hasMedia) {
            const safeId = serializedId.replace(/[^a-zA-Z0-9_-]/g, '_');
            uploadMediaWithRetry(msg, safeId, serializedId);
        }
    });

    client.on('message_create', async (msg) => {
        if (msg.isStatus || !msg.fromMe) return;
        const serializedId = getSerializedId(msg.id);
        if (!serializedId) return;

        const isAudio = (msg.type === 'ptt' || msg.type === 'audio');
        const hasMedia = msg.hasMedia;

        let contactName = msg.to;
        try {
            const contact = await client.getContactById(msg.to);
            if (contact) {
                contactName = contact.name || contact.pushname || msg.to;
                setDoc(doc(db, "contacts", getSerializedId(contact.id)), {
                    name: contact.name || null,
                    pushname: contact.pushname || null,
                    number: contact.number || null,
                    lastActivity: msg.timestamp
                }, { merge: true });
            }
        } catch(e) {}

        const msgData = {
            id: serializedId,
            fromMe: true,
            author: msg.to,
            contactName,
            senderName: "Tú",
            body: msg.body,
            timestamp: msg.timestamp,
            type: msg.type,
            hasMedia,
            isAudio,
            mediaUrl: null
        };
        await setDoc(doc(db, "messages", serializedId), msgData);

        if (isAudio && hasMedia) {
            const safeId = serializedId.replace(/[^a-zA-Z0-9_-]/g, '_');
            uploadMediaWithRetry(msg, safeId, serializedId);
        }
    });

    client.initialize();

    const outboxRef = collection(db, 'outbox');
    onSnapshot(outboxRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                try {
                    console.log(`Sending message to ${data.chatId}...`);
                    await client.sendMessage(data.chatId, data.text);
                    await deleteDoc(change.doc.ref);
                } catch (e) {
                    console.error('Error sending message:', e);
                }
            }
        });
    });
}

start();
