import { useState } from 'react';
import { Tag as TagIcon, MessageCircle, Users, User, Search } from 'lucide-react';

function InstagramMiniIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
    </svg>
  );
}

function ChatList({ chats, activeChat, setActiveChat, workspace = 'cob' }) {
  const [filterChannel, setFilterChannel] = useState('all'); // COB: 'all', 'whatsapp', 'instagram' | Personal: 'all', 'groups', 'direct'
  const [searchQuery, setSearchQuery] = useState('');

  const isInstagramChat = (chat) => {
    return chat.channel === 'instagram' || chat.author?.startsWith('ig_') || chat.platform === 'instagram';
  };

  const isGroupChat = (chat) => {
    return !!(chat.isGroup || chat.author?.includes('@g.us') || chat.contactId?.includes('@g.us') ||
             (chat.name && (
               chat.name.toLowerCase().includes('grupo') ||
               chat.name.toLowerCase().includes('colegio') ||
               chat.name.toLowerCase().includes('padres') ||
               chat.name.toLowerCase().includes('mamis') ||
               chat.name.toLowerCase().includes('familia')
             )));
  };

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

  const getDisplayNumber = (chat) => {
    if (chat.channel === 'instagram' || chat.author?.startsWith('ig_')) {
      return '@' + (chat.number || chat.pushname || chat.name || chat.author.replace('ig_', ''));
    }
    if (isGroupChat(chat)) {
      return 'Grupo de WhatsApp';
    }
    const raw = chat.contactId?.includes('@c.us') ? chat.contactId.split('@')[0] : (chat.number || chat.author?.split('@')[0]);
    if (!raw || isLid(raw) || isLid(chat.author)) {
      return 'WhatsApp Directo';
    }
    return formatPhoneNumber(raw);
  };

  const getLastMessagePreview = (chat) => {
    if (chat.lastMessage && typeof chat.lastMessage === 'string') {
      return chat.lastMessage;
    }
    return getDisplayNumber(chat);
  };

  const formatName = (chat) => {
    if (chat.channel === 'instagram' || chat.author?.startsWith('ig_')) {
      return chat.name || chat.pushname || ('@' + chat.author.replace('ig_', ''));
    }
    if (chat.name && chat.name !== 'Grupo de WhatsApp') return chat.name;
    if (chat.pushname && chat.pushname !== 'Grupo de WhatsApp') return chat.pushname;
    if (chat.name) return chat.name;
    if (chat.pushname) return chat.pushname;
    return getDisplayNumber(chat);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Ayer';
    }

    const diffDays = Math.round((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }

    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  };

  // 1. Filtrar primero por el espacio activo (Aislamiento Total)
  const workspaceChats = chats.filter(chat => {
    if (workspace === 'personal') {
      return chat.workspaceId === 'personal';
    } else {
      // Espacio COB (todo lo que no sea explícitamente personal)
      return chat.workspaceId !== 'personal';
    }
  });

  // Filtrado de chats por canal / tipo y término de búsqueda
  const filteredChats = workspaceChats.filter(chat => {
    const q = searchQuery.toLowerCase();
    const nameMatch = (chat.name || '').toLowerCase().includes(q);
    const numberMatch = (chat.number || '').toString().includes(q);
    const authorMatch = (chat.author || '').toLowerCase().includes(q);
    const pushnameMatch = (chat.pushname || '').toLowerCase().includes(q);

    if (searchQuery.trim() && !(nameMatch || numberMatch || authorMatch || pushnameMatch)) {
      return false;
    }

    if (workspace === 'personal') {
      if (filterChannel === 'groups') return isGroupChat(chat);
      if (filterChannel === 'direct') return !isGroupChat(chat);
      return true;
    } else {
      if (filterChannel === 'whatsapp') return !isInstagramChat(chat);
      if (filterChannel === 'instagram') return isInstagramChat(chat);
      return true;
    }
  });

  // Ordenar por última actividad descendente (chats más recientes primero)
  filteredChats.sort((a, b) => (Number(b.lastActivity) || 0) - (Number(a.lastActivity) || 0));

  // Contadores
  const groupsCount = workspaceChats.filter(c => isGroupChat(c)).length;
  const directCount = workspaceChats.filter(c => !isGroupChat(c)).length;
  const whatsappCount = workspaceChats.filter(c => !isInstagramChat(c)).length;
  const instagramCount = workspaceChats.filter(c => isInstagramChat(c)).length;

  return (
    <div className="sidebar" style={{ width: '350px', minWidth: '350px', maxWidth: '350px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        padding: '1.1rem 1.1rem 0.65rem',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <h1 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
            {workspace === 'personal' ? 'Chats & Grupos' : 'Conversaciones'}
          </h1>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: '700',
            padding: '2px 8px',
            borderRadius: '6px',
            backgroundColor: workspace === 'personal' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            color: workspace === 'personal' ? '#818cf8' : 'var(--accent)'
          }}>
            {workspace === 'personal' ? 'PERSONAL' : 'COB'}
          </span>
        </div>

        {/* Buscador */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '0.35rem 0.6rem',
          marginTop: '0.6rem'
        }}>
          <Search size={14} style={{ color: 'var(--text-secondary)', marginRight: '0.4rem' }} />
          <input
            type="text"
            placeholder={workspace === 'personal' ? "Buscar grupo o contacto..." : "Buscar paciente o chat..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              outline: 'none',
              width: '100%'
            }}
          />
        </div>
        
        {/* Filtros */}
        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.6rem', width: '100%', boxSizing: 'border-box' }}>
          <button
            onClick={() => setFilterChannel('all')}
            title={`Todos (${workspaceChats.length})`}
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              padding: '0.35rem 0.3rem',
              borderRadius: '6px',
              border: filterChannel === 'all' ? '1px solid var(--accent)' : '1px solid var(--border)',
              backgroundColor: filterChannel === 'all' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-primary)',
              color: filterChannel === 'all' ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: '0.72rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Todos ({workspaceChats.length})
          </button>

          {workspace === 'personal' ? (
            <>
              <button
                onClick={() => setFilterChannel('groups')}
                title={`Grupos (${groupsCount})`}
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  padding: '0.35rem 0.3rem',
                  borderRadius: '6px',
                  border: filterChannel === 'groups' ? '1px solid #6366f1' : '1px solid var(--border)',
                  backgroundColor: filterChannel === 'groups' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-primary)',
                  color: filterChannel === 'groups' ? '#818cf8' : 'var(--text-secondary)',
                  fontSize: '0.72rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Grupos ({groupsCount})
              </button>
              <button
                onClick={() => setFilterChannel('direct')}
                title={`Directos (${directCount})`}
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  padding: '0.35rem 0.3rem',
                  borderRadius: '6px',
                  border: filterChannel === 'direct' ? '1px solid #10b981' : '1px solid var(--border)',
                  backgroundColor: filterChannel === 'direct' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-primary)',
                  color: filterChannel === 'direct' ? '#10b981' : 'var(--text-secondary)',
                  fontSize: '0.72rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Directos ({directCount})
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setFilterChannel('whatsapp')}
                title={`WhatsApp (${whatsappCount})`}
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  padding: '0.35rem 0.3rem',
                  borderRadius: '6px',
                  border: filterChannel === 'whatsapp' ? '1px solid #22c55e' : '1px solid var(--border)',
                  backgroundColor: filterChannel === 'whatsapp' ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-primary)',
                  color: filterChannel === 'whatsapp' ? '#22c55e' : 'var(--text-secondary)',
                  fontSize: '0.72rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                WhatsApp ({whatsappCount})
              </button>
              <button
                onClick={() => setFilterChannel('instagram')}
                title={`Instagram (${instagramCount})`}
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  padding: '0.35rem 0.3rem',
                  borderRadius: '6px',
                  border: filterChannel === 'instagram' ? '1px solid #e1306c' : '1px solid var(--border)',
                  backgroundColor: filterChannel === 'instagram' ? 'rgba(225, 48, 108, 0.15)' : 'var(--bg-primary)',
                  color: filterChannel === 'instagram' ? '#e1306c' : 'var(--text-secondary)',
                  fontSize: '0.72rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Instagram ({instagramCount})
              </button>
            </>
          )}
        </div>
      </div>

      <div className="chat-list" style={{ flex: 1, overflowY: 'auto' }}>
        {filteredChats.map(chat => {
          const isIg = isInstagramChat(chat);
          const isGroup = isGroupChat(chat);
          const previewText = getLastMessagePreview(chat);

          return (
            <div 
              key={chat.author} 
              className={`chat-item ${activeChat?.author === chat.author ? 'active' : ''}`}
              onClick={() => setActiveChat(chat)}
            >
              <div className="chat-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                  {/* Badge de Tipo / Canal */}
                  {isIg ? (
                    <span 
                      title="Mensaje Directo de Instagram"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        background: 'linear-gradient(45deg, #f09433 0%, #dc2743 50%, #bc1888 100%)',
                        color: 'white',
                        flexShrink: 0
                      }}
                    >
                      <InstagramMiniIcon size={12} />
                    </span>
                  ) : isGroup ? (
                    <span 
                      title="Grupo de WhatsApp"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        backgroundColor: '#6366f1',
                        color: 'white',
                        flexShrink: 0
                      }}
                    >
                      <Users size={12} />
                    </span>
                  ) : (
                    <span 
                      title="WhatsApp Chat"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        backgroundColor: '#22c55e',
                        color: 'white',
                        flexShrink: 0
                      }}
                    >
                      <MessageCircle size={12} />
                    </span>
                  )}
                  <span className="chat-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatName(chat)}
                  </span>
                </div>
                <span className="chat-time" style={{ flexShrink: 0 }}>{formatDate(chat.lastActivity)}</span>
              </div>

              <div className="chat-preview" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem', gap: '0.5rem' }}>
                <span 
                  style={{ 
                    opacity: 0.75, 
                    fontSize: '0.8rem', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap',
                    flex: 1
                  }}
                  title={previewText}
                >
                  {previewText}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                  {chat.unreadCount > 0 && (
                    <span style={{
                      backgroundColor: '#22c55e',
                      color: 'white',
                      fontSize: '0.68rem',
                      fontWeight: '700',
                      borderRadius: '10px',
                      padding: '1px 6px',
                      minWidth: '16px',
                      textAlign: 'center',
                      lineHeight: '1.2'
                    }}>
                      {chat.unreadCount}
                    </span>
                  )}
                  {chat.tag && (
                    <span className="tag-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <TagIcon size={10} /> {chat.tag}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredChats.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            {workspace === 'personal'
              ? 'No hay chats ni grupos personales sincronizados aún.'
              : 'No hay conversaciones en esta bandeja.'}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatList;
