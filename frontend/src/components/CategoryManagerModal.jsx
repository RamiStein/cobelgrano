import { useState } from 'react';
import { 
  X, Plus, Edit2, Trash2, Check, Sparkles, Tag, Palette, 
  HelpCircle, RefreshCw, FolderPlus, AlertCircle
} from 'lucide-react';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc, collection, writeBatch } from 'firebase/firestore';

export const DEFAULT_TEMPLATES = {
  personal: {
    id: 'personal',
    name: 'Personal & Familia',
    description: 'Colegio, niños, cumpleaños, compras del hogar y citas familiares.',
    icon: '👨‍👩‍👧‍👦',
    categories: [
      {
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
      {
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
      {
        id: 'compras',
        label: 'Compras & Hogar',
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
      {
        id: 'compromisos',
        label: 'Compromisos & Citas',
        emoji: '📅',
        color: '#f59e0b',
        keywords: [
          'pediatra', 'medico', 'médico', 'dentista', 'turno', 'cita', 'control',
          'asado', 'almuerzo familiar', 'cena familiar', 'visitar', 'abuela', 'abuelos',
          'natacion', 'natación', 'futbol', 'fútbol', 'danza', 'gimnasia', 'partido',
          'cumple de mamá', 'cumple de papá', 'aniversario', 'viaje', 'escapada'
        ]
      },
      {
        id: 'finanzas',
        label: 'Gastos & Servicios',
        emoji: '💳',
        color: '#8b5cf6',
        keywords: [
          'pagar', 'pago', 'luz', 'gas', 'aysa', 'edenor', 'edesur', 'expensas',
          'internet', 'cable', 'transferencia', 'vencimiento', 'factura', 'comprobante',
          'cuota', 'tarjeta', 'deuda', 'resumen', 'banco'
        ]
      }
    ]
  },
  comercio: {
    id: 'comercio',
    name: 'Ventas & Comercio',
    description: 'Pedidos de clientes, precios, pagos recibidos, envíos y reclamos.',
    icon: '🏪',
    categories: [
      {
        id: 'pedidos',
        label: 'Nuevos Pedidos',
        emoji: '📦',
        color: '#3b82f6',
        keywords: [
          'quiero comprar', 'hacer un pedido', 'encargar', 'precio', 'cuanto sale', 'cuánto sale',
          'cuanto cuesta', 'cuánto cuesta', 'stock', 'catalogo', 'catálogo', 'talle', 'color',
          'disponible', 'me guardas', 'me reservás', 'pedido'
        ]
      },
      {
        id: 'pagos',
        label: 'Pagos & Transferencias',
        emoji: '🧾',
        color: '#10b981',
        keywords: [
          'transferencia', 'comprobante', 'ya pague', 'ya pagué', 'te transferí', 'te transferi',
          'alias', 'cbu', 'link de pago', 'tarjeta', 'efectivo', 'factura', 'recibo', 'abonado'
        ]
      },
      {
        id: 'envios',
        label: 'Envíos & Logística',
        emoji: '🚚',
        color: '#f59e0b',
        keywords: [
          'envio', 'envío', 'cuando llega', 'cuándo llega', 'andreani', 'oca', 'correo argentino',
          'seguimiento', 'despacho', 'direccion', 'dirección', 'moto', 'repartidor', 'cadete'
        ]
      },
      {
        id: 'consultas',
        label: 'Consultas & Horarios',
        emoji: '💬',
        color: '#8b5cf6',
        keywords: [
          'horario', 'abierto', 'direccion', 'ubicacion', 'donde estan', 'dónde están',
          'local', 'sucursal', 'telefono', 'consulta', 'duda'
        ]
      },
      {
        id: 'reclamos',
        label: 'Reclamos & Garantías',
        emoji: '⚠️',
        color: '#ef4444',
        keywords: [
          'reclamo', 'garantia', 'garantía', 'vino roto', 'no funciona', 'falta', 'devolucion',
          'devolución', 'cambio', 'falla', 'queja', 'demora'
        ]
      }
    ]
  },
  salud: {
    id: 'salud',
    name: 'Consultorio & Salud',
    description: 'Turnos médicos/dentales, urgencias, presupuestos y obras sociales.',
    icon: '🦷',
    categories: [
      {
        id: 'turnos_salud',
        label: 'Turnos & Citas',
        emoji: '🗓️',
        color: '#3b82f6',
        keywords: [
          'turno', 'cita', 'consulta', 'horario disponible', 'cuando puedo ir', 'cuándo puedo ir',
          'reprogramar', 'cancelar turno', 'atencion', 'atención', 'doctor', 'doctora'
        ]
      },
      {
        id: 'urgencias',
        label: 'Urgencias & Dolor',
        emoji: '🚨',
        color: '#ef4444',
        keywords: [
          'urgencia', 'dolor', 'me duele', 'muela', 'roto', 'se quebro', 'se cayó', 'flemón',
          'sangra', 'hinchado', 'inflamado', 'infeccion', 'infección', 'antibiotico', 'antibiótico'
        ]
      },
      {
        id: 'presupuestos',
        label: 'Tratamientos & Costos',
        emoji: '📋',
        color: '#10b981',
        keywords: [
          'presupuesto', 'cuanto cuesta', 'implante', 'ortodoncia', 'brackets', 'conducto',
          'protesis', 'prótesis', 'corona', 'limpieza', 'blanqueamiento', 'extraccion', 'extracción'
        ]
      },
      {
        id: 'obras_sociales',
        label: 'Obras Sociales & Prepagas',
        emoji: '📑',
        color: '#8b5cf6',
        keywords: [
          'obra social', 'prepaga', 'osde', 'swiss medical', 'galeno', 'ioma', 'pami',
          'cobertura', 'reintegro', 'carnet', 'credencial', 'autorizacion', 'autorización'
        ]
      }
    ]
  },
  educacion: {
    id: 'educacion',
    name: 'Cursos & Alumnos',
    description: 'Inscripciones, cuotas, fechas de exámenes y dudas de alumnos.',
    icon: '🎓',
    categories: [
      {
        id: 'inscripciones',
        label: 'Inscripciones & Vacantes',
        emoji: '📝',
        color: '#3b82f6',
        keywords: [
          'inscripcion', 'inscripción', 'anotarse', 'vacante', 'requisitos', 'arancel',
          'inicio de clases', 'formulario', 'matricula', 'matrícula'
        ]
      },
      {
        id: 'examenes',
        label: 'Exámenes & Clases',
        emoji: '📚',
        color: '#f59e0b',
        keywords: [
          'examen', 'parcial', 'final', 'fecha de examen', 'recuperatorio', 'entrega',
          'trabajo practico', 'tp', 'temario', 'clase', 'zoom', 'link de la clase'
        ]
      },
      {
        id: 'cuotas',
        label: 'Cuotas & Cobranzas',
        emoji: '💵',
        color: '#10b981',
        keywords: [
          'cuota', 'arancel', 'pago de cuota', 'comprobante de pago', 'recibo', 'vencimiento',
          'alias del colegio', 'transferencia cuota'
        ]
      },
      {
        id: 'alumnos',
        label: 'Consultas & Alumnos',
        emoji: '🎒',
        color: '#8b5cf6',
        keywords: [
          'certificado', 'constancia de alumno regular', 'inasistencia', 'falta', 'justificativo',
          'notas', 'boletin', 'boletín', 'profesor', 'profesora'
        ]
      }
    ]
  }
};

const COLOR_PALETTE = [
  '#3b82f6', '#ec4899', '#10b981', '#f59e0b', 
  '#8b5cf6', '#06b6d4', '#ef4444', '#14b8a6'
];

const POPULAR_EMOJIS = [
  '🎒', '🎂', '🛒', '📅', '💳', '📦', '💰', '🧾', 
  '🚚', '⚠️', '🗓️', '🚨', '📋', '🔬', '📚', '🎓', 
  '💼', '💡', '⭐', '🩺', '🏠', '🔑', '🏷️', '📌'
];

export default function CategoryManagerModal({ isOpen, onClose, categories = [], workspaceId = 'personal' }) {
  const [editingCatId, setEditingCatId] = useState(null);
  const [formName, setFormName] = useState('');
  const [formEmoji, setFormEmoji] = useState('📌');
  const [formColor, setFormColor] = useState('#3b82f6');
  const [formKeywords, setFormKeywords] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleStartEdit = (cat) => {
    setEditingCatId(cat.id);
    setFormName(cat.label || cat.name || '');
    setFormEmoji(cat.emoji || '📌');
    setFormColor(cat.color || '#3b82f6');
    setFormKeywords(Array.isArray(cat.keywords) ? cat.keywords.join(', ') : (cat.keywords || ''));
  };

  const handleCancelEdit = () => {
    setEditingCatId(null);
    setFormName('');
    setFormEmoji('📌');
    setFormColor('#3b82f6');
    setFormKeywords('');
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setSaving(true);
    try {
      const slug = editingCatId || formName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
      const kwArray = formKeywords
        .split(',')
        .map(k => k.trim().toLowerCase())
        .filter(k => k.length > 1);

      await setDoc(doc(db, 'custom_categories', slug), {
        id: slug,
        label: formName.trim(),
        name: formName.trim(),
        emoji: formEmoji || '📌',
        color: formColor || '#3b82f6',
        keywords: kwArray,
        workspaceId: workspaceId,
        updatedAt: Date.now()
      }, { merge: true });

      handleCancelEdit();
    } catch (err) {
      console.error('Error guardando categoría:', err);
      alert('Error guardando categoría: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (catId) => {
    if (!confirm('¿Seguro que deseas eliminar esta categoría? Las notas existentes conservarán su etiqueta histórica.')) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'custom_categories', catId));
    } catch (err) {
      console.error('Error eliminando categoría:', err);
    }
  };

  const handleApplyTemplate = async (templateKey) => {
    const template = DEFAULT_TEMPLATES[templateKey];
    if (!template) return;

    if (!confirm(`¿Cargar la plantilla "${template.name}"? Esto configurará automáticamente ${template.categories.length} categorías especializadas.`)) {
      return;
    }

    setSaving(true);
    try {
      for (const cat of template.categories) {
        await setDoc(doc(db, 'custom_categories', cat.id), {
          ...cat,
          workspaceId: workspaceId,
          updatedAt: Date.now()
        }, { merge: true });
      }
      alert(`¡Plantilla "${template.name}" aplicada con éxito!`);
    } catch (err) {
      console.error('Error aplicando plantilla:', err);
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '750px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--border)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(99, 102, 241, 0.08)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.4rem' }}>⚙️</span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
                Personalizar Categorías y Extracción
              </h2>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Crea categorías a tu medida para cualquier usuario o número de WhatsApp conectado.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          
          {/* Preset Templates Section */}
          <div style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            backgroundColor: 'var(--bg-primary)',
            borderRadius: '12px',
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Sparkles size={16} color="#6366f1" />
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                Cargar Plantilla Rápida de Categorías
              </strong>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '0.6rem'
            }}>
              {Object.entries(DEFAULT_TEMPLATES).map(([key, tpl]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleApplyTemplate(key)}
                  disabled={saving}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '0.65rem 0.8rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    opacity: saving ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#6366f1'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>{tpl.icon}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700' }}>{tpl.name}</span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: '1.2' }}>
                    {tpl.categories.length} categorías listas
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Form to Add / Edit Category */}
          <div style={{
            marginBottom: '1.5rem',
            padding: '1.2rem',
            backgroundColor: editingCatId ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-primary)',
            borderRadius: '12px',
            border: editingCatId ? '1.5px solid #6366f1' : '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {editingCatId ? <Edit2 size={16} color="#6366f1" /> : <Plus size={16} color="#10b981" />}
                {editingCatId ? 'Editar Categoría' : 'Nueva Categoría Personalizada'}
              </strong>
              {editingCatId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Cancelar edición
                </button>
              )}
            </div>

            <form onSubmit={handleSaveCategory}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                {/* Emoji Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Emoji
                  </label>
                  <input
                    type="text"
                    value={formEmoji}
                    onChange={(e) => setFormEmoji(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      textAlign: 'center',
                      fontSize: '1.3rem',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)'
                    }}
                    maxLength={4}
                  />
                </div>

                {/* Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Nombre de la Categoría *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Nuevos Pedidos, Médicos, etc."
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.8rem',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
              </div>

              {/* Quick Emojis */}
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.85rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginRight: '0.3rem' }}>Sugeridos:</span>
                {POPULAR_EMOJIS.slice(0, 16).map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setFormEmoji(emoji)}
                    style={{
                      background: formEmoji === emoji ? '#6366f130' : 'none',
                      border: formEmoji === emoji ? '1px solid #6366f1' : '1px solid transparent',
                      borderRadius: '4px',
                      padding: '2px 4px',
                      cursor: 'pointer',
                      fontSize: '0.95rem'
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Color Picker */}
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Color Identificador
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {COLOR_PALETTE.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormColor(c)}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: c,
                        border: formColor === c ? '2.5px solid white' : '1px solid transparent',
                        boxShadow: formColor === c ? `0 0 0 2px ${c}` : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {formColor === c && <Check size={12} color="white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Keywords */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Palabras Clave de Detección (separadas por coma) *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Ej: pedido, encargar, stock, precio, talle, catálogo, cuánto cuesta"
                  value={formKeywords}
                  onChange={(e) => setFormKeywords(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                    lineHeight: '1.4'
                  }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem', display: 'block' }}>
                  💡 Cuando un mensaje entrante en WhatsApp contenga alguna de estas palabras, el sistema lo clasificará aquí.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.6rem 1.25rem',
                    backgroundColor: editingCatId ? '#6366f1' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                  }}
                >
                  <Check size={16} />
                  {editingCatId ? 'Actualizar Categoría' : 'Agregar Categoría'}
                </button>
              </div>
            </form>
          </div>

          {/* Current Categories List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                Categorías Activas ({categories.length})
              </strong>
            </div>

            {categories.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '2rem',
                backgroundColor: 'var(--bg-primary)',
                borderRadius: '12px',
                border: '1px dashed var(--border)'
              }}>
                <Tag size={32} style={{ color: 'var(--text-secondary)', opacity: 0.5, marginBottom: '0.5rem' }} />
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Aún no tienes categorías personalizadas. Puedes cargar una plantilla rápida arriba o crear una nueva.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {categories.map(cat => {
                  const kwList = Array.isArray(cat.keywords) ? cat.keywords : [];
                  return (
                    <div
                      key={cat.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.85rem 1rem',
                        backgroundColor: 'var(--bg-primary)',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        gap: '1rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                        <span style={{
                          fontSize: '1.3rem',
                          backgroundColor: `${cat.color}20`,
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {cat.emoji || '📌'}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                              {cat.label || cat.name}
                            </strong>
                            <span style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: cat.color || '#3b82f6'
                            }} />
                          </div>
                          <span style={{
                            fontSize: '0.72rem',
                            color: 'var(--text-secondary)',
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '400px'
                          }}>
                            {kwList.slice(0, 6).join(', ')}{kwList.length > 6 ? ` (+${kwList.length - 6} más)` : ''}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(cat)}
                          title="Editar categoría"
                          style={{
                            background: 'none',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            color: 'var(--text-secondary)',
                            padding: '0.4rem 0.6rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            fontSize: '0.75rem'
                          }}
                        >
                          <Edit2 size={13} />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat.id)}
                          title="Eliminar categoría"
                          style={{
                            background: 'none',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '6px',
                            color: '#ef4444',
                            padding: '0.4rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'flex-end',
          backgroundColor: 'var(--bg-secondary)'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.6rem 1.4rem',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Listo / Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
