import { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, Activity, Globe, Megaphone, Radio, 
  LogOut, Sparkles, Building2, Home, Users, CheckSquare,
  QrCode as QrIcon, Check, Copy, ExternalLink, RefreshCw, X, ShieldCheck
} from 'lucide-react';
import QRCode from 'react-qr-code';
import './App.css';
import Dashboard from './components/Dashboard';
import ChatList from './components/ChatList';
import ChatView from './components/ChatView';
import WebLeads from './components/WebLeads';
import Marketing from './components/Marketing';
import Channels from './components/Channels';
import SmartOrganizer from './components/SmartOrganizer';
import Login from './components/Login';
import { db, auth } from './firebase';
import { doc, onSnapshot, collection, query, orderBy, limit, where, addDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('cob_staff_auth');
  });

  // Workspace Switcher: 'cob' (Consultorio) vs 'personal' (Compañera / Familia)
  const [currentWorkspace, setCurrentWorkspace] = useState(() => {
    return localStorage.getItem('cob_crm_workspace') || 'cob';
  });

  const [isReady, setIsReady] = useState(false);
  const [zernioStatus, setZernioStatus] = useState('disconnected');
  const [partnerZernioStatus, setPartnerZernioStatus] = useState('disconnected');
  const [zernioConfig, setZernioConfig] = useState(null);

  // Modal de estado y conexión rápida
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [partnerAuthUrl, setPartnerAuthUrl] = useState('');
  const [loadingPartnerQr, setLoadingPartnerQr] = useState(false);
  const [copiedPartnerLink, setCopiedPartnerLink] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [organizerResetKey, setOrganizerResetKey] = useState(0);
  
  // Tab activo por defecto según espacio
  const [activeTab, setActiveTab] = useState(() => {
    const ws = localStorage.getItem('cob_crm_workspace') || 'cob';
    return ws === 'personal' ? 'organizer' : 'dashboard';
  });

  const [activeChat, setActiveChat] = useState(null);
  const [chats, setChats] = useState([]);
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  const [personalPendingCount, setPersonalPendingCount] = useState(0);
  
  const sessionStartRef = useRef(null);

  const fetchPartnerAuthUrl = async (customKey) => {
    const key = customKey || zernioConfig?.apiKey || 'sk_8e06ac9cdb51753e1992f6286a6dc3277d525ca5704639fcc577e403e2ccddb4';
    if (!key) return;

    setLoadingPartnerQr(true);
    try {
      const pId = zernioConfig?.partnerProfileId || '6ab071431eb011d0b9ddaef7';
      const redirectUrl = window.location.origin;
      const queryParams = new URLSearchParams({
        profileId: pId,
        onboarding: 'business_app',
        redirect_url: redirectUrl
      });

      const res = await fetch(`https://zernio.com/api/v1/connect/whatsapp?${queryParams.toString()}`, {
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

  const handleCheckConnection = async () => {
    setCheckingConnection(true);
    try {
      const key = zernioConfig?.apiKey || 'sk_8e06ac9cdb51753e1992f6286a6dc3277d525ca5704639fcc577e403e2ccddb4';
      const res = await fetch('https://zernio.com/api/v1/accounts', {
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok && data.accounts) {
        let foundPartner = false;
        for (const acc of data.accounts) {
          const profId = acc.profileId?._id || acc.profileId;
          const profName = (acc.profileId?.name || '').toLowerCase();
          if (acc.platform === 'whatsapp') {
            if (profId === '6ab071431eb011d0b9ddaef7' || profName.includes('personal') || profName.includes('familia')) {
              await setDoc(doc(db, 'system', 'zernio_config'), {
                partnerAccountId: acc._id,
                partnerPhoneNumber: acc.username,
                partnerStatus: acc.isActive ? 'connected' : 'inactive',
                lastChecked: Date.now()
              }, { merge: true });
              foundPartner = true;
              alert(`¡Línea detectada con éxito! Número: ${acc.username}`);
              setShowConnectionModal(false);
              break;
            }
          }
        }
        if (!foundPartner) {
          alert('Aún no se detectó la vinculación. Apunta la cámara del celular de tu compañera al código QR o abre el enlace.');
        }
      }
    } catch (e) {
      console.error('Error comprobando cuentas:', e);
    } finally {
      setCheckingConnection(false);
    }
  };

  // Cambiar de espacio de trabajo con persistencia
  const handleSwitchWorkspace = (workspace) => {
    if (workspace === currentWorkspace) return;
    setCurrentWorkspace(workspace);
    localStorage.setItem('cob_crm_workspace', workspace);
    setActiveChat(null);
    if (workspace === 'personal') {
      setActiveTab('organizer');
    } else {
      setActiveTab('dashboard');
    }
  };

  useEffect(() => {
    // Listen to system status for local WhatsApp Web QR and Readiness
    const unsubStatus = onSnapshot(doc(db, 'system', 'status'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsReady(!!data.isReady);
      }
    });

    // Listen to Zernio official cloud connection status
    const unsubZernio = onSnapshot(doc(db, 'system', 'zernio_config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setZernioStatus(data.status || 'disconnected');
        setPartnerZernioStatus(data.partnerStatus || 'disconnected');
        setZernioConfig(data);
        if (data.apiKey && data.partnerStatus !== 'connected') {
          fetchPartnerAuthUrl(data.apiKey);
        }
      }
    });

    // Listen to contacts/chats list
    const q = query(collection(db, 'contacts'), orderBy('lastActivity', 'desc'), limit(150));
    const unsubChats = onSnapshot(q, (snapshot) => {
      const chatsData = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        chatsData.push({
          author: docSnap.id,
          contactId: docSnap.id,
          name: d.name,
          pushname: d.pushname,
          number: d.number,
          lastActivity: d.lastActivity,
          tag: d.tag,
          workspaceId: d.workspaceId || 'cob',
          isGroup: d.isGroup || false,
          channel: d.channel || 'whatsapp_cloud',
          platform: d.platform || 'whatsapp'
        });
      });
      setChats(chatsData);
    });

    // Listen to web_leads for badge
    const qLeads = collection(db, 'web_leads');
    const unsubLeads = onSnapshot(qLeads, (snapshot) => {
      let count = 0;
      snapshot.forEach(docSnap => {
        if ((docSnap.data().status || 'nuevo') === 'nuevo') {
          count++;
        }
      });
      setNewLeadsCount(count);
    });

    // Listen to smart_notes for personal pending badge
    const qNotes = query(collection(db, 'smart_notes'), where('workspaceId', '==', 'personal'));
    const unsubNotes = onSnapshot(qNotes, (snapshot) => {
      let pending = 0;
      snapshot.forEach(docSnap => {
        if (docSnap.data().status !== 'completado') {
          pending++;
        }
      });
      setPersonalPendingCount(pending);
    });

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
      }
    });

    return () => {
      unsubStatus();
      unsubZernio();
      unsubChats();
      unsubLeads();
      unsubNotes();
      unsubAuth();
    };
  }, []);
  
  // Handle session timing and sync to Firebase
  useEffect(() => {
    if (activeChat) {
      sessionStartRef.current = Date.now();
    }
    return () => {
      if (activeChat && sessionStartRef.current) {
        const duration = Date.now() - sessionStartRef.current;
        if (duration > 1500) {
          addDoc(collection(db, 'sessions'), {
            chatId: activeChat.author,
            duration: duration,
            timestamp: Date.now()
          }).catch(console.error);
        }
      }
    };
  }, [activeChat]);

  const handleLogout = async () => {
    if (confirm('¿Deseas cerrar la sesión del sistema?')) {
      localStorage.removeItem('cob_staff_auth');
      await signOut(auth).catch(() => {});
      setIsAuthenticated(false);
    }
  };

  const handleOpenChatFromOrganizer = (chatId) => {
    const found = chats.find(c => c.author === chatId || c.contactId === chatId);
    if (found) {
      setActiveChat(found);
    } else {
      setActiveChat({
        author: chatId,
        contactId: chatId,
        name: chatId,
        workspaceId: 'personal'
      });
    }
    setActiveTab('chats');
  };

  if (!isAuthenticated) {
    return <Login onAuthenticated={(ws) => {
      if (ws) {
        setCurrentWorkspace(ws);
        localStorage.setItem('cob_crm_workspace', ws);
        setActiveTab(ws === 'personal' ? 'organizer' : 'dashboard');
      }
      setIsAuthenticated(true);
    }} />;
  }

  // Estado de conexión según el espacio activo
  const isCobConnected = zernioStatus === 'connected' || isReady;
  const isPersonalConnected = partnerZernioStatus === 'connected';
  const isCurrentConnected = currentWorkspace === 'cob' ? isCobConnected : isPersonalConnected;

  return (
    <div className={`app-container fade-in ${currentWorkspace === 'personal' ? 'workspace-personal' : 'workspace-cob'}`}>
      {/* Sidebar Navigation */}
      <div 
        className="sidebar" 
        style={{ 
          width: '80px', 
          alignItems: 'center', 
          padding: '1.25rem 0', 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%', 
          justifyContent: 'space-between',
          borderRight: '1px solid var(--border)'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%' }}>
          
          {/* Workspace Switcher Dual Button */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            padding: '4px',
            backgroundColor: 'var(--bg-primary)',
            borderRadius: '12px',
            border: '1px solid var(--border)'
          }}>
            <button
              onClick={() => handleSwitchWorkspace('cob')}
              title="Espacio Consultorio Odontológico Belgrano"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: currentWorkspace === 'cob' ? 'var(--accent)' : 'transparent',
                color: currentWorkspace === 'cob' ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                boxShadow: currentWorkspace === 'cob' ? '0 2px 8px rgba(16, 185, 129, 0.4)' : 'none'
              }}
            >
              <Building2 size={20} />
            </button>

            <button
              onClick={() => handleSwitchWorkspace('personal')}
              title="Espacio Personal & Familia (Compañera)"
              style={{
                position: 'relative',
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: currentWorkspace === 'personal' ? '#6366f1' : 'transparent',
                color: currentWorkspace === 'personal' ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                boxShadow: currentWorkspace === 'personal' ? '0 2px 8px rgba(99, 102, 241, 0.4)' : 'none'
              }}
            >
              <Home size={20} />
              {personalPendingCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  backgroundColor: '#ec4899',
                  color: 'white',
                  borderRadius: '999px',
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  padding: '1px 5px',
                  border: '2px solid var(--bg-secondary)'
                }}>
                  {personalPendingCount}
                </span>
              )}
            </button>
          </div>

          {/* Status dot / Connection Indicator Button */}
          <button
            type="button"
            onClick={() => {
              setShowConnectionModal(true);
              if (currentWorkspace === 'personal' && !isPersonalConnected && !partnerAuthUrl) {
                fetchPartnerAuthUrl();
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.35)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            title={
              currentWorkspace === 'cob' 
                ? (isCobConnected ? "🟢 Línea COB Conectada 24/7 (Clic para ver estado)" : "🟡 Línea COB Desconectada (Clic para conectar)") 
                : (isPersonalConnected ? "🟢 Línea Personal Conectada 24/7 (Clic para ver estado)" : "🟡 Línea Personal Pendiente de Vincular (Clic para escanear QR y vincular)")
            }
          >
            <div 
              className="status-dot" 
              style={{ 
                width: '12px',
                height: '12px',
                backgroundColor: isCurrentConnected ? '#10b981' : '#f59e0b',
                boxShadow: isCurrentConnected ? '0 0 10px #10b981' : '0 0 12px #f59e0b'
              }}
            />
          </button>

          {/* Navigation Items: COB Workspace */}
          {currentWorkspace === 'cob' ? (
            <>
              <button 
                onClick={() => { setActiveTab('dashboard'); setActiveChat(null); }}
                style={{ background: 'none', border: 'none', color: activeTab === 'dashboard' ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer' }}
                title="Panel de Control Dental"
              >
                <Activity size={26} />
              </button>

              <button 
                onClick={() => setActiveTab('chats')}
                style={{ background: 'none', border: 'none', color: activeTab === 'chats' ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer' }}
                title="Chats Pacientes & Leads"
              >
                <MessageCircle size={26} />
              </button>

              <button 
                onClick={() => { setActiveTab('web-leads'); setActiveChat(null); }}
                title="Consultas Web Oficial"
                style={{ position: 'relative', background: 'none', border: 'none', color: activeTab === 'web-leads' ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <Globe size={26} />
                {newLeadsCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-5px',
                    background: '#ef4444',
                    color: 'white',
                    borderRadius: '999px',
                    fontSize: '0.65rem',
                    fontWeight: 'bold',
                    padding: '2px 6px'
                  }}>
                    {newLeadsCount}
                  </span>
                )}
              </button>

              <button 
                onClick={() => { setActiveTab('marketing'); setActiveChat(null); }}
                title="Publicidad & Campañas (Meta / Google Ads)"
                style={{ background: 'none', border: 'none', color: activeTab === 'marketing' ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <Megaphone size={26} />
              </button>

              <button 
                onClick={() => { setActiveTab('channels'); setActiveChat(null); }}
                title="Canales Oficiales (WhatsApp Cloud & Meta)"
                style={{ 
                  position: 'relative', 
                  background: 'none', 
                  border: 'none', 
                  color: activeTab === 'channels' ? 'var(--accent)' : 'var(--text-secondary)', 
                  cursor: 'pointer' 
                }}
              >
                <Radio size={26} />
              </button>
            </>
          ) : (
            /* Navigation Items: Personal Workspace (Compañera) */
            <>
              <button 
                onClick={() => { 
                  setActiveTab('organizer'); 
                  setActiveChat(null); 
                  setOrganizerResetKey(prev => prev + 1);
                }}
                style={{ 
                  position: 'relative', 
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: activeTab === 'organizer' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                  color: activeTab === 'organizer' ? '#818cf8' : 'var(--text-secondary)', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  boxShadow: activeTab === 'organizer' ? '0 0 12px rgba(99, 102, 241, 0.35)' : 'none'
                }}
                title="Organizador Inteligente (Colegio, Cumpleaños, Compras)"
              >
                <Sparkles size={26} />
                {personalPendingCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    background: '#ec4899',
                    color: 'white',
                    borderRadius: '999px',
                    fontSize: '0.65rem',
                    fontWeight: 'bold',
                    padding: '2px 6px',
                    border: '2px solid var(--bg-secondary)'
                  }}>
                    {personalPendingCount}
                  </span>
                )}
              </button>

              <button 
                onClick={() => setActiveTab('chats')}
                style={{ background: 'none', border: 'none', color: activeTab === 'chats' ? '#6366f1' : 'var(--text-secondary)', cursor: 'pointer' }}
                title="Chats & Grupos Escolares / Familia"
              >
                <MessageCircle size={26} />
              </button>

              <button 
                onClick={() => { setActiveTab('channels'); setActiveChat(null); }}
                title="Conexión de Teléfono Personal"
                style={{ 
                  position: 'relative', 
                  background: 'none', 
                  border: 'none', 
                  color: activeTab === 'channels' ? '#6366f1' : 'var(--text-secondary)', 
                  cursor: 'pointer' 
                }}
              >
                <Radio size={26} />
                {!isPersonalConnected && (
                  <span style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    background: '#f59e0b',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%'
                  }} />
                )}
              </button>
            </>
          )}
        </div>
        
        {/* Logout */}
        <button 
          onClick={handleLogout}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'color 0.2s' }}
          onMouseEnter={(e) => e.target.style.color = '#ef4444'}
          onMouseLeave={(e) => e.target.style.color = 'var(--text-secondary)'}
          title="Cerrar Sesión"
        >
          <LogOut size={26} />
        </button>
      </div>

      {/* Second Sidebar: Chat List (when on chats tab) */}
      {activeTab === 'chats' && (
        <ChatList 
            chats={chats} 
            activeChat={activeChat} 
            setActiveChat={setActiveChat} 
            workspace={currentWorkspace}
        />
      )}

      {/* Main Area */}
      <div className="main-area">
        {activeTab === 'organizer' ? (
           <SmartOrganizer 
              onOpenChat={handleOpenChatFromOrganizer} 
              onNavigateToChannels={() => setActiveTab('channels')}
              isPartnerConnected={isPersonalConnected}
              resetKey={organizerResetKey}
           />
        ) : activeTab === 'dashboard' ? (
           <Dashboard />
        ) : activeTab === 'marketing' ? (
           <Marketing />
        ) : activeTab === 'web-leads' ? (
           <WebLeads />
        ) : activeTab === 'channels' ? (
           <Channels />
        ) : activeChat ? (
           <ChatView chat={activeChat} />
        ) : (
           <div className="empty-state fade-in" style={{ textAlign: 'center', padding: '3rem' }}>
              {currentWorkspace === 'personal' ? (
                <>
                  <Sparkles size={64} style={{ color: '#6366f1', marginBottom: '1rem', opacity: 0.8 }} />
                  <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Bandeja Personal & Grupos Escolares</h2>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 1.5rem', lineHeight: '1.4' }}>
                    Selecciona un grupo o chat a la izquierda para conversar, o visita el <strong>Organizador Inteligente</strong> para ver tareas y recordatorios extraídos automáticamente.
                  </p>
                  <button
                    onClick={() => setActiveTab('organizer')}
                    style={{
                      padding: '0.65rem 1.3rem',
                      backgroundColor: '#6366f1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
                    }}
                  >
                    🧠 Ver Organizador Inteligente
                  </button>
                </>
              ) : (
                <>
                  <MessageCircle size={64} style={{ color: 'var(--accent)', marginBottom: '1rem', opacity: 0.8 }} />
                  <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Bandeja de Entrada COB</h2>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 1.5rem', lineHeight: '1.4' }}>
                    Selecciona una conversación a la izquierda para ver los mensajes de pacientes, responder en vivo y escuchar audios.
                  </p>
                  {!isCobConnected && (
                    <button
                      onClick={() => setActiveTab('channels')}
                      style={{
                        padding: '0.6rem 1.2rem',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--accent)',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: '600'
                      }}
                    >
                      ⚡ Configurar WhatsApp Oficial en la Nube (Zernio)
                    </button>
                  )}
                </>
              )}
           </div>
        )}
      </div>

      {/* Modal de Conexión y Estado de WhatsApp */}
      {showConnectionModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: `1.5px solid ${isCurrentConnected ? '#10b981' : '#f59e0b'}`,
            borderRadius: '16px',
            width: '100%',
            maxWidth: '460px',
            padding: '1.75rem',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            position: 'relative'
          }}>
            {/* Close Button */}
            <button
              onClick={() => setShowConnectionModal(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: currentWorkspace === 'personal' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: currentWorkspace === 'personal' ? '#818cf8' : '#10b981'
              }}>
                {currentWorkspace === 'personal' ? <Home size={22} /> : <Building2 size={22} />}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                  {currentWorkspace === 'personal' ? 'Línea Personal & Familia' : 'Línea Consultorio Odontológico Belgrano'}
                </h3>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  color: isCurrentConnected ? '#10b981' : '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  marginTop: '2px'
                }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: isCurrentConnected ? '#10b981' : '#f59e0b'
                  }} />
                  {isCurrentConnected ? '🟢 Conectado 24/7 en la Nube' : '🟡 Pendiente de Vinculación Oficial'}
                </span>
              </div>
            </div>

            {/* Body */}
            {currentWorkspace === 'personal' ? (
              isPersonalConnected ? (
                <div style={{
                  backgroundColor: 'var(--bg-primary)',
                  padding: '1rem',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Número Vinculado:</span>
                    <strong style={{ color: '#10b981' }}>{zernioConfig?.partnerPhoneNumber || 'Vinculado'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Organizador Inteligente:</span>
                    <strong style={{ color: '#818cf8' }}>✓ Monitoreando grupos escolares</strong>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1rem' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                    Para que el <strong>Organizador Inteligente</strong> detecte las compras (flautas, útiles), tareas y cumpleaños automáticamente, escanea este código con el celular de tu compañera:
                  </p>

                  {partnerAuthUrl ? (
                    <div style={{
                      backgroundColor: '#ffffff',
                      padding: '12px',
                      borderRadius: '12px',
                      display: 'inline-block',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
                    }}>
                      <QRCode value={partnerAuthUrl} size={170} />
                    </div>
                  ) : (
                    <div style={{ padding: '1rem', color: '#818cf8', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {loadingPartnerQr ? (
                        <>
                          <RefreshCw size={16} className="spin" /> Generando código QR oficial de Meta...
                        </>
                      ) : (
                        <button
                          onClick={() => fetchPartnerAuthUrl()}
                          style={{
                            padding: '0.6rem 1.2rem',
                            backgroundColor: '#6366f1',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          ⚡ Generar Código QR
                        </button>
                      )}
                    </div>
                  )}

                  {partnerAuthUrl && (
                    <div style={{ display: 'flex', gap: '0.5rem', width: '100%', flexWrap: 'wrap' }}>
                      <a
                        href={partnerAuthUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flex: 1,
                          minWidth: '150px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                          padding: '0.6rem',
                          backgroundColor: '#6366f1',
                          color: 'white',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          textDecoration: 'none'
                        }}
                      >
                        <ExternalLink size={14} /> Abrir en este navegador
                      </a>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(partnerAuthUrl);
                          setCopiedPartnerLink(true);
                          setTimeout(() => setCopiedPartnerLink(false), 3000);
                        }}
                        style={{
                          flex: 1,
                          minWidth: '150px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                          padding: '0.6rem',
                          backgroundColor: copiedPartnerLink ? '#10b981' : 'var(--bg-primary)',
                          color: copiedPartnerLink ? 'white' : 'var(--text-primary)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        {copiedPartnerLink ? <Check size={14} /> : <Copy size={14} />}
                        {copiedPartnerLink ? '¡Enlace copiado!' : 'Copiar enlace'}
                      </button>
                    </div>
                  )}

                  <button
                    onClick={handleCheckConnection}
                    disabled={checkingConnection}
                    style={{
                      width: '100%',
                      padding: '0.65rem',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <RefreshCw size={15} className={checkingConnection ? 'spin' : ''} />
                    {checkingConnection ? 'Verificando con Zernio...' : '🔄 Ya lo vinculé / Comprobar Conexión'}
                  </button>
                </div>
              )
            ) : (
              <div style={{
                backgroundColor: 'var(--bg-primary)',
                padding: '1rem',
                borderRadius: '10px',
                fontSize: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Línea WhatsApp COB:</span>
                  <strong style={{ color: '#10b981' }}>+54 9 11 2616-3119</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Estado Meta Cloud:</span>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓ Conectado 24/7</span>
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <button
                onClick={() => {
                  setShowConnectionModal(false);
                  setActiveTab('channels');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#818cf8',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Radio size={14} /> Administrar en Canales
              </button>

              <button
                onClick={() => setShowConnectionModal(false)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
