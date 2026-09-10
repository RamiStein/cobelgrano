import { useState, useEffect } from 'react';
import { Megaphone, Copy, Check, QrCode, ExternalLink, TrendingUp, Users, Target, Sparkles, Filter } from 'lucide-react';
import QRCode from 'react-qr-code';
import { db } from '../firebase';
import { collection, onSnapshot, query, getDocs } from 'firebase/firestore';

const CANALES = [
  { id: 'instagram_ads', name: 'Instagram Ads (Meta)', icon: '📸', color: '#e1306c' },
  { id: 'facebook_ads', name: 'Facebook Ads (Meta)', icon: '📘', color: '#1877f2' },
  { id: 'google_ads', name: 'Google Ads (Búsqueda)', icon: '🔍', color: '#4285f4' },
  { id: 'tiktok_ads', name: 'TikTok / Reels Orgánico', icon: '🎵', color: '#00f2fe' },
  { id: 'qr_folleto', name: 'Gráfica / Folletería / QR', icon: '📄', color: '#10b981' }
];

const TRATAMIENTOS = [
  'Ortodoncia y Alineadores Invisibles',
  'Implantes Dentales y Prótesis',
  'Estética Dental y Blanqueamiento',
  'Odontopediatría (Niños)',
  'Endodoncia y Tratamiento de Conducto',
  'Consulta General y Diagnóstico 3D',
  'Urgencia Odontológica'
];

const WHATSAPP_NUMBER = '5491138786782';

function Marketing() {
  const [selectedCanal, setSelectedCanal] = useState(CANALES[0]);
  const [selectedTratamiento, setSelectedTratamiento] = useState(TRATAMIENTOS[0]);
  const [customCampaignName, setCustomCampaignName] = useState('');
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  // Marketing Stats
  const [channelStats, setChannelStats] = useState({
    meta: 0,
    google: 0,
    web: 0,
    direct: 0
  });
  const [leadsList, setLeadsList] = useState([]);

  // Generate smart WhatsApp URL
  const campaignTag = customCampaignName.trim() ? ` [Ref: ${customCampaignName.trim()}]` : '';
  const prefilledText = `¡Hola COB! Vi su anuncio de ${selectedTratamiento} en ${selectedCanal.name}${campaignTag} y quisiera consultar para agendar un turno.`;
  const generatedUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(prefilledText)}`;

  useEffect(() => {
    // Listen to web_leads and contacts to calculate attribution
    const unsubLeads = onSnapshot(collection(db, 'web_leads'), (snap) => {
      let metaCount = 0;
      let googleCount = 0;
      let webCount = 0;
      const leads = [];

      snap.forEach(d => {
        const data = d.data();
        leads.push({ id: d.id, ...data, originType: 'Formulario Web' });
        const source = (data.utmSource || '').toLowerCase();
        if (source.includes('facebook') || source.includes('instagram') || source.includes('meta')) {
          metaCount++;
        } else if (source.includes('google')) {
          googleCount++;
        } else {
          webCount++;
        }
      });

      setChannelStats(prev => ({
        ...prev,
        meta: metaCount,
        google: googleCount,
        web: webCount
      }));
      setLeadsList(leads);
    });

    // Also analyze messages in contacts
    const unsubContacts = onSnapshot(collection(db, 'contacts'), (snap) => {
      let directCount = 0;
      snap.forEach(d => {
        const data = d.data();
        const tag = (data.tag || '').toLowerCase();
        if (tag.includes('meta') || tag.includes('instagram') || tag.includes('facebook')) {
          setChannelStats(prev => ({ ...prev, meta: prev.meta + 1 }));
        } else if (tag.includes('google')) {
          setChannelStats(prev => ({ ...prev, google: prev.google + 1 }));
        } else {
          directCount++;
        }
      });
      setChannelStats(prev => ({ ...prev, direct: directCount }));
    });

    return () => {
      unsubLeads();
      unsubContacts();
    };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div style={{ padding: '3rem', flex: 1, overflowY: 'auto', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Megaphone color="#f59e0b" size={32} /> Marketing & Publicidad COB
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Centro de generación de campañas, enlaces con atribución y recepción de anuncios de Meta y Google Ads.
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="stats-grid" style={{ marginBottom: '2.5rem' }}>
        <div className="stat-card fade-in" style={{ borderLeft: '4px solid #e1306c' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#e1306c' }}>
            <span style={{ fontSize: '1.25rem' }}>📸</span>
            <span className="stat-label">Meta Ads (IG & FB)</span>
          </div>
          <div className="stat-value">{channelStats.meta}</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Consultas de campañas de Meta</span>
        </div>

        <div className="stat-card fade-in" style={{ borderLeft: '4px solid #4285f4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#4285f4' }}>
            <span style={{ fontSize: '1.25rem' }}>🔍</span>
            <span className="stat-label">Google Ads & Búsqueda</span>
          </div>
          <div className="stat-value">{channelStats.google}</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Leads con origen Google</span>
        </div>

        <div className="stat-card fade-in" style={{ borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#10b981' }}>
            <span style={{ fontSize: '1.25rem' }}>🌐</span>
            <span className="stat-label">Web Oficial cobelgrano.com</span>
          </div>
          <div className="stat-value">{channelStats.web}</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Consultas directas del sitio</span>
        </div>
      </div>

      {/* Campaign Link Generator */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '20px',
        padding: '2rem',
        marginBottom: '2.5rem',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <Sparkles color="#10b981" size={24} />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 600, margin: 0 }}>
            Generador de Enlaces Inteligentes de WhatsApp (Click-to-WhatsApp)
          </h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', maxWidth: '750px' }}>
          Crea el enlace exacto para colocar en tus anuncios de Instagram, Facebook o Google. Cuando el paciente toque el anuncio, abrirá WhatsApp con el mensaje pre-cargado que el CRM detectará automáticamente.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Canal Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>
              1. Canal Publicitario
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {CANALES.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCanal(c)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.65rem 1rem',
                    borderRadius: '10px',
                    border: selectedCanal.id === c.id ? `2px solid ${c.color}` : '1px solid var(--border)',
                    background: selectedCanal.id === c.id ? 'rgba(255,255,255,0.06)' : 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '0.9rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <span>{c.icon}</span>
                  <span style={{ fontWeight: selectedCanal.id === c.id ? 600 : 400 }}>{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tratamiento Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>
              2. Especialidad / Tratamiento del Anuncio
            </label>
            <select
              value={selectedTratamiento}
              onChange={(e) => setSelectedTratamiento(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
                outline: 'none',
                cursor: 'pointer',
                marginBottom: '1rem'
              }}
            >
              {TRATAMIENTOS.map(t => (
                <option key={t} value={t} style={{ background: '#1a1d24', color: '#fff' }}>
                  {t}
                </option>
              ))}
            </select>

            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>
              3. Nombre Interno de Campaña (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: Promo Septiembre, PMax Buenos Aires"
              value={customCampaignName}
              onChange={(e) => setCustomCampaignName(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Output Link Box */}
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '14px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <strong>Vista previa del mensaje que enviará el paciente:</strong>
            <div style={{ marginTop: '0.4rem', color: 'var(--accent)', fontStyle: 'italic' }}>
              "{prefilledText}"
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            background: 'rgba(0,0,0,0.3)',
            padding: '0.6rem 1rem',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <span style={{ fontSize: '0.85rem', color: '#a1a1aa', wordBreak: 'break-all', flex: 1, fontFamily: 'monospace' }}>
              {generatedUrl}
            </span>
            <button
              onClick={handleCopy}
              style={{
                background: copied ? '#059669' : 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                flexShrink: 0
              }}
            >
              {copied ? <><Check size={16} /> Copiado</> : <><Copy size={16} /> Copiar Enlace</>}
            </button>
            <button
              onClick={() => setShowQr(!showQr)}
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '0.5rem 0.85rem',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                flexShrink: 0
              }}
            >
              <QrCode size={16} /> {showQr ? 'Ocultar QR' : 'Ver QR'}
            </button>
            <a
              href={generatedUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'transparent',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                padding: '0.5rem'
              }}
              title="Probar enlace"
            >
              <ExternalLink size={18} />
            </a>
          </div>

          {showQr && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem', background: 'white', borderRadius: '12px', width: 'fit-content', margin: '0.5rem auto' }}>
              <QRCode value={generatedUrl} size={180} />
              <span style={{ color: '#000', fontSize: '0.75rem', fontWeight: 600, marginTop: '0.5rem' }}>
                QR para Folleto / Impresión
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Guide for Meta & Google Ads */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '1.5rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem'
      }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#e1306c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📸 Cómo usarlo en Meta Ads (Instagram / Facebook)
          </h3>
          <ol style={{ paddingLeft: '1.2rem', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.8, marginTop: '0.5rem' }}>
            <li>En Meta Ads Manager, crea una campaña con objetivo <strong>"Interacción"</strong> o <strong>"Clientes potenciales"</strong>.</li>
            <li>En ubicación de destino, elige <strong>"Apps de mensajería"</strong> (WhatsApp) o <strong>"Sitio web"</strong>.</li>
            <li>Pega este enlace generado o usa el texto sugerido como plantilla de mensaje inicial.</li>
            <li>¡Listo! El CRM de COB etiquetará al paciente apenas escriba.</li>
          </ol>
        </div>

        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#4285f4', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🔍 Cómo usarlo en Google Ads
          </h3>
          <ol style={{ paddingLeft: '1.2rem', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.8, marginTop: '0.5rem' }}>
            <li>En tus campañas de Búsqueda, agrega la <strong>Extensión de Mensajes</strong> de WhatsApp.</li>
            <li>Coloca el enlace generado como destino de la extensión.</li>
            <li>En los anuncios que van a <code>cobelgrano.com</code>, las UTMs son capturadas automáticamente por el sitio oficial.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default Marketing;
