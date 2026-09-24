import { useState, useEffect } from 'react';
import { 
  Sparkles, CheckCircle2, Circle, Clock, Tag, MessageSquare, 
  Trash2, Plus, Search, Filter, AlertCircle, Calendar, ShoppingBag, 
  GraduationCap, Gift, Users, ExternalLink, Check, ChevronRight, X, Share2,
  QrCode as QrIcon, ArrowRight, Settings, SlidersHorizontal, LayoutGrid, List,
  Package, CheckCheck, RefreshCw
} from 'lucide-react';
import { db } from '../firebase';
import { 
  collection, query, where, onSnapshot, doc, 
  updateDoc, deleteDoc, addDoc, orderBy 
} from 'firebase/firestore';
import CategoryManagerModal, { DEFAULT_TEMPLATES } from './CategoryManagerModal';
import ChatExtractionRulesModal from './ChatExtractionRulesModal';
import OrderSummaryModal, { detectIntent, detectProductItem } from './OrderSummaryModal';

// Limpieza de títulos redundantes (quita 'frutas (palta): ' etc.)
function cleanNoteTitle(title = '') {
  let clean = title.replace(/^[\s📌]*[A-Za-z0-9_\sáéíóúñÁÉÍÓÚÑ]+\s*(\([^)]+\))?\s*:\s*/i, '').trim();
  return clean || title;
}

// Extrae palabra clave / sub-producto
function extractSubKeyword(title = '', originalText = '') {
  const match = title.match(/\(([^)]+)\)/);
  if (match && match[1]) {
    const word = match[1].trim();
    if (!['vendo', 'compro', 'quiero', 'doy', 'intercambio'].includes(word.toLowerCase())) {
      return word;
    }
  }
  const prod = detectProductItem(originalText || title);
  if (prod.label !== 'Otros Encargos') {
    return prod.label;
  }
  return null;
}

export default function SmartOrganizer({ onOpenChat, onNavigateToChannels, isPartnerConnected, resetKey }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');
  const [selectedIntent, setSelectedIntent] = useState('all'); // 'all', 'pedido', 'consulta', 'aviso', 'oferta'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending'); // 'pending', 'completed', 'all'
  
  // Modales
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showChatRulesModal, setShowChatRulesModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);

  const [customCategories, setCustomCategories] = useState([]);
  const [copied, setCopied] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  const toggleExpandNote = (noteId) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  };

  // Escuchar categorías dinámicas desde Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'custom_categories'), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        list.push({ id: docSnap.id, ...d });
      });
      setCustomCategories(list);
    }, (err) => {
      console.warn('[SmartOrganizer] Aviso leyendo custom_categories:', err.message);
    });
    return () => unsub();
  }, []);

  // Categorías activas
  const activeCategories = customCategories.length > 0
    ? customCategories
    : DEFAULT_TEMPLATES.personal.categories;

  const categoriesMap = {};
  activeCategories.forEach(c => {
    categoriesMap[c.id] = {
      ...c,
      label: c.label || c.name || c.id,
      emoji: c.emoji || '📌',
      color: c.color || '#6366f1',
      bg: `${c.color || '#6366f1'}20`
    };
  });

  // Reset al hacer clic desde el sidebar
  useEffect(() => {
    if (resetKey) {
      setSelectedCategory('all');
      setSelectedSource('all');
      setSelectedIntent('all');
      setStatusFilter('pending');
      setSearchQuery('');
    }
  }, [resetKey]);

  // Leer notas de Firestore
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'smart_notes'),
      where('workspaceId', '==', 'personal')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
      setNotes(list);
      setLoading(false);
    }, (err) => {
      console.error('[SmartOrganizer] Error leyendo notas:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleToggleStatus = async (note) => {
    try {
      const nextStatus = note.status === 'completado' ? 'pendiente' : 'completado';
      await updateDoc(doc(db, 'smart_notes', note.id), {
        status: nextStatus,
        completedAt: nextStatus === 'completado' ? Date.now() : null
      });
    } catch (err) {
      console.error('Error al actualizar nota:', err);
    }
  };

  const handleDelete = async (noteId) => {
    if (confirm('¿Eliminar este registro del organizador?')) {
      try {
        await deleteDoc(doc(db, 'smart_notes', noteId));
      } catch (err) {
        console.error('Error eliminando nota:', err);
      }
    }
  };

  // Formulario manual
  const [newNote, setNewNote] = useState({
    title: '',
    category: activeCategories[0]?.id || 'compras',
    originalText: '',
    sourceName: 'Nota manual',
    senderName: 'Yo',
    priority: 'media'
  });

  const handleCreateManualNote = async (e) => {
    e.preventDefault();
    if (!newNote.title.trim()) return;

    try {
      await addDoc(collection(db, 'smart_notes'), {
        workspaceId: 'personal',
        category: newNote.category,
        title: newNote.title.trim(),
        originalText: newNote.originalText.trim() || newNote.title.trim(),
        sourceName: newNote.sourceName || 'Nota manual',
        senderName: newNote.senderName || 'Yo',
        chatId: '',
        status: 'pendiente',
        priority: newNote.priority || 'media',
        intent: 'general',
        timestamp: Math.floor(Date.now() / 1000),
        createdAt: Date.now()
      });

      setShowAddModal(false);
      setNewNote({
        title: '',
        category: activeCategories[0]?.id || 'compras',
        originalText: '',
        sourceName: 'Nota manual',
        senderName: 'Yo',
        priority: 'media'
      });
    } catch (err) {
      console.error('Error creando nota manual:', err);
    }
  };

  // Copiar resumen de WhatsApp
  const handleCopySummary = () => {
    const pendings = notes.filter(n => n.status !== 'completado');
    if (pendings.length === 0) {
      alert('No hay tareas pendientes en este momento.');
      return;
    }

    let text = '📋 *RESUMEN DE PENDIENTES - ORGANIZADOR*\n\n';

    activeCategories.forEach(cat => {
      const items = pendings.filter(n => n.category === cat.id);
      if (items.length > 0) {
        text += `${cat.emoji || '📌'} *${(cat.label || cat.name || cat.id).toUpperCase()}:*\n`;
        items.forEach(c => {
          text += `▫️ *${cleanNoteTitle(c.title)}*\n   _Origen:_ ${c.sourceName}\n   "${(c.originalText || '').slice(0, 90)}"\n`;
        });
        text += '\n';
      }
    });

    text += '✨ _Organizado automáticamente por el CRM Inteligente_';

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // Grupos u orígenes únicos presentes en las notas
  const uniqueSources = Array.from(new Set(notes.map(n => n.sourceName).filter(Boolean))).sort();

  // Filtrado multidimensional
  const filteredNotes = notes.filter(n => {
    // 1. Categoría
    if (selectedCategory !== 'all' && n.category !== selectedCategory) return false;

    // 2. Estado
    if (statusFilter === 'pending' && n.status === 'completado') return false;
    if (statusFilter === 'completed' && n.status !== 'completado') return false;

    // 3. Grupo / Origen
    if (selectedSource !== 'all' && n.sourceName !== selectedSource) return false;

    // 4. Intención
    if (selectedIntent !== 'all') {
      const intentType = n.intent || detectIntent(n.originalText || n.title).type;
      if (intentType !== selectedIntent) return false;
    }

    // 5. Búsqueda por texto
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleMatch = (n.title || '').toLowerCase().includes(q);
      const textMatch = (n.originalText || '').toLowerCase().includes(q);
      const sourceMatch = (n.sourceName || '').toLowerCase().includes(q);
      const senderMatch = (n.senderName || '').toLowerCase().includes(q);
      return titleMatch || textMatch || sourceMatch || senderMatch;
    }

    return true;
  });

  // Métricas
  const totalNotes = notes.length;
  const pendingNotes = notes.filter(n => n.status !== 'completado').length;
  const completedNotes = notes.filter(n => n.status === 'completado').length;

  const ordersCount = notes.filter(n => n.status !== 'completado' && (n.intent === 'pedido' || detectIntent(n.originalText || n.title).type === 'pedido')).length;
  const queriesCount = notes.filter(n => n.status !== 'completado' && (n.intent === 'consulta' || detectIntent(n.originalText || n.title).type === 'consulta')).length;
  const avisosCount = notes.filter(n => n.status !== 'completado' && (n.intent === 'aviso' || detectIntent(n.originalText || n.title).type === 'aviso')).length;

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString([], { day: '2-digit', month: 'short' }) + ' ' +
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <div style={{
        padding: '1.25rem 2rem',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        backgroundColor: 'var(--bg-secondary)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🧠</span>
            <h1 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              Organizador Inteligente
            </h1>
            <span style={{
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              color: '#818cf8',
              fontSize: '0.75rem',
              fontWeight: '700',
              padding: '3px 8px',
              borderRadius: '999px',
              letterSpacing: '0.5px'
            }}>
              ESPACIO PERSONAL
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '0.25rem 0 0 0' }}>
            Extracción y consolidación automática de pedidos, consultas, compras y avisos de tus grupos de WhatsApp.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Botón Consolidar Pedidos */}
          <button
            type="button"
            onClick={() => setShowOrderModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: 'rgba(16, 185, 129, 0.18)',
              color: '#10b981',
              border: '1.5px solid #10b981',
              borderRadius: '8px',
              padding: '0.55rem 0.95rem',
              fontSize: '0.82rem',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.2)'
            }}
          >
            <ShoppingBag size={15} />
            Consolidar Pedidos ({ordersCount})
          </button>

          <button
            type="button"
            onClick={() => setShowCategoryModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '0.55rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <Settings size={15} color="#6366f1" />
            Personalizar Categorías
          </button>

          <button
            type="button"
            onClick={() => setShowChatRulesModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '0.55rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <SlidersHorizontal size={15} color="#10b981" />
            Reglas de Chats
          </button>

          <button
            type="button"
            onClick={handleCopySummary}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '0.55rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            {copied ? <Check size={15} color="#10b981" /> : <Share2 size={15} />}
            {copied ? '¡Copiado!' : 'Copiar Todo'}
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '0.55rem 1rem',
              fontSize: '0.82rem',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.35)'
            }}
          >
            <Plus size={15} />
            Nueva Tarea
          </button>
        </div>
      </div>

      {/* Banner de Vinculación si no está conectado */}
      {!isPartnerConnected && (
        <div style={{
          margin: '1rem 2rem 0',
          padding: '1rem 1.25rem',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}>
              <QrIcon size={18} />
            </div>
            <div>
              <strong style={{ fontSize: '0.9rem', color: '#e0e7ff', display: 'block' }}>
                Línea de WhatsApp de tu compañera pendiente de vincular
              </strong>
              <span style={{ fontSize: '0.8rem', color: '#c7d2fe' }}>
                Para que el organizador lea automáticamente las notas y grupos de ella, escanea el código QR oficial.
              </span>
            </div>
          </div>

          <button
            onClick={onNavigateToChannels}
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.55rem 1rem',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            <QrIcon size={14} />
            Ver Código QR <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Modern Compact Metrics Bar (Sin espacios negros gigantes) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '0.75rem',
        padding: '1rem 2rem 0.25rem'
      }}>
        {/* KPI 1: Pedidos / Encargos detectados */}
        <div
          onClick={() => {
            setSelectedIntent(selectedIntent === 'pedido' ? 'all' : 'pedido');
            setSelectedCategory('all');
          }}
          style={{
            backgroundColor: selectedIntent === 'pedido' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-secondary)',
            border: selectedIntent === 'pedido' ? '1.5px solid #10b981' : '1px solid var(--border)',
            borderRadius: '10px',
            padding: '0.65rem 0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.15s',
            boxShadow: selectedIntent === 'pedido' ? '0 4px 12px rgba(16, 185, 129, 0.2)' : 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem'
            }}>
              🛒
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                Pedidos & Reservas
              </div>
              <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: '600' }}>
                {selectedIntent === 'pedido' ? 'Filtro activo' : 'Toca para aislar'}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#10b981' }}>
            {ordersCount}
          </div>
        </div>

        {/* Categorías dinámicas */}
        {activeCategories.map(cat => {
          const count = notes.filter(n => n.category === cat.id && n.status !== 'completado').length;
          const isSelected = selectedCategory === cat.id && selectedIntent === 'all';
          return (
            <div 
              key={cat.id}
              onClick={() => {
                setSelectedCategory(isSelected ? 'all' : cat.id);
                setSelectedIntent('all');
              }}
              style={{
                backgroundColor: isSelected ? `${cat.color || '#6366f1'}18` : 'var(--bg-secondary)',
                border: isSelected ? `1.5px solid ${cat.color || '#6366f1'}` : '1px solid var(--border)',
                borderRadius: '10px',
                padding: '0.65rem 0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s',
                boxShadow: isSelected ? `0 4px 12px ${cat.color || '#6366f1'}30` : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: `${cat.color || '#6366f1'}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem'
                }}>
                  {cat.emoji || '📌'}
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {cat.label || cat.name}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {count === 1 ? '1 pendiente' : `${count} pendientes`}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: cat.color || '#6366f1' }}>
                {count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Advanced Command & Filter Bar */}
      <div style={{
        padding: '0.75rem 2rem 0.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem'
      }}>
        {/* Row 1: Category Chips & Intent Chips */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Todas las categorías */}
          <button
            onClick={() => { setSelectedCategory('all'); setSelectedIntent('all'); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '7px',
              border: selectedCategory === 'all' && selectedIntent === 'all' ? '1.5px solid #6366f1' : '1px solid var(--border)',
              backgroundColor: selectedCategory === 'all' && selectedIntent === 'all' ? 'rgba(99, 102, 241, 0.18)' : 'var(--bg-secondary)',
              color: selectedCategory === 'all' && selectedIntent === 'all' ? '#818cf8' : 'var(--text-secondary)',
              fontSize: '0.78rem',
              fontWeight: selectedCategory === 'all' && selectedIntent === 'all' ? '700' : '500',
              cursor: 'pointer'
            }}
          >
            <Sparkles size={13} />
            Todas las categorías ({pendingNotes})
          </button>

          {activeCategories.map(cat => {
            const isSelected = selectedCategory === cat.id && selectedIntent === 'all';
            const count = notes.filter(n => n.category === cat.id && n.status !== 'completado').length;
            return (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); setSelectedIntent('all'); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.7rem',
                  borderRadius: '7px',
                  border: isSelected ? `1.5px solid ${cat.color || '#6366f1'}` : '1px solid var(--border)',
                  backgroundColor: isSelected ? `${cat.color || '#6366f1'}20` : 'var(--bg-secondary)',
                  color: isSelected ? (cat.color || '#6366f1') : 'var(--text-secondary)',
                  fontSize: '0.78rem',
                  fontWeight: isSelected ? '700' : '500',
                  cursor: 'pointer'
                }}
              >
                <span>{cat.emoji || '📌'}</span>
                {cat.label || cat.name} ({count})
              </button>
            );
          })}

          <div style={{ width: '1px', height: '22px', backgroundColor: 'var(--border)', margin: '0 0.3rem' }} />

          {/* Filtros por Intención */}
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
            Tipo:
          </span>

          <button
            onClick={() => setSelectedIntent(selectedIntent === 'pedido' ? 'all' : 'pedido')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.35rem 0.65rem',
              borderRadius: '7px',
              border: selectedIntent === 'pedido' ? '1.5px solid #10b981' : '1px solid var(--border)',
              backgroundColor: selectedIntent === 'pedido' ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-secondary)',
              color: selectedIntent === 'pedido' ? '#10b981' : 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: selectedIntent === 'pedido' ? '700' : '500',
              cursor: 'pointer'
            }}
          >
            🛒 Pedidos ({ordersCount})
          </button>

          <button
            onClick={() => setSelectedIntent(selectedIntent === 'consulta' ? 'all' : 'consulta')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.35rem 0.65rem',
              borderRadius: '7px',
              border: selectedIntent === 'consulta' ? '1.5px solid #0ea5e9' : '1px solid var(--border)',
              backgroundColor: selectedIntent === 'consulta' ? 'rgba(14, 165, 233, 0.2)' : 'var(--bg-secondary)',
              color: selectedIntent === 'consulta' ? '#0ea5e9' : 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: selectedIntent === 'consulta' ? '700' : '500',
              cursor: 'pointer'
            }}
          >
            ❓ Consultas ({queriesCount})
          </button>

          <button
            onClick={() => setSelectedIntent(selectedIntent === 'aviso' ? 'all' : 'aviso')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.35rem 0.65rem',
              borderRadius: '7px',
              border: selectedIntent === 'aviso' ? '1.5px solid #f59e0b' : '1px solid var(--border)',
              backgroundColor: selectedIntent === 'aviso' ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-secondary)',
              color: selectedIntent === 'aviso' ? '#f59e0b' : 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: selectedIntent === 'aviso' ? '700' : '500',
              cursor: 'pointer'
            }}
          >
            📢 Avisos ({avisosCount})
          </button>
        </div>

        {/* Row 2: Search, Group Selector, Status & View Mode */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.6rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '0.3rem'
        }}>
          {/* Left Controls: Search + Group Dropdown */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Buscador */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '0.35rem 0.65rem',
              width: '240px'
            }}>
              <Search size={14} style={{ color: 'var(--text-secondary)', marginRight: '0.4rem' }} />
              <input
                type="text"
                placeholder="Buscar cliente, palabra..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  outline: 'none',
                  width: '100%'
                }}
              />
              {searchQuery && (
                <X size={13} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setSearchQuery('')} />
              )}
            </div>

            {/* Selector por Grupo de WhatsApp */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: 'var(--bg-secondary)',
              border: selectedSource !== 'all' ? '1px solid #6366f1' : '1px solid var(--border)',
              borderRadius: '8px',
              padding: '0.35rem 0.65rem'
            }}>
              <Users size={14} style={{ color: selectedSource !== 'all' ? '#818cf8' : 'var(--text-secondary)' }} />
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: selectedSource !== 'all' ? '#818cf8' : 'var(--text-primary)',
                  fontSize: '0.8rem',
                  fontWeight: selectedSource !== 'all' ? '600' : '400',
                  outline: 'none',
                  cursor: 'pointer',
                  maxWidth: '220px'
                }}
              >
                <option value="all" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                  Todos los grupos ({uniqueSources.length})
                </option>
                {uniqueSources.map(source => {
                  const count = notes.filter(n => n.sourceName === source && n.status !== 'completado').length;
                  return (
                    <option key={source} value={source} style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                      {source} ({count})
                    </option>
                  );
                })}
              </select>
              {selectedSource !== 'all' && (
                <X size={13} style={{ cursor: 'pointer', color: '#818cf8' }} onClick={() => setSelectedSource('all')} title="Quitar filtro de grupo" />
              )}
            </div>
          </div>

          {/* Right Controls: Status Toggle & View Switch */}
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            {/* Status Toggle (Sin "Todos" duplicado) */}
            <div style={{
              display: 'flex',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '2px'
            }}>
              <button
                onClick={() => setStatusFilter('pending')}
                style={{
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: statusFilter === 'pending' ? 'var(--border)' : 'transparent',
                  color: statusFilter === 'pending' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Pendientes ({pendingNotes})
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                style={{
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: statusFilter === 'completed' ? 'var(--border)' : 'transparent',
                  color: statusFilter === 'completed' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Resueltos ({completedNotes})
              </button>
              <button
                onClick={() => setStatusFilter('all')}
                style={{
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: statusFilter === 'all' ? 'var(--border)' : 'transparent',
                  color: statusFilter === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Historial ({totalNotes})
              </button>
            </div>

            {/* View Mode Toggle: Grid vs List */}
            <div style={{
              display: 'flex',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '2px'
            }}>
              <button
                onClick={() => setViewMode('grid')}
                title="Vista en Tarjetas"
                style={{
                  padding: '0.3rem 0.55rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: viewMode === 'grid' ? '#6366f1' : 'transparent',
                  color: viewMode === 'grid' ? 'white' : 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                <LayoutGrid size={14} /> Tarjetas
              </button>
              <button
                onClick={() => setViewMode('list')}
                title="Vista en Lista Compacta (alta velocidad)"
                style={{
                  padding: '0.3rem 0.55rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: viewMode === 'list' ? '#6366f1' : 'transparent',
                  color: viewMode === 'list' ? 'white' : 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                <List size={14} /> Lista
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area: Grid View vs Compact List View */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
          <RefreshCw size={24} className="spin" style={{ marginBottom: '0.5rem' }} />
          <div>Cargando organizador inteligente...</div>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div style={{
          margin: '1rem 2rem 2rem',
          textAlign: 'center',
          padding: '3.5rem 1rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '12px',
          border: '1px dashed var(--border)'
        }}>
          <Sparkles size={40} style={{ color: '#6366f1', opacity: 0.6, marginBottom: '0.8rem' }} />
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
            No hay notas con este criterio
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '420px', margin: '0 auto' }}>
            Prueba cambiando los filtros de categoría, grupo o estado, o usa el buscador para localizar un mensaje.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* VISTA 1: GRID EN TARJETAS (LIMPIAS Y SIN REDUNDANCIA) */
        <div style={{
          padding: '0.5rem 2rem 2.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '1rem'
        }}>
          {filteredNotes.map(note => {
            const cat = categoriesMap[note.category] || {
              label: note.category,
              emoji: '📌',
              color: '#6366f1',
              bg: 'rgba(99, 102, 241, 0.12)'
            };
            const isCompleted = note.status === 'completado';
            const intent = detectIntent(note.originalText || note.title);
            const subKeyword = extractSubKeyword(note.title, note.originalText);
            const cleanTitle = cleanNoteTitle(note.title);

            const isVeryLong = (note.originalText || '').length > 170 || (note.originalText || '').split('\n').length > 3;
            const isExpanded = expandedNotes.has(note.id);

            return (
              <div
                key={note.id}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: isCompleted ? '1px solid var(--border)' : `1px solid ${cat.color}45`,
                  borderRadius: '12px',
                  padding: '1.1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: isCompleted ? 'none' : '0 2px 8px rgba(0,0,0,0.06)',
                  opacity: isCompleted ? 0.6 : 1,
                  transition: 'all 0.2s',
                  position: 'relative'
                }}
              >
                <div>
                  {/* Card Header: Category + Subkeyword + Intent Badge + Date */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {/* Categoría */}
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        padding: '2px 7px',
                        borderRadius: '5px',
                        backgroundColor: cat.bg || `${cat.color}20`,
                        color: cat.color
                      }}>
                        <span>{cat.emoji || '📌'}</span>
                        {cat.label || cat.name}
                      </span>

                      {/* Sub-producto / Palabra Clave */}
                      {subKeyword && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          fontSize: '0.7rem',
                          fontWeight: '600',
                          padding: '1px 6px',
                          borderRadius: '5px',
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          color: 'var(--text-primary)'
                        }}>
                          {subKeyword}
                        </span>
                      )}

                      {/* Badge de Intención */}
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: '700',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: intent.bg,
                        color: intent.color
                      }}>
                        {intent.emoji} {intent.label}
                      </span>
                    </div>

                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      {formatDate(note.timestamp)}
                    </span>
                  </div>

                  {/* Clean Title (Sin prefijos repetitivos) */}
                  <h3 style={{
                    fontSize: '0.96rem',
                    fontWeight: '600',
                    color: isCompleted ? 'var(--text-secondary)' : 'var(--text-primary)',
                    textDecoration: isCompleted ? 'line-through' : 'none',
                    margin: '0 0 0.55rem 0',
                    lineHeight: '1.35',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    wordBreak: 'break-word'
                  }} title={note.title}>
                    {cleanTitle}
                  </h3>

                  {/* Original text snippet con lector colapsable */}
                  <div style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'rgba(0, 0, 0, 0.12)',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '6px',
                    borderLeft: `3px solid ${cat.color}`,
                    marginBottom: '0.75rem',
                    fontStyle: 'italic',
                    wordBreak: 'break-word',
                    lineHeight: '1.45',
                    position: 'relative'
                  }}>
                    <div style={{
                      maxHeight: isExpanded ? 'none' : (isVeryLong ? '80px' : 'none'),
                      overflow: 'hidden',
                      whiteSpace: 'pre-wrap',
                      transition: 'max-height 0.25s ease'
                    }}>
                      "{note.originalText}"
                    </div>

                    {isVeryLong && (
                      <div style={{ marginTop: '0.35rem', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => toggleExpandNote(note.id)}
                          style={{
                            background: 'rgba(99, 102, 241, 0.1)',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            borderRadius: '4px',
                            color: '#818cf8',
                            fontSize: '0.7rem',
                            fontWeight: '600',
                            padding: '1px 6px',
                            cursor: 'pointer'
                          }}
                        >
                          {isExpanded ? '▲ Ver menos' : '▼ Ver mensaje completo'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Origin & Sender */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: 'var(--border)', padding: '2px 6px', borderRadius: '4px' }}>
                      <Users size={11} />
                      {note.sourceName}
                    </span>
                    {note.senderName && note.senderName !== note.sourceName && (
                      <span style={{ opacity: 0.85 }}>
                        Por: <strong style={{ color: 'var(--text-primary)' }}>{note.senderName}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '0.65rem',
                  borderTop: '1px solid var(--border)',
                  marginTop: '0.4rem'
                }}>
                  <button
                    onClick={() => handleToggleStatus(note)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      border: isCompleted ? '1px solid var(--border)' : '1px solid #10b981',
                      backgroundColor: isCompleted ? 'transparent' : 'rgba(16, 185, 129, 0.15)',
                      color: isCompleted ? 'var(--text-secondary)' : '#10b981',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    {isCompleted ? <Circle size={13} /> : <Check size={13} />}
                    {isCompleted ? 'Pendiente' : 'Marcar resuelto'}
                  </button>

                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    {note.chatId && onOpenChat && (
                      <button
                        onClick={() => onOpenChat(note.chatId)}
                        title="Abrir conversación en WhatsApp"
                        style={{
                          background: 'none',
                          border: '1px solid var(--border)',
                          color: 'var(--accent)',
                          padding: '0.35rem 0.55rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        <ExternalLink size={13} /> Chat
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(note.id)}
                      title="Eliminar del organizador"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        padding: '0.35rem',
                        cursor: 'pointer',
                        borderRadius: '4px'
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VISTA 2: LISTA COMPACTA (ALTA VELOCIDAD Y VISIBILIDAD MASIVA) */
        <div style={{ padding: '0.5rem 2rem 2.5rem' }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            overflow: 'hidden'
          }}>
            {/* Table Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '120px 100px 1fr 180px 110px 140px',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-primary)',
              borderBottom: '1px solid var(--border)',
              fontSize: '0.72rem',
              fontWeight: '700',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              <div>Intención</div>
              <div>Categoría</div>
              <div>Mensaje / Detalle</div>
              <div>Cliente & Origen</div>
              <div>Fecha</div>
              <div style={{ textAlign: 'right' }}>Acciones</div>
            </div>

            {/* Table Rows */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredNotes.map(note => {
                const cat = categoriesMap[note.category] || {
                  label: note.category,
                  emoji: '📌',
                  color: '#6366f1',
                  bg: 'rgba(99, 102, 241, 0.12)'
                };
                const isCompleted = note.status === 'completado';
                const intent = detectIntent(note.originalText || note.title);
                const subKeyword = extractSubKeyword(note.title, note.originalText);
                const cleanTitle = cleanNoteTitle(note.title);

                return (
                  <div
                    key={note.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '120px 100px 1fr 180px 110px 140px',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      alignItems: 'center',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      backgroundColor: isCompleted ? 'rgba(0, 0, 0, 0.15)' : 'transparent',
                      opacity: isCompleted ? 0.6 : 1,
                      transition: 'background 0.15s'
                    }}
                  >
                    {/* Intención */}
                    <div>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: '700',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: intent.bg,
                        color: intent.color,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}>
                        {intent.emoji} {intent.label}
                      </span>
                    </div>

                    {/* Categoría */}
                    <div>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: '600',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: cat.bg,
                        color: cat.color,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}>
                        {cat.emoji} {cat.label}
                      </span>
                    </div>

                    {/* Mensaje & Subkeyword */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {subKeyword && (
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: '700',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            backgroundColor: 'rgba(255,255,255,0.08)',
                            color: 'var(--text-primary)',
                            flexShrink: 0
                          }}>
                            {subKeyword}
                          </span>
                        )}
                        <strong style={{
                          fontSize: '0.85rem',
                          color: isCompleted ? 'var(--text-secondary)' : 'var(--text-primary)',
                          textDecoration: isCompleted ? 'line-through' : 'none',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }} title={note.originalText || note.title}>
                          {cleanTitle}
                        </strong>
                      </div>
                    </div>

                    {/* Cliente & Grupo */}
                    <div style={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {note.senderName || note.sourceName}
                      </strong>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {note.sourceName}
                      </div>
                    </div>

                    {/* Fecha */}
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      {formatDate(note.timestamp)}
                    </div>

                    {/* Acciones */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
                      <button
                        onClick={() => handleToggleStatus(note)}
                        title={isCompleted ? 'Marcar pendiente' : 'Marcar resuelto'}
                        style={{
                          backgroundColor: isCompleted ? 'transparent' : 'rgba(16, 185, 129, 0.15)',
                          border: isCompleted ? '1px solid var(--border)' : '1px solid #10b981',
                          color: isCompleted ? 'var(--text-secondary)' : '#10b981',
                          padding: '0.3rem 0.5rem',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          fontSize: '0.72rem',
                          fontWeight: '600',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem'
                        }}
                      >
                        {isCompleted ? <Circle size={12} /> : <Check size={12} />}
                        {isCompleted ? 'Pend.' : 'Listo'}
                      </button>

                      {note.chatId && onOpenChat && (
                        <button
                          onClick={() => onOpenChat(note.chatId)}
                          title="Abrir chat original"
                          style={{
                            background: 'none',
                            border: '1px solid var(--border)',
                            color: 'var(--accent)',
                            padding: '0.3rem',
                            borderRadius: '5px',
                            cursor: 'pointer'
                          }}
                        >
                          <ExternalLink size={13} />
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(note.id)}
                        title="Eliminar"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          padding: '0.3rem',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Consolidador de Pedidos */}
      <OrderSummaryModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        notes={notes}
        onResolveNote={handleToggleStatus}
        onOpenChat={onOpenChat}
      />

      {/* Modal: Administrador de Categorías */}
      <CategoryManagerModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        workspaceId="personal"
      />

      {/* Modal: Reglas de Extracción por Chat */}
      <ChatExtractionRulesModal
        isOpen={showChatRulesModal}
        onClose={() => setShowChatRulesModal(false)}
        workspaceId="personal"
      />

      {/* Modal: Nueva Nota Manual */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Nueva Tarea / Nota Manual</h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateManualNote} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Categoría
                </label>
                <select
                  value={newNote.category}
                  onChange={(e) => setNewNote({ ...newNote, category: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem'
                  }}
                >
                  {activeCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.emoji || '📌'} {cat.label || cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Título de la Tarea / Asunto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Llevar frutillas a Susana, Comprar bolsas..."
                  value={newNote.title}
                  onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Detalle / Nota
                </label>
                <textarea
                  rows={3}
                  placeholder="Detalles adicionales, cantidades, horario de entrega..."
                  value={newNote.originalText}
                  onChange={(e) => setNewNote({ ...newNote, originalText: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '0.6rem 1rem',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.6rem 1.25rem',
                    backgroundColor: '#6366f1',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Guardar Tarea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
