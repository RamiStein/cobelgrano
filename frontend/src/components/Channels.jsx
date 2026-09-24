import { useState, useEffect } from 'react';
import { 
  Radio, CheckCircle2, AlertCircle, RefreshCw, Key, ExternalLink, 
  MessageSquare, ShieldCheck, Check, Sparkles, Smartphone, Share2, QrCode as QrIcon,
  X, Maximize2
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';

const ZERNIO_BASE_URL = 'https://zernio.com/api/v1';

const DEFAULT_PARTNER_AUTH_URL = 'https://www.facebook.com/v22.0/dialog/oauth?client_id=712341431446535&redirect_uri=https%3A%2F%2Fzernio.com%2Fapi%2Fv1%2Fconnect%2Fwhatsapp%2Fcallback&scope=whatsapp_business_management%2Cwhatsapp_business_messaging%2Cwhatsapp_business_manage_events%2Cbusiness_management&response_type=code&config_id=920007930882314&override_default_response_type=true&state=6a5b7e6d434a613f8ae316c3-6ab071431eb011d0b9ddaef7-1789957305227-https%253A%252F%252Ffrontend-lovat-five-bbcuj2lohv.vercel.app-ct_4b767717f43a7f26736229ac2ae5cd83fc3d9e0b4df130b4&extras=%7B%22sessionInfoVersion%22%3A%223%22%2C%22featureType%22%3A%22whatsapp_business_app_onboarding%22%7D';

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
    apiKey: 'sk_8e06ac9cdb51753e1992f6286a6dc3277d525ca5704639fcc577e403e2ccddb4',
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
    partnerStatus: 'disconnected',
    partnerAuthUrl: DEFAULT_PARTNER_AUTH_URL
  });

  const [inputApiKey, setInputApiKey] = useState('sk_8e06ac9cdb51753e1992f6286a6dc3277d525ca5704639fcc577e403e2ccddb4');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // QR y enlace de WhatsApp Personal
  const [partnerAuthUrl, setPartnerAuthUrl] = useState(DEFAULT_PARTNER_AUTH_URL);
  const [partnerWebQr, setPartnerWebQr] = useState(null);
  const [loadingPartnerQr, setLoadingPartnerQr] = useState(false);
  const [copiedPartnerLink, setCopiedPartnerLink] = useState(false);
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Modo de vinculación: 'code' (código de 8 dígitos) o 'qr' (cámara)
  const [partnerLinkMode, setPartnerLinkMode] = useState('code');
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingCode, setPairingCode] = useState(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState(null);
  const [copiedPairingCode, setCopiedPairingCode] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleResetWhatsAppSession = async () => {
    setIsResetting(true);
    try {
      await setDoc(doc(db, 'system', 'partner_reset_request'), {
        triggerReset: Date.now()
      }, { merge: true });
      alert('Reiniciando sesión limpia de WhatsApp Web. En segundos tendrás un nuevo código QR y código de vinculación listos.');
    } catch (err) {
      alert('Error reiniciando sesión: ' + err.message);
    } finally {
      setTimeout(() => setIsResetting(false), 5000);
    }
  };

  const fetchPartnerAuthUrl = async (customKey) => {
    const key = customKey || config.apiKey || inputApiKey.trim();
    if (!key) return;

    setLoadingPartnerQr(true);
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
      if (res.ok && data.authUrl) {
        setPartnerAuthUrl(data.authUrl);
      }
    } catch (err) {
      console.error('Error obteniendo QR de WhatsApp Personal:', err);
    } finally {
      setLoadingPartnerQr(false);
    }
  };

  // 1. Escuchar la configuración en Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'zernio_config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConfig(prev => ({ ...prev, ...data }));
        if (data.apiKey) {
          setInputApiKey(data.apiKey);
        }
        if (data.partnerQr) {
          setPartnerWebQr(data.partnerQr);
        }
        if (data.partnerAuthUrl) {
          setPartnerAuthUrl(data.partnerAuthUrl);
        } else if (data.apiKey && data.partnerStatus !== 'connected') {
          fetchPartnerAuthUrl(data.apiKey);
        }
      }
    });

    const unsubPartner = onSnapshot(doc(db, 'system', 'partner_status'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.qr) {
          setPartnerWebQr(d.qr);
        }
        if (d.pairingCode) {
          setPairingCode(d.pairingCode);
          setPairingLoading(false);
        }
        if (d.status === 'connected' && d.phoneNumber) {
          setConfig(prev => ({
            ...prev,
            partnerStatus: 'connected',
            partnerPhoneNumber: d.phoneNumber
          }));
        }
      }
    });

    const unsubPairingReq = onSnapshot(doc(db, 'system', 'partner_pairing_request'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.status === 'ready' && d.code) {
          setPairingCode(d.code);
          setPairingLoading(false);
          setPairingError(null);
        } else if (d.status === 'error') {
          setPairingError(d.error || 'Error al generar código.');
          setPairingLoading(false);
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

    return () => {
      unsub();
      unsubPartner();
      unsubPairingReq();
    };
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

  const handleRequestPairingCode = async (e) => {
    if (e) e.preventDefault();
    if (!pairingPhone.trim()) {
      setStatusMessage({ type: 'error', text: 'Por favor ingresa el número de WhatsApp de tu compañera.' });
      return;
    }
    setPairingLoading(true);
    setPairingError(null);
    try {
      await setDoc(doc(db, 'system', 'partner_pairing_request'), {
        phoneNumber: pairingPhone.trim(),
        status: 'requested',
        requestedAt: Date.now()
      }, { merge: true });
      setStatusMessage({ type: 'info', text: 'Generando código oficial de 8 dígitos con WhatsApp...' });
    } catch (err) {
      setPairingError(err.message);
      setPairingLoading(false);
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
  const isPartnerWhatsAppConnected = config.partnerStatus === 'connected' && (config.partnerAccountId || config.partnerPhoneNumber);
  const isInstagramConnected = config.instagramStatus === 'connected' && config.instagramAccountId;
  const activePartnerQr = partnerWebQr || config.partnerQr || partnerAuthUrl;
  const isWebQrMode = !!(partnerWebQr || config.partnerQr);


  return (
    <div className="channels-container" style={{ 
      width: '100%', 
      padding: '1.25rem 1.5rem 6rem', 
      maxWidth: '1080px', 
      margin: '0 auto', 
      color: 'var(--text-primary)' 
    }}>
      {/* Header */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <Radio size={26} color="var(--accent)" />
            <h1 style={{ fontSize: '1.6rem', fontWeight: 'bold', margin: 0 }}>Canales & Integraciones Oficiales</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem' }}>
            Conexión omnicanal unificada (WhatsApp, Instagram y Ads) mediante <strong>Meta Cloud</strong>.
          </p>
        </div>

        {/* Badge / Acción rápida de API Key */}
        {!isEditingKey && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '0.35rem 0.75rem',
            fontSize: '0.78rem'
          }}>
            <Key size={14} color="var(--accent)" />
            <span style={{ color: 'var(--text-secondary)' }}>Zernio API:</span>
            <code style={{ color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '1px 5px', borderRadius: '4px' }}>
              sk_••••••••
            </code>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓ Conectada</span>
            <button
              type="button"
              onClick={() => setIsEditingKey(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                marginLeft: '0.3rem'
              }}
            >
              Modificar
            </button>
          </div>
        )}
      </div>

      {/* Banner de Mensajes / Estado */}
      {statusMessage && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          backgroundColor: statusMessage.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : statusMessage.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
          border: `1px solid ${statusMessage.type === 'success' ? '#22c55e' : statusMessage.type === 'error' ? '#ef4444' : '#3b82f6'}`,
          color: 'var(--text-primary)'
        }}>
          {statusMessage.type === 'success' ? <CheckCircle2 color="#22c55e" size={18} /> : statusMessage.type === 'error' ? <AlertCircle color="#ef4444" size={18} /> : <Sparkles color="#3b82f6" size={18} />}
          <span style={{ fontSize: '0.85rem', flex: 1 }}>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Panel de Edición de API Key (Solo cuando el usuario hace clic en Modificar) */}
      {isEditingKey && (
        <div className="card" style={{
          backgroundColor: 'var(--bg-secondary)',
          padding: '1rem 1.25rem',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          marginBottom: '1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Key size={18} color="var(--accent)" />
              <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Actualizar API Key de Zernio</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsEditingKey(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>

          <form onSubmit={(e) => { handleSaveApiKey(e); setIsEditingKey(false); }} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input 
                type={showKey ? 'text' : 'password'}
                value={inputApiKey}
                onChange={(e) => setInputApiKey(e.target.value)}
                placeholder="sk_..."
                style={{
                  width: '100%',
                  padding: '0.6rem 3rem 0.6rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem'
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
                  fontSize: '0.75rem'
                }}
              >
                {showKey ? 'Ocultar' : 'Ver'}
              </button>
            </div>

            <button 
              type="submit" 
              disabled={loading || !inputApiKey.trim()}
              style={{
                padding: '0.6rem 1.25rem',
                backgroundColor: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem'
              }}
            >
              {loading ? <RefreshCw className="spin" size={15} /> : <Check size={15} />}
              Guardar
            </button>
          </form>
        </div>
      )}

      {/* Grid de Canales */}
      <h2 style={{ fontSize: '1.2rem', marginBottom: '0.85rem', color: 'var(--text-primary)' }}>Canales Disponibles</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        
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
              <div style={{
                backgroundColor: 'var(--bg-primary)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1.5px dashed #6366f1',
                margin: '0.25rem 0 0.85rem'
              }}>
                {/* Selector de Modo */}
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.85rem' }}>
                  <button
                    type="button"
                    onClick={() => setPartnerLinkMode('code')}
                    style={{
                      flex: 1,
                      padding: '0.5rem 0.6rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      border: partnerLinkMode === 'code' ? '2px solid #6366f1' : '1px solid var(--border)',
                      backgroundColor: partnerLinkMode === 'code' ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-secondary)',
                      color: partnerLinkMode === 'code' ? '#a5b4fc' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <Smartphone size={15} /> Código de 8 Dígitos (Sin Cámara)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPartnerLinkMode('qr')}
                    style={{
                      flex: 1,
                      padding: '0.5rem 0.6rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      border: partnerLinkMode === 'qr' ? '2px solid #6366f1' : '1px solid var(--border)',
                      backgroundColor: partnerLinkMode === 'qr' ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-secondary)',
                      color: partnerLinkMode === 'qr' ? '#a5b4fc' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <QrIcon size={15} /> Escanear QR
                  </button>
                </div>

                {partnerLinkMode === 'code' ? (
                  /* Modo Código de 8 Dígitos */
                  pairingCode ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#a5b4fc', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Código Oficial de WhatsApp Web
                      </div>
                      <div style={{
                        backgroundColor: '#0f172a',
                        border: '2px solid #6366f1',
                        borderRadius: '12px',
                        padding: '0.6rem 1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.85rem'
                      }}>
                        <span style={{
                          fontSize: '2rem',
                          fontWeight: '900',
                          letterSpacing: '4px',
                          color: '#38bdf8',
                          fontFamily: 'monospace'
                        }}>
                          {pairingCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(pairingCode.replace('-', ''));
                            setCopiedPairingCode(true);
                            setTimeout(() => setCopiedPairingCode(false), 3000);
                          }}
                          style={{
                            padding: '0.35rem 0.65rem',
                            backgroundColor: copiedPairingCode ? '#10b981' : '#6366f1',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          {copiedPairingCode ? <Check size={13} /> : <Share2 size={13} />}
                          {copiedPairingCode ? '¡Copiado!' : 'Copiar'}
                        </button>
                      </div>

                      <div style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary)',
                        lineHeight: '1.4',
                        backgroundColor: 'rgba(99, 102, 241, 0.08)',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        width: '100%',
                        border: '1px solid rgba(99, 102, 241, 0.2)'
                      }}>
                        <strong style={{ color: 'white', display: 'block', marginBottom: '0.3rem' }}>
                          📱 Pasos en el celular de tu compañera:
                        </strong>
                        1. Abre <strong>WhatsApp</strong> en su teléfono.<br />
                        2. Toca <strong>⋮ o Ajustes &gt; Dispositivos vinculados</strong>.<br />
                        3. Toca el botón verde <strong>"Vincular un dispositivo"</strong>.<br />
                        4. Toca abajo la opción: <strong style={{ color: '#38bdf8' }}>"Vincular con el número de teléfono"</strong>.<br />
                        5. Escribe este código: <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{pairingCode}</strong>.
                      </div>

                      <button
                        type="button"
                        onClick={() => setPairingCode(null)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        Ingresar otro número o generar nuevo código
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleRequestPairingCode} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#a5b4fc' }}>
                        Número de celular de tu compañera:
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="text"
                          value={pairingPhone}
                          onChange={(e) => setPairingPhone(e.target.value)}
                          placeholder="Ej: 11 2345 6789 ó +54 9 11..."
                          style={{
                            flex: 1,
                            padding: '0.6rem 0.85rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem'
                          }}
                        />
                        <button
                          type="submit"
                          disabled={pairingLoading || !pairingPhone.trim()}
                          style={{
                            padding: '0.6rem 1rem',
                            backgroundColor: '#6366f1',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {pairingLoading ? <RefreshCw className="spin" size={14} /> : <Sparkles size={14} />}
                          {pairingLoading ? 'Generando...' : 'Obtener Código'}
                        </button>
                      </div>
                      <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.3' }}>
                        ✨ Genera un código de 8 dígitos para escribir en WhatsApp bajo <em>"Vincular con el número de teléfono"</em>. Sin usar cámara.
                      </p>
                      {pairingError && (
                        <div style={{ color: '#ef4444', fontSize: '0.75rem' }}>
                          ⚠️ {pairingError}
                        </div>
                      )}
                    </form>
                  )
                ) : (
                  /* Modo QR */
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    flexWrap: 'wrap',
                    justifyContent: 'center'
                  }}>
                    <div 
                      onClick={() => setShowQrModal(true)}
                      style={{
                        backgroundColor: '#ffffff',
                        padding: '10px',
                        borderRadius: '12px',
                        boxShadow: '0 4px 18px rgba(0,0,0,0.3)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        flexShrink: 0
                      }}
                      title="Clic para ver en pantalla completa"
                    >
                      <QRCode value={activePartnerQr} size={135} />
                      <span style={{ fontSize: '0.65rem', color: '#4f46e5', fontWeight: 'bold', marginTop: '3px' }}>
                        🔍 Clic para agrandar
                      </span>
                    </div>

                    <div style={{ flex: 1, minWidth: '170px', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.35' }}>
                        <strong style={{ color: '#ffffff' }}>Escanear desde WhatsApp:</strong><br />
                        1. Abre <strong>WhatsApp</strong> en el teléfono de tu compañera.<br />
                        2. Toca <strong>⋮ o Ajustes &gt; Dispositivos vinculados</strong>.<br />
                        3. Toca <strong>"Vincular un dispositivo"</strong> y apunta a este QR.
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowQrModal(true)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          padding: '0.4rem 0.7rem',
                          backgroundColor: '#6366f1',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        <Maximize2 size={13} /> Ver QR en Pantalla Completa
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem' }}>
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
                gap: '0.4rem',
                fontSize: '0.85rem'
              }}
            >
              <RefreshCw size={15} className={syncing ? 'spin' : ''} />
              {syncing ? 'Verificando...' : (isPartnerWhatsAppConnected ? 'Comprobar Estado' : '🔄 Ya lo vinculé / Comprobar')}
            </button>

            <button
              type="button"
              onClick={handleResetWhatsAppSession}
              disabled={isResetting}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#ef4444',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                fontSize: '0.8rem'
              }}
              title="Si el QR no responde o la cámara no lo toma, genera una nueva sesión limpia"
            >
              <RefreshCw size={14} className={isResetting ? 'spin' : ''} />
              {isResetting ? 'Reiniciando...' : '🔄 Generar Nuevo QR'}
            </button>
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
                Opcional
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Canal opcional para anuncios y publicaciones de Facebook Fanpage. WhatsApp e Instagram ya están 100% configurados y activos; no requiere ninguna acción adicional de tu parte.
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
            Canal Opcional (Próximamente)
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

      {/* Modal QR Pantalla Completa */}
      {showQrModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#1a1d24',
            border: '2px solid #6366f1',
            borderRadius: '18px',
            padding: '2rem 1.75rem',
            maxWidth: '420px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            position: 'relative',
            boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
            animation: 'fadeIn 0.25s ease-out'
          }}>
            <button
              onClick={() => setShowQrModal(false)}
              style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Cerrar"
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem', color: '#818cf8' }}>
              <QrIcon size={24} />
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'white', fontWeight: 'bold' }}>
                Vincular WhatsApp Personal (Compañera)
              </h3>
            </div>

            {/* Selector en el Modal */}
            <div style={{ display: 'flex', gap: '0.4rem', width: '100%', marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={() => setPartnerLinkMode('code')}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: partnerLinkMode === 'code' ? '#6366f1' : 'rgba(255, 255, 255, 0.08)',
                  color: partnerLinkMode === 'code' ? 'white' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem'
                }}
              >
                <Smartphone size={15} /> Código de 8 Dígitos
              </button>
              <button
                type="button"
                onClick={() => setPartnerLinkMode('qr')}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: partnerLinkMode === 'qr' ? '#6366f1' : 'rgba(255, 255, 255, 0.08)',
                  color: partnerLinkMode === 'qr' ? 'white' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem'
                }}
              >
                <QrIcon size={15} /> Escanear QR
              </button>
            </div>

            {partnerLinkMode === 'code' ? (
              <div style={{ width: '100%', marginBottom: '1.25rem' }}>
                {pairingCode ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{
                      backgroundColor: '#0f172a',
                      border: '2px solid #6366f1',
                      borderRadius: '14px',
                      padding: '0.85rem 1.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)'
                    }}>
                      <span style={{
                        fontSize: '2.4rem',
                        fontWeight: '900',
                        letterSpacing: '5px',
                        color: '#38bdf8',
                        fontFamily: 'monospace'
                      }}>
                        {pairingCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(pairingCode.replace('-', ''));
                          setCopiedPairingCode(true);
                          setTimeout(() => setCopiedPairingCode(false), 3000);
                        }}
                        style={{
                          padding: '0.45rem 0.8rem',
                          backgroundColor: copiedPairingCode ? '#10b981' : '#6366f1',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        {copiedPairingCode ? <Check size={14} /> : <Share2 size={14} />}
                        {copiedPairingCode ? '¡Copiado!' : 'Copiar'}
                      </button>
                    </div>

                    <div style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      lineHeight: '1.45',
                      backgroundColor: 'rgba(99, 102, 241, 0.08)',
                      padding: '0.85rem',
                      borderRadius: '10px',
                      width: '100%',
                      textAlign: 'left',
                      border: '1px solid rgba(99, 102, 241, 0.2)'
                    }}>
                      <strong style={{ color: 'white', display: 'block', marginBottom: '0.35rem' }}>
                        📱 Pasos en el celular de tu compañera:
                      </strong>
                      1. Abre <strong>WhatsApp</strong> en su teléfono.<br />
                      2. Toca <strong>⋮ o Ajustes &gt; Dispositivos vinculados</strong>.<br />
                      3. Toca el botón verde <strong>"Vincular un dispositivo"</strong>.<br />
                      4. Toca abajo la opción: <strong style={{ color: '#38bdf8' }}>"Vincular con el número de teléfono"</strong>.<br />
                      5. Escribe este código: <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{pairingCode}</strong>.
                    </div>

                    <button
                      type="button"
                      onClick={() => setPairingCode(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      Ingresar otro número o generar nuevo código
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRequestPairingCode} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#a5b4fc' }}>
                      Número de WhatsApp de tu compañera:
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        value={pairingPhone}
                        onChange={(e) => setPairingPhone(e.target.value)}
                        placeholder="Ej: 11 2345 6789 ó +54 9 11..."
                        style={{
                          flex: 1,
                          padding: '0.65rem 0.85rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          fontSize: '0.88rem'
                        }}
                      />
                      <button
                        type="submit"
                        disabled={pairingLoading || !pairingPhone.trim()}
                        style={{
                          padding: '0.65rem 1rem',
                          backgroundColor: '#6366f1',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: 'bold',
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {pairingLoading ? <RefreshCw className="spin" size={14} /> : <Sparkles size={14} />}
                        {pairingLoading ? 'Generando...' : 'Obtener Código'}
                      </button>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.3' }}>
                      ✨ Ingresa este código en WhatsApp bajo <em>"Vincular con el número de teléfono"</em>. Sin usar cámara.
                    </p>
                    {pairingError && (
                      <div style={{ color: '#ef4444', fontSize: '0.78rem' }}>
                        ⚠️ {pairingError}
                      </div>
                    )}
                  </form>
                )}
              </div>
            ) : (
              <>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem 0', lineHeight: '1.4' }}>
                  Abre <strong>WhatsApp</strong> en el teléfono de tu compañera &gt; <strong>Dispositivos vinculados</strong> y apunta a este código QR:
                </div>

                <div style={{
                  backgroundColor: '#ffffff',
                  padding: '16px',
                  borderRadius: '16px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                  marginBottom: '1.25rem',
                  display: 'inline-block'
                }}>
                  <QRCode value={activePartnerQr} size={230} />
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                checkAccounts();
                setShowQrModal(false);
              }}
              disabled={syncing}
              style={{
                width: '100%',
                padding: '0.65rem',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: '#10b981',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <RefreshCw size={15} className={syncing ? 'spin' : ''} />
              {syncing ? 'Verificando...' : '🔄 Ya lo vinculé / Comprobar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

