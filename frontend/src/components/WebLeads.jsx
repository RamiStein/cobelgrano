import { useState, useEffect } from 'react';
import { Globe, Phone, Clock, CheckCircle, AlertCircle, MessageSquare, Trash2, ExternalLink } from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';

function WebLeads() {
  const [leads, setLeads] = useState([]);
  const [filter, setFilter] = useState('todos');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'web_leads'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const items = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() });
      });
      setLeads(items);
      setLoading(false);
    }, (error) => {
      console.error('Error cargando web_leads:', error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const updateStatus = async (id, status) => {
    try {
      await updateDoc(doc(db, 'web_leads', id), { status });
    } catch (err) {
      console.error('Error al actualizar estado:', err);
    }
  };

  const deleteLead = async (id) => {
    if (window.confirm('¿Seguro que deseas eliminar este registro de consulta web?')) {
      try {
        await deleteDoc(doc(db, 'web_leads', id));
      } catch (err) {
        console.error('Error al eliminar:', err);
      }
    }
  };

  const getCleanPhone = (phoneStr) => {
    if (!phoneStr) return '';
    let cleaned = phoneStr.replace(/\D/g, '');
    if (cleaned.startsWith('549')) return cleaned;
    if (cleaned.startsWith('54')) return '549' + cleaned.slice(2);
    if (cleaned.startsWith('15')) cleaned = cleaned.slice(2);
    return '549' + cleaned;
  };

  const handleOpenWhatsApp = (lead) => {
    const phone = getCleanPhone(lead.telefono);
    const text = encodeURIComponent(
      '¡Hola ' + (lead.nombre || '') + '! Te contactamos de Consultorios Odontológicos Belgrano (COB). Vimos tu consulta web sobre ' + (lead.motivo || 'atención odontológica') + '. ¿Cómo podemos ayudarte?'
    );
    if (lead.status === 'nuevo') {
      updateStatus(lead.id, 'contactado');
    }
    window.open('https://wa.me/' + phone + '?text=' + text, '_blank');
  };

  const filteredLeads = leads.filter((l) => {
    if (filter === 'todos') return true;
    return (l.status || 'nuevo') === filter;
  });

  const totalNuevos = leads.filter(l => (l.status || 'nuevo') === 'nuevo').length;
  const totalContactados = leads.filter(l => l.status === 'contactado').length;
  const totalAgendados = leads.filter(l => l.status === 'agendado').length;

  return (
    <div style={{ padding: '3rem', flex: 1, overflowY: 'auto' }}>
      <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Globe color="#06b6d4" /> Consultas de la Web Oficial
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Pacientes que dejaron su consulta en la web oficial (cobelgrano.com).
          </p>
        </div>
        <a 
          href="https://cobelgrano.com" 
          target="_blank" 
          rel="noopener noreferrer" 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.2rem',
            borderRadius: '8px',
            background: 'var(--bg-glass)',
            border: '1px solid var(--border)',
            color: '#06b6d4',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: 500
          }}
        >
          Ver Web Oficial <ExternalLink size={16} />
        </a>
      </div>

      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card fade-in" style={{ cursor: 'pointer', border: filter === 'nuevo' ? '1px solid #eab308' : '1px solid var(--border)' }} onClick={() => setFilter('nuevo')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#eab308' }}>
            <AlertCircle size={20} />
            <span className="stat-label">Nuevos Pendientes</span>
          </div>
          <div className="stat-value">{totalNuevos}</div>
        </div>

        <div className="stat-card fade-in" style={{ cursor: 'pointer', border: filter === 'contactado' ? '1px solid #3b82f6' : '1px solid var(--border)' }} onClick={() => setFilter('contactado')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#3b82f6' }}>
            <Phone size={20} />
            <span className="stat-label">Contactados</span>
          </div>
          <div className="stat-value">{totalContactados}</div>
        </div>

        <div className="stat-card fade-in" style={{ cursor: 'pointer', border: filter === 'agendado' ? '1px solid #10b981' : '1px solid var(--border)' }} onClick={() => setFilter('agendado')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#10b981' }}>
            <CheckCircle size={20} />
            <span className="stat-label">Turnos Agendados</span>
          </div>
          <div className="stat-value">{totalAgendados}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {['todos', 'nuevo', 'contactado', 'agendado'].map((st) => (
          <button
            key={st}
            onClick={() => setFilter(st)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: filter === st ? '#06b6d4' : 'var(--border)',
              background: filter === st ? 'rgba(6, 182, 212, 0.15)' : 'var(--bg-glass)',
              color: filter === st ? '#06b6d4' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: filter === st ? 600 : 400,
              textTransform: 'capitalize'
            }}
          >
            {st === 'todos' ? 'Todos los registros' : st}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)', padding: '2rem 0' }}>Cargando consultas web...</div>
      ) : filteredLeads.length === 0 ? (
        <div style={{
          background: 'var(--bg-glass)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--text-secondary)'
        }}>
          No hay consultas en esta categoría.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredLeads.map((lead) => {
            const status = lead.status || 'nuevo';
            let badgeBg = 'rgba(234, 179, 8, 0.15)';
            let badgeColor = '#eab308';
            let badgeText = 'Nuevo';

            if (status === 'contactado') {
              badgeBg = 'rgba(59, 130, 246, 0.15)';
              badgeColor = '#3b82f6';
              badgeText = 'Contactado';
            } else if (status === 'agendado') {
              badgeBg = 'rgba(16, 185, 129, 0.15)';
              badgeColor = '#10b981';
              badgeText = 'Turno Agendado';
            }

            return (
              <div 
                key={lead.id} 
                className="fade-in"
                style={{
                  background: 'var(--bg-glass)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {lead.nombre || 'Sin nombre'}
                      </span>
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: badgeBg,
                        color: badgeColor
                      }}>
                        {badgeText}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Phone size={14} /> {lead.telefono}
                      </span>
                      {lead.fechaStr && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Clock size={14} /> {lead.fechaStr}
                        </span>
                      )}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#06b6d4', fontWeight: 500 }}>
                        Motivo: {lead.motivo || 'General'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                      onClick={() => handleOpenWhatsApp(lead)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: '#10b981',
                        color: '#ffffff',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      <MessageSquare size={16} /> Contactar por WhatsApp
                    </button>

                    <select
                      value={status}
                      onChange={(e) => updateStatus(lead.id, e.target.value)}
                      style={{
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        padding: '0.45rem 0.75rem',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      <option value="nuevo">Nuevo</option>
                      <option value="contactado">Contactado</option>
                      <option value="agendado">Turno Agendado</option>
                    </select>

                    <button
                      onClick={() => deleteLead(lead.id)}
                      title="Eliminar consulta"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '0.4rem',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {lead.mensaje && (
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.25)',
                    padding: '0.85rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    color: '#e4e4e7',
                    borderLeft: '3px solid #06b6d4'
                  }}>
                    {lead.mensaje}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default WebLeads;
