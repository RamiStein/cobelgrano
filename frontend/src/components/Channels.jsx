import { useState, useEffect } from 'react';
import { 
  Radio, CheckCircle2, AlertCircle, RefreshCw, Key, ExternalLink, 
  MessageSquare, ShieldCheck, Check, Sparkles, Smartphone, Share2
} from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';

const ZERNIO_BASE_URL = 'https://zernio.com/api/v1';

// Icono personalizado de Instagram
function InstagramIcon({ size = 22, color = "white" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
    </svg>
  );
}

// Icono personalizado de Facebook
function FacebookIcon({ size = 22, color = "white" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

export default function Channels() {
  const [config, setConfig] = useState({
    apiKey: '',
    profileId: '',
    profileName: 'Consultorios Odontológicos Belgrano',
    accountId: '',
    phoneNumber: '',
    status: 'disconnected', // 'disconnected', 'ready_to_connect', 'connected'
    instagramAccountId: '',
    instagramUsername: '',
    instagramStatus: 'disconnected',
    // Workspace Personal (Compañera)
    partnerProfileId: '6ab071431eb011d0b9ddaef7',
    partnerAccountId: '',
    partnerPhoneNumber: '',
    partnerStatus: 'disconnected'
  });

  const [inputApiKey, setInputApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // 1. Escuchar la configuración en Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'zernio_config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConfig(prev => ({ ...prev, ...data }));
        if (data.apiKey && !inputApiKey) {
          setInputApiKey(data.apiKey);
        }
      }
    });

    // 2. Detectar callback de Meta / Zernio en la URL
    const urlParams = new URLSearchParams(window.location.search);
    const connectedPlatform = urlParams.get('connected');
    const accountIdParam = urlParams.get('accountId');
    const usernameParam = urlParams.get('username');
    const profileIdParam = urlParams.get('profileId');

    if (connectedPlatform === 'whatsapp' && accountIdParam) {
      handleWhatsAppCallback(accountIdParam, usernameParam, profileIdParam);
    } else if (connectedPlatform === 'instagram' && accountIdParam) {
      handleInstagramCallback(accountIdParam, usernameParam, profileIdParam);
    }

    return () => unsub();
  }, []);

  const handleWhatsAppCallback = async (accId, username, profId) => {
    try {
      setLoading(true);
      const cleanPhone = username ? decodeURIComponent(username) : '';
      const isPersonal = profId === '6ab071431eb011d0b9ddaef7' || profId === config.partnerProfileId;

      if (isPersonal) {
        await setDoc(doc(db, 'system', 'zernio_config'), {
          partnerAccountId: accId,
          partnerPhoneNumber: cleanPhone,
          partnerStatus: 'connected',
          partnerProfileId: profId || '6ab071431eb011d0b9ddaef7',
          updatedAt: Date.now()
        }, { merge: true });

        setStatusMessage({
          type: 'success',
          text: `¡WhatsApp Personal (Compañera) vinculado con éxito! Número: ${cleanPhone}`
        });
      } else {
        await setDoc(doc(db, 'system', 'zernio_config'), {
          accountId: accId,
          phoneNumber: cleanPhone,
          status: 'connected',
          platform: 'whatsapp',
          profileId: profId || config.profileId || null,
          updatedAt: Date.now()
        }, { merge: true });

        setStatusMessage({
          type: 'success',
          text: `¡WhatsApp COB vinculado exitosamente con Meta Cloud y Zernio! Número: ${cleanPhone}`
        });
      }

      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      console.error('Error guardando callback de WhatsApp:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInstagramCallback = async (accId, username, profId) => {
    try {
      setLoading(true);
      const cleanUser = username ? decodeURIComponent(username) : 'Instagram User';
      await setDoc(doc(db, 'system', 'zernio_config'), {
        instagramAccountId: accId,
        instagramUsername: cleanUser,
        instagramStatus: 'connected',
        profileId: profId || config.profileId || null,
        updatedAt: Date.now()
      }, { merge: true });

      setStatusMessage({
        type: 'success',
        text: `¡Instagram Direct (@${cleanUser}) vinculado exitosamente con Zernio y el CRM!`
      });

      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      console.error('Error guardando callback de Instagram:', err);
    } finally {
      setLoading(false);
    }
  };

  // Guardar API Key
  const handleSaveApiKey = async (e) => {
    e.preventDefault();
    if (!inputApiKey.trim()) return;

    setLoading(true);
    setStatusMessage(null);
    try {
      const key = inputApiKey.trim();
      await setDoc(doc(db, 'system', 'zernio_config'), {
        apiKey: key,
        updatedAt: Date.now()
      }, { merge: true });

      setStatusMessage({ type: 'success', text: 'API Key de Zernio guardada correctamente.' });
      await checkAccounts(key);
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Error al guardar: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  // Paso 1: Crear perfil en Zernio
  const handleCreateProfile = async () => {
    const key = config.apiKey || inputApiKey.trim();
    if (!key) {
      setStatusMessage({ type: 'error', text: 'Ingresa primero tu API Key de Zernio.' });
      return;
    }

    setLoading(true);
    setStatusMessage({ type: 'info', text: 'Creando perfil COB en Zernio...' });
    try {
      const res = await fetch(`${ZERNIO_BASE_URL}/profiles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: "Consultorios Odontológicos Belgrano" })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Error al crear perfil');

      const profile = data.profile;
      await setDoc(doc(db, 'system', 'zernio_config'), {
        profileId: profile._id,
        profileName: profile.name,
        updatedAt: Date.now()
      }, { merge: true });

      setStatusMessage({ 
        type: 'success', 
        text: `Perfil creado exitosamente en Zernio (ID: ${profile._id}).` 
      });
      return profile._id;
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Error: ${err.message}` });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Paso 2: Iniciar Meta Embedded Signup para WhatsApp
  const handleConnectWhatsApp = async () => {
    const key = config.apiKey || inputApiKey.trim();
    if (!key) {
      setStatusMessage({ type: 'error', text: 'Falta la API Key de Zernio.' });
      return;
    }

    let pId = config.profileId;
    if (!pId) {
      pId = await handleCreateProfile();
      if (!pId) return;
    }

    setLoading(true);
    setStatusMessage({ type: 'info', text: 'Generando enlace oficial de Meta Embedded Signup...' });
    try {
      const redirectUrl = window.location.origin;
      const queryParams = new URLSearchParams({
        profileId: pId,
        onboarding: 'business_app',
        redirect_url: redirectUrl
      });

      const res = await fetch(`${ZERNIO_BASE_URL}/connect/whatsapp?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Error obteniendo enlace de conexión');

      if (data.authUrl) {
        setStatusMessage({
          type: 'info',
          text: 'Redirigiendo a Meta para vincular WhatsApp...'
        });
        window.location.href = data.authUrl;
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Error al conectar WhatsApp: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  // Paso 3: Iniciar conexión oficial con Instagram Direct
  const handleConnectInstagram = async () => {
    const key = config.apiKey || inputApiKey.trim();
    if (!key) {
      setStatusMessage({ type: 'error', text: 'Falta la API Key de Zernio.' });
      return;
    }

    let pId = config.profileId;
    if (!pId) {
      pId = await handleCreateProfile();
      if (!pId) return;
    }

    setLoading(true);
    setStatusMessage({ type: 'info', text: 'Generando enlace de autorización oficial de Instagram...' });
    try {
      const redirectUrl = window.location.origin;
      const queryParams = new URLSearchParams({
        profileId: pId,
        redirect_url: redirectUrl
      });

      const res = await fetch(`${ZERNIO_BASE_URL}/connect/instagram?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Error al solicitar autorización de Instagram');

      if (data.authUrl) {
        setStatusMessage({
          type: 'info',
          text: 'Redirigiendo a Meta/Instagram para autorizar los permisos de mensajería...'
        });
        window.location.href = data.authUrl;
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Error al conectar Instagram: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  // Paso 2B: Iniciar Meta Embedded Signup para WhatsApp Personal (Compañera)
  const handleConnectWhatsAppPartner = async () => {
    const key = config.apiKey || inputApiKey.trim();
    if (!key) {
      setStatusMessage({ type: 'error', text: 'Falta la API Key de Zernio.' });
      return;
    }

    setLoading(true);
    setStatusMessage({ type: 'info', text: 'Generando enlace oficial para la línea de tu compañera...' });
    try {
      const pId = config.partnerProfileId || '6ab071431eb011d0b9ddaef7';
      const redirectUrl = window.location.origin;
      const queryParams = new URLSearchParams({
        profileId: pId,
        onboarding: 'business_app',
        redirect_url: redirectUrl
      });

      const res = await fetch(`${ZERNIO_BASE_URL}/connect/whatsapp?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Error obteniendo enlace de conexión');

      if (data.authUrl) {
        setStatusMessage({
          type: 'info',
          text: 'Redirigiendo a Meta para vincular la línea de tu compañera...'
        });
        window.location.href = data.authUrl;
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Error al conectar WhatsApp Personal: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  // Comprobar cuentas existentes en Zernio (COB + Personal + Instagram)
  const checkAccounts = async (customKey) => {
    const key = customKey || config.apiKey || inputApiKey.trim();
    if (!key) return;

    setSyncing(true);
    try {
      const res = await fetch(`${ZERNIO_BASE_URL}/accounts`, {
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await res.json();
      if (res.ok && data.accounts) {
        const updatePayload = { lastChecked: Date.now() };

        for (const acc of data.accounts) {
          const profId = acc.profileId?._id || acc.profileId;
          const profName = (acc.profileId?.name || '').toLowerCase();

          if (acc.platform === 'whatsapp') {
            const isPersonal = profId === '6ab071431eb011d0b9ddaef7' || 
                               profId === config.partnerProfileId || 
                               profName.includes('personal') || 
                               profName.includes('familia') || 
                               profName.includes('compañera');

            if (isPersonal) {
              updatePayload.partnerAccountId = acc._id;
              updatePayload.partnerPhoneNumber = acc.username;
              updatePayload.partnerStatus = acc.isActive ? 'connected' : 'inactive';
            } else {
              updatePayload.accountId = acc._id;
              updatePayload.phoneNumber = acc.username;
              updatePayload.status = acc.isActive ? 'connected' : 'inactive';
            }
          } else if (acc.platform === 'instagram') {
            updatePayload.instagramAccountId = acc._id;
            updatePayload.instagramUsername = acc.username;
            updatePayload.instagramStatus = acc.isActive ? 'connected' : 'inactive';
          }
        }

        await setDoc(doc(db, 'system', 'zernio_config'), updatePayload, { merge: true });

        const statusTexts = [];
        if (updatePayload.phoneNumber) statusTexts.push(`COB: ${updatePayload.phoneNumber}`);
        if (updatePayload.partnerPhoneNumber) statusTexts.push(`Personal: ${updatePayload.partnerPhoneNumber}`);
        if (updatePayload.instagramUsername) statusTexts.push(`Instagram: @${updatePayload.instagramUsername}`);

        setStatusMessage({
          type: 'success',
          text: `Cuentas verificadas en Zernio: ${statusTexts.join(' | ') || 'Ninguna cuenta aún'}`
        });
      } else {
        throw new Error(data.error || data.message || 'Error al consultar cuentas');
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Consulta Zernio: ${err.message}` });
    } finally {
      setSyncing(false);
    }
  };

  const isWhatsAppConnected = config.status === 'connected' && config.accountId;
  const isPartnerWhatsAppConnected = config.partnerStatus === 'connected' && config.partnerAccountId;
  const isInstagramConnected = config.instagramStatus === 'connected' && config.instagramAccountId;

  return (
    <div className="channels-container" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Radio size={28} color="var(--accent)" />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', margin: 0 }}>Canales & Integraciones Oficiales</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          Conexión omnicanal unificada (WhatsApp, Instagram, Facebook y Ads) mediante <strong>Zernio API</strong> & <strong>Meta Cloud</strong>.
        </p>
      </div>

      {/* Banner de Mensajes / Estado */}
      {statusMessage && (
        <div style={{
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          backgroundColor: statusMessage.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : statusMessage.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
          border: `1px solid ${statusMessage.type === 'success' ? '#22c55e' : statusMessage.type === 'error' ? '#ef4444' : '#3b82f6'}`,
          color: 'var(--text-primary)'
        }}>
          {statusMessage.type === 'success' ? <CheckCircle2 color="#22c55e" size={20} /> : statusMessage.type === 'error' ? <AlertCircle color="#ef4444" size={20} /> : <Sparkles color="#3b82f6" size={20} />}
          <span style={{ fontSize: '0.9rem', flex: 1 }}>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Configuración de API Key de Zernio */}
      <div className="card" style={{
        backgroundColor: 'var(--bg-secondary)',
        padding: '1.5rem',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Key size={20} color="var(--accent)" />
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Autenticación Zernio API</h3>
          </div>
          <a 
            href="https://zernio.com/dashboard/api-keys" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ fontSize: '0.85rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}
          >
            Panel de API Keys <ExternalLink size={14} />
          </a>
        </div>

        <form onSubmit={handleSaveApiKey} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input 
              type={showKey ? 'text' : 'password'}
              value={inputApiKey}
              onChange={(e) => setInputApiKey(e.target.value)}
              placeholder="sk_..."
              style={{
                width: '100%',
                padding: '0.75rem 3rem 0.75rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: '0.9rem'
              }}
            />
            <button 
              type="button"
              onClick={() => setShowKey(!showKey)}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              {showKey ? 'Ocultar' : 'Ver'}
            </button>
          </div>

          <button 
            type="submit" 
            disabled={loading || !inputApiKey.trim()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {loading ? <RefreshCw className="spin" size={16} /> : <Check size={16} />}
            Guardar Clave
          </button>
        </form>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Esta clave conecta todos los canales (WhatsApp, Instagram, Meta Ads y Facebook) de forma centralizada en la nube.
        </p>
      </div>

      {/* Grid de Canales */}
      <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>Canales Disponibles</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* WhatsApp Card */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '12px',
          border: isWhatsAppConnected ? '2px solid #22c55e' : '1px solid var(--border)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(34, 197, 94, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <MessageSquare size={22} color="#22c55e" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>WhatsApp Cloud (Oficial)</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Meta Cloud API vía Zernio</span>
                </div>
              </div>

              <span style={{
                fontSize: '0.75rem',
                fontWeight: 'bold',
                padding: '4px 10px',
                borderRadius: '999px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: isWhatsAppConnected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: isWhatsAppConnected ? '#22c55e' : '#ef4444'
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isWhatsAppConnected ? '#22c55e' : '#ef4444'
                }} />
                {isWhatsAppConnected ? 'Conectado 24/7' : 'Desconectado'}
              </span>
            </div>

            {isWhatsAppConnected ? (
              <div style={{
                backgroundColor: 'var(--bg-primary)',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Número Vinculado:</span>
                  <strong>{config.phoneNumber || '+54 9 11 2616-3119'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Modo:</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#22c55e' }}>
                    <Smartphone size={14} /> Coexistencia Móvil + Web
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>ID Cuenta:</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{config.accountId}</span>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                Conexión oficial de WhatsApp mediante Meta Cloud API.
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              onClick={() => checkAccounts()}
              disabled={syncing}
              style={{
                flex: 1,
                padding: '0.75rem',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <RefreshCw size={16} className={syncing ? 'spin' : ''} />
              {syncing ? 'Verificando...' : 'Comprobar Estado'}
            </button>
          </div>
        </div>

        {/* WhatsApp Personal & Familia (Compañera) Card */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '12px',
          border: isPartnerWhatsAppConnected ? '2px solid #6366f1' : '1px solid var(--border)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <MessageSquare size={22} color="#6366f1" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>WhatsApp Personal (Compañera)</h3>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#818cf8', fontWeight: '600' }}>Grupos Escolares & Familia</span>
                </div>
              </div>

              <span style={{
                fontSize: '0.75rem',
                fontWeight: 'bold',
                padding: '4px 10px',
                borderRadius: '999px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: isPartnerWhatsAppConnected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: isPartnerWhatsAppConnected ? '#818cf8' : '#f59e0b'
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isPartnerWhatsAppConnected ? '#6366f1' : '#f59e0b'
                }} />
                {isPartnerWhatsAppConnected ? 'Conectado 24/7' : 'Listo para Vincular'}
              </span>
            </div>

            {isPartnerWhatsAppConnected ? (
              <div style={{
                backgroundColor: 'var(--bg-primary)',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Número Vinculado:</span>
                  <strong>{config.partnerPhoneNumber}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Espacio de Trabajo:</span>
                  <span style={{ color: '#818cf8', fontWeight: 'bold' }}>🏠 Personal & Familiar</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Organizador Inteligente:</span>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓ Activo (Colegio, Cumpleaños, Compras)</span>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                Conecta la línea de tu compañera con Meta Embedded Signup para que el sistema procese automáticamente sus grupos escolares (tareas, flautas, avisos), cumpleaños y compras familiares con aislamiento total de COB.
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            {isPartnerWhatsAppConnected ? (
              <button
                onClick={() => checkAccounts()}
                disabled={syncing}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <RefreshCw size={16} className={syncing ? 'spin' : ''} />
                {syncing ? 'Verificando...' : 'Comprobar Estado'}
              </button>
            ) : (
              <button
                onClick={handleConnectWhatsAppPartner}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#6366f1',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)'
                }}
              >
                <ExternalLink size={16} />
                ⚡ Vincular Teléfono de mi Compañera
              </button>
            )}
          </div>
        </div>

        {/* Instagram Direct Card */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '12px',
          border: isInstagramConnected ? '2px solid #e1306c' : '1px solid var(--border)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <InstagramIcon size={22} color="white" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Instagram Direct</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>DMs, Stories & Comentarios</span>
                </div>
              </div>

              <span style={{
                fontSize: '0.75rem',
                fontWeight: 'bold',
                padding: '4px 10px',
                borderRadius: '999px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: isInstagramConnected ? 'rgba(225, 48, 108, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: isInstagramConnected ? '#e1306c' : '#ef4444'
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isInstagramConnected ? '#e1306c' : '#ef4444'
                }} />
                {isInstagramConnected ? 'Conectado 24/7' : 'Desconectado'}
              </span>
            </div>

            {isInstagramConnected ? (
              <div style={{
                backgroundColor: 'var(--bg-primary)',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Cuenta Instagram:</span>
                  <strong>@{config.instagramUsername}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Canal:</span>
                  <span style={{ color: '#e1306c', fontWeight: 'bold' }}>Bandeja Unificada CRM</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>ID Zernio:</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{config.instagramAccountId}</span>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                Conecta la cuenta profesional de Instagram de COB para recibir y responder DMs y respuestas a Stories directamente en esta bandeja unificada.
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            {isInstagramConnected ? (
              <button
                onClick={() => checkAccounts()}
                disabled={syncing}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <RefreshCw size={16} className={syncing ? 'spin' : ''} />
                {syncing ? 'Verificando...' : 'Comprobar Estado'}
              </button>
            ) : (
              <button
                onClick={handleConnectInstagram}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 12px rgba(220, 39, 67, 0.3)'
                }}
              >
                <ExternalLink size={16} />
                Conectar Instagram con Meta
              </button>
            )}
          </div>
        </div>

        {/* Facebook Messenger Card */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          opacity: 0.85
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  backgroundColor: '#1877F2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FacebookIcon size={22} color="white" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Facebook Messenger</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Página Oficial COB</span>
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
                Zernio v1
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Recepción automática de mensajes provenientes de publicaciones y anuncios de la Fanpage oficial de Facebook.
            </p>
          </div>
          <button
            disabled
            style={{
              padding: '0.75rem',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              cursor: 'not-allowed',
              fontWeight: '600'
            }}
          >
            Próximo a activar (Paso 2)
          </button>
        </div>

        {/* Google Analytics & Meta Ads Attribution Card */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <ShieldCheck size={22} color="#3b82f6" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Meta Ads & Google Ads</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Atribución de Campañas</span>
                </div>
              </div>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 'bold',
                padding: '4px 8px',
                borderRadius: '6px',
                backgroundColor: 'rgba(34, 197, 94, 0.2)',
                color: '#22c55e'
              }}>
                Activo
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Rastreo inteligente de origen mediante enlaces UTM y eventos de conversión en <code>cobelgrano.com</code> conectado a Firestore.
            </p>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#3b82f6', fontWeight: '500' }}>
            ✓ Integrado con pestaña Publicidad & Leads
          </div>
        </div>

      </div>
    </div>
  );
}
