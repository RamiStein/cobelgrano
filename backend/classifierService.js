const { db } = require('./firebase');
const { doc, setDoc, getDocs, collection, query, where, limit } = require('firebase/firestore');

class ClassifierService {
    constructor() {
        this.categories = {
            colegio: {
                id: 'colegio',
                label: 'Colegio & Niños',
                emoji: '🎒',
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
                keywords: [
                    'cumple', 'cumpleaños', 'cumpleanos', 'cumpleañitos', 'cumpleanitos',
                    'festejo', 'festejamos', 'festejar', 'pelotero', 'salon', 'salón',
                    'invitacion', 'invitación', 'regalo', 'regalito', 'vaquita', 'alias para el regalo',
                    'añitos', 'anitos', 'cumple de', 'souvenir', 'torta de cumple', 'festeja su cumple'
                ]
            },
            compras: {
                id: 'compras',
                label: 'Compras & Pendientes',
                emoji: '🛒',
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
                label: 'Compromisos Personales / Familia',
                emoji: '📅',
                keywords: [
                    'pediatra', 'medico', 'médico', 'dentista', 'turno', 'cita', 'control',
                    'asado', 'almuerzo familiar', 'cena familiar', 'visitar', 'abuela', 'abuelos',
                    'natacion', 'natación', 'futbol', 'fútbol', 'danza', 'gimnasia', 'partido',
                    'cumple de mamá', 'cumple de papá', 'aniversario', 'viaje', 'escapada'
                ]
            }
        };
    }

    normalizeText(text) {
        if (!text) return '';
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    classifyText(text) {
        if (!text || typeof text !== 'string') return null;
        const normalized = this.normalizeText(text);

        const scores = {};
        for (const [catKey, catData] of Object.entries(this.categories)) {
            let score = 0;
            const matchedWords = [];

            for (const kw of catData.keywords) {
                const normKw = this.normalizeText(kw);
                const regex = new RegExp(`\\b${normKw}\\b`, 'i');
                if (regex.test(normalized)) {
                    const weight = kw.includes(' ') ? 3 : (kw === 'flauta' || kw === 'cumple' || kw === 'tarea' ? 2.5 : 1.5);
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

    generateTitle(category, text, matchedKeywords = []) {
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        const firstLine = lines[0] || text;
        const cleanSnippet = firstLine.trim().slice(0, 75);

        const normalized = this.normalizeText(text);

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

        return cleanSnippet;
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

        const classification = this.classifyText(text);
        if (!classification) return null;

        const { category, matchedKeywords } = classification;
        const title = this.generateTitle(category, text, matchedKeywords);

        // Deduplication
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
