import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import QRCode from 'react-qr-code';
import { MessageCircle, Activity, Settings, User, LogOut } from 'lucide-react';
import Dashboard from './components/Dashboard';
import ChatList from './components/ChatList';
import ChatView from './components/ChatView';

const BACKEND_URL = 'http://localhost:3001';

function App() {
  const [socket, setSocket] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' or 'chats'
  const [activeChat, setActiveChat] = useState(null);
  const [chats, setChats] = useState([]);
  
  // Track session for time spent
  const sessionStartRef = useRef(null);

  useEffect(() => {
    // Check initial status
    fetch(`${BACKEND_URL}/status`)
      .then(res => res.json())
      .then(data => setIsReady(data.ready))
      .catch(console.error);

    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    newSocket.on('qr', (qr) => {
      setQrCode(qr);
      setIsReady(false);
    });

    newSocket.on('ready', () => {
      setIsReady(true);
      setQrCode(null);
      fetchChats();
    });

    let fetchTimeout;
    newSocket.on('new_message', (msg) => {
      // Refresh chats list to update last message, debounced to prevent UI thrashing
      clearTimeout(fetchTimeout);
      fetchTimeout = setTimeout(() => {
        fetchChats();
      }, 500);
      // The ChatView component will handle adding the message to its own state if it's the active chat
    });

    return () => {
      clearTimeout(fetchTimeout);
      newSocket.close();
    };
  }, []);
  
  // Handle session timing
  useEffect(() => {
      if (activeChat) {
          sessionStartRef.current = Date.now();
      }
      
      return () => {
          if (activeChat && sessionStartRef.current) {
              const endTime = Date.now();
              // Send session to backend
              fetch(`${BACKEND_URL}/session`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      chatId: activeChat.author,
                      startTime: sessionStartRef.current,
                      endTime: endTime
                  })
              }).catch(console.error);
          }
      }
  }, [activeChat]);

  const fetchChats = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/chats`);
      const data = await res.json();
      setChats(data);
    } catch (error) {
      console.error(error);
    }
  };
  
  // Also fetch chats periodically or when ready
  useEffect(() => {
      if (isReady) fetchChats();
  }, [isReady]);

  const handleLogout = async () => {
    if (confirm('¿Estás seguro de que quieres cerrar la sesión de WhatsApp? Tendrás que escanear el código QR de nuevo.')) {
      try {
        setIsReady(false);
        setQrCode(null);
        await fetch(`${BACKEND_URL}/logout`, { method: 'POST' });
      } catch (error) {
        console.error('Error logging out:', error);
      }
    }
  };

  if (!isReady) {
    return (
      <div className="qr-screen fade-in">
        <div className="qr-box">
          <h2>Conectar a WhatsApp</h2>
          <p>Escanea este código QR con la aplicación de WhatsApp en tu teléfono para vincular el panel.</p>
          {qrCode ? (
            <div style={{ background: 'white', padding: '16px', borderRadius: '12px' }}>
              <QRCode value={qrCode} size={250} />
            </div>
          ) : (
            <div style={{ height: '250px', display: 'flex', alignItems: 'center' }}>
                <p>Generando código QR...</p>
            </div>
          )}
        </div>
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
          >
            <Activity size={28} />
          </button>
          <button 
            onClick={() => setActiveTab('chats')}
            style={{ background: 'none', border: 'none', color: activeTab === 'chats' ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <MessageCircle size={28} />
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
           <Dashboard backendUrl={BACKEND_URL} />
        ) : activeChat ? (
           <ChatView 
              chat={activeChat} 
              backendUrl={BACKEND_URL} 
              socket={socket} 
              onTagUpdated={fetchChats}
           />
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
