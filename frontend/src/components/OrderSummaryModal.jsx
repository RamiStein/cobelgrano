import { useState } from 'react';
import { 
  X, ShoppingBag, Copy, Check, ExternalLink, CheckCircle2, 
  Package, Users, Sparkles, AlertCircle 
} from 'lucide-react';

export function detectIntent(text = '') {
  const norm = (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Pedidos o encargos
  if (/(guarda|guardame|guardas|apartame|separame|me llevo|llevo|compro|comprar|quiero|quisiera|anotame|pedir|pedido|encargo|cajon|kilo|medio kilo|bolson|bolsón|reserva)/i.test(norm)) {
    return { type: 'pedido', label: 'Pedido / Reserva', emoji: '🛒', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
  }
  // Consultas de stock o precio
  if (/(vas a tener|van a tener|quedan|quedo|queda|hay|tenes|tenés|tiene|precio|cuanto|cuánto|cuanto esta|a que hora|cuando llegan|a que precio)/i.test(norm)) {
    return { type: 'consulta', label: 'Consulta de Stock', emoji: '❓', color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.15)' };
  }
  // Avisos o comunicados
  if (/(informamos|comunicamos|aviso|atencion|comunicado|no llegaron|cambio de horario|comunidad)/i.test(norm)) {
    return { type: 'aviso', label: 'Aviso / Proveedor', emoji: '📢', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' };
  }
  // Venta u oferta
  if (/(vendo|ofrezco|disponible|promo|oferta|talle|usado|nuevo sin uso)/i.test(norm)) {
    return { type: 'oferta', label: 'Oferta / Venta', emoji: '🏷️', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' };
  }
  return { type: 'general', label: 'Mensaje', emoji: '💬', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)' };
}

export function detectProductItem(text = '') {
  const norm = (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (norm.includes('frutilla')) return { label: 'Frutillas', emoji: '🍓' };
  if (norm.includes('palta')) return { label: 'Paltas', emoji: '🥑' };
  if (norm.includes('papa')) return { label: 'Papas', emoji: '🥔' };
  if (norm.includes('tomate')) return { label: 'Tomates', emoji: '🍅' };
  if (norm.includes('cebolla')) return { label: 'Cebollas', emoji: '🧅' };
  if (norm.includes('zanahoria')) return { label: 'Zanahorias', emoji: '🥕' };
  if (norm.includes('limon') || norm.includes('limón')) return { label: 'Limones', emoji: '🍋' };
  if (norm.includes('naranja')) return { label: 'Naranjas', emoji: '🍊' };
  if (norm.includes('banana')) return { label: 'Bananas', emoji: '🍌' };
  if (norm.includes('lechuga') || norm.includes('acelga') || norm.includes('espinaca')) return { label: 'Verduras de Hoja', emoji: '🥬' };
  if (norm.includes('miel')) return { label: 'Miel', emoji: '🍯' };
  if (norm.includes('huevo')) return { label: 'Huevos', emoji: '🥚' };
  if (norm.includes('queso')) return { label: 'Quesos', emoji: '🧀' };
  if (norm.includes('pan') || norm.includes('harina')) return { label: 'Panificados / Harinas', emoji: '🍞' };
  if (norm.includes('yerba')) return { label: 'Yerba', emoji: '🧉' };
  return { label: 'Otros Encargos', emoji: '📦' };
}

export default function OrderSummaryModal({ isOpen, onClose, notes, onResolveNote, onOpenChat }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Filtrar solo notas pendientes que representen un Pedido o Consulta de Stock
  const relevantNotes = notes.filter(n => {
    if (n.status === 'completado') return false;
    const intent = detectIntent(n.originalText || n.title).type;
    return intent === 'pedido' || intent === 'consulta';
  });

  // Agrupar por producto
  const grouped = {};
  relevantNotes.forEach(note => {
    const prod = detectProductItem(note.originalText || note.title);
    if (!grouped[prod.label]) {
      grouped[prod.label] = {
        emoji: prod.emoji,
        label: prod.label,
        items: []
      };
    }
    grouped[prod.label].items.push(note);
  });

  const productGroups = Object.values(grouped);
  const totalOrders = relevantNotes.length;
  const uniqueClients = new Set(relevantNotes.map(n => n.senderName || n.sourceName)).size;

  const handleCopySummary = () => {
    if (productGroups.length === 0) {
      alert('No hay pedidos activos para consolidar.');
      return;
    }

    let text = '📦 *CONSOLIDADO DE PEDIDOS & ENCARGOS*\n';
    text += `_Total detectados: ${totalOrders} pedidos (${uniqueClients} clientes)_\n\n`;

    productGroups.forEach(g => {
      text += `${g.emoji} *${g.label.toUpperCase()}* (${g.items.length}):\n`;
      g.items.forEach(item => {
        const client = item.senderName && item.senderName !== item.sourceName 
          ? `${item.senderName} (${item.sourceName})` 
          : item.sourceName;
        text += ` • *${client}:* "${(item.originalText || item.title).trim()}"\n`;
      });
      text += '\n';
    });

    text += '✨ _Organizado automáticamente con el CRM Inteligente_';

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1.5rem'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '750px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-primary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981'
            }}>
              <ShoppingBag size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
                Consolidador de Pedidos & Encargos
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Agrupación automática por producto para preparar mercadería o compras
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Metric Badges */}
        <div style={{
          padding: '1rem 1.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.75rem',
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          borderBottom: '1px solid var(--border)'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            padding: '0.75rem',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>
              Pedidos / Reservas
            </span>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10b981', marginTop: '0.2rem' }}>
              {totalOrders}
            </div>
          </div>
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            padding: '0.75rem',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>
              Productos Distintos
            </span>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#6366f1', marginTop: '0.2rem' }}>
              {productGroups.length}
            </div>
          </div>
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            padding: '0.75rem',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>
              Clientes Involucrados
            </span>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f59e0b', marginTop: '0.2rem' }}>
              {uniqueClients}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          {productGroups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <Package size={48} style={{ opacity: 0.4, marginBottom: '0.8rem' }} />
              <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.3rem 0', color: 'var(--text-primary)' }}>
                No hay pedidos pendientes detectados
              </h3>
              <p style={{ fontSize: '0.85rem', margin: 0 }}>
                Cuando los clientes pidan frutillas, paltas, verduras o mercadería por WhatsApp, aparecerán consolidados aquí.
              </p>
            </div>
          ) : (
            productGroups.map(group => (
              <div 
                key={group.label}
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  overflow: 'hidden'
                }}
              >
                <div style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.3rem' }}>{group.emoji}</span>
                    <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                      {group.label}
                    </strong>
                  </div>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981'
                  }}>
                    {group.items.length === 1 ? '1 pedido' : `${group.items.length} pedidos`}
                  </span>
                </div>

                <div style={{ padding: '0.5rem 0' }}>
                  {group.items.map(item => {
                    const clientName = item.senderName && item.senderName !== item.sourceName 
                      ? item.senderName 
                      : (item.sourceName || 'Cliente');
                    const intent = detectIntent(item.originalText || item.title);

                    return (
                      <div 
                        key={item.id}
                        style={{
                          padding: '0.65rem 1rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '1rem',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
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
                            <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                              {clientName}
                            </strong>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                              • {item.sourceName}
                            </span>
                          </div>
                          <div style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                            fontStyle: 'italic',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            "{item.originalText || item.title}"
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                          {item.chatId && onOpenChat && (
                            <button
                              onClick={() => {
                                onOpenChat(item.chatId);
                                onClose();
                              }}
                              title="Abrir chat para responder"
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
                          {onResolveNote && (
                            <button
                              onClick={() => onResolveNote(item)}
                              title="Marcar listo / preparado"
                              style={{
                                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid #10b981',
                                color: '#10b981',
                                padding: '0.35rem 0.55rem',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                            >
                              <Check size={13} /> Listo
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-primary)'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.55rem 1rem',
              backgroundColor: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            Cerrar
          </button>

          <button
            onClick={handleCopySummary}
            disabled={productGroups.length === 0}
            style={{
              padding: '0.55rem 1.25rem',
              backgroundColor: copied ? '#10b981' : '#6366f1',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: productGroups.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 2px 10px rgba(99, 102, 241, 0.3)',
              transition: 'background 0.2s'
            }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? '¡Copiado para WhatsApp!' : 'Copiar Resumen para WhatsApp'}
          </button>
        </div>
      </div>
    </div>
  );
}
