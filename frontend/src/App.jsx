import { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { MessageCircle, Activity, Settings, User, LogOut, Globe } from 'lucide-react';
import './App.css';
import Dashboard from './components/Dashboard';
import ChatList from './components/ChatList';
import ChatView from './components/ChatView';
import WebLeads from './components/WebLeads';
import { db } from './firebase';
import { doc, onSnapshot, collection, query, orderBy, limit, where } from 'firebase/firestore';

function App() {
  const [isReady, setIsReady] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'chats', 'web-leads'
  const [activeChat, setActiveChat] = useState(null);
  const [chats, setChats] = useState([]);
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  
  const sessionStartRef = useRef(null);

  useEffect(() => {
    // Listen to system status for QR and Readiness
    const unsubStatus = onSnapshot(doc(db, 'system', 'status'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsReady(data.isReady);
        setQrCode(data.qr);
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

    return () => {
      unsubStatus();
      unsubChats();
      unsubLeads();
    };
  }, []);
  
  // Handle session timing (we won't sync this to firebase for now to keep it simple, or you can add a sessions collection later)
  useEffect(() => {
      if (activeChat) {
          sessionStartRef.current = Date.now();
      }
      return () => {}
  }, [activeChat]);

  const handleLogout = async () => {
    if (confirm('¿Estás seguro de que quieres cerrar la sesión de WhatsApp? Esta acción requiere reiniciar el servidor local por ahora.')) {
        alert("Reinicia el backend en tu PC para cerrar sesión.");
    }
  };

  if (!isReady && qrCode) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="logo-container" style={{display: 'flex', justifyContent: 'center', marginBottom: '2rem'}}>
             {/* Logo would go here */}
          </div>
          <h2>Conectar WhatsApp</h2>
          <p>Escanea este código QR con la app de WhatsApp en tu teléfono para conectar el sistema.</p>
          <div className="qr-wrapper">
            <QRCode value={qrCode} size={256} />
          </div>
          <p style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Abre WhatsApp &gt; Dispositivos vinculados &gt; Vincular un dispositivo
          </p>
        </div>
      </div>
    );
  }

  if (!isReady && !qrCode) {
    return (
      <div className="loading-container">
        <h2>Iniciando Sistema COB...</h2>
        <p>Conectando con WhatsApp, por favor espera.</p>
      </div>
    );
  }

  return (
    <div className="app-container fade-in">
      {/* Sidebar Navigation */}
      <div className="sidebar" style={{ width: '80px', alignItems: 'center', padding: '2rem 0', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
          <div className="status-dot"></div>
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
            title="Chats"
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
        </div>
        
        <button 
          onClick={handleLogout}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'color 0.2s' }}
          onMouseEnter={(e) => e.target.style.color = '#ef4444'}
          onMouseLeave={(e) => e.target.style.color = 'var(--text-secondary)'}
          title="Cerrar Sesión"
        >
          <LogOut size={28} />
        </button>
      </div>

      {/* Second Sidebar: Chat List */}
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
        ) : activeTab === 'web-leads' ? (
           <WebLeads />
        ) : activeChat ? (
           <ChatView chat={activeChat} />
        ) : (
           <div className="empty-state fade-in">
              <MessageCircle size={64} />
              <p>Selecciona un chat para ver la conversación y escuchar audios.</p>
           </div>
        )}
      </div>
    </div>
  );
}

export default App;
