const { db } = require('./firebase');
const { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, addDoc, query, where, getDocs, deleteDoc } = require('firebase/firestore');

const ZERNIO_BASE_URL = 'https://zernio.com/api/v1';

class ZernioService {
    constructor() {
        this.apiKey = process.env.ZERNIO_API_KEY || null;
        this.profileId = null;
        this.accountId = null;
        this.status = 'disconnected';
        this.phoneNumber = null;
        this.instagramAccountId = null;
        this.instagramUsername = null;
        this.instagramStatus = 'disconnected';
        this.isInitialized = false;
        this.syncInterval = null;
        this.syncedConversations = new Map();
        this.knownMessageIds = new Set();
    }

    async init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        console.log('[Zernio] Inicializando servicio omnicanal...');

        // Lectura inicial síncrona de Firestore
        try {
            const initialSnap = await getDoc(doc(db, 'system', 'zernio_config'));
            if (initialSnap.exists()) {
                const data = initialSnap.data();
                this.apiKey = data.apiKey || process.env.ZERNIO_API_KEY || null;
                this.profileId = data.profileId || null;
                this.accountId = data.accountId || null;
                this.status = data.status || 'disconnected';
                this.phoneNumber = data.phoneNumber || null;
                this.instagramAccountId = data.instagramAccountId || null;
                this.instagramUsername = data.instagramUsername || null;
                this.instagramStatus = data.instagramStatus || 'disconnected';
                console.log(`[Zernio] Configuración cargada: WhatsApp=${this.accountId ? 'OK' : 'No'}, Instagram=${this.instagramAccountId ? 'OK' : 'No'}`);
            }
        } catch (e) {
            console.warn('[Zernio] No se pudo leer config inicial:', e.message);
        }

        // Escuchar configuración de Firestore en tiempo real
        onSnapshot(doc(db, 'system', 'zernio_config'), async (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const keyChanged = this.apiKey !== data.apiKey;
                this.apiKey = data.apiKey || process.env.ZERNIO_API_KEY || null;
                this.profileId = data.profileId || null;
                this.accountId = data.accountId || null;
                this.status = data.status || 'disconnected';
                this.phoneNumber = data.phoneNumber || null;
                this.instagramAccountId = data.instagramAccountId || null;
                this.instagramUsername = data.instagramUsername || null;
                this.instagramStatus = data.instagramStatus || 'disconnected';

                console.log(`[Zernio] Configuración actualizada: WA=${this.status}, IG=${this.instagramStatus}`);

                if (this.apiKey && (!this.profileId || !this.accountId || keyChanged)) {
                    await this.autoDiscover();
                }

                if (this.apiKey && (this.accountId || this.instagramAccountId)) {
                    this.startPeriodicSync();
                }
            } else {
                if (process.env.ZERNIO_API_KEY) {
                    this.apiKey = process.env.ZERNIO_API_KEY;
                    await this.autoDiscover();
                }
            }
        });
    }

    async autoDiscover() {
        if (!this.apiKey) return;
        try {
            console.log('[Zernio] Verificando cuentas conectadas en Zernio API...');
            const accounts = await this.listAccounts();
            if (accounts && accounts.length > 0) {
                const whatsappAcc = accounts.find(a => a.platform === 'whatsapp');
                const instagramAcc = accounts.find(a => a.platform === 'instagram');
                const updates = { lastChecked: Date.now() };

                if (whatsappAcc) {
                    console.log(`[Zernio] WhatsApp encontrado: ID ${whatsappAcc._id} (${whatsappAcc.username})`);
                    this.accountId = whatsappAcc._id;
                    this.phoneNumber = whatsappAcc.username;
                    this.status = whatsappAcc.isActive ? 'connected' : 'inactive';
                    updates.accountId = this.accountId;
                    updates.phoneNumber = this.phoneNumber;
                    updates.status = this.status;
                }

                if (instagramAcc) {
                    console.log(`[Zernio] Instagram encontrado: ID ${instagramAcc._id} (@${instagramAcc.username})`);
                    this.instagramAccountId = instagramAcc._id;
                    this.instagramUsername = instagramAcc.username;
                    this.instagramStatus = instagramAcc.isActive ? 'connected' : 'inactive';
                    updates.instagramAccountId = this.instagramAccountId;
                    updates.instagramUsername = this.instagramUsername;
                    updates.instagramStatus = this.instagramStatus;
                }

                await setDoc(doc(db, 'system', 'zernio_config'), updates, { merge: true });
            }
        } catch (err) {
            console.error('[Zernio] Error en autoDiscover:', err.message);
        }
    }

    async apiRequest(endpoint, options = {}) {
        const key = options.apiKey || this.apiKey;
        if (!key) {
            throw new Error('Zernio API Key no configurada.');
        }

        const url = `${ZERNIO_BASE_URL}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        const fetchOptions = {
            method: options.method || 'GET',
            headers
        };

        if (options.body) {
            fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
        }

        const response = await fetch(url, fetchOptions);
        const data = await response.json().catch(() => null);

        if (!response.ok) {
            const errMsg = data?.error || data?.message || `HTTP ${response.status}: ${response.statusText}`;
            const error = new Error(errMsg);
            error.status = response.status;
            error.data = data;
            throw error;
        }

        return data;
    }

    async createProfile(name = "Consultorios Odontológicos Belgrano") {
        console.log(`[Zernio] Creando perfil: ${name}...`);
        const result = await this.apiRequest('/profiles', {
            method: 'POST',
            body: { name }
        });
        const profile = result?.profile;
        if (profile?._id) {
            this.profileId = profile._id;
            await setDoc(doc(db, 'system', 'zernio_config'), {
                profileId: profile._id,
                profileName: profile.name,
                updatedAt: Date.now()
            }, { merge: true });
        }
        return profile;
    }

    async getConnectUrl(platform = 'whatsapp', redirectUrl, onboarding = 'business_app') {
        if (!this.profileId) {
            await this.createProfile();
        }

        const queryParams = new URLSearchParams({
            profileId: this.profileId
        });
        if (onboarding && platform === 'whatsapp') {
            queryParams.append('onboarding', onboarding);
        }
        if (redirectUrl) {
            queryParams.append('redirect_url', redirectUrl);
        }

        return await this.apiRequest(`/connect/${platform}?${queryParams.toString()}`);
    }

    async listAccounts() {
        const result = await this.apiRequest('/accounts');
        return result?.accounts || [];
    }

    async sendMessage(conversationId, text, accountId, options = {}) {
        const targetAccountId = accountId || this.accountId;
        if (!targetAccountId) {
            throw new Error('No hay cuenta de mensajería activa en Zernio.');
        }

        const payload = {
            accountId: targetAccountId,
            message: text,
            ...options
        };

        return await this.apiRequest(`/inbox/conversations/${conversationId}/messages`, {
            method: 'POST',
            body: payload
        });
    }

    async createConversation(participantId, text, accountId, options = {}) {
        const targetAccountId = accountId || this.accountId;
        if (!targetAccountId) {
            throw new Error('No hay cuenta de mensajería activa en Zernio.');
        }

        const payload = {
            accountId: targetAccountId,
            participantId: participantId,
            message: text,
            ...options
        };

        return await this.apiRequest('/inbox/conversations', {
            method: 'POST',
            body: payload
        });
    }

    // Despachar mensaje saliente desde outbox (WhatsApp o Instagram)
    async dispatchOutboxMessage(outboxData) {
        try {
            const text = outboxData.text;
            const target = outboxData.chatId; // Ej: "54911...@c.us" o "ig_username"
            const isInstagram = outboxData.channel === 'instagram' || target.startsWith('ig_');
            const targetAccountId = isInstagram ? this.instagramAccountId : this.accountId;

            if (!targetAccountId) {
                throw new Error(`Cuenta de ${isInstagram ? 'Instagram' : 'WhatsApp'} no conectada en Zernio.`);
            }

            console.log(`[Zernio Dispatch] Despachando a ${target} (${isInstagram ? 'Instagram' : 'WhatsApp'}): "${text}"`);

            // Buscar si ya tenemos un conversationId guardado para este contacto
            let conversationId = null;
            const contactSnap = await getDoc(doc(db, 'contacts', target));
            if (contactSnap.exists() && contactSnap.data().zernioConversationId) {
                conversationId = contactSnap.data().zernioConversationId;
            }

            let sendResult;
            if (conversationId) {
                try {
                    sendResult = await this.sendMessage(conversationId, text, targetAccountId);
                } catch (sendErr) {
                    console.warn(`[Zernio Dispatch] Envío directo a ${conversationId} falló (${sendErr.message}), creando conversación...`);
                    conversationId = null;
                }
            }

            if (!conversationId) {
                const participantClean = isInstagram ? target.replace('ig_', '') : target.split('@')[0].replace(/[^0-9]/g, '');
                const convResult = await this.createConversation(participantClean, text, targetAccountId);
                conversationId = convResult?.data?.conversationId || convResult?.conversationId;
                sendResult = convResult;

                if (conversationId) {
                    await setDoc(doc(db, 'contacts', target), {
                        zernioConversationId: conversationId
                    }, { merge: true });
                }
            }

            // Registrar mensaje enviado en Firestore (con tolerancia a cuotas)
            const msgId = sendResult?.data?.messageId || `zernio_${Date.now()}`;
            try {
                await setDoc(doc(db, 'messages', msgId), {
                    id: msgId,
                    fromMe: true,
                    author: target,
                    contactName: target,
                    senderName: "Tú",
                    body: text,
                    timestamp: Math.floor(Date.now() / 1000),
                    type: 'chat',
                    channel: isInstagram ? 'instagram' : 'whatsapp_cloud',
                    hasMedia: false,
                    isAudio: false
                });
            } catch (fsErr) {
                console.warn('[Firestore Write Queued]', fsErr.message);
            }

            console.log(`[Zernio Dispatch] ¡Mensaje despachado con éxito! ID: ${msgId}`);
            return true;
        } catch (error) {
            console.error('[Zernio Dispatch] Error despachando mensaje:', error.message);
            throw error;
        }
    }

    startPeriodicSync() {
        if (this.syncInterval) clearInterval(this.syncInterval);
        console.log('[Zernio] Sincronización periódica delta activada (cada 60s)');

        this.syncInterval = setInterval(async () => {
            try {
                await this.syncInboxToFirestore();
            } catch (err) {
                // Silencioso
            }
        }, 60000);
    }

    async syncInboxToFirestore() {
        if (!this.apiKey) return;

        if (this.accountId) {
            await this.syncPlatformInbox(this.accountId, 'whatsapp');
        }

        if (this.instagramAccountId) {
            await this.syncPlatformInbox(this.instagramAccountId, 'instagram');
        }
    }

    async syncPlatformInbox(accountId, platform) {
        try {
            const conversations = await this.apiRequest(`/inbox/conversations?accountId=${accountId}`);
            const list = conversations?.data || conversations?.conversations || [];

            for (const conv of list) {
                const convId = conv._id || conv.id;
                const participant = conv.participantId || conv.participantUsername || conv.phone || conv.username;
                if (!participant) continue;

                const convUpdated = new Date(conv.updatedTime || conv.updatedAt || conv.lastMessageAt || 0).getTime();
                const lastSynced = this.syncedConversations.get(convId) || 0;

                const isIg = platform === 'instagram';
                const safeContactId = isIg ? `ig_${conv.participantUsername || participant}` : `${participant.replace(/[^0-9]/g, '')}@c.us`;

                // Si la conversación no cambió, omitir escritura en Firestore
                if (convUpdated > lastSynced || !this.syncedConversations.has(convId)) {
                    await setDoc(doc(db, 'contacts', safeContactId), {
                        number: participant,
                        name: conv.participantName || (isIg ? `@${conv.participantUsername || participant}` : participant),
                        pushname: conv.participantName || null,
                        lastActivity: Math.floor((convUpdated || Date.now()) / 1000),
                        zernioConversationId: convId,
                        channel: isIg ? 'instagram' : 'whatsapp_cloud',
                        platform: platform
                    }, { merge: true });

                    this.syncedConversations.set(convId, convUpdated);
                }

                // Sincronizar mensajes si hay nuevos
                const msgRes = await this.apiRequest(`/inbox/conversations/${convId}/messages?accountId=${accountId}`);
                const messages = msgRes?.messages || msgRes?.data || [];

                for (const m of messages) {
                    if (this.knownMessageIds.has(m.id)) {
                        continue; // Omitir mensaje ya guardado
                    }

                    const isOutgoing = m.direction === 'outgoing';
                    const isAudio = m.attachments?.some(a => a.type === 'audio' || a.voiceNote) || false;
                    const mediaUrl = m.attachments?.[0]?.url || null;

                    await setDoc(doc(db, 'messages', m.id), {
                        id: m.id,
                        fromMe: isOutgoing,
                        author: safeContactId,
                        contactName: conv.participantName || participant,
                        senderName: isOutgoing ? 'Tú' : (conv.participantName || participant),
                        body: m.message || (isAudio ? 'Nota de voz' : ''),
                        timestamp: Math.floor(new Date(m.createdAt || m.sentAt || Date.now()).getTime() / 1000),
                        type: isAudio ? 'audio' : 'chat',
                        hasMedia: !!mediaUrl,
                        isAudio: isAudio,
                        mediaUrl: mediaUrl,
                        channel: isIg ? 'instagram' : 'whatsapp_cloud',
                        platform: platform
                    }, { merge: true });

                    this.knownMessageIds.add(m.id);
                }
            }
        } catch (err) {
            console.error(`[Zernio Sync ${platform}] Error:`, err.message);
        }
    }
}

const zernioService = new ZernioService();
module.exports = zernioService;
