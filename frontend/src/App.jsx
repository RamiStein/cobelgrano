import { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { MessageCircle, Activity, Settings, User, LogOut, Globe, Megaphone, Radio } from 'lucide-react';
import './App.css';
import Dashboard from './components/Dashboard';
import ChatList from './components/ChatList';
import ChatView from './components/ChatView';
import WebLeads from './components/WebLeads';
import Marketing from './components/Marketing';
import Channels from './components/Channels';
import Login from './components/Login';
import { db, auth } from './firebase';
import { doc, onSnapshot, collection, query, orderBy, limit, where, addDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('cob_staff_auth');
  });
  const [isReady, setIsReady] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [zernioStatus, setZernioStatus] = useState('disconnected');
  
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'chats', 'web-leads', 'marketing', 'channels'
  const [activeChat, setActiveChat] = useState(null);
  const [chats, setChats] = useState([]);
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  
  const sessionStartRef = useRef(null);

  useEffect(() => {
    // Listen to system status for local WhatsApp Web QR and Readiness
    const unsubStatus = onSnapshot(doc(db, 'system', 'status'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsReady(!!data.isReady);
        setQrCode(data.qr || null);
      }
    });

    // Listen to Zernio official cloud connection status
    const unsubZernio = onSnapshot(doc(db, 'system', 'zernio_config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setZernioStatus(data.status || 'disconnected');
      }
    });

    // Listen to contacts/chats list
    const q = query(collection(db, 'contacts'), orderBy('lastActivity', 'desc'), limit(100));
    const unsubChats = onSnapshot(q, (snapshot) => {
      const chatsData = [];
      snapshot.forEach(doc => {
        chatsData.push({
          author: doc.id,
          contactId: doc.id,
          name: doc.data().name,
          pushname: doc.data().pushname,
          number: doc.data().number,
          lastActivity: doc.data().lastActivity,
          tag: doc.data().tag
        });
      });
      setChats(chatsData);
    });

    // Listen to web_leads for badge
    const qLeads = collection(db, 'web_leads');
    const unsubLeads = onSnapshot(qLeads, (snapshot) => {
      let count = 0;
      snapshot.forEach(doc => {
        if ((doc.data().status || 'nuevo') === 'nuevo') {
          count++;
        }
      });
      setNewLeadsCount(count);
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
        if (duration > 1500) { // Only log if reading for more than 1.5s
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
    if (confirm('¿Deseas cerrar la sesión del CRM de COB?')) {
      localStorage.removeItem('cob_staff_auth');
      await signOut(auth).catch(() => {});
      setIsAuthenticated(false);
    }
  };

  if (!isAuthenticated) {
    return <Login onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  const isConnected = zernioStatus === 'connected' || isReady;

  return (
    <div className="app-container fade-in">
      {/* Sidebar Navigation */}
      <div className="sidebar" style={{ width: '80px', alignItems: 'center', padding: '2rem 0', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
          {/* Status dot: Green if connected via Zernio or Local, Yellow/Red if pending */}
          <div 
            className="status-dot" 
            style={{ 
              backgroundColor: isConnected ? '#10b981' : '#f59e0b',
              boxShadow: isConnected ? '0 0 10px #10b981' : '0 0 10px #f59e0b'
            }}
            title={isConnected ? "WhatsApp Conectado (Nube/Local)" : "WhatsApp Desconectado - Ver Canales"}
          />

          <button 
            onClick={() => { setActiveTab('dashboard'); setActiveChat(null); }}
            style={{ background: 'none', border: 'none', color: activeTab === 'dashboard' ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer' }}
            title="Panel de Control"
          >
            <Activity size={28} />
          </button>

          <button 
            onClick={() => setActiveTab('chats')}
            style={{ background: 'none', border: 'none', color: activeTab === 'chats' ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer' }}
            title="Chats & Mensajería"
          >
            <MessageCircle size={28} />
          </button>

          <button 
            onClick={() => { setActiveTab('web-leads'); setActiveChat(null); }}
            title="Consultas Web Oficial"
            style={{ position: 'relative', background: 'none', border: 'none', color: activeTab === 'web-leads' ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <Globe size={28} />
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
                padding: '2px 6px',
                textAlign: 'center'
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
            <Megaphone size={28} />
          </button>

          <button 
            onClick={() => { setActiveTab('channels'); setActiveChat(null); }}
            title="Canales Oficiales (Zernio / WhatsApp Cloud / Meta)"
            style={{ 
              position: 'relative', 
              background: 'none', 
              border: 'none', 
              color: activeTab === 'channels' ? 'var(--accent)' : 'var(--text-secondary)', 
              cursor: 'pointer' 
            }}
          >
            <Radio size={28} />
            {zernioStatus !== 'connected' && (
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
        </div>
        
        <button 
          onClick={handleLogout}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'color 0.2s' }}
          onMouseEnter={(e) => e.target.style.color = '#ef4444'}
          onMouseLeave={(e) => e.target.style.color = 'var(--text-secondary)'}
          title="Cerrar Sesión del CRM"
        >
          <LogOut size={28} />
        </button>
      </div>

      {/* Second Sidebar: Chat List (when on chats tab) */}
      {activeTab === 'chats' && (
        <ChatList 
            chats={chats} 
            activeChat={activeChat} 
            setActiveChat={setActiveChat} 
        />
      )}

      {/* Main Area */}
      <div className="main-area">
        {activeTab === 'dashboard' ? (
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
              <MessageCircle size={64} style={{ color: 'var(--accent)', marginBottom: '1rem', opacity: 0.8 }} />
              <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Bandeja de Entrada COB</h2>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
                Selecciona una conversación a la izquierda para ver los mensajes, responder en vivo y escuchar audios.
              </p>
              {zernioStatus !== 'connected' && (
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
           </div>
        )}
      </div>
    </div>
  );
}

export default App;
