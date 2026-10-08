const fs = require('fs');
const path = require('path');
const { db } = require('./firebase');
const { doc, setDoc, addDoc, getDocs, collection, query, orderBy, limit } = require('firebase/firestore');

const BACKUP_FILE = path.join(__dirname, 'banca_abeja_local_backup.json');
const SESSIONS_FILE = path.join(__dirname, 'banca_abeja_sessions.json');

// ==========================================
// PERSISTENCIA LOCAL DE RESPALDO (RESILIENCIA)
// ==========================================
function loadLocalTxs() {
    try {
        if (fs.existsSync(BACKUP_FILE)) {
            const data = fs.readFileSync(BACKUP_FILE, 'utf8');
            return JSON.parse(data) || [];
        }
    } catch(e) {}
    return [];
}

function saveLocalTx(tx) {
    try {
        const txs = loadLocalTxs();
        txs.unshift(tx);
        fs.writeFileSync(BACKUP_FILE, JSON.stringify(txs.slice(0, 500), null, 2), 'utf8');
    } catch(e) {}
}

function loadSessions() {
    try {
        if (fs.existsSync(SESSIONS_FILE)) {
            const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
            return JSON.parse(data) || {};
        }
    } catch(e) {}
    return {};
}

function saveSessions(sessionsObj) {
    try {
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessionsObj, null, 2), 'utf8');
    } catch(e) {}
}

// Carga y sincronización dinámica de miembros de Banca Abeja (Firestore banca_abeja_members)
let membersCache = [];
let lastMembersFetch = 0;

async function getRegisteredMembers() {
    if (Date.now() - lastMembersFetch < 20000 && membersCache.length > 0) {
        return membersCache;
    }
    try {
        const snap = await Promise.race([
            getDocs(collection(db, 'banca_abeja_members')),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
        ]);
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        if (list.length > 0) {
            membersCache = list;
            lastMembersFetch = Date.now();
            return list;
        }
    } catch(e) {}

    // Fallback con miembros conocidos de la colmena
    if (membersCache.length === 0) {
        membersCache = [
            { id: 'ramiro', name: 'Ramiro', phone: '+54 9 11 2745-2476', cleanPhone: '5491127452476' },
            { id: 'agustina', name: 'Agustina', phone: '+54 9 11 2649-5598', cleanPhone: '5491126495598' },
            { id: 'cristian', name: 'Cristian', phone: '+54 9 11 4974-8673', cleanPhone: '5491149748673' }
        ];
    }
    return membersCache;
}

// ==========================================
// PARSER DE GASTOS COLOQUIALES PARA WHATSAPP
// ==========================================
function parseWhatsAppExpenses(rawText, defaultSenderName, defaultMemberId = 'amigo') {
    if (!rawText || !rawText.trim()) return [];
    let text = rawText.trim().replace(/^(#abeja|banca abeja|abeja|\/gasto)\s*/i, '');
    if (!text.trim()) return [];

    // Descartar si el texto parece base64 (thumbnails de mapas/fotos) o es anormalmente largo
    if (text.length > 250) return [];
    if (text.startsWith('/j/') || text.startsWith('/9j/') || text.startsWith('data:') || /^[\w+/=]{50,}$/.test(text.replace(/\s+/g, ''))) {
        return [];
    }

    const parseAmount = (str) => {
        if (!str) return 0;
        let s = str.trim().toLowerCase();
        let multiplier = 1;
        if (s.includes('mil') || s.endsWith('k')) {
            multiplier = 1000;
            s = s.replace(/mil/gi, '').replace(/k/gi, '').trim();
        }
        if (/\d+\.\d{3}/.test(s)) {
            s = s.replace(/\./g, '');
        } else if (/\d+,\d{3}/.test(s)) {
            s = s.replace(/,/g, '');
        } else {
            s = s.replace(',', '.');
        }
        const cleanDigits = s.replace(/[^\d.]/g, '');
        const num = parseFloat(cleanDigits);
        return isNaN(num) ? 0 : num * multiplier;
    };

    const splitRegex = /(?:\r?\n+|;\s*|,\s*(?=[a-zñáéíóú\s]*\d)|\s+y\s+(?:en\s+|puse\s+|gast[eé]\s+|para\s+|de\s+)?|\s+adem[aá]s\s+|\s+tambi[eé]n\s+)/i;
    let rawClauses = text.split(splitRegex).map(c => c.trim()).filter(Boolean);

    if (rawClauses.length <= 1 && /\s+y\s+/i.test(text)) {
        rawClauses = text.split(/\s+y\s+/i).map(c => c.trim()).filter(Boolean);
    }

    const parsedItems = [];

    rawClauses.forEach((clause) => {
        const numberRegex = /(\d+(?:[.,]\d{3})*(?:[.,]\d+)?\s*(?:mil|k)?)/i;
        const numMatch = clause.match(numberRegex);

        if (numMatch) {
            const rawNumStr = numMatch[0];
            const amount = parseAmount(rawNumStr);

            if (amount > 0) {
                const lowerClause = clause.toLowerCase();

                let currency = 'ARS';
                if (lowerClause.includes('usd') || lowerClause.includes('dolar') || lowerClause.includes('dólar') || lowerClause.includes('u$s')) {
                    currency = 'USD';
                } else if (lowerClause.includes('abeja') || lowerClause.includes('hora') || lowerClause.includes('semilla')) {
                    currency = 'ABEJA';
                }

                let scope = 'comunitario';
                if (lowerClause.includes('personal') || lowerClause.includes('propio') || lowerClause.includes('mío') || lowerClause.includes('mio') || lowerClause.includes('mía')) {
                    scope = 'individual';
                }

                let category = 'Gastos Generales';
                if (/\bclio\b/i.test(lowerClause)) {
                    category = 'Movilidad (Clio)';
                } else if (/\betios\b/i.test(lowerClause)) {
                    category = 'Movilidad (Etios)';
                } else if (/nafta|combustible|\bauto\b|gasoil|peaje|estacionamiento|remis|uber|cabify|taxi|colectivo|sube|gnc|taller|mec[aá]nic/i.test(lowerClause)) {
                    category = 'Movilidad';
                } else if (/ferreter[ií]a|bomba|herramienta|huerta|tierra|obra|plomer|electric|pintur|limpieza|lavandina|jab[oó]n|gasista|mantenimiento/i.test(lowerClause)) {
                    category = 'Hábitat & Mantenimiento';
                } else if (/\bluz\b|\bgas\b|\binternet\b|\bstarlink\b|\bagua\b|\bseguro\b|edenor|metrogas|aysa|fibertel|personal|claro|movistar|abl|arba|expensas/i.test(lowerClause)) {
                    category = 'Servicios';
                } else if (/alimento|verdu|frut|comida|arepa|s[uú]per|carn|pollo|panader|diet[eé]tica|\bpan\b|\bleche\b|\bhuevo|almac[eé]n|mercado|queso/i.test(lowerClause)) {
                    category = 'Despensa & Alimentos';
                }

                let concept = clause
                    .replace(rawNumStr, '')
                    .replace(/^(#abeja|banca abeja|abeja|\/gasto)\s+/i, '')
                    .replace(/\b(gast[eéóo]|gasto|puse|pongo|compr[eéóo]|compro|pagu[eé]|pag[oó])\b\s*(?:en|para|de)?\s*/gi, '')
                    .replace(/^(para|en|de|con)\s+/i, '')
                    .replace(/\s+(con|para|en|de)$/i, '')
                    .replace(/\s*(usd|dolares|dólares|u\$s|pesos|abejas|horas)\s*/gi, '')
                    .trim();

                if (!concept || concept.length < 2) {
                    concept = category;
                }

                concept = concept.charAt(0).toUpperCase() + concept.slice(1);

                parsedItems.push({
                    concept,
                    scope,
                    category,
                    currency,
                    amount,
                    memberId: defaultMemberId,
                    memberName: defaultSenderName
                });
            }
        }
    });

    return parsedItems;
}

// ==========================================
// SERVICIO DEL BOT DE BANCA ABEJA
// ==========================================
class BancaAbejaBotService {

    // Gestión de Sesiones Activas en chats privados
    isSessionActive(chatId) {
        if (!chatId) return false;
        const sessions = loadSessions();
        const sess = sessions[chatId];
        return !!(sess && sess.expiresAt > Date.now());
    }

    activateSession(chatId, senderName, durationHours = 2) {
        const sessions = loadSessions();
        sessions[chatId] = {
            activatedAt: Date.now(),
            expiresAt: Date.now() + durationHours * 60 * 60 * 1000,
            activatedBy: senderName
        };
        saveSessions(sessions);
    }

    deactivateSession(chatId) {
        const sessions = loadSessions();
        delete sessions[chatId];
        saveSessions(sessions);
    }

    // Evaluación Inteligente de Disparadores (Triggers)
    checkTrigger({ text, chatName, chatId, senderName, memberId, isKnownMember, isCommunityChat, isSelfChat, isTargetMember, isDirectBotChat }) {
        if (!text) return null;
        // Evitar que el bot reaccione a sus propios mensajes de confirmación o reportes
        if (text.startsWith('🐝') || text.startsWith('📊') || text.startsWith('⚠️')) return null;

        // Descartar si el texto parece base64 (thumbnails de mapas/fotos) o es anormalmente largo
        if (text.length > 250) return null;
        if (text.startsWith('/j/') || text.startsWith('/9j/') || text.startsWith('data:') || /^[\w+/=]{50,}$/.test(text.replace(/\s+/g, ''))) {
            return null;
        }

        const lower = text.toLowerCase().trim();
        const lowerChat = (chatName || '').toLowerCase();

        // 1. Comandos de Activación / Desactivación / Ayuda (funcionan en cualquier chat)
        if (/^\/(activar|iniciar|on)\b/i.test(lower) || lower === 'activar' || lower === 'activar abeja' || lower === 'iniciar abeja' || lower === 'banca abeja on') {
            return 'ACTIVATE';
        }
        if (/^\/(desactivar|pausar|off|salir)\b/i.test(lower) || lower === 'desactivar' || lower === 'pausar' || lower === 'salir' || lower === 'banca abeja off') {
            return 'DEACTIVATE';
        }
        if (/^\/(ayuda|help)\b/i.test(lower) || lower === 'ayuda' || lower === 'banca abeja') {
            return 'HELP';
        }

        // 2. Comandos directos o prefijos explícitos (funcionan en cualquier chat sin sesión previa)
        if (lower.startsWith('#abeja') || lower.startsWith('/gasto') || lower.startsWith('abeja ') || lower.startsWith('banca abeja ')) {
            return 'DIRECT_EXPENSE';
        }
        if (/^\/(saldo|cuentas|balance)\b/i.test(lower)) {
            return 'BALANCE';
        }

        // 3. Sesión Activa en este chat (habilitada previamente con /activar)
        const isSession = this.isSessionActive(chatId);

        // 4. Ámbitos autorizados para interpretación natural sin comando explícito:
        // - Grupos comunitarios (banca, colmena, gastos, etc.)
        // - Sesión activa durante 2 horas en el chat
        // - Chat de notas personales de Ramiro consigo mismo (self chat)
        // - Chat directo de un miembro (Agustina, Cristian) con el bot
        // - Chat directo entre Ramiro y otro miembro de la colmena
        const isAuthorizedContext = isCommunityChat || isSession || isSelfChat || isDirectBotChat || isTargetMember;

        // Si NO es un ámbito autorizado (ej: chat personal con un amigo, paciente o grupo externo),
        // el bot NUNCA interfiere en la conversación a menos que se use un comando explícito (#abeja, /activar).
        if (isAuthorizedContext) {
            if (/^(saldo|saldos|cuentas|resumen|\?cu[aá]nto debemos|\?c[oó]mo estamos|como estamos|cómo estamos)/i.test(lower)) {
                return 'BALANCE';
            }

            const verbWithAmount = /^(gast[eéóo]|gasto|puse|pongo|compr[eéóo]|compro|pagu[eé]|pag[oó])\b.*?\d+/i.test(lower);
            const amountWithConcept = /^\$?\d+[\d.,]*\s*(k|mil)?\s*(?:en|para|de|con\s+)?\b/i.test(lower);
            const generalExpense = (
                lower.includes('gaste') || lower.includes('gasté') || lower.includes('gasto') || lower.includes('gastó') ||
                lower.includes('puse') || lower.includes('pongo') ||
                lower.includes('pagué') || lower.includes('pague') || lower.includes('pago') || lower.includes('pagó') ||
                lower.includes('compré') || lower.includes('compre') || lower.includes('compro') || lower.includes('compró')
            ) && /\d+/.test(lower);

            // Reconocimiento de monto + rubro directo (ej: "25000 verduleria" o "30000 nafta")
            // Usamos \bgas\b para evitar falsos positivos con palabras que contengan "gas"
            const hasAmountAndCategory = /\d+/.test(lower) && /verdu|frut|carn|pollo|panader|alimento|comida|super|súper|nafta|clio|etios|ferreter|internet|luz|\bgas\b/i.test(lower);

            if (verbWithAmount || amountWithConcept || generalExpense || hasAmountAndCategory) {
                return 'EXPENSE';
            }
        }

        return null;
    }

    isBancaAbejaTrigger(text, chatName = '', chatId = null, senderName = '') {
        const allIdentifiers = [senderName, chatId].filter(Boolean).map(s => String(s).toLowerCase()).join(' ');
        const isKnownMember = (membersCache || []).some(m => {
            const cPhone = (m.cleanPhone || m.phone || '').replace(/\D/g, '');
            if (cPhone && cPhone.length >= 8 && allIdentifiers.includes(cPhone.slice(-8))) return true;
            const mName = (m.name || '').toLowerCase().trim();
            if (mName && mName.length >= 3 && allIdentifiers.includes(mName)) return true;
            return false;
        }) || allIdentifiers.includes('agustina') || allIdentifiers.includes('cristian') || allIdentifiers.includes('ramiro');
        const isCommunityChat = (chatName || '').toLowerCase().match(/banca|abeja|colmena|gastos/);
        return !!this.checkTrigger({ 
            text, 
            chatName, 
            chatId, 
            senderName, 
            isKnownMember, 
            isCommunityChat, 
            isSelfChat: false, 
            isTargetMember: false, 
            isDirectBotChat: isKnownMember 
        });
    }

    async processMessage(msg, client) {
        if (!msg) return;

        // 1. Filtrar tipos de mensajes que no son texto directo
        if (msg.type && msg.type !== 'chat') {
            // Si es imagen/video/documento, solo procesar si el usuario le puso caption/texto
            if ((msg.type === 'image' || msg.type === 'video' || msg.type === 'document') && msg.caption) {
                // ok, procesar caption
            } else {
                // Ubicaciones ('location'), stickers, llamadas, audio no transcripto, etc. se ignoran
                return;
            }
        }

        const rawText = msg.caption || msg.body;
        if (!rawText || typeof rawText !== 'string') return;
        const text = rawText.trim();
        if (!text) return;

        // 2. Descartar base64 y mensajes gigantes
        if (text.length > 250) return;
        if (text.startsWith('/j/') || text.startsWith('/9j/') || text.startsWith('data:') || /^[\w+/=]{50,}$/.test(text.replace(/\s+/g, ''))) {
            return;
        }

        // Chat de destino para la respuesta (si es fromMe, responder a msg.to)
        const chatJid = msg.fromMe ? (msg.to || msg.from) : msg.from;

        let chatName = 'Directo';
        try {
            const chat = await msg.getChat();
            chatName = chat?.name || chat?.formattedTitle || (chatJid.includes('@g.us') ? 'Grupo' : 'Directo');
        } catch(e) {}

        const lowerChat = (chatName || '').toLowerCase();
        const isGroup = !!(chatJid && chatJid.includes('@g.us'));

        // Cargar miembros registrados
        const registeredMembers = await getRegisteredMembers();
        let senderName = 'Amigo';
        let memberId = 'amigo';
        let isKnownMember = false;

        if (msg.fromMe) {
            senderName = 'Ramiro';
            memberId = 'ramiro';
            isKnownMember = true;
            const ramiroMem = registeredMembers.find(m => m.id === 'ramiro');
            if (ramiroMem) senderName = ramiroMem.name;
        } else {
            const senderJid = msg.author || msg.from || '';
            const senderNumber = senderJid ? senderJid.split('@')[0] : '';

            try {
                let contact = null;
                if (client && typeof client.getContactById === 'function') {
                    try { contact = await client.getContactById(senderJid); } catch(e) {}
                }
                if (!contact && typeof msg.getContact === 'function') {
                    try { contact = await msg.getContact(); } catch(e) {}
                }
                const notifyName = (msg._data && msg._data.notifyName) || null;
                senderName = contact?.name || contact?.pushname || notifyName || senderNumber;

                const allIdentifiers = [
                    senderJid,
                    senderNumber,
                    senderName,
                    msg.from,
                    msg.author,
                    contact?.number,
                    contact?.name,
                    contact?.pushname,
                    notifyName
                ].filter(Boolean).map(s => String(s).toLowerCase()).join(' ');

                // 🔍 Búsqueda dinámica en los miembros dados de alta
                const matched = registeredMembers.find(m => {
                    const cPhone = (m.cleanPhone || m.phone || '').replace(/\D/g, '');
                    if (cPhone && cPhone.length >= 8) {
                        const last8 = cPhone.slice(-8);
                        if (allIdentifiers.includes(last8)) return true;
                    }
                    const mName = (m.name || '').toLowerCase().trim();
                    if (mName && mName.length >= 3 && allIdentifiers.includes(mName)) return true;
                    return false;
                });

                if (matched) {
                    senderName = matched.name;
                    memberId = matched.id;
                    isKnownMember = true;
                } else if (allIdentifiers.includes('agustina') || allIdentifiers.includes('sol solar') || allIdentifiers.includes('26495598')) {
                    senderName = 'Agustina';
                    memberId = 'agustina';
                    isKnownMember = true;
                } else if (allIdentifiers.includes('cristian') || allIdentifiers.includes('cris') || allIdentifiers.includes('ferreyra') || allIdentifiers.includes('49748673310966')) {
                    senderName = 'Cristian';
                    memberId = 'cristian';
                    isKnownMember = true;
                } else if (allIdentifiers.includes('ramiro') || allIdentifiers.includes('rami') || allIdentifiers.includes('27452476')) {
                    senderName = 'Ramiro';
                    memberId = 'ramiro';
                    isKnownMember = true;
                } else {
                    memberId = senderName.toLowerCase().replace(/[^a-z0-9]/g, '_');
                }
            } catch(e) {}
        }

        // Determinar tipo de contexto del chat
        const isCommunityChat = isGroup && (
            lowerChat.includes('banca') || lowerChat.includes('abeja') || 
            lowerChat.includes('colmena') || lowerChat.includes('gastos')
        );

        // Chat de Ramiro consigo mismo (Note to self / Mensajes guardados)
        const isSelfChat = msg.fromMe && (
            chatJid.includes('27452476') || 
            chatJid === msg.from || 
            (msg.to && msg.from && msg.to.split('@')[0] === msg.from.split('@')[0])
        );

        // Chat directo de un miembro hacia el bot
        const isDirectBotChat = !msg.fromMe && !isGroup && isKnownMember;

        // Chat directo de Ramiro hacia otro miembro de la colmena
        const isTargetMember = msg.fromMe && !isGroup && registeredMembers.some(m => {
            if (m.id === 'ramiro') return false;
            const cPhone = (m.cleanPhone || m.phone || '').replace(/\D/g, '');
            return cPhone && cPhone.length >= 8 && chatJid.includes(cPhone.slice(-8));
        });

        const trigger = this.checkTrigger({
            text,
            chatName,
            chatId: chatJid,
            senderName,
            memberId,
            isKnownMember,
            isCommunityChat,
            isSelfChat,
            isTargetMember,
            isDirectBotChat
        });

        if (!trigger) {
            return;
        }

        console.log(`[Banca Abeja Bot] 🐝 Disparador [${trigger}] en [${chatName}] de [${senderName}] (fromMe: ${!!msg.fromMe}): "${text}"`);

        // Caso A: Activar Sesión
        if (trigger === 'ACTIVATE') {
            this.activateSession(chatJid, senderName, 2);
            const activateMsg = `🐝 *¡Modo Banca Abeja ACTIVADO!*
Este chat quedó habilitado durante *2 horas* para registrar gastos y consultar saldos.

• *Para cargar gastos:* Escribí o mandá notas de voz libremente:
  _"Gasté 100.000"_
  _"30.000 en alimentos y 15.000 de nafta con el clio"_
• *Para consultar saldos:* _saldo_ o _cuentas_
• *Para pausar:* _/desactivar_ o _/pausar_

🌐 Panel en vivo: https://bancaabeja.org`;
            await client.sendMessage(chatJid, activateMsg);
            return;
        }

        // Caso B: Desactivar Sesión
        if (trigger === 'DEACTIVATE') {
            this.deactivateSession(chatJid);
            const pauseMsg = `🐝 *Modo Banca Abeja PAUSADO.*
El chat vuelve a su modo personal habitual. Podés reactivarlo en cualquier momento escribiendo */activar* o anteponiendo *#abeja* a tu gasto.`;
            await client.sendMessage(chatJid, pauseMsg);
            return;
        }

        // Caso C: Ayuda
        if (trigger === 'HELP') {
            const helpMsg = `🐝 *¡Hola! Soy el Bot de Banca Abeja.*

• *Comandos principales:*
  • */activar* : Abre una sesión de 2 horas para registrar gastos libremente en este chat.
  • */pausar* : Pausa el bot en este chat.
  • *saldo* o *cuentas* : Consulta el estado de las cuentas y aportes.
• *Cargar gastos directos:*
  • Podés mandar notas de voz 🎙️
  • O escribir: _"Gasté 30.000 en alimentos y 15.000 de nafta con el clio"_
  • O con prefijo rápido: _"#abeja gasté 100.000"_

🌐 Panel y balances en vivo: https://bancaabeja.org`;
            await client.sendMessage(chatJid, helpMsg);
            return;
        }

        // Caso D: Balance
        if (trigger === 'BALANCE') {
            await this.handleBalanceQuery(chatJid, client);
            return;
        }

        // Caso E: Registro de Gastos (Directo o en Sesión)
        if (trigger === 'EXPENSE' || trigger === 'DIRECT_EXPENSE') {
            const parsedItems = parseWhatsAppExpenses(text, senderName, memberId);
            if (parsedItems.length > 0) {
                const isSession = this.isSessionActive(chatJid);
                await this.handleRegisterExpenses(chatJid, client, parsedItems, senderName, memberId, false, isSession);
            }
        }
    }

    // Procesa texto recibido (vía mensaje normal o por transcripción de audio Whisper)
    async processDirect({ text, senderName = 'Amigo', memberId = 'amigo', chatId, client, chatName = '', isAudio = false }) {
        if (!text || !chatId || !client) return;

        const registeredMembers = await getRegisteredMembers();
        let resolvedMemberId = memberId;
        const allIdentifiers = [senderName, chatId, memberId].filter(Boolean).map(s => String(s).toLowerCase()).join(' ');
        let isKnownMember = false;

        const matched = registeredMembers.find(m => {
            const cPhone = (m.cleanPhone || m.phone || '').replace(/\D/g, '');
            if (cPhone && cPhone.length >= 8) {
                const last8 = cPhone.slice(-8);
                if (allIdentifiers.includes(last8)) return true;
            }
            const mName = (m.name || '').toLowerCase().trim();
            if (mName && mName.length >= 3 && allIdentifiers.includes(mName)) return true;
            return false;
        });

        if (matched) {
            senderName = matched.name;
            resolvedMemberId = matched.id;
            isKnownMember = true;
        } else if (allIdentifiers.includes('agustina') || allIdentifiers.includes('sol solar') || allIdentifiers.includes('26495598')) {
            senderName = 'Agustina';
            resolvedMemberId = 'agustina';
            isKnownMember = true;
        } else if (allIdentifiers.includes('cristian') || allIdentifiers.includes('cris') || allIdentifiers.includes('ferreyra') || allIdentifiers.includes('49748673310966')) {
            senderName = 'Cristian';
            resolvedMemberId = 'cristian';
            isKnownMember = true;
        } else if (allIdentifiers.includes('ramiro') || allIdentifiers.includes('rami') || allIdentifiers.includes('27452476')) {
            senderName = 'Ramiro';
            resolvedMemberId = 'ramiro';
            isKnownMember = true;
        }

        const trigger = this.checkTrigger({
            text,
            chatName,
            chatId,
            senderName,
            memberId: resolvedMemberId,
            isKnownMember
        });

        if (!trigger) return;

        if (trigger === 'BALANCE') {
            await this.handleBalanceQuery(chatId, client);
            return;
        }

        const parsedItems = parseWhatsAppExpenses(text, senderName, memberId);
        if (parsedItems.length > 0) {
            const isSession = this.isSessionActive(chatId);
            await this.handleRegisterExpenses(chatId, client, parsedItems, senderName, memberId, isAudio, isSession);
        }
    }

    // Guardar gastos y responder confirmación
    async handleRegisterExpenses(chatId, client, parsedItems, senderName, memberId, isAudio = false, hasSession = true) {
        try {
            const now = new Date();
            const dateStr = now.toLocaleDateString('es-AR');
            let totalSum = 0;
            const currency = parsedItems[0].currency || 'ARS';
            const currSymbol = currency === 'USD' ? 'US$' : currency === 'ABEJA' ? '🐝' : '$';

            const summaryLines = [];

            for (const item of parsedItems) {
                totalSum += item.amount;
                summaryLines.push(`• *${item.concept}:* ${currSymbol}${item.amount.toLocaleString('es-AR')} _(${item.category})_`);

                const txRecord = {
                    date: dateStr,
                    memberId: item.memberId || memberId || senderName.toLowerCase(),
                    memberName: senderName,
                    concept: item.concept,
                    category: item.category,
                    currency: item.currency,
                    amount: item.amount,
                    scope: item.scope,
                    channel: isAudio ? 'whatsapp_audio' : 'whatsapp',
                    timestamp: Date.now()
                };

                // 1. Guardar en respaldo local seguro
                saveLocalTx(txRecord);

                // 2. Guardar en Firestore colección compartida en background (sin bloquear respuesta WhatsApp)
                addDoc(collection(db, 'banca_abeja_transactions'), txRecord).catch((firestoreErr) => {
                    if (firestoreErr.code !== 'resource-exhausted') {
                        console.warn('[Banca Abeja Bot] Aviso Firestore:', firestoreErr.message);
                    }
                });
            }

            let tipMsg = '';
            if (!hasSession && !chatId.includes('@g.us')) {
                tipMsg = `\n_(Tip: Podés mandar */activar* para abrir una sesión continua de 2 horas sin escribir comandos)_`;
            }

            const replyMessage = `🐝 *¡Anotado en Banca Abeja!*${isAudio ? ' 🎙️ (Nota de voz)' : ''}
${summaryLines.join('\n')}

💰 *Total:* ${currSymbol}${totalSum.toLocaleString('es-AR')} (Pagó ${senderName})
📊 Actualizado en tiempo real en: https://bancaabeja.org${tipMsg}`;

            await client.sendMessage(chatId, replyMessage);
            console.log(`[Banca Abeja Bot] ✓ ${parsedItems.length} gastos guardados y confirmados a ${senderName} en [${chatId}].`);
        } catch (err) {
            console.error('[Banca Abeja Bot] Error registrando gastos:', err.message);
            await client.sendMessage(chatId, `⚠️ Hubo un error guardando el gasto en Banca Abeja: ${err.message}`);
        }
    }

    // Consultar balances y responder
    async handleBalanceQuery(chatId, client) {
        try {
            const txs = [];
            try {
                const firestoreTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000));
                const snap = await Promise.race([
                    getDocs(collection(db, 'banca_abeja_transactions')),
                    firestoreTimeout
                ]);
                snap.forEach(d => txs.push(d.data()));
            } catch(e) {
                console.warn('[Banca Abeja Bot] Leyendo saldos desde respaldo local:', e.message);
            }

            // Combinar con respaldo local para deduplicar
            const localTxs = loadLocalTxs();
            localTxs.forEach(lt => {
                if (!txs.some(t => t.timestamp === lt.timestamp && t.amount === lt.amount)) {
                    txs.push(lt);
                }
            });

            if (txs.length === 0) {
                await client.sendMessage(chatId, `🐝 *Banca Abeja - Estado de la Colmena*
Aún no hay movimientos registrados este período.
Podés cargar el primero diciendo por ejemplo: _"Gasté 25.000 en verdura"_`);
                return;
            }

            let totalComunitarioARS = 0;
            const userPaidARS = {};

            let totalComunitarioUSD = 0;
            let totalComunitarioABEJA = 0;

            txs.forEach(t => {
                const curr = t.currency || 'ARS';
                const member = t.memberName || t.memberId || 'Amigo';
                if (curr === 'ARS') {
                    if (!userPaidARS[member]) userPaidARS[member] = 0;
                    if (t.scope === 'comunitario') {
                        totalComunitarioARS += t.amount;
                        userPaidARS[member] += t.amount;
                    }
                } else if (curr === 'USD' && t.scope === 'comunitario') {
                    totalComunitarioUSD += t.amount;
                } else if (curr === 'ABEJA' && t.scope === 'comunitario') {
                    totalComunitarioABEJA += t.amount;
                }
            });

            const membersList = Object.keys(userPaidARS);
            const memberCount = Math.max(membersList.length, 1);
            const fairShare = totalComunitarioARS / memberCount;

            const balances = membersList.map(m => {
                const net = userPaidARS[m] - fairShare;
                const sign = net >= 0 ? '+' : '-';
                return `• *${m}:* Aportó $${userPaidARS[m].toLocaleString('es-AR')} (${net >= 0 ? '🟢 A favor' : '🔴 Debe reponer'} ${sign}$${Math.abs(Math.round(net)).toLocaleString('es-AR')})`;
            });

            let otherCurrencies = '';
            if (totalComunitarioUSD > 0 || totalComunitarioABEJA > 0) {
                otherCurrencies = `\n*Otras monedas en curso:*\n` +
                    (totalComunitarioUSD > 0 ? `• Dólares: US$${totalComunitarioUSD.toLocaleString('es-AR')}\n` : '') +
                    (totalComunitarioABEJA > 0 ? `• Abejas (Horas de labor): 🐝 ${totalComunitarioABEJA}\n` : '');
            }

            const reply = `📊 *Estado de la Colmena (Banca Abeja - Pesos):*
• *Total Comunitario:* $${totalComunitarioARS.toLocaleString('es-AR')}
• *Aporte equitativo p/persona:* ~$${Math.round(fairShare).toLocaleString('es-AR')}

*Saldos por miembro:*
${balances.length > 0 ? balances.join('\n') : '• Sin aportes en ARS registrados'}
${otherCurrencies}
👉 Panel y desglose completo en vivo: https://bancaabeja.org`;

            await client.sendMessage(chatId, reply);
            console.log('[Banca Abeja Bot] ✓ Balance enviado por WhatsApp.');
        } catch (err) {
            console.error('[Banca Abeja Bot] Error consultando saldos:', err.message);
            await client.sendMessage(chatId, `⚠️ Error consultando saldos: ${err.message}`);
        }
    }
}

module.exports = new BancaAbejaBotService();
