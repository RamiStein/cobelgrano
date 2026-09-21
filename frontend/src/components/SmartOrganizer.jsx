import { useState, useEffect } from 'react';
import { 
  Sparkles, CheckCircle2, Circle, Clock, Tag, MessageSquare, 
  Trash2, Plus, Search, Filter, AlertCircle, Calendar, ShoppingBag, 
  GraduationCap, Gift, Users, ExternalLink, Check, ChevronRight, X, Share2,
  QrCode as QrIcon, ArrowRight
} from 'lucide-react';
import { db } from '../firebase';
import { 
  collection, query, where, onSnapshot, doc, 
  updateDoc, deleteDoc, addDoc, orderBy 
} from 'firebase/firestore';

const CATEGORIES = {
  all: { id: 'all', label: 'Todos', icon: Sparkles, color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
  colegio: { id: 'colegio', label: 'Colegio & Niños', icon: GraduationCap, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  cumpleanos: { id: 'cumpleanos', label: 'Cumpleaños & Festejos', icon: Gift, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)' },
  compras: { id: 'compras', label: 'Compras & Encargos', icon: ShoppingBag, color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
  compromisos: { id: 'compromisos', label: 'Compromisos / Familia', icon: Calendar, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
};

export default function SmartOrganizer({ onOpenChat, onNavigateToChannels, isPartnerConnected, resetKey }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending'); // 'all', 'pending', 'completed'
  const [showAddModal, setShowAddModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Al hacer clic en la estrellita desde el menú lateral, restablecer filtros a "Todos"
  useEffect(() => {
    if (resetKey) {
      setSelectedCategory('all');
      setStatusFilter('pending');
      setSearchQuery('');
    }
  }, [resetKey]);

  const handleCopySummary = () => {
    const pendings = notes.filter(n => n.status !== 'completado');
    if (pendings.length === 0) {
      alert('No hay tareas pendientes en este momento.');
      return;
    }

    let text = '📋 *RESUMEN DE PENDIENTES - FAMILIA*\n\n';

    const colegio = pendings.filter(n => n.category === 'colegio');
    if (colegio.length > 0) {
      text += '🎒 *COLEGIO & NIÑOS:*\n';
      colegio.forEach(c => {
        text += `▫️ *${c.title}*\n   _Grupo/Origen:_ ${c.sourceName}\n   "${c.originalText.slice(0, 100)}"\n`;
      });
      text += '\n';
    }

    const cumple = pendings.filter(n => n.category === 'cumpleanos');
    if (cumple.length > 0) {
      text += '🎂 *CUMPLEAÑOS & FESTEJOS:*\n';
      cumple.forEach(c => {
        text += `▫️ *${c.title}*\n   "${c.originalText.slice(0, 100)}"\n`;
      });
      text += '\n';
    }

    const compras = pendings.filter(n => n.category === 'compras');
    if (compras.length > 0) {
      text += '🛒 *COMPRAS & ENCARGOS:*\n';
      compras.forEach(c => {
        text += `▫️ *${c.title}*\n`;
      });
      text += '\n';
    }

    const compromisos = pendings.filter(n => n.category === 'compromisos');
    if (compromisos.length > 0) {
      text += '📅 *COMPROMISOS / FAMILIA:*\n';
      compromisos.forEach(c => {
        text += `▫️ *${c.title}*\n`;
      });
      text += '\n';
    }

    text += '✨ _Organizado automáticamente por el CRM Inteligente_';

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // Formulario de nueva nota manual
  const [newNote, setNewNote] = useState({
    title: '',
    category: 'colegio',
    originalText: '',
    sourceName: 'Nota manual',
    senderName: 'Yo',
    priority: 'media'
  });

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
      // Sort chronologically in memory (newest first)
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
    if (confirm('¿Eliminar esta nota del organizador?')) {
      try {
        await deleteDoc(doc(db, 'smart_notes', noteId));
      } catch (err) {
        console.error('Error eliminando nota:', err);
      }
    }
  };

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
        timestamp: Math.floor(Date.now() / 1000),
        createdAt: Date.now()
      });

      setShowAddModal(false);
      setNewNote({
        title: '',
        category: 'colegio',
        originalText: '',
        sourceName: 'Nota manual',
        senderName: 'Yo',
        priority: 'media'
      });
    } catch (err) {
      console.error('Error creando nota manual:', err);
    }
  };

  // Filtrado de notas
  const filteredNotes = notes.filter(n => {
    // Filtro por categoría
    if (selectedCategory !== 'all' && n.category !== selectedCategory) {
      return false;
    }
    // Filtro por estado
    if (statusFilter === 'pending' && n.status === 'completado') return false;
    if (statusFilter === 'completed' && n.status !== 'completado') return false;

    // Filtro por búsqueda
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
  const colegioCount = notes.filter(n => n.category === 'colegio' && n.status !== 'completado').length;
  const cumpleCount = notes.filter(n => n.category === 'cumpleanos' && n.status !== 'completado').length;
  const comprasCount = notes.filter(n => n.category === 'compras' && n.status !== 'completado').length;
  const compromisosCount = notes.filter(n => n.category === 'compromisos' && n.status !== 'completado').length;

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
        padding: '1.5rem 2rem',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.6rem' }}>🧠</span>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
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
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.3rem 0 0 0' }}>
            Extracción y categorización automática de grupos de WhatsApp (escuela, festejos, compras y tareas del hogar).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button
            onClick={handleCopySummary}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: copied ? '#10b981' : 'var(--bg-secondary)',
              color: copied ? 'white' : 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '0.6rem 1rem',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            {copied ? <Check size={16} /> : <Share2 size={16} />}
            {copied ? '¡Copiado para WhatsApp!' : 'Copiar para WhatsApp'}
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '0.6rem 1.1rem',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
            }}
          >
            <Plus size={16} />
            Agregar Tarea Manual
          </button>
        </div>
      </div>

      {/* Banner de Vinculación de WhatsApp si no está conectado */}
      {!isPartnerConnected && (
        <div style={{
          margin: '1.25rem 2rem 0',
          padding: '1.1rem 1.4rem',
          backgroundColor: 'rgba(99, 102, 241, 0.12)',
          border: '1.5px solid #6366f1',
          borderRadius: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          boxShadow: '0 4px 20px rgba(99, 102, 241, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <QrIcon size={24} color="#ffffff" />
            </div>
            <div>
              <strong style={{ fontSize: '1rem', color: '#ffffff', display: 'block' }}>
                Línea de WhatsApp de tu compañera pendiente de vincular
              </strong>
              <span style={{ fontSize: '0.82rem', color: '#c7d2fe' }}>
                Para que el organizador lea automáticamente las tareas, flautas, cumpleaños y grupos de ella, escanea el código QR oficial.
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
              padding: '0.65rem 1.25rem',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'background 0.2s',
              boxShadow: '0 2px 10px rgba(99, 102, 241, 0.4)'
            }}
          >
            <QrIcon size={16} />
            Ver Código QR de Vinculación <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        padding: '1.5rem 2rem 0.5rem'
      }}>
        {/* Colegio */}
        <div 
          onClick={() => setSelectedCategory('colegio')}
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: selectedCategory === 'colegio' ? '1px solid #3b82f6' : '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Colegio & Niños</span>
            <span style={{ fontSize: '1.2rem' }}>🎒</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#3b82f6', marginTop: '0.3rem' }}>
            {colegioCount}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Tareas, flautas y avisos</span>
        </div>

        {/* Cumpleaños */}
        <div 
          onClick={() => setSelectedCategory('cumpleanos')}
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: selectedCategory === 'cumpleanos' ? '1px solid #ec4899' : '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cumpleaños</span>
            <span style={{ fontSize: '1.2rem' }}>🎂</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#ec4899', marginTop: '0.3rem' }}>
            {cumpleCount}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Festejos e invitaciones</span>
        </div>

        {/* Compras */}
        <div 
          onClick={() => setSelectedCategory('compras')}
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: selectedCategory === 'compras' ? '1px solid #10b981' : '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Compras & Pendientes</span>
            <span style={{ fontSize: '1.2rem' }}>🛒</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#10b981', marginTop: '0.3rem' }}>
            {comprasCount}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Farmacia, súper, encargos</span>
        </div>

        {/* Compromisos */}
        <div 
          onClick={() => setSelectedCategory('compromisos')}
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: selectedCategory === 'compromisos' ? '1px solid #f59e0b' : '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Familia / Citas</span>
            <span style={{ fontSize: '1.2rem' }}>📅</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#f59e0b', marginTop: '0.3rem' }}>
            {compromisosCount}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Médicos y compromisos</span>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div style={{
        padding: '1rem 2rem',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {Object.entries(CATEGORIES).map(([key, cat]) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.8rem',
                  borderRadius: '8px',
                  border: isSelected ? `1px solid ${cat.color}` : '1px solid var(--border)',
                  backgroundColor: isSelected ? cat.bg : 'var(--bg-secondary)',
                  color: isSelected ? cat.color : 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  fontWeight: isSelected ? '600' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <Icon size={14} />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Search & Status Toggle */}
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '0.35rem 0.75rem',
            width: '220px'
          }}>
            <Search size={14} style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }} />
            <input
              type="text"
              placeholder="Buscar tareas, notas..."
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
          </div>

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
              Resueltos
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
              Todos ({totalNotes})
            </button>
          </div>
        </div>
      </div>

      {/* Note Cards List */}
      <div style={{
        padding: '0.5rem 2rem 2rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: '1rem'
      }}>
        {loading ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            Cargando organizador inteligente...
          </div>
        ) : filteredNotes.length === 0 ? (
          <div style={{
            gridColumn: '1 / -1',
            textAlign: 'center',
            padding: '3rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: '1px dashed var(--border)'
          }}>
            <Sparkles size={40} style={{ color: '#6366f1', opacity: 0.6, marginBottom: '0.8rem' }} />
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>No hay notas pendientes en este filtro</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '400px', margin: '0 auto' }}>
              Los mensajes entrantes de los grupos escolares o de tu compañera sobre tareas, flautas, compras o cumpleaños aparecerán aquí automáticamente.
            </p>
          </div>
        ) : (
          filteredNotes.map(note => {
            const cat = CATEGORIES[note.category] || CATEGORIES.colegio;
            const CatIcon = cat.icon;
            const isCompleted = note.status === 'completado';

            return (
              <div
                key={note.id}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: isCompleted ? '1px solid var(--border)' : `1px solid ${cat.color}40`,
                  borderRadius: '12px',
                  padding: '1.2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: isCompleted ? 'none' : '0 2px 8px rgba(0,0,0,0.08)',
                  opacity: isCompleted ? 0.65 : 1,
                  transition: 'all 0.2s',
                  position: 'relative'
                }}
              >
                <div>
                  {/* Card Header: Category & Priority */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: cat.bg,
                      color: cat.color
                    }}>
                      <CatIcon size={12} />
                      {cat.label}
                    </span>

                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {formatDate(note.timestamp)}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 style={{
                    fontSize: '1.05rem',
                    fontWeight: '600',
                    color: isCompleted ? 'var(--text-secondary)' : 'var(--text-primary)',
                    textDecoration: isCompleted ? 'line-through' : 'none',
                    margin: '0 0 0.6rem 0',
                    lineHeight: '1.35'
                  }}>
                    {note.title}
                  </h3>

                  {/* Original text snippet / quote */}
                  <div style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'rgba(0, 0, 0, 0.12)',
                    padding: '0.6rem 0.8rem',
                    borderRadius: '6px',
                    borderLeft: `3px solid ${cat.color}`,
                    marginBottom: '0.8rem',
                    fontStyle: 'italic',
                    wordBreak: 'break-word',
                    lineHeight: '1.4'
                  }}>
                    "{note.originalText}"
                  </div>

                  {/* Origin & Sender */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: 'var(--border)', padding: '2px 6px', borderRadius: '4px' }}>
                      <Users size={11} />
                      {note.sourceName}
                    </span>
                    {note.senderName && note.senderName !== note.sourceName && (
                      <span style={{ opacity: 0.8 }}>
                        Por: <strong>{note.senderName}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border)',
                  marginTop: '0.5rem'
                }}>
                  <button
                    onClick={() => handleToggleStatus(note)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
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
                    {isCompleted ? <Circle size={14} /> : <Check size={14} />}
                    {isCompleted ? 'Marcar pendiente' : 'Marcar resuelto'}
                  </button>

                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    {note.chatId && onOpenChat && (
                      <button
                        onClick={() => onOpenChat(note.chatId)}
                        title="Abrir conversación original"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent)',
                          padding: '0.35rem',
                          cursor: 'pointer',
                          borderRadius: '4px'
                        }}
                      >
                        <ExternalLink size={16} />
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
                      onMouseEnter={(e) => e.target.style.color = '#ef4444'}
                      onMouseLeave={(e) => e.target.style.color = 'var(--text-secondary)'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal para agregar nota manual */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            width: '100%',
            maxWidth: '480px',
            padding: '1.5rem',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>Agregar Tarea / Nota Manual</h2>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateManualNote}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
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
                    fontSize: '0.85rem'
                  }}
                >
                  <option value="colegio">🎒 Colegio & Niños (flautas, tareas, exámenes)</option>
                  <option value="cumpleanos">🎂 Cumpleaños & Festejos</option>
                  <option value="compras">🛒 Compras & Pendientes (super, farmacia)</option>
                  <option value="compromisos">📅 Compromisos / Familia / Médico</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Título / Tarea a recordar *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Comprar flauta dulce para clase de música"
                  value={newNote.title}
                  onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Detalles o notas adicionales
                </label>
                <textarea
                  rows={3}
                  placeholder="Ej: La seño pidió que sea marca Yamaha o similar para el martes..."
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
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '0.6rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.6rem 1.2rem',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#6366f1',
                    color: 'white',
                    fontSize: '0.85rem',
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
