const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const { db } = require('./firebase');
const { doc, setDoc, updateDoc, addDoc, collection, onSnapshot, getDocs, query, where, deleteDoc } = require('firebase/firestore');
const classifierService = require('./classifierService');
const whisperService = require('./whisperService');

let client = null;
let isReady = false;
let currentQr = null;
let isInitializing = false;
const chatTitleCache = new Map();
let syncChatsInterval = null;

const DESKTOP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const chromeExecutable = fs.existsSync(CHROME_PATH) ? CHROME_PATH : undefined;

function getSerializedId(idObj) {
    if (!idObj) return null;
    return idObj._serialized || idObj['$1'] || `${idObj.fromMe}_${idObj.remote}_${idObj.id}`;
}

async function initPartnerService() {
    if (isInitializing) {
        console.log('[Partner WhatsApp] Ya se está inicializando una instancia, omitiendo llamada duplicada.');
        return;
    }
    if (client && isReady) {
        console.log('[Partner WhatsApp] El cliente ya se encuentra conectado.');
        return;
    }
    isInitializing = true;

    console.log(`[Partner WhatsApp] Inicializando WhatsApp Web con Chrome oficial (${chromeExecutable || 'Chromium bundled'})...`);

    client = new Client({
        authStrategy: new LocalAuth({ clientId: 'partner_session' }),
        userAgent: DESKTOP_USER_AGENT,
        puppeteer: {
            headless: 'new',
            executablePath: chromeExecutable,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                `--user-agent=${DESKTOP_USER_AGENT}`
            ]
        }
    });

    client.on('loading_screen', (percent, message) => {
        console.log(`[Partner WhatsApp] Cargando: ${percent}% - ${message}`);
    });

    client.on('authenticated', () => {
        console.log('[Partner WhatsApp] ¡Autenticado exitosamente con WhatsApp Web!');
    });

    client.on('code', async (code) => {
        console.log(`[Partner WhatsApp] ¡Código de vinculación recibido!: ${code}`);
        let formatted = code;
        if (code && code.length === 8) {
            formatted = `${code.slice(0, 4)}-${code.slice(4)}`;
        }
        try {
            await setDoc(doc(db, 'system', 'partner_status'), {
                pairingCode: formatted,
                rawPairingCode: code,
                pairingStatus: 'code_ready',
                pairingExpiresAt: Date.now() + 180000,
                updatedAt: Date.now()
            }, { merge: true });
        } catch (e) {
            console.error('[Partner WhatsApp] Error guardando pairing code:', e.message);
        }
    });

    client.on('auth_failure', async (msg) => {
        console.error('[Partner WhatsApp] Fallo de autenticación:', msg);
        await setDoc(doc(db, 'system', 'partner_status'), {
            isReady: false,
            status: 'auth_failure',
            error: msg,
            updatedAt: Date.now()
        }, { merge: true });
    });

    client.on('qr', async (qr) => {
        console.log('[Partner WhatsApp] ¡Nuevo código QR oficial de WhatsApp Web generado!');
        currentQr = qr;
        isReady = false;

        const payload = {
            qr: qr,
            isReady: false,
            status: 'qr_ready',
            updatedAt: Date.now()
        };

        try {
            await setDoc(doc(db, 'system', 'partner_status'), payload, { merge: true });
            await setDoc(doc(db, 'system', 'zernio_config'), {
                partnerQr: qr,
                partnerStatus: 'qr_ready',
                updatedAt: Date.now()
            }, { merge: true });
            console.log('[Partner WhatsApp] QR sincronizado con Firestore en system/partner_status y zernio_config.');
        } catch (e) {
            console.error('[Partner WhatsApp] Error guardando QR en Firestore:', e.message);
        }
    });

    async function syncAllChats() {
        if (!client || !isReady || !client.pupPage) return;
        try {
            console.log('[Partner WhatsApp] Sincronizando nombres de todos los chats y grupos de WhatsApp...');

            const chatsData = await client.pupPage.evaluate(() => {
                try {
                    let chatModels = [];
                    if (window.Store && window.Store.Chat && window.Store.Chat.getModelsArray) {
                        chatModels = window.Store.Chat.getModelsArray();
                    } else if (window.require) {
                        try {
                            const collections = window.require('WAWebCollections');
                            if (collections && collections.Chat && collections.Chat.getModelsArray) {
                                chatModels = collections.Chat.getModelsArray();
                            }
                        } catch (e) {}
                    }

                    return chatModels.map(c => {
                        const id = c.id?._serialized || (typeof c.id === 'string' ? c.id : null);
                        const isGroup = !!(c.isGroup || (id && id.endsWith('@g.us')));
                        const title = c.formattedTitle || c.name || c.contact?.name || c.contact?.pushname || (c.groupMetadata && c.groupMetadata.subject) || null;
                        
                        let lastSnippet = null;
                        let lastTimestamp = c.t || 0;
                        try {
                            const lastMsgKey = c.lastReceivedKey?._serialized || c.lastReceivedKey;
                            const msg = (lastMsgKey && window.Store?.Msg?.get) ? window.Store.Msg.get(lastMsgKey) : null;
                            if (msg) {
                                if (msg.type === 'ptt' || msg.type === 'audio') lastSnippet = '🎤 Nota de voz';
                                else if (msg.type === 'image') lastSnippet = '📷 Imagen';
                                else if (msg.type === 'video') lastSnippet = '🎥 Video';
                                else if (msg.body) lastSnippet = msg.body;
                                if (msg.t) lastTimestamp = msg.t;
                            } else if (c.msgs && c.msgs.last) {
                                const m = c.msgs.last();
                                if (m) {
                                    if (m.type === 'ptt' || m.type === 'audio') lastSnippet = '🎤 Nota de voz';
                                    else if (m.type === 'image') lastSnippet = '📷 Imagen';
                                    else if (m.body) lastSnippet = m.body;
                                    if (m.t) lastTimestamp = m.t;
                                }
                            }
                        } catch (e) {}

                        return {
                            id,
                            title,
                            isGroup,
                            timestamp: lastTimestamp || c.t || 0,
                            lastMessage: lastSnippet,
                            unreadCount: c.unreadCount || 0
                        };
                    });
                } catch (err) {
                    return [];
                }
            });

            console.log(`[Partner WhatsApp] ${chatsData ? chatsData.length : 0} conversaciones recuperadas del navegador.`);

            let updatedCount = 0;
            for (const item of (chatsData || [])) {
                if (!item.id) continue;
                const title = item.title;
                if (title && title !== 'Grupo de WhatsApp') {
                    chatTitleCache.set(item.id, title);
                }

                const contactPayload = {
                    id: item.id,
                    number: item.id.split('@')[0],
                    lastActivity: item.timestamp || Math.floor(Date.now() / 1000),
                    workspaceId: 'personal',
                    isGroup: item.isGroup,
                    channel: 'whatsapp_web'
                };

                if (title && title !== 'Grupo de WhatsApp') {
                    contactPayload.name = title;
                    contactPayload.pushname = title;
                }
                if (item.lastMessage) {
                    contactPayload.lastMessage = item.lastMessage;
                }
                if (item.unreadCount !== undefined) {
                    contactPayload.unreadCount = item.unreadCount;
                }

                await setDoc(doc(db, 'contacts', item.id), contactPayload, { merge: true });
                updatedCount++;
            }
            console.log(`[Partner WhatsApp] Sincronización completada con éxito. ${updatedCount} chats y grupos actualizados con nombre y último mensaje en Firestore.`);
        } catch (err) {
            console.error('[Partner WhatsApp] Error en syncAllChats:', err.message || err);
        }
    }

    client.on('ready', async () => {
        isReady = true;
        currentQr = null;
        const phone = client.info?.wid?.user ? `+${client.info.wid.user}` : 'Conectado';
        console.log(`[Partner WhatsApp] ¡Cliente LISTO y CONECTADO 24/7! Número: ${phone}`);

        const payload = {
            qr: null,
            isReady: true,
            status: 'connected',
            phoneNumber: phone,
            updatedAt: Date.now()
        };

        try {
            await setDoc(doc(db, 'system', 'partner_status'), payload, { merge: true });
            await setDoc(doc(db, 'system', 'zernio_config'), {
                partnerQr: null,
                partnerStatus: 'connected',
                partnerPhoneNumber: phone,
                updatedAt: Date.now()
            }, { merge: true });
            console.log('[Partner WhatsApp] Estado CONECTADO actualizado en Firestore.');
        } catch (e) {
            console.error('[Partner WhatsApp] Error actualizando estado en Firestore:', e.message);
        }

        // Sincronizar nombres reales de chats y grupos inmediatamente y tras unos segundos de warming
        setTimeout(() => syncAllChats(), 2000);
        setTimeout(() => syncAllChats(), 15000);
        setTimeout(() => recoverPendingAudios(), 10000);

        if (!syncChatsInterval) {
            syncChatsInterval = setInterval(() => {
                if (isReady && client) {
                    syncAllChats();
                }
            }, 10 * 60 * 1000);
        }
    });

    client.on('disconnected', async (reason) => {
        console.warn('[Partner WhatsApp] Desconectado:', reason);
        isReady = false;
        currentQr = null;
        if (syncChatsInterval) {
            clearInterval(syncChatsInterval);
            syncChatsInterval = null;
        }

        try {
            await setDoc(doc(db, 'system', 'partner_status'), {
                qr: null,
                isReady: false,
                status: 'disconnected',
                updatedAt: Date.now()
            }, { merge: true });
            await setDoc(doc(db, 'system', 'zernio_config'), {
                partnerStatus: 'disconnected',
                updatedAt: Date.now()
            }, { merge: true });
        } catch (e) {}

        try {
            if (client) {
                await client.destroy();
            }
        } catch (e) {}
        client = null;
        isInitializing = false;

        // Intentar reconectar tras 4 segundos
        setTimeout(() => {
            console.log('[Partner WhatsApp] Intentando reiniciar cliente limpio para generar nuevo QR/código...');
            initPartnerService().catch(err => console.error('[Partner WhatsApp] Error reinicializando:', err.message));
        }, 4000);
    });

    // Procesar mensajes entrantes (Chats privados y GRUPOS escolares/familia)
    client.on('message', async (msg) => {
        try {
            if (msg.isStatus || msg.from === 'status@broadcast' || msg.to === 'status@broadcast') return;

            const isGroup = msg.from.includes('@g.us');
            let sourceName = 'Chat Directo';
            let groupName = null;

            if (isGroup) {
                let groupTitle = chatTitleCache.get(msg.from);

                if (!groupTitle || groupTitle === 'Grupo de WhatsApp') {
                    try {
                        const chat = await msg.getChat();
                        groupTitle = chat?.name || chat?.formattedTitle || chat?.groupMetadata?.subject;
                    } catch (e) {}
                }

                if (!groupTitle || groupTitle === 'Grupo de WhatsApp') {
                    try {
                        const chat = await client.getChatById(msg.from);
                        groupTitle = chat?.name || chat?.formattedTitle || chat?.groupMetadata?.subject;
                    } catch (e) {}
                }

                if ((!groupTitle || groupTitle === 'Grupo de WhatsApp') && client.pupPage) {
                    try {
                        groupTitle = await client.pupPage.evaluate((cid) => {
                            const c = window.Store?.Chat?.get(cid);
                            return c?.formattedTitle || c?.name || c?.groupMetadata?.subject || null;
                        }, msg.from);
                    } catch (e) {}
                }

                if (groupTitle && groupTitle !== 'Grupo de WhatsApp') {
                    chatTitleCache.set(msg.from, groupTitle);
                    sourceName = groupTitle;
                    groupName = groupTitle;
                } else {
                    sourceName = chatTitleCache.get(msg.from) || 'Grupo de WhatsApp';
                    groupName = sourceName;
                }
            }

            let senderName = msg.author ? msg.author.split('@')[0] : msg.from.split('@')[0];
            try {
                const contact = await msg.getContact();
                const notifyName = (msg._data && msg._data.notifyName) || null;
                const bestName = contact.name || contact.pushname || notifyName;
                if (bestName) senderName = bestName;
                if (!isGroup) sourceName = senderName;
            } catch (e) {}

            console.log(`[Partner WhatsApp] Mensaje en [${sourceName}] de [${senderName}]: "${(msg.body || '').slice(0, 60)}"`);

            // 1. Clasificación automática inteligente con IA/Reglas para el Organizador Personal
            if (msg.body && msg.body.trim()) {
                const note = classifierService.classifyMessage(msg.body, senderName, sourceName, 'personal', msg.from);
                if (note) {
                    console.log(`[Partner Organizer] 🎯 Auto-clasificado: [${note.category.toUpperCase()}] "${note.title}"`);
                    await addDoc(collection(db, 'smart_notes'), {
                        workspaceId: 'personal',
                        category: note.category,
                        title: note.title,
                        originalText: note.originalText,
                        sourceName: note.sourceName,
                        senderName: note.senderName,
                        chatId: msg.from,
                        status: 'pendiente',
                        priority: note.priority || 'media',
                        intent: note.intent || 'general',
                        subKeyword: note.subKeyword || null,
                        timestamp: msg.timestamp || Math.floor(Date.now() / 1000),
                        createdAt: Date.now()
                    });
                }
            }

            // 2. Guardar mensaje en Firestore para el historial del Espacio Personal
            const serializedId = getSerializedId(msg.id);
            if (serializedId) {
                const isAudio = (msg.type === 'ptt' || msg.type === 'audio');
                const initialBody = msg.body || (isAudio ? '🎤 Nota de voz' : (msg.hasMedia ? '📷 Multimedia' : ''));

                await setDoc(doc(db, 'messages', serializedId), {
                    id: serializedId,
                    fromMe: false,
                    author: msg.from,
                    contactName: sourceName,
                    senderName,
                    body: initialBody,
                    timestamp: msg.timestamp || Math.floor(Date.now() / 1000),
                    type: msg.type,
                    hasMedia: msg.hasMedia,
                    isAudio,
                    mediaUrl: null,
                    mediaStatus: isAudio ? 'downloading' : null,
                    workspaceId: 'personal',
                    isGroup
                });

                let lastSnippet = msg.body;
                if (isAudio) lastSnippet = '🎤 Nota de voz';
                else if (msg.hasMedia) lastSnippet = '📷 Multimedia';
                if (isGroup && senderName) lastSnippet = `${senderName}: ${lastSnippet}`;

                const contactPayload = {
                    id: msg.from,
                    number: msg.from.split('@')[0],
                    lastActivity: msg.timestamp || Math.floor(Date.now() / 1000),
                    lastMessage: lastSnippet,
                    workspaceId: 'personal',
                    isGroup,
                    channel: 'whatsapp_web'
                };

                if (isGroup) {
                    if (sourceName && sourceName !== 'Grupo de WhatsApp') {
                        contactPayload.name = sourceName;
                        contactPayload.pushname = sourceName;
                    }
                } else {
                    contactPayload.name = sourceName;
                    contactPayload.pushname = senderName;
                }

                await setDoc(doc(db, 'contacts', msg.from), contactPayload, { merge: true });

                // Si es audio, descargarlo de inmediato y encolarlo para Whisper
                if (isAudio && msg.hasMedia) {
                    downloadAndProcessAudio(msg, serializedId, sourceName, senderName, msg.from);
                }
            }
        } catch (err) {
            console.error('[Partner WhatsApp] Error procesando mensaje:', err.message);
        }
    });

    async function downloadAndProcessAudio(msg, serializedId, sourceName, senderName, chatId, maxRetries = 4) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const delayMs = attempt === 1 ? 1500 : 3000 * attempt;
                await new Promise(r => setTimeout(r, delayMs));

                console.log(`[Partner Audio] Descargando audio ${serializedId} (intento ${attempt}/${maxRetries})...`);
                const media = await msg.downloadMedia();
                if (media && media.data) {
                    const dataUrl = `data:${media.mimetype || 'audio/ogg; codecs=opus'};base64,${media.data}`;
                    await updateDoc(doc(db, 'messages', serializedId), {
                        mediaUrl: dataUrl,
                        mediaStatus: 'ready'
                    });
                    console.log(`[Partner Audio] ✅ ¡Audio listo y guardado en Firestore para ${serializedId}!`);

                    // Encolar transcripción con Whisper
                    whisperService.queueTranscription({
                        audioBase64: media.data,
                        mimeType: media.mimetype || 'audio/ogg; codecs=opus',
                        msgId: serializedId,
                        senderName,
                        sourceName,
                        chatId,
                        workspaceId: 'personal'
                    });
                    return dataUrl;
                }
            } catch (e) {
                console.error(`[Partner Audio] Error descargando audio intento ${attempt} para ${serializedId}:`, e.message);
            }
        }
        await updateDoc(doc(db, 'messages', serializedId), { mediaStatus: 'error' }).catch(() => {});
        return null;
    }

    async function recoverPendingAudios() {
        if (!client || !isReady) return;
        try {
            console.log('[Partner Audio Recovery] Buscando audios sin descargar...');
            const pendingQuery = query(
                collection(db, 'messages'),
                where('workspaceId', '==', 'personal'),
                where('isAudio', '==', true)
            );
            const pendingSnap = await getDocs(pendingQuery);
            let recovered = 0;
            for (const docSnap of pendingSnap.docs) {
                const data = docSnap.data();
                if (!data.mediaUrl && data.id) {
                    try {
                        const msgObj = await client.getMessageById(data.id);
                        if (msgObj && msgObj.hasMedia) {
                            downloadAndProcessAudio(msgObj, data.id, data.contactName, data.senderName, data.author);
                            recovered++;
                        }
                    } catch (e) {}
                }
            }
            if (recovered > 0) {
                console.log(`[Partner Audio Recovery] ${recovered} audios puestos en cola de descarga.`);
            }
        } catch (e) {
            console.error('[Partner Audio Recovery] Error:', e.message);
        }
    }

    // Escuchar acciones de audio desde el frontend (reintentar descarga o transcribir a demanda)
    try {
        onSnapshot(collection(db, 'audio_actions'), (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    const action = change.doc.data();
                    if (action.msgId && isReady && client) {
                        try {
                            console.log(`[Audio Action] Solicitud para ${action.msgId}: ${action.type}`);
                            const msgObj = await client.getMessageById(action.msgId);
                            if (msgObj && msgObj.hasMedia) {
                                downloadAndProcessAudio(msgObj, action.msgId, action.sourceName, action.senderName, action.chatId);
                            }
                        } catch (e) {
                            console.error('[Audio Action] Error:', e.message);
                        }
                    }
                    await deleteDoc(change.doc.ref).catch(() => {});
                }
            });
        });
    } catch (e) {}

    // Escuchar solicitudes de código de vinculación desde la interfaz
    try {
        onSnapshot(doc(db, 'system', 'partner_pairing_request'), async (snap) => {
            if (!snap.exists()) return;
            const req = snap.data();
            if (req.status === 'requested' && req.phoneNumber) {
                console.log(`[Partner WhatsApp] Solicitud de código recibida para: ${req.phoneNumber}`);
                try {
                    const formattedCode = await requestPairingCode(req.phoneNumber);
                    await setDoc(doc(db, 'system', 'partner_pairing_request'), {
                        status: 'ready',
                        code: formattedCode,
                        error: null,
                        updatedAt: Date.now()
                    }, { merge: true });
                } catch (e) {
                    await setDoc(doc(db, 'system', 'partner_pairing_request'), {
                        status: 'error',
                        error: e.message,
                        updatedAt: Date.now()
                    }, { merge: true });
                }
            } else if (req.status === 'cancel') {
                try {
                    if (client && client.cancelPairingCode) {
                        await client.cancelPairingCode();
                        console.log('[Partner WhatsApp] Código cancelado, volviendo a modo QR.');
                    }
                    await setDoc(doc(db, 'system', 'partner_status'), {
                        pairingCode: null,
                        pairingStatus: 'cancelled',
                        updatedAt: Date.now()
                    }, { merge: true });
                    await setDoc(doc(db, 'system', 'partner_pairing_request'), {
                        status: 'cancelled',
                        updatedAt: Date.now()
                    }, { merge: true });
                } catch (e) {}
            }
        });

        onSnapshot(doc(db, 'system', 'partner_reset_request'), async (snap) => {
            if (!snap.exists()) return;
            const req = snap.data();
            if (req.triggerReset && req.triggerReset > (lastResetTimestamp || 0)) {
                lastResetTimestamp = req.triggerReset;
                console.log('[Partner WhatsApp] Solicitud de reinicio limpio recibida...');
                await resetSession();
            }
        });
    } catch (e) {
        console.error('[Partner WhatsApp] Error en listener de pairing_request:', e.message);
    }

    // Iniciar cliente
    try {
        await client.initialize();
    } catch (e) {
        console.error('[Partner WhatsApp] Error inicializando cliente de WhatsApp Web:', e.message);
    }
}

let lastResetTimestamp = 0;

async function resetSession() {
    console.log('[Partner WhatsApp] Reiniciando cliente de WhatsApp...');
    try {
        if (client) {
            await client.destroy();
        }
    } catch (e) {}
    client = null;
    isReady = false;
    currentQr = null;
    isInitializing = false;

    try {
        const sessionPath = './.wwebjs_auth/session-partner_session';
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log('[Partner WhatsApp] Datos de sesión eliminados.');
        }
    } catch (e) {
        console.warn('[Partner WhatsApp] Aviso borrando sesión:', e.message);
    }

    await setDoc(doc(db, 'system', 'partner_status'), {
        qr: null,
        pairingCode: null,
        isReady: false,
        status: 'resetting',
        updatedAt: Date.now()
    }, { merge: true });

    setTimeout(() => {
        initPartnerService().catch(err => console.error('[Partner WhatsApp] Error reinicializando tras reset:', err));
    }, 2000);
}

async function requestPairingCode(rawPhone) {
    if (!client) {
        throw new Error('El cliente de WhatsApp Web no está inicializado.');
    }
    if (isReady) {
        throw new Error('El cliente ya está conectado.');
    }

    let clean = String(rawPhone || '').replace(/\D/g, '');
    if (!clean) {
        throw new Error('Número de teléfono inválido.');
    }

    // Normalizar números argentinos
    if (clean.length === 10) {
        clean = '549' + clean;
    } else if (clean.length === 11 && clean.startsWith('9')) {
        clean = '54' + clean;
    } else if (clean.length === 12 && clean.startsWith('5411')) {
        clean = '549' + clean.slice(2);
    }

    console.log(`[Partner WhatsApp] Solicitando código de emparejamiento a WhatsApp Web para ${clean}...`);
    try {
        const code = await client.requestPairingCode(clean);
        console.log(`[Partner WhatsApp] ¡Código de vinculación generado con éxito!: ${code}`);
        
        let formatted = code;
        if (code && code.length === 8) {
            formatted = `${code.slice(0, 4)}-${code.slice(4)}`;
        }

        await setDoc(doc(db, 'system', 'partner_status'), {
            pairingCode: formatted,
            rawPairingCode: code,
            pairingPhone: clean,
            pairingStatus: 'code_ready',
            pairingExpiresAt: Date.now() + 180000,
            updatedAt: Date.now()
        }, { merge: true });

        return formatted;
    } catch (err) {
        console.error('[Partner WhatsApp] Error generando código:', err.message);
        throw err;
    }
}

async function sendPartnerMessage(chatId, text) {
    if (!client || !isReady) {
        throw new Error('El cliente de WhatsApp Personal no está conectado todavía');
    }
    return await client.sendMessage(chatId, text);
}

module.exports = {
    init: initPartnerService,
    sendMessage: sendPartnerMessage,
    requestPairingCode: requestPairingCode,
    resetSession: resetSession,
    isReady: () => isReady,
    getQr: () => currentQr
};
