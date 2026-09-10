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
        this.isInitialized = false;
        this.syncInterval = null;
    }

    async init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        console.log('[Zernio] Inicializando servicio...');

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

                console.log(`[Zernio] Configuración actualizada: status=${this.status}, accountId=${this.accountId ? this.accountId.substring(0, 8) + '...' : 'ninguno'}`);

                if (this.apiKey && (!this.profileId || !this.accountId || keyChanged)) {
                    await this.autoDiscover();
                }

                if (this.apiKey && this.accountId) {
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
                if (whatsappAcc) {
                    console.log(`[Zernio] ¡Cuenta de WhatsApp encontrada! ID: ${whatsappAcc._id}, Número: ${whatsappAcc.username}`);
                    this.accountId = whatsappAcc._id;
                    this.phoneNumber = whatsappAcc.username;
                    this.status = whatsappAcc.isActive ? 'connected' : 'inactive';

                    await setDoc(doc(db, 'system', 'zernio_config'), {
                        accountId: this.accountId,
                        phoneNumber: this.phoneNumber,
                        status: this.status,
                        platform: 'whatsapp',
                        lastChecked: Date.now()
                    }, { merge: true });
                }
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

    // Step 2: Crear perfil en Zernio
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

    // Step 3: Obtener URL de conexión para WhatsApp (Meta Embedded Signup)
    async getConnectUrl(redirectUrl, onboarding = 'business_app') {
        if (!this.profileId) {
            // Si no tiene perfil aún, lo crea automáticamente
            await this.createProfile();
        }

        console.log(`[Zernio] Solicitando URL de conexión para WhatsApp (profileId=${this.profileId}, onboarding=${onboarding})...`);
        const queryParams = new URLSearchParams({
            profileId: this.profileId,
            onboarding
        });
        if (redirectUrl) {
            queryParams.append('redirect_url', redirectUrl);
        }

        const result = await this.apiRequest(`/connect/whatsapp?${queryParams.toString()}`);
        return result; // { authUrl: "...", state: "..." }
    }

    // Step 4: Listar cuentas conectadas
    async listAccounts() {
        const result = await this.apiRequest('/accounts');
        return result?.accounts || [];
    }

    // Step 5: Enviar mensaje de WhatsApp
    async sendMessage(conversationId, text, options = {}) {
        if (!this.accountId) {
            throw new Error('No hay cuenta de WhatsApp conectada en Zernio.');
        }

        console.log(`[Zernio] Enviando mensaje a conversación ${conversationId}...`);
        const payload = {
            accountId: this.accountId,
            message: text,
            ...options
        };

        const result = await this.apiRequest(`/inbox/conversations/${conversationId}/messages`, {
            method: 'POST',
            body: payload
        });
        return result;
    }

    // Iniciar nueva conversación por número de teléfono
    async createConversation(participantId, options = {}) {
        if (!this.accountId) {
            throw new Error('No hay cuenta de WhatsApp conectada en Zernio.');
        }

        // Formato número: dígitos sin + ni espacios
        const cleanPhone = participantId.replace(/[^0-9]/g, '');
        console.log(`[Zernio] Creando conversación para número ${cleanPhone}...`);

        const payload = {
            accountId: this.accountId,
            participantId: cleanPhone,
            ...options
        };

        const result = await this.apiRequest('/inbox/conversations', {
            method: 'POST',
            body: payload
        });
        return result;
    }

    // Listar conversaciones del Inbox de Zernio
    async listConversations() {
        if (!this.accountId) return [];
        const result = await this.apiRequest(`/inbox/conversations?accountId=${this.accountId}`);
        return result?.conversations || result?.data || [];
    }

    // Obtener mensajes de una conversación
    async getConversationMessages(conversationId) {
        const result = await this.apiRequest(`/inbox/conversations/${conversationId}/messages`);
        return result?.messages || result?.data || [];
    }

    // Despachar mensaje saliente desde outbox
    async dispatchOutboxMessage(outboxData) {
        try {
            const text = outboxData.text;
            const target = outboxData.chatId; // Ej: "54911...@c.us" o número
            const cleanPhone = target.split('@')[0].replace(/[^0-9]/g, '');

            console.log(`[Zernio Dispatch] Despachando a ${cleanPhone}: "${text}"`);

            // Buscar si ya tenemos un conversationId guardado para este contacto
            let conversationId = null;
            const contactSnap = await getDoc(doc(db, 'contacts', target));
            if (contactSnap.exists() && contactSnap.data().zernioConversationId) {
                conversationId = contactSnap.data().zernioConversationId;
            }

            let sendResult;
            if (conversationId) {
                try {
                    sendResult = await this.sendMessage(conversationId, text);
                } catch (sendErr) {
                    console.warn(`[Zernio Dispatch] Envío directo a ${conversationId} falló (${sendErr.message}), intentando createConversation...`);
                    conversationId = null;
                }
            }

            if (!conversationId) {
                // Iniciar o recuperar conversación por teléfono
                const convResult = await this.createConversation(cleanPhone, { message: text });
                conversationId = convResult?.data?.conversationId || convResult?.conversationId;
                sendResult = convResult;

                if (conversationId) {
                    await setDoc(doc(db, 'contacts', target), {
                        zernioConversationId: conversationId
                    }, { merge: true });
                }
            }

            // Registrar mensaje enviado en Firestore
            const msgId = sendResult?.data?.messageId || `zernio_${Date.now()}`;
            await setDoc(doc(db, 'messages', msgId), {
                id: msgId,
                fromMe: true,
                author: target,
                contactName: target,
                senderName: "Tú (Zernio)",
                body: text,
                timestamp: Math.floor(Date.now() / 1000),
                type: 'chat',
                channel: 'zernio_whatsapp',
                hasMedia: false,
                isAudio: false
            });

            console.log(`[Zernio Dispatch] ¡Mensaje despachado con éxito! ID: ${msgId}`);
            return true;
        } catch (error) {
            console.error('[Zernio Dispatch] Error despachando mensaje:', error.message);
            throw error;
        }
    }

    // Sincronización periódica automática para mantener Firestore al día
    startPeriodicSync() {
        if (this.syncInterval) clearInterval(this.syncInterval);
        console.log('[Zernio] Sincronización periódica activada (cada 30s)');

        this.syncInterval = setInterval(async () => {
            try {
                await this.syncInboxToFirestore();
            } catch (err) {
                // Silencioso para no saturar logs
            }
        }, 30000);
    }

    async syncInboxToFirestore() {
        if (!this.apiKey || !this.accountId) return;

        const conversations = await this.listConversations();
        for (const conv of conversations) {
            const convId = conv._id || conv.id;
            const participant = conv.participantId || conv.phone || conv.username;
            if (!participant) continue;

            const safeContactId = `${participant.replace(/[^0-9]/g, '')}@c.us`;

            // Actualizar contacto
            await setDoc(doc(db, 'contacts', safeContactId), {
                number: participant,
                name: conv.participantName || conv.name || participant,
                lastActivity: Math.floor(new Date(conv.updatedAt || conv.lastMessageAt || Date.now()).getTime() / 1000),
                zernioConversationId: convId,
                channel: 'whatsapp'
            }, { merge: true });
        }
    }
}

const zernioService = new ZernioService();
module.exports = zernioService;
