import { useState, useEffect, useRef } from 'react';
import { Play, Pause, FileText, Tag as TagIcon, Send, RefreshCw } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, setDoc, doc, limit } from 'firebase/firestore';

function ChatView({ chat, onTagUpdated }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inputText, setInputText] = useState('');
  const [transcribing, setTranscribing] = useState({});
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Build list of all potential IDs for this chat (Phone @c.us, LID @lid, numbers)
    const rawNumber = chat.number ? chat.number.toString().trim() : null;
    const authorNum = chat.author?.includes('@') ? chat.author.split('@')[0] : chat.author;
    const contactNum = chat.contactId?.includes('@') ? chat.contactId.split('@')[0] : chat.contactId;

    const candidates = [
      chat.author,
      chat.contactId,
      rawNumber ? `${rawNumber}@lid` : null,
      rawNumber ? `${rawNumber}@c.us` : null,
      rawNumber,
      authorNum ? `${authorNum}@lid` : null,
      authorNum ? `${authorNum}@c.us` : null,
      contactNum ? `${contactNum}@lid` : null,
      contactNum ? `${contactNum}@c.us` : null
    ].filter(Boolean);

    const uniqueAuthors = [...new Set(candidates)];

    const q = query(
      collection(db, 'messages'),
      where('author', 'in', uniqueAuthors)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() });
      });
      // Sort in JavaScript by timestamp (handles chronological order without needing composite index)
      msgs.sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
      setMessages(msgs);
      setLoading(false);
    }, (err) => {
      console.error("Firebase query error:", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [chat.author, chat.contactId, chat.number]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const handleTagConversation = async () => {
    const newTag = prompt('Ingresa una etiqueta para esta conversación (ej. Consulta, Turno, Urgente):', chat.tag || '');
    if (newTag !== null) {
      try {
        await setDoc(doc(db, 'contacts', chat.author), { tag: newTag }, { merge: true });
        if (chat.contactId && chat.contactId !== chat.author) {
          await setDoc(doc(db, 'contacts', chat.contactId), { tag: newTag }, { merge: true });
        }
        chat.tag = newTag;
        if (onTagUpdated) onTagUpdated();
      } catch (err) {
        console.error('Error etiquetando', err);
      }
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    
    const textToSend = inputText;
    setInputText('');
    
    // Choose destination: phone @c.us if available, or chat.author
    const targetChat = chat.contactId || chat.author;
    
    try {
        await addDoc(collection(db, 'outbox'), {
            chatId: targetChat,
            text: textToSend,
            createdAt: new Date().getTime()
        });
    } catch (err) {
        console.error('Error al enviar mensaje:', err);
    }
  };

  const handleTranscribe = (msgId) => {
     alert("La transcripción automática se debe re-configurar para Firebase. Muy pronto disponible.");
  }

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
        {error && (
          <div style={{ padding: '1rem', background: '#fee2e2', color: '#991b1b', margin: '1rem', borderRadius: '8px' }}>
            <strong>Error de Base de Datos:</strong> {error}
          </div>
        )}
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>Cargando mensajes...</div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`message ${msg.fromMe ? 'sent' : 'received'}`}>
              
              {!msg.fromMe && msg.senderName && (
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--accent)', marginBottom: '0.35rem' }}>
                  {msg.senderName}
                </div>
              )}

              {msg.isAudio ? (
                <div>
                  <div className="audio-player">
                    {msg.mediaUrl ? (
                        <audio controls style={{ height: '30px', outline: 'none' }} key={msg.mediaUrl}>
                            <source src={msg.mediaUrl} type="audio/ogg; codecs=opus" />
                            Tu navegador no soporta el elemento de audio.
                        </audio>
                    ) : (
                        <div style={{fontSize: '0.8rem', color: 'gray'}}>Descargando audio...</div>
                    )}
                  </div>
                  
                  {msg.transcription ? (
                    <div className="transcription-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                      <span>{msg.transcription}</span>
                    </div>
                  ) : (
                    <div className="transcription-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                        <span>Nota de voz</span>
                        <button 
                            onClick={() => handleTranscribe(msg.id)} 
                            disabled={transcribing[msg.id] || !msg.mediaUrl}
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem', borderRadius: '4px' }}
                            title="Transcribir (Próximamente)"
                        >
                            <FileText size={16} />
                        </button>
                    </div>
                  )}
                </div>
              ) : msg.hasMedia ? (
                <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                  [Multimedia no soportada en esta versión web]
                </div>
              ) : (
                <p>{msg.body}</p>
              )}
              
              <span className="message-time">{formatTime(msg.timestamp)}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <form onSubmit={handleSendMessage} className="chat-input-form" style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
          <input
            type="text"
            className="chat-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Escribe un mensaje..."
            style={{ flex: 1 }}
          />
          <button 
            type="submit" 
            className="send-button"
            disabled={!inputText.trim()}
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChatView;
