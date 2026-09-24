const { db } = require('./firebase');
const { doc, setDoc, getDocs, collection, query, where, limit, onSnapshot } = require('firebase/firestore');

class ClassifierService {
    constructor() {
        // Categorías por defecto (templates iniciales)
        this.defaultCategories = {
            colegio: {
                id: 'colegio',
                label: 'Colegio & Niños',
                emoji: '🎒',
                color: '#3b82f6',
                keywords: [
                    'flauta', 'flauta dulce', 'tarea', 'deberes', 'cuaderno', 'cartulina', 'afiche',
                    'seño', 'seno', 'profe', 'grado', 'colegio', 'escuela', 'jardin', 'jardín',
                    'examen', 'prueba', 'evaluacion', 'evaluación', 'acto', 'uniforme', 'guardapolvo',
                    'cooperadora', 'materiales', 'útiles', 'utiles', 'plasticola', 'temperas', 'témperas',
                    'fotocopias', 'boletin', 'boletín', 'reunion de padres', 'reunión de padres',
                    'campamento', 'merienda', 'mochila', 'mapa', 'cartuchera', 'música', 'musica',
                    'educacion fisica', 'educación física', 'plástica', 'plastica', 'ingles', 'inglés'
                ]
            },
            cumpleanos: {
                id: 'cumpleanos',
                label: 'Cumpleaños & Festejos',
                emoji: '🎂',
                color: '#ec4899',
                keywords: [
                    'cumple', 'cumpleaños', 'cumpleanos', 'cumpleañitos', 'cumpleanitos',
                    'festejo', 'festejamos', 'festejar', 'pelotero', 'salon', 'salón',
                    'invitacion', 'invitación', 'regalo', 'regalito', 'vaquita', 'alias para el regalo',
                    'añitos', 'anitos', 'cumple de', 'souvenir', 'torta de cumple', 'festeja su cumple'
                ]
            },
            compras: {
                id: 'compras',
                label: 'Compras & Encargos',
                emoji: '🛒',
                color: '#10b981',
                keywords: [
                    'comprar', 'compremos', 'comprá', 'encargar', 'conseguir', 'farmacia',
                    'supermercado', 'super', 'coto', 'carrefour', 'dia%', 'verduleria', 'verdulería',
                    'carniceria', 'carnicería', 'panaderia', 'panadería', 'lista de compras',
                    'pedir delivery', 'pedidosya', 'rappi', 'pasar a buscar', 'encargo', 'paquete',
                    'remedio', 'leche', 'pañales', 'panales'
                ]
            },
            compromisos: {
                id: 'compromisos',
                label: 'Compromisos / Familia',
                emoji: '📅',
                color: '#f59e0b',
                keywords: [
                    'pediatra', 'medico', 'médico', 'dentista', 'turno', 'cita', 'control',
                    'asado', 'almuerzo familiar', 'cena familiar', 'visitar', 'abuela', 'abuelos',
                    'natacion', 'natación', 'futbol', 'fútbol', 'danza', 'gimnasia', 'partido',
                    'cumple de mamá', 'cumple de papá', 'aniversario', 'viaje', 'escapada'
                ]
            }
        };

        // Cache en memoria por workspaceId: { [workspaceId]: { [catId]: catData } }
        this.workspaceCategories = {};
        // Cache en memoria de reglas por chat: { [chatId]: { excluded, forcedCategory, allowedCategories } }
        this.chatRules = {};

        this.initListeners();
    }

    initListeners() {
        try {
            // Escuchar categorías personalizadas en Firestore
            const catCol = collection(db, 'custom_categories');
            onSnapshot(catCol, (snapshot) => {
                const newCatMap = {};
                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    const ws = data.workspaceId || 'personal';
                    if (!newCatMap[ws]) newCatMap[ws] = {};
                    newCatMap[ws][data.id || docSnap.id] = {
                        id: data.id || docSnap.id,
                        label: data.label || data.name || 'Categoría',
                        emoji: data.emoji || '📌',
                        color: data.color || '#6366f1',
                        keywords: Array.isArray(data.keywords) ? data.keywords : (typeof data.keywords === 'string' ? data.keywords.split(',').map(k => k.trim()) : [])
                    };
                });
                this.workspaceCategories = newCatMap;
                console.log(`[Classifier] Categorías personalizadas sincronizadas (${snapshot.size} cargadas)`);
            }, (err) => {
                console.warn('[Classifier] Advertencia escuchando custom_categories:', err.message);
            });

            // Escuchar reglas por chat en Firestore
            const rulesCol = collection(db, 'chat_rules');
            onSnapshot(rulesCol, (snapshot) => {
                const newRules = {};
                snapshot.forEach(docSnap => {
                    newRules[docSnap.id] = docSnap.data();
                });
                this.chatRules = newRules;
                console.log(`[Classifier] Reglas por chat sincronizadas (${snapshot.size} chats configurados)`);
            }, (err) => {
                console.warn('[Classifier] Advertencia escuchando chat_rules:', err.message);
            });
        } catch (e) {
            console.error('[Classifier] Error inicializando listeners:', e.message);
        }
    }

    getCategoriesForWorkspace(workspaceId = 'personal') {
        const custom = this.workspaceCategories[workspaceId];
        if (custom && Object.keys(custom).length > 0) {
            return custom;
        }
        return this.defaultCategories;
    }

    normalizeText(text) {
        if (!text) return '';
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    classifyText(text, workspaceId = 'personal', chatId = null) {
        if (!text || typeof text !== 'string') return null;

        // 1. Verificar regla específica del chat si existe
        if (chatId && this.chatRules[chatId]) {
            const rule = this.chatRules[chatId];
            if (rule.excluded) {
                // El usuario desactivó la extracción de este chat
                return null;
            }
            if (rule.forcedCategory) {
                // Forzar categoría predeterminada si el mensaje tiene contenido
                return {
                    category: rule.forcedCategory,
                    confidence: 5,
                    matchedKeywords: ['regla_forzada']
                };
            }
        }

        const normalized = this.normalizeText(text);
        const categories = this.getCategoriesForWorkspace(workspaceId);
        const allowed = (chatId && this.chatRules[chatId] && Array.isArray(this.chatRules[chatId].allowedCategories))
            ? this.chatRules[chatId].allowedCategories
            : null;

        const scores = {};
        for (const [catKey, catData] of Object.entries(categories)) {
            // Si el chat tiene filtro de categorías permitidas y esta categoría no está, omitir
            if (allowed && !allowed.includes(catKey)) continue;

            let score = 0;
            const matchedWords = [];

            for (const kw of (catData.keywords || [])) {
                if (!kw || !kw.trim()) continue;
                const normKw = this.normalizeText(kw.trim());
                if (normKw.length < 2) continue;

                // Búsqueda por palabra exacta o frase
                const regex = new RegExp(`(^|\\W)${normKw}($|\\W)`, 'i');
                if (regex.test(normalized)) {
                    const weight = normKw.includes(' ') ? 3 : 1.5;
                    score += weight;
                    matchedWords.push(kw);
                }
            }

            if (score > 0) {
                scores[catKey] = { score, matchedWords };
            }
        }

        let bestCategory = null;
        let highestScore = 0;
        let matchedKeywords = [];

        for (const [catKey, data] of Object.entries(scores)) {
            if (data.score > highestScore) {
                highestScore = data.score;
                bestCategory = catKey;
                matchedKeywords = data.matchedWords;
            }
        }

        if (highestScore >= 1.5) {
            return {
                category: bestCategory,
                confidence: highestScore,
                matchedKeywords
            };
        }

        return null;
    }

    sanitizeSnippet(text) {
        if (!text) return '';
        // Separar líneas no vacías
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        // Buscar la primera línea que no sea solo una URL
        let bestLine = lines.find(l => !l.match(/^(https?:\/\/|www\.)\S+$/i));
        
        if (!bestLine) {
            // Si todo el texto es un enlace o enlaces
            const urlMatch = text.match(/https?:\/\/(?:www\.)?([^\/\s]+)/i);
            if (urlMatch && urlMatch[1]) {
                return `Enlace (${urlMatch[1]})`;
            }
            return 'Enlace web';
        }

        // Si la línea contiene enlaces mezclados con texto, simplificarlos
        let cleaned = bestLine.replace(/https?:\/\/(?:www\.)?([^\/\s]+)\S*/gi, '[$1]');
        // Limpiar caracteres repetidos o símbolos iniciales
        cleaned = cleaned.replace(/^[\s\-–—*#•>]+/g, '').trim();

        if (cleaned.length > 55) {
            return cleaned.slice(0, 52) + '...';
        }
        return cleaned || 'Nota de mensaje';
    }

    generateTitle(category, text, matchedKeywords = [], workspaceId = 'personal') {
        const cleanSnippet = this.sanitizeSnippet(text);
        const normalized = this.normalizeText(text);

        // Generadores para categorías estándar
        if (category === 'colegio') {
            if (normalized.includes('flauta')) return 'Comprar / Llevar flauta dulce para música';
            if (normalized.includes('tarea')) return 'Tarea escolar pendiente';
            if (normalized.includes('examen') || normalized.includes('prueba')) return 'Examen / Evaluación escolar';
            if (normalized.includes('reunion') || normalized.includes('reunión')) return 'Reunión de padres';
            if (normalized.includes('cartulina') || normalized.includes('afiche') || normalized.includes('tempera')) return 'Materiales para el colegio';
            return `Aviso escolar: ${cleanSnippet}`;
        }

        if (category === 'cumpleanos') {
            const matchName = text.match(/cumple(?:años)?\s+(?:de\s+)?([A-Za-zÁÉÍÓÚáéíóúñÑ]+)/i);
            if (matchName && matchName[1]) {
                return `Cumpleaños de ${matchName[1]}`;
            }
            if (normalized.includes('regalo') || normalized.includes('vaquita')) {
                return 'Regalo / Vaquita de cumpleaños';
            }
            return `Festejo de cumpleaños: ${cleanSnippet}`;
        }

        if (category === 'compras') {
            if (normalized.includes('farmacia') || normalized.includes('remedio')) return 'Comprar en farmacia';
            if (normalized.includes('super') || normalized.includes('coto')) return 'Hacer compras de supermercado';
            return `Comprar: ${cleanSnippet}`;
        }

        if (category === 'compromisos') {
            if (normalized.includes('pediatra') || normalized.includes('medico') || normalized.includes('dentista')) return 'Turno médico / Pediatra';
            return `Compromiso: ${cleanSnippet}`;
        }

        // Título limpio para categorías personalizadas (sin prefijo repetitivo)
        return cleanSnippet;
    }

    detectIntent(text) {
        const norm = (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (/(guarda|guardame|guardas|apartame|separame|me llevo|llevo|compro|comprar|quiero|quisiera|anotame|pedir|pedido|encargo|cajon|kilo|medio kilo|bolson|bolsón|reserva)/i.test(norm)) {
            return { type: 'pedido', label: 'Pedido / Reserva', emoji: '🛒' };
        }
        if (/(vas a tener|van a tener|quedan|quedo|queda|hay|tenes|tenés|tiene|precio|cuanto|cuánto|cuanto esta|a que hora|cuando llegan|a que precio)/i.test(norm)) {
            return { type: 'consulta', label: 'Consulta de Stock', emoji: '❓' };
        }
        if (/(informamos|comunicamos|aviso|atencion|comunicado|no llegaron|cambio de horario|comunidad)/i.test(norm)) {
            return { type: 'aviso', label: 'Aviso / Proveedor', emoji: '📢' };
        }
        if (/(vendo|ofrezco|disponible|promo|oferta|talle|usado|nuevo sin uso)/i.test(norm)) {
            return { type: 'oferta', label: 'Oferta / Venta', emoji: '🏷️' };
        }
        return { type: 'general', label: 'Mensaje', emoji: '💬' };
    }

    // Alias para compatibilidad con código existente
    classifyMessage(text, senderName, sourceName, workspaceId = 'personal', chatId = null) {
        const classification = this.classifyText(text, workspaceId, chatId);
        if (!classification) return null;

        const title = this.generateTitle(classification.category, text, classification.matchedKeywords, workspaceId);
        const intentInfo = this.detectIntent(text);
        const subKeyword = classification.matchedKeywords[0] || null;

        return {
            category: classification.category,
            title,
            originalText: text,
            senderName,
            sourceName,
            confidence: classification.confidence,
            intent: intentInfo.type,
            subKeyword,
            priority: intentInfo.type === 'pedido' ? 'alta' : 'media'
        };
    }

    async processIncomingMessage({
        messageId,
        text,
        senderName,
        sourceName,
        chatId,
        timestamp = Math.floor(Date.now() / 1000),
        workspaceId = 'personal'
    }) {
        if (!text || text.length < 5) return null;

        const classification = this.classifyText(text, workspaceId, chatId);
        if (!classification) return null;

        const { category, matchedKeywords } = classification;
        const title = this.generateTitle(category, text, matchedKeywords, workspaceId);

        // Deduplicación en Firestore
        try {
            const existingQuery = query(
                collection(db, 'smart_notes'),
                where('workspaceId', '==', workspaceId),
                where('category', '==', category),
                limit(15)
            );
            const snapshot = await getDocs(existingQuery);
            const isDuplicate = snapshot.docs.some(docSnap => {
                const data = docSnap.data();
                return (data.originalText === text || data.title === title) &&
                       Math.abs((data.timestamp || 0) - timestamp) < 86400 * 3;
            });

            if (isDuplicate) {
                console.log(`[SmartOrganizer] Nota duplicada omitida: "${title}"`);
                return null;
            }
        } catch (e) {
            console.warn('[SmartOrganizer] Error verificando duplicados:', e.message);
        }

        const noteId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const notePayload = {
            id: noteId,
            workspaceId,
            category,
            title,
            originalText: text,
            matchedKeywords,
            senderName: senderName || 'Desconocido',
            sourceName: sourceName || senderName || 'Chat',
            chatId: chatId || '',
            status: 'pendiente',
            priority: (category === 'colegio' || category === 'cumpleanos') ? 'alta' : 'media',
            timestamp: Number(timestamp) || Math.floor(Date.now() / 1000),
            createdAt: Date.now()
        };

        try {
            await setDoc(doc(db, 'smart_notes', noteId), notePayload);
            console.log(`[SmartOrganizer] ⭐ ¡Nueva nota inteligente creada!: [${category.toUpperCase()}] "${title}" (De: ${senderName} en ${sourceName})`);
            return notePayload;
        } catch (err) {
            console.error('[SmartOrganizer] Error guardando nota inteligente:', err.message);
            return null;
        }
    }
}

const classifierService = new ClassifierService();
module.exports = classifierService;
