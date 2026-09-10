const { Client, LocalAuth } = require('whatsapp-web.js');
const db = require('./db');
const fs = require('fs');
const path = require('path');

const MEDIA_DIR = path.join(__dirname, 'media');

// Ensure media dir exists
if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

let client;
let isReady = false;

// Helper to get serialized ID (handles newer minified properties like '$1')
function getSerializedId(idObj) {
    if (!idObj) return null;
    return idObj._serialized || idObj['$1'] || `${idObj.fromMe}_${idObj.remote}_${idObj.id}`;
}

// Helper to sanitize message ID for use as filename
function sanitizeId(id) {
    if (!id) return 'unknown';
    return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// Helper to save media with retries and delays
async function saveMediaWithRetry(msg, maxRetries = 5) {
    const serializedId = getSerializedId(msg.id);
    const safeId = sanitizeId(serializedId);
    const filePath = path.join(MEDIA_DIR, `${safeId}.ogg`);
    
    if (fs.existsSync(filePath)) {
        console.log(`Audio already saved: ${safeId}`);
        return safeId;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Wait progressively longer before each attempt
            // This gives WhatsApp time to finish downloading the media internally
            const delayMs = attempt === 1 ? 3000 : 5000 * attempt;
            console.log(`Waiting ${delayMs}ms before download attempt ${attempt}/${maxRetries} for ${safeId}...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            
            // CRITICAL FIX: whatsapp-web.js internal downloadMedia() uses msg.id._serialized
            // which is undefined due to WhatsApp Web updates. We populate it here.
            msg.id._serialized = serializedId;
            
            const media = await msg.downloadMedia();
            if (media && media.data) {
                fs.writeFileSync(filePath, Buffer.from(media.data, 'base64'));
                const fileSize = fs.statSync(filePath).size;
                console.log(`Audio saved: ${safeId} (attempt ${attempt}, size: ${fileSize} bytes)`);
                return safeId;
            } else {
                console.log(`Download attempt ${attempt}: media was null or had no data`);
            }
        } catch (err) {
            console.error(`Download attempt ${attempt}/${maxRetries} failed for ${safeId}: ${err.message}`);
        }
    }
    console.error(`ALL ${maxRetries} download attempts failed for ${safeId}`);
    return null;
}

function initWhatsApp(io) {
    client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        }
    });

    client.on('qr', (qr) => {
        console.log('QR RECEIVED');
        io.emit('qr', qr);
    });

    client.on('ready', async () => {
        console.log('Client is ready!');
        isReady = true;
        io.emit('ready', 'WhatsApp Client is Ready');
    });

    client.on('message', async (msg) => {
        try {
            // Guard: ignore status/story updates from contacts
            if (msg.isStatus || msg.from === 'status@broadcast' || msg.to === 'status@broadcast') {
                return;
            }
            
            // Ignore system notifications and protocol messages that create empty bubbles
            const ignoredTypes = ['e2e_notification', 'notification_template', 'protocolMessage', 'call_log', 'gp2'];
            if (ignoredTypes.includes(msg.type) || (msg.body === '' && !msg.hasMedia && msg.type !== 'location' && msg.type !== 'vcard')) {
                return;
            }

            const serializedId = getSerializedId(msg.id);
            // Guard: skip if msg.id is malformed (can happen with some system messages)
            if (!serializedId) {
                console.log('Skipping message. msg keys:', Object.keys(msg || {}), 'msg.id:', msg ? msg.id : 'null');
                return;
            }
            const isAudio = (msg.type === 'ptt' || msg.type === 'audio') ? 1 : 0;
            const hasMedia = msg.hasMedia ? 1 : 0;

            // Dynamically save group info if it's a group message
            if (msg.from.includes('@g.us')) {
                try {
                    const chat = await msg.getChat();
                    const chatSerializedId = getSerializedId(chat.id);
                    if (chatSerializedId) {
                        db.run(`INSERT OR IGNORE INTO contacts (id, name) VALUES (?, ?)`, [chatSerializedId, chat.name || null]);
                        db.run(`UPDATE contacts SET name = ? WHERE id = ? AND name IS NULL`, [chat.name, chatSerializedId]);
                    }
                } catch (e) {
                    console.error('Failed to get group info dynamically:', e.message);
                }
            }

            // Get contact info
            let contactName = msg.from;
            let senderName = msg.author ? msg.author.split('@')[0] : msg.from.split('@')[0];
            try {
                const contact = await msg.getContact();
                const notifyName = (msg._data && msg._data.notifyName) || null;
                contactName = contact.name || contact.pushname || notifyName || msg.from;
                const contactSerializedId = getSerializedId(contact.id);
                db.run(`INSERT OR REPLACE INTO contacts (id, name, pushname, number) VALUES (?, ?, ?, ?)`,
                    [contactSerializedId, contact.name || null, contact.pushname || notifyName || null, contact.number || null]);

                if (msg.author) {
                    const senderContact = await client.getContactById(msg.author);
                    senderName = senderContact.name || senderContact.pushname || notifyName || senderContact.number || msg.author.split('@')[0];
                } else {
                    senderName = contactName;
                }
            } catch(e) {
                console.error('Failed to get contact:', e.message);
            }

            const safeId = sanitizeId(serializedId);

            // Save to DB (using unsanitized ID)
            db.run(`INSERT OR IGNORE INTO messages 
                (id, fromMe, author, body, timestamp, type, hasMedia, isAudio, senderName) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [serializedId, msg.fromMe ? 1 : 0, msg.from, msg.body, msg.timestamp, msg.type, hasMedia, isAudio, senderName]);

            // Emit to frontend immediately (audio will be available after download)
            // ONLY emit if the message is relatively new (less than 2 minutes old) to prevent UI thrashing during historical syncs
            const nowSeconds = Math.floor(Date.now() / 1000);
            if (nowSeconds - msg.timestamp < 120) {
                io.emit('new_message', {
                    id: serializedId,
                    fromMe: msg.fromMe,
                    author: msg.from,
                    contactName: contactName,
                    senderName: senderName,
                    body: msg.body,
                    timestamp: msg.timestamp,
                    type: msg.type,
                    hasMedia: hasMedia,
                    isAudio: isAudio,
                    transcription: null
                });
            }

            // Download audio media in background (with delay for WhatsApp to resolve it)
            if (isAudio && hasMedia) {
                saveMediaWithRetry(msg).then(result => {
                    if (result) {
                        // Notify frontend that media is now available (passing unsanitized ID)
                        io.emit('media_ready', { id: serializedId });
                    }
                });
            }
            
        } catch (error) {
            console.error('Error handling message', error);
        }
    });
    
    // Catch when we send a message
    client.on('message_create', async (msg) => {
        // Guard: ignore status/story updates
        if (msg.isStatus || msg.from === 'status@broadcast' || msg.to === 'status@broadcast') {
            return;
        }

        // Ignore system notifications and protocol messages that create empty bubbles
        const ignoredTypes = ['e2e_notification', 'notification_template', 'protocolMessage', 'call_log', 'gp2'];
        if (ignoredTypes.includes(msg.type) || (msg.body === '' && !msg.hasMedia && msg.type !== 'location' && msg.type !== 'vcard')) {
            return;
        }

        if (msg.fromMe) {
             try {
                const serializedId = getSerializedId(msg.id);
                // Guard: skip if msg.id is malformed
                if (!serializedId) {
                    return;
                }
                const isAudio = (msg.type === 'ptt' || msg.type === 'audio') ? 1 : 0;
                const hasMedia = msg.hasMedia ? 1 : 0;

                let contactName = msg.to;
                let senderName = "Tú";
                try {
                    const contact = await client.getContactById(msg.to);
                    if (contact) {
                        contactName = contact.name || contact.pushname || msg.to;
                        const contactSerializedId = getSerializedId(contact.id);
                        db.run(`INSERT OR REPLACE INTO contacts (id, name, pushname, number) VALUES (?, ?, ?, ?)`,
                            [contactSerializedId, contact.name || null, contact.pushname || null, contact.number || null]);
                    }
                } catch(e) {
                    console.error('Failed to get sent contact:', e.message);
                }
    
                const safeId = sanitizeId(serializedId);

                db.run(`INSERT OR IGNORE INTO messages 
                    (id, fromMe, author, body, timestamp, type, hasMedia, isAudio, senderName) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [serializedId, 1, msg.to, msg.body, msg.timestamp, msg.type, hasMedia, isAudio, senderName]);

                const nowSeconds = Math.floor(Date.now() / 1000);
                if (nowSeconds - msg.timestamp < 120) {
                    io.emit('new_message', {
                        id: serializedId,
                        fromMe: true,
                        author: msg.to,
                        contactName: contactName,
                        senderName: senderName,
                        body: msg.body,
                        timestamp: msg.timestamp,
                        type: msg.type,
                        hasMedia: hasMedia,
                        isAudio: isAudio,
                        transcription: null
                    });
                }

                // Download audio media in background
                if (isAudio && hasMedia) {
                    saveMediaWithRetry(msg).then(result => {
                        if (result) {
                            io.emit('media_ready', { id: serializedId });
                        }
                    });
                }
            } catch (err) {
                 console.error('Error saving sent message', err);
            }
        }
    });

    client.initialize();
}

async function logoutWhatsApp(io) {
    console.log('Forced logout initiated from WhatsApp...');
    isReady = false;
    if (client) {
        try {
            console.log('Destroying client...');
            await client.destroy();
            console.log('Client destroyed.');
        } catch (e) {
            console.error('Error during client.destroy()', e.message);
        }
    }

    // Delete session directory
    const authDir = path.join(__dirname, '.wwebjs_auth');
    if (fs.existsSync(authDir)) {
        try {
            console.log('Deleting auth directory:', authDir);
            // Wait a bit for locks to release
            await new Promise(resolve => setTimeout(resolve, 2000));
            fs.rmSync(authDir, { recursive: true, force: true });
            console.log('Auth session directory deleted successfully.');
        } catch (err) {
            console.error('Failed to delete auth session directory:', err.message);
        }
    }

    // Re-initialize client
    console.log('Re-initializing client...');
    initWhatsApp(io);
}

function getClient() {
    return client;
}

function getStatus() {
    return isReady;
}

module.exports = {
    initWhatsApp,
    getClient: () => client,
    getStatus,
    sanitizeId,
    MEDIA_DIR,
    logoutWhatsApp
};
