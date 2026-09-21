import { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, Activity, Globe, Megaphone, Radio, 
  LogOut, Sparkles, Building2, Home, Users, CheckSquare 
} from 'lucide-react';
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
import { doc, onSnapshot, collection, query, orderBy, limit, where, addDoc } from 'firebase/firestore';
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

          {/* Status dot */}
          <div 
            className="status-dot" 
            style={{ 
              backgroundColor: isCurrentConnected ? '#10b981' : '#f59e0b',
              boxShadow: isCurrentConnected ? '0 0 10px #10b981' : '0 0 10px #f59e0b'
            }}
            title={
              currentWorkspace === 'cob' 
                ? (isCobConnected ? "Línea COB Conectada 24/7" : "Línea COB Desconectada") 
                : (isPersonalConnected ? "Línea Personal Conectada 24/7" : "Línea Personal Lista para Vincular")
            }
          />

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
                onClick={() => { setActiveTab('organizer'); setActiveChat(null); }}
                style={{ 
                  position: 'relative',
                  background: 'none', 
                  border: 'none', 
                  color: activeTab === 'organizer' ? '#6366f1' : 'var(--text-secondary)', 
                  cursor: 'pointer' 
                }}
                title="Organizador Inteligente (Colegio, Cumpleaños, Compras)"
              >
                <Sparkles size={26} />
                {personalPendingCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-5px',
                    background: '#ec4899',
                    color: 'white',
                    borderRadius: '999px',
                    fontSize: '0.65rem',
                    fontWeight: 'bold',
                    padding: '2px 6px'
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
           <SmartOrganizer onOpenChat={handleOpenChatFromOrganizer} />
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
    </div>
  );
}

export default App;
