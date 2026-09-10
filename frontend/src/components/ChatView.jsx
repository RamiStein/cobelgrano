import { useState, useEffect, useRef } from 'react';
import { Play, Pause, FileText, Tag as TagIcon, Send, RefreshCw } from 'lucide-react';

function ChatView({ chat, backendUrl, socket, onTagUpdated }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [mediaReady, setMediaReady] = useState({}); // track which media files are ready
  const [transcribing, setTranscribing] = useState({}); // track which messages are currently transcribing
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchMessages();

    const handleNewMessage = (msg) => {
      if (msg.author === chat.author) {
        setMessages(prev => [...prev, msg]);
      }
    };

    const handleTranscription = ({ msgId, transcription }) => {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, transcription } : m));
    };

    // When media finishes downloading in the backend
    const handleMediaReady = ({ id }) => {
      console.log('Media ready for:', id);
      setMediaReady(prev => ({ ...prev, [id]: Date.now() }));
    };

    socket.on('new_message', handleNewMessage);
    socket.on('transcription_updated', handleTranscription);
    socket.on('media_ready', handleMediaReady);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('transcription_updated', handleTranscription);
      socket.off('media_ready', handleMediaReady);
    };
  }, [chat.author]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/messages/${chat.author}`);
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getDisplayNumber = () => {
    if (chat.contactId && chat.contactId.includes('@c.us')) {
      return chat.contactId.split('@')[0];
    }
    return chat.author.split('@')[0];
  };

  const formatName = () => {
    if (chat.name) return chat.name;
    if (chat.pushname) return chat.pushname;
    return getDisplayNumber();
  };

  const handleTranscribe = async (msgId) => {
    setTranscribing(prev => ({ ...prev, [msgId]: true }));
    try {
      const res = await fetch(`${backendUrl}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msgId })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'Error al transcribir. El audio puede no haberse descargado aún. Intenta de nuevo en unos segundos.');
      }
    } catch (err) {
      console.error(err);
      alert('Error en la conexión con el servidor.');
    } finally {
      setTranscribing(prev => ({ ...prev, [msgId]: false }));
    }
  };

  const handleTagConversation = async () => {
    const newTag = prompt('Ingresa una etiqueta para esta conversación (ej. Consulta, Turno, Urgente):', chat.tag || '');
    if (newTag !== null) {
      try {
        await fetch(`${backendUrl}/tag`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: chat.author, tag: newTag })
        });
        chat.tag = newTag;
        if (onTagUpdated) onTagUpdated();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    
    const textToSend = inputText;
    setInputText('');
    
    try {
        await fetch(`${backendUrl}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: chat.author, text: textToSend })
        });
    } catch (err) {
        console.error('Error al enviar mensaje:', err);
    }
  };

  // Generate a unique audio URL, busting cache when media becomes ready
  const getAudioUrl = (msgId) => {
    const cacheBuster = mediaReady[msgId] || '';
    return `${backendUrl}/media/${msgId}?t=${cacheBuster}`;
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="main-header">
        <div className="chat-header-info">
          <h2>{formatName()}</h2>
          <span className="chat-subtitle" style={{opacity: 0.7, fontSize: '0.8rem'}}>{getDisplayNumber()}</span>
        </div>
        
        <button 
          onClick={handleTagConversation}
          className="tag-badge"
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
        >
          <TagIcon size={14} color="var(--accent)" />
          {chat.tag ? chat.tag : 'Etiquetar Conversación'}
        </button>
      </div>
      
      <div className="messages-container" style={{ paddingBottom: '0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>Cargando mensajes...</div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`message ${msg.fromMe ? 'sent' : 'received'}`}>
              
              {/* Display sender name for incoming messages */}
              {!msg.fromMe && msg.senderName && (
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--accent)', marginBottom: '0.35rem' }}>
                  {msg.senderName}
                </div>
              )}

              {msg.isAudio === 1 ? (
                <div>
                  <div className="audio-player">
                    <audio 
                      controls 
                      style={{ height: '30px', outline: 'none' }}
                      key={mediaReady[msg.id] || msg.id}
                    >
                      <source src={getAudioUrl(msg.id)} type="audio/ogg; codecs=opus" />
                      Tu navegador no soporta el elemento de audio.
                    </audio>
                  </div>
                  
                  {msg.transcription ? (
                    <div className="transcription-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                      <span>{msg.transcription}</span>
                      <button 
                        onClick={() => handleTranscribe(msg.id)} 
                        disabled={transcribing[msg.id]}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: 'var(--text-secondary)', 
                          cursor: transcribing[msg.id] ? 'not-allowed' : 'pointer', 
                          display: 'flex', 
                          alignItems: 'center', 
                          padding: '0.25rem',
                          animation: transcribing[msg.id] ? 'spin 1s linear infinite' : 'none'
                        }}
                        title="Volver a transcribir con modelo avanzado"
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  ) : (
                    <button 
                      className="transcribe-btn" 
                      onClick={() => handleTranscribe(msg.id)}
                      disabled={transcribing[msg.id]}
                      style={{ cursor: transcribing[msg.id] ? 'not-allowed' : 'pointer', opacity: transcribing[msg.id] ? 0.7 : 1 }}
                    >
                      <FileText size={14} /> 
                      {transcribing[msg.id] ? 'Transcribiendo...' : 'Transcribir'}
                    </button>
                  )}
                </div>
              ) : (
                <p>{msg.body || (msg.hasMedia ? '[Contenido Multimedia]' : '')}</p>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <span className="message-time">{formatTime(msg.timestamp)}</span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Area */}
      <div style={{ padding: '1rem 2rem', background: 'var(--bg-glass)', borderTop: '1px solid var(--border)' }}>
          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '1rem' }}>
              <input 
                  type="text" 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  style={{
                      flex: 1,
                      padding: '0.75rem 1rem',
                      borderRadius: '99px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-secondary)',
                      color: 'white',
                      outline: 'none',
                      fontFamily: 'inherit'
                  }}
              />
              <button 
                type="submit"
                style={{
                    background: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '45px',
                    height: '45px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                }}
              >
                  <Send size={20} />
              </button>
          </form>
      </div>
    </div>
  );
}

export default ChatView;
