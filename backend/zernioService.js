const { db } = require('./firebase');
const { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, addDoc, query, where, getDocs, deleteDoc } = require('firebase/firestore');
const classifierService = require('./classifierService');

const ZERNIO_BASE_URL = 'https://zernio.com/api/v1';

class ZernioService {
    constructor() {
        this.apiKey = process.env.ZERNIO_API_KEY || null;
        // Workspace 1: COB Dental Clinic
        this.profileId = '6aa335bc2a1a1261505b1e5e';
        this.accountId = '6aa2ceb5726ebfe037d480af';
        this.status = 'disconnected';
        this.phoneNumber = '+54 9 11 2616-3119';

        // Instagram COB
        this.instagramAccountId = null;
        this.instagramUsername = null;
        this.instagramStatus = 'disconnected';

        // Workspace 2: Personal & Familia (Compañera)
        this.partnerProfileId = '6ab071431eb011d0b9ddaef7';
        this.partnerAccountId = null;
        this.partnerPhoneNumber = null;
        this.partnerStatus = 'disconnected';

        this.isInitialized = false;
        this.syncInterval = null;
        this.syncedConversations = new Map();
        this.knownMessageIds = new Set();
        this.lastAutoDiscoverTime = 0;
    }

    async init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        console.log('[Zernio] Inicializando servicio multi-espacio (COB + Personal)...');

        // Lectura inicial de Firestore
        try {
            const initialSnap = await getDoc(doc(db, 'system', 'zernio_config'));
            if (initialSnap.exists()) {
                const data = initialSnap.data();
                this.apiKey = data.apiKey || process.env.ZERNIO_API_KEY || null;
                
                // COB
                this.profileId = data.profileId || this.profileId;
                this.accountId = data.accountId || this.accountId;
                this.status = data.status || 'disconnected';
                this.phoneNumber = data.phoneNumber || this.phoneNumber;
                this.instagramAccountId = data.instagramAccountId || null;
                this.instagramUsername = data.instagramUsername || null;
                this.instagramStatus = data.instagramStatus || 'disconnected';

                // Personal
                this.partnerProfileId = data.partnerProfileId || this.partnerProfileId;
                this.partnerAccountId = data.partnerAccountId || null;
                this.partnerPhoneNumber = data.partnerPhoneNumber || null;
                this.partnerStatus = data.partnerStatus || 'disconnected';

                console.log(`[Zernio] Config cargada: COB=${this.accountId ? 'OK' : 'No'} (${this.phoneNumber}), Personal=${this.partnerAccountId ? 'OK' : 'Pendiente'}`);
            }
        } catch (e) {
            console.warn('[Zernio] No se pudo leer config inicial:', e.message);
        }

        // Escuchar configuración en tiempo real
        onSnapshot(doc(db, 'system', 'zernio_config'), async (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const keyChanged = this.apiKey !== data.apiKey;
                this.apiKey = data.apiKey || process.env.ZERNIO_API_KEY || null;
                
                // COB
                this.profileId = data.profileId || this.profileId;
                this.accountId = data.accountId || this.accountId;
                this.status = data.status || 'disconnected';
                this.phoneNumber = data.phoneNumber || this.phoneNumber;
                this.instagramAccountId = data.instagramAccountId || null;
                this.instagramUsername = data.instagramUsername || null;
                this.instagramStatus = data.instagramStatus || 'disconnected';

                // Personal
                this.partnerProfileId = data.partnerProfileId || this.partnerProfileId;
                this.partnerAccountId = data.partnerAccountId || this.partnerAccountId;
                this.partnerPhoneNumber = data.partnerPhoneNumber || this.partnerPhoneNumber;
                this.partnerStatus = data.partnerStatus || this.partnerStatus;

                if (this.apiKey && (keyChanged || (!this.accountId && Date.now() - this.lastAutoDiscoverTime > 300000))) {
                    await this.autoDiscover();
                }

                if (this.apiKey && (this.accountId || this.partnerAccountId || this.instagramAccountId)) {
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
        if (Date.now() - this.lastAutoDiscoverTime < 60000) return; // Respetar rate limits
        this.lastAutoDiscoverTime = Date.now();
        try {
            console.log('[Zernio] Comprobando perfiles y cuentas conectadas...');
            const accounts = await this.listAccounts();
            if (accounts && accounts.length > 0) {
                const updates = { lastChecked: Date.now() };

                for (const acc of accounts) {
                    const profId = acc.profileId?._id || acc.profileId;
                    const profName = (acc.profileId?.name || '').toLowerCase();

                    if (acc.platform === 'whatsapp') {
                        // Check if account belongs to Personal or COB
                        const isPersonal = profId === this.partnerProfileId || 
                                           profName.includes('personal') || 
                                           profName.includes('familia') || 
                                           profName.includes('compañera');

                        if (isPersonal) {
                            console.log(`[Zernio] WhatsApp Personal encontrado: ID ${acc._id} (${acc.username})`);
                            this.partnerAccountId = acc._id;
                            this.partnerPhoneNumber = acc.username;
                            this.partnerStatus = acc.isActive ? 'connected' : 'inactive';
                            updates.partnerAccountId = this.partnerAccountId;
                            updates.partnerPhoneNumber = this.partnerPhoneNumber;
                            updates.partnerStatus = this.partnerStatus;
                            updates.partnerProfileId = this.partnerProfileId;
                        } else {
                            console.log(`[Zernio] WhatsApp COB encontrado: ID ${acc._id} (${acc.username})`);
                            this.accountId = acc._id;
                            this.phoneNumber = acc.username;
                            this.status = acc.isActive ? 'connected' : 'inactive';
                            updates.accountId = this.accountId;
                            updates.phoneNumber = this.phoneNumber;
                            updates.status = this.status;
                            updates.profileId = this.profileId;
                        }
                    } else if (acc.platform === 'instagram') {
                        console.log(`[Zernio] Instagram COB encontrado: ID ${acc._id} (@${acc.username})`);
                        this.instagramAccountId = acc._id;
                        this.instagramUsername = acc.username;
                        this.instagramStatus = acc.isActive ? 'connected' : 'inactive';
                        updates.instagramAccountId = this.instagramAccountId;
                        updates.instagramUsername = this.instagramUsername;
                        updates.instagramStatus = this.instagramStatus;
                    }
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

    async createProfile(name = "Personal & Familia") {
        console.log(`[Zernio] Creando perfil: ${name}...`);
        const result = await this.apiRequest('/profiles', {
            method: 'POST',
            body: { name }
        });
        const profile = result?.profile;
        return profile;
    }

    async getConnectUrl(platform = 'whatsapp', redirectUrl, onboarding = 'business_app', workspace = 'cob') {
        let targetProfileId = (workspace === 'personal') ? this.partnerProfileId : this.profileId;
        
        if (!targetProfileId) {
            const newProfile = await this.createProfile(workspace === 'personal' ? 'Personal & Familia' : 'Consultorios Odontológicos Belgrano');
            targetProfileId = newProfile?._id;
            if (workspace === 'personal') {
                this.partnerProfileId = targetProfileId;
                await setDoc(doc(db, 'system', 'zernio_config'), { partnerProfileId: targetProfileId }, { merge: true });
            } else {
                this.profileId = targetProfileId;
                await setDoc(doc(db, 'system', 'zernio_config'), { profileId: targetProfileId }, { merge: true });
            }
        }

        const queryParams = new URLSearchParams({
            profileId: targetProfileId
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

    // Despachar mensaje saliente desde outbox respetando el workspace correspondiente
    async dispatchOutboxMessage(outboxData) {
        try {
            const text = outboxData.text;
            const target = outboxData.chatId; // Ej: "54911...@c.us" o "120363...@g.us" o "ig_username"
            const workspace = outboxData.workspaceId || 'cob';
            const isInstagram = outboxData.channel === 'instagram' || target.startsWith('ig_');

            let targetAccountId = null;
            if (isInstagram) {
                targetAccountId = this.instagramAccountId;
            } else if (workspace === 'personal') {
                targetAccountId = this.partnerAccountId || this.accountId;
            } else {
                targetAccountId = this.accountId;
            }

            if (!targetAccountId) {
                throw new Error(`Cuenta no disponible para despacho en espacio ${workspace}.`);
            }

            console.log(`[Zernio Dispatch] Despachando (${workspace.toUpperCase()}) a ${target}: "${text}"`);

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
                        zernioConversationId: conversationId,
                        workspaceId: workspace
                    }, { merge: true });
                }
            }

            // Registrar mensaje enviado en Firestore
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
                    isAudio: false,
                    workspaceId: workspace
                });
            } catch (fsErr) {
                console.warn('[Firestore Write Queued]', fsErr.message);
            }

            console.log(`[Zernio Dispatch] ¡Mensaje enviado con éxito! ID: ${msgId}`);
            return true;
        } catch (error) {
            console.error('[Zernio Dispatch] Error despachando mensaje:', error.message);
            throw error;
        }
    }

    startPeriodicSync() {
        if (this.syncInterval) return;
        console.log('[Zernio] Sincronización periódica multi-espacio activada (cada 60s)');

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

        // 1. Sincronizar WhatsApp Consultorio COB
        if (this.accountId) {
            await this.syncPlatformInbox(this.accountId, 'whatsapp', 'cob');
        }

        // 2. Sincronizar WhatsApp Personal & Compañera (Grupos escolares, familia, compras)
        if (this.partnerAccountId) {
            await this.syncPlatformInbox(this.partnerAccountId, 'whatsapp', 'personal');
        }

        // 3. Sincronizar Instagram Direct Consultorio COB
        if (this.instagramAccountId) {
            await this.syncPlatformInbox(this.instagramAccountId, 'instagram', 'cob');
        }
    }

    async syncPlatformInbox(accountId, platform, workspaceId = 'cob') {
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
                const isGroup = !!(conv.isGroup || (participant && participant.includes('@g.us')) || (conv.participantName && (
                    conv.participantName.toLowerCase().includes('colegio') ||
                    conv.participantName.toLowerCase().includes('grupo') ||
                    conv.participantName.toLowerCase().includes('padres') ||
                    conv.participantName.toLowerCase().includes('mamis') ||
                    conv.participantName.toLowerCase().includes('familia')
                )));

                const safeContactId = isIg ? `ig_${conv.participantUsername || participant}` : 
                                      isGroup ? (participant.includes('@g.us') ? participant : `${participant}@g.us`) : 
                                      `${participant.replace(/[^0-9]/g, '')}@c.us`;

                // Si la conversación no cambió, omitir escritura en Firestore
                if (convUpdated > lastSynced || !this.syncedConversations.has(convId)) {
                    await setDoc(doc(db, 'contacts', safeContactId), {
                        number: participant,
                        name: conv.participantName || (isIg ? `@${conv.participantUsername || participant}` : participant),
                        pushname: conv.participantName || null,
                        lastActivity: Math.floor((convUpdated || Date.now()) / 1000),
                        zernioConversationId: convId,
                        channel: isIg ? 'instagram' : 'whatsapp_cloud',
                        platform: platform,
                        workspaceId: workspaceId,
                        isGroup: isGroup
                    }, { merge: true });

                    this.syncedConversations.set(convId, convUpdated);
                }

                // Sincronizar mensajes si hay nuevos
                const msgRes = await this.apiRequest(`/inbox/conversations/${convId}/messages?accountId=${accountId}`);
                const messages = msgRes?.messages || msgRes?.data || [];

                for (const m of messages) {
                    if (this.knownMessageIds.has(m.id)) {
                        continue;
                    }

                    const isOutgoing = m.direction === 'outgoing';
                    const isAudio = m.attachments?.some(a => a.type === 'audio' || a.voiceNote) || false;
                    const mediaUrl = m.attachments?.[0]?.url || null;
                    const senderDisplayName = isOutgoing ? 'Tú' : (m.senderName || conv.participantName || participant);

                    await setDoc(doc(db, 'messages', m.id), {
                        id: m.id,
                        fromMe: isOutgoing,
                        author: safeContactId,
                        contactName: conv.participantName || participant,
                        senderName: senderDisplayName,
                        senderPhoneNumber: m.senderPhoneNumber || null,
                        body: m.message || (isAudio ? 'Nota de voz' : ''),
                        timestamp: Math.floor(new Date(m.createdAt || m.sentAt || Date.now()).getTime() / 1000),
                        type: isAudio ? 'audio' : 'chat',
                        hasMedia: !!mediaUrl,
                        isAudio: isAudio,
                        mediaUrl: mediaUrl,
                        channel: isIg ? 'instagram' : 'whatsapp_cloud',
                        platform: platform,
                        workspaceId: workspaceId,
                        isGroup: isGroup
                    }, { merge: true });

                    this.knownMessageIds.add(m.id);

                    // Si el mensaje es entrante en el espacio Personal (o de un grupo escolar / familiar), clasificar automáticamente
                    if (workspaceId === 'personal' && !isOutgoing && m.message) {
                        try {
                            await classifierService.processIncomingMessage({
                                messageId: m.id,
                                text: m.message,
                                senderName: senderDisplayName,
                                sourceName: conv.participantName || 'Grupo Personal',
                                chatId: safeContactId,
                                timestamp: Math.floor(new Date(m.createdAt || m.sentAt || Date.now()).getTime() / 1000),
                                workspaceId: 'personal'
                            });
                        } catch (classErr) {
                            console.warn('[SmartOrganizer Error]', classErr.message);
                        }
                    }
                }
            }
        } catch (err) {
            console.error(`[Zernio Sync ${platform} (${workspaceId})] Error:`, err.message);
        }
    }
}

const zernioService = new ZernioService();
module.exports = zernioService;
