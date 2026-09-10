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
    <div className="app-layout">
      {/* Navbar Lateral */}
      <nav className="main-nav">
        <div className="nav-brand">
          COB
        </div>
        <div className="nav-items">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
            title="Dashboard"
          >
            <Activity size={24} />
          </button>
          <button 
            className={`nav-item ${activeTab === 'chats' ? 'active' : ''}`}
            onClick={() => setActiveTab('chats')}
            title="Chats"
          >
            <MessageCircle size={24} />
          </button>
          <button 
            className={`nav-item ${activeTab === 'web-leads' ? 'active' : ''}`}
            onClick={() => setActiveTab('web-leads')}
            title="Consultas Web Oficial"
            style={{ position: 'relative' }}
          >
            <Globe size={24} />
            {newLeadsCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                background: '#ef4444',
                color: 'white',
                borderRadius: '999px',
                fontSize: '0.65rem',
                fontWeight: 'bold',
                padding: '0.1rem 0.35rem',
                minWidth: '16px',
                textAlign: 'center',
                boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)'
              }}>
                {newLeadsCount}
              </span>
            )}
          </button>
        </div>
        
        <div className="nav-footer">
          <button className="nav-item" onClick={handleLogout} title="Cerrar Sesión">
            <LogOut size={24} />
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      {activeTab === 'dashboard' && <Dashboard />}

      {activeTab === 'web-leads' && <WebLeads />}
      
      {activeTab === 'chats' && (
        <div className="workspace">
          <ChatList 
            chats={chats} 
            activeChat={activeChat} 
            setActiveChat={setActiveChat} 
          />
          {activeChat ? (
            <ChatView chat={activeChat} />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              Selecciona una conversación para empezar
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
