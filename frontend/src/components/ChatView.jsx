import { useState, useEffect, useRef } from 'react';
import { Play, Pause, FileText, Tag as TagIcon, Send, RefreshCw, Settings, CheckCheck, Sparkles } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, setDoc, doc, limit } from 'firebase/firestore';
import ChatExtractionRulesModal from './ChatExtractionRulesModal';

function ModernAudioPlayer({ msg, onRetry, onTranscribe, isTranscribing }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const toggleSpeed = () => {
    const speeds = [1, 1.5, 2];
    const nextIndex = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIndex];
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const formatSeconds = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Si no hay mediaUrl disponible todavía
  if (!msg.mediaUrl) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        padding: '0.5rem 0.75rem',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        fontSize: '0.8rem',
        color: 'var(--text-secondary)',
        minWidth: '220px'
      }}>
        <RefreshCw size={14} style={{ animation: 'spin 2s linear infinite' }} />
        <span>Recuperando audio...</span>
        <button
          type="button"
          onClick={() => onRetry(msg)}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            color: 'var(--text-primary)',
            padding: '2px 8px',
            fontSize: '0.72rem',
            cursor: 'pointer'
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div style={{ minWidth: '240px', maxWidth: '340px', display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.2rem 0' }}>
      <audio
        ref={audioRef}
        src={msg.mediaUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
        preload="metadata"
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <button
          type="button"
          onClick={togglePlay}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent, #6366f1)',
            color: 'white',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
          }}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: '2px' }} />}
        </button>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            style={{
              width: '100%',
              accentColor: 'var(--accent, #6366f1)',
              cursor: 'pointer',
              height: '5px'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            <span>{formatSeconds(currentTime)}</span>
            <span>{formatSeconds(duration)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleSpeed}
          title="Velocidad de reproducción"
          style={{
            fontSize: '0.72rem',
            fontWeight: '700',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '2px 7px',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          {playbackRate}x
        </button>
      </div>

      {/* Transcripción Whisper */}
      {msg.transcription ? (
        <div style={{
          marginTop: '0.35rem',
          padding: '0.5rem 0.7rem',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '6px',
          borderLeft: '3px solid var(--accent, #6366f1)',
          fontSize: '0.82rem',
          lineHeight: '1.4',
          color: 'var(--text-primary)'
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--accent, #818cf8)', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Sparkles size={11} />
            <span>TRANSCRIPCIÓN</span>
          </div>
          <span>"{msg.transcription}"</span>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
          <button
            type="button"
            onClick={() => onTranscribe(msg)}
            disabled={isTranscribing}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent, #818cf8)',
              fontSize: '0.72rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              opacity: isTranscribing ? 0.6 : 0.9,
              padding: '2px 4px'
            }}
          >
            <FileText size={12} />
            {isTranscribing ? 'Transcribiendo con IA...' : 'Transcribir a texto'}
          </button>
        </div>
      )}
    </div>
  );
}

function ChatView({ chat, onTagUpdated }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inputText, setInputText] = useState('');
  const [transcribing, setTranscribing] = useState({});
  const [showExtractionModal, setShowExtractionModal] = useState(false);
  const [categories, setCategories] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const unsubCat = onSnapshot(collection(db, 'custom_categories'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setCategories(list);
    });
    return () => unsubCat();
  }, []);

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

  const isInstagram = chat.channel === 'instagram' || chat.author?.startsWith('ig_');
  const isGroup = !!(chat.isGroup || chat.author?.includes('@g.us') || chat.contactId?.includes('@g.us'));
  const isPersonal = chat.workspaceId === 'personal';

  const isLid = (str) => {
    if (!str) return false;
    const clean = String(str).replace('@lid', '').replace('@c.us', '');
    return str.includes('@lid') || (clean.length >= 14 && clean.startsWith('1'));
  };

  const formatPhoneNumber = (num) => {
    if (!num) return '';
    const clean = String(num).replace(/\D/g, '');
    if (isLid(clean)) return 'WhatsApp Directo';
    if (clean.startsWith('549') && clean.length >= 12) {
      return `+54 9 ${clean.slice(3, 5)} ${clean.slice(5, 9)}-${clean.slice(9)}`;
    }
    if (clean.startsWith('54') && clean.length >= 11) {
      return `+54 ${clean.slice(2, 4)} ${clean.slice(4, 8)}-${clean.slice(8)}`;
    }
    return `+${clean}`;
  };

  const getDisplayNumber = () => {
    if (isInstagram) return '@' + (chat.number || chat.pushname || chat.author.replace('ig_', ''));
    if (isGroup) return 'Grupo de WhatsApp';
    const raw = (chat.contactId && chat.contactId.includes('@c.us')) ? chat.contactId.split('@')[0] : (chat.number || chat.author?.split('@')[0]);
    if (!raw || isLid(raw) || isLid(chat.author)) {
      return 'WhatsApp Directo';
    }
    return formatPhoneNumber(raw);
  };

  const formatName = () => {
    if (isInstagram) return chat.name || chat.pushname || ('@' + chat.author.replace('ig_', ''));
    if (chat.name && chat.name !== 'Grupo de WhatsApp') return chat.name;
    if (chat.pushname && chat.pushname !== 'Grupo de WhatsApp') return chat.pushname;
    if (chat.name) return chat.name;
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
    
    const ws = chat.workspaceId || 'cob';
    try {
        await addDoc(collection(db, 'outbox'), {
            chatId: targetChat,
            text: textToSend,
            channel: isInstagram ? 'instagram' : 'whatsapp',
            workspaceId: ws,
            createdAt: new Date().getTime()
        });
    } catch (err) {
        console.error('Error al enviar mensaje:', err);
    }
  };

  const handleRetryAudio = async (msg) => {
    try {
      await addDoc(collection(db, 'audio_actions'), {
        type: 'redownload',
        msgId: msg.id,
        chatId: chat.author || chat.contactId,
        sourceName: formatName(),
        senderName: msg.senderName || '',
        createdAt: Date.now()
      });
    } catch (e) {
      console.error('Error solicitando re-descarga de audio:', e);
    }
  };

  const handleTranscribeAudio = async (msg) => {
    setTranscribing(prev => ({ ...prev, [msg.id]: true }));
    try {
      await addDoc(collection(db, 'audio_actions'), {
        type: 'transcribe',
        msgId: msg.id,
        chatId: chat.author || chat.contactId,
        sourceName: formatName(),
        senderName: msg.senderName || '',
        createdAt: Date.now()
      });
      await setDoc(doc(db, 'messages', msg.id), {
        transcriptionStatus: 'processing'
      }, { merge: true });
    } catch (e) {
      console.error('Error solicitando transcripción:', e);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="main-header">
        <div className="chat-header-info" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2>{formatName()}</h2>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 'bold',
                padding: '2px 8px',
                borderRadius: '4px',
                background: isInstagram 
                  ? 'linear-gradient(45deg, #f09433 0%, #dc2743 50%, #bc1888 100%)' 
                  : (isGroup ? '#6366f1' : (isPersonal ? '#818cf8' : '#22c55e')),
                color: 'white'
              }}>
                {isInstagram ? 'Instagram Direct' : (isGroup ? 'Grupo de WhatsApp' : (isPersonal ? 'WhatsApp Personal' : 'WhatsApp Cloud'))}
              </span>
            </div>
            <span className="chat-subtitle" style={{opacity: 0.7, fontSize: '0.8rem'}}>{getDisplayNumber()}</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button 
            type="button"
            onClick={() => setShowExtractionModal(true)}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              color: '#818cf8',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: '20px',
              padding: '0.4rem 0.8rem',
              fontSize: '0.78rem',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
            title="Configurar qué información tomar de este chat para el Organizador"
          >
            <Settings size={13} />
            Configurar Extracción
          </button>

          <button 
            onClick={handleTagConversation}
            className="tag-badge"
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          >
            <TagIcon size={14} color="var(--accent)" />
            {chat.tag ? chat.tag : 'Etiquetar Conversación'}
          </button>
        </div>
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
          messages.map((msg, index) => {
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const isConsecutive = prevMsg && prevMsg.fromMe === msg.fromMe && prevMsg.senderName === msg.senderName;
            const showSender = !msg.fromMe && msg.senderName && !isConsecutive;

            return (
              <div 
                key={msg.id} 
                className={`message ${msg.fromMe ? 'sent' : 'received'}`}
                style={{ marginTop: isConsecutive ? '3px' : '10px' }}
              >
                {showSender && (
                  <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent, #818cf8)', marginBottom: '0.25rem' }}>
                    {msg.senderName}
                  </div>
                )}

                {msg.isAudio ? (
                  <ModernAudioPlayer
                    msg={msg}
                    onRetry={handleRetryAudio}
                    onTranscribe={handleTranscribeAudio}
                    isTranscribing={transcribing[msg.id] || msg.transcriptionStatus === 'processing'}
                  />
                ) : msg.hasMedia ? (
                  <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                    [Multimedia recibida]
                  </div>
                ) : (
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.body}</p>
                )}
                
                <span className="message-time">{formatTime(msg.timestamp)}</span>
              </div>
            );
          })
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

      <ChatExtractionRulesModal 
        isOpen={showExtractionModal} 
        onClose={() => setShowExtractionModal(false)} 
        chat={chat} 
        categories={categories} 
      />
    </div>
  );
}

export default ChatView;
