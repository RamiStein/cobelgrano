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

  const getDisplayNumber = (chat) => {
    if (chat.channel === 'instagram' || chat.author?.startsWith('ig_')) {
      return '@' + (chat.number || chat.pushname || chat.name || chat.author.replace('ig_', ''));
    }
    if (isGroupChat(chat)) {
      return 'Grupo de WhatsApp';
    }
    if (chat.contactId && chat.contactId.includes('@c.us')) {
      return chat.contactId.split('@')[0];
    }
    return chat.author?.split('@')[0] || '';
  };

  const formatName = (chat) => {
    if (chat.channel === 'instagram' || chat.author?.startsWith('ig_')) {
      return chat.name || chat.pushname || ('@' + chat.author.replace('ig_', ''));
    }
    if (chat.name) return chat.name;
    if (chat.pushname) return chat.pushname;
    return getDisplayNumber(chat);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  // 2. Filtrar por subcategorías/canales
  const filteredChats = workspaceChats.filter(chat => {
    // Filtro de búsqueda
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = formatName(chat).toLowerCase();
      const num = getDisplayNumber(chat).toLowerCase();
      if (!name.includes(q) && !num.includes(q)) return false;
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

  // Contadores
  const groupsCount = workspaceChats.filter(c => isGroupChat(c)).length;
  const directCount = workspaceChats.filter(c => !isGroupChat(c)).length;
  const whatsappCount = workspaceChats.filter(c => !isInstagramChat(c)).length;
  const instagramCount = workspaceChats.filter(c => isInstagramChat(c)).length;

  return (
    <div className="sidebar" style={{ width: '350px', display: 'flex', flexDirection: 'column' }}>
      <div className="sidebar-header" style={{ paddingBottom: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.3rem', margin: 0 }}>
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
        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.6rem' }}>
          <button
            onClick={() => setFilterChannel('all')}
            style={{
              flex: 1,
              padding: '0.3rem 0.4rem',
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
                style={{
                  flex: 1,
                  padding: '0.3rem 0.4rem',
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
                style={{
                  flex: 1,
                  padding: '0.3rem 0.4rem',
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
                style={{
                  flex: 1,
                  padding: '0.3rem 0.4rem',
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
                style={{
                  flex: 1,
                  padding: '0.3rem 0.4rem',
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

              <div className="chat-preview" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>{getDisplayNumber(chat)}</span>
                {chat.tag && (
                  <span className="tag-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <TagIcon size={10} /> {chat.tag}
                  </span>
                )}
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
