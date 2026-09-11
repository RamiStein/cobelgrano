import { useState } from 'react';
import { Tag as TagIcon, MessageCircle } from 'lucide-react';

function InstagramMiniIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
    </svg>
  );
}

function ChatList({ chats, activeChat, setActiveChat }) {
  const [filterChannel, setFilterChannel] = useState('all'); // 'all', 'whatsapp', 'instagram'
  
  const getDisplayNumber = (chat) => {
    if (chat.channel === 'instagram' || chat.author?.startsWith('ig_')) {
      return '@' + (chat.number || chat.pushname || chat.name || chat.author.replace('ig_', ''));
    }
    if (chat.contactId && chat.contactId.includes('@c.us')) {
      return chat.contactId.split('@')[0];
    }
    return chat.author.split('@')[0];
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

  const isInstagramChat = (chat) => {
    return chat.channel === 'instagram' || chat.author?.startsWith('ig_') || chat.platform === 'instagram';
  };

  const filteredChats = chats.filter(chat => {
    if (filterChannel === 'whatsapp') return !isInstagramChat(chat);
    if (filterChannel === 'instagram') return isInstagramChat(chat);
    return true;
  });

  const whatsappCount = chats.filter(c => !isInstagramChat(c)).length;
  const instagramCount = chats.filter(c => isInstagramChat(c)).length;

  return (
    <div className="sidebar" style={{ width: '350px' }}>
      <div className="sidebar-header" style={{ paddingBottom: '0.5rem' }}>
        <h1 style={{ fontSize: '1.4rem' }}>Conversaciones</h1>
        
        {/* Filtros de Canal Omnicanal */}
        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem' }}>
          <button
            onClick={() => setFilterChannel('all')}
            style={{
              flex: 1,
              padding: '0.35rem 0.5rem',
              borderRadius: '6px',
              border: filterChannel === 'all' ? '1px solid var(--accent)' : '1px solid var(--border)',
              backgroundColor: filterChannel === 'all' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-primary)',
              color: filterChannel === 'all' ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Todos ({chats.length})
          </button>
          <button
            onClick={() => setFilterChannel('whatsapp')}
            style={{
              flex: 1,
              padding: '0.35rem 0.5rem',
              borderRadius: '6px',
              border: filterChannel === 'whatsapp' ? '1px solid #22c55e' : '1px solid var(--border)',
              backgroundColor: filterChannel === 'whatsapp' ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-primary)',
              color: filterChannel === 'whatsapp' ? '#22c55e' : 'var(--text-secondary)',
              fontSize: '0.75rem',
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
              padding: '0.35rem 0.5rem',
              borderRadius: '6px',
              border: filterChannel === 'instagram' ? '1px solid #e1306c' : '1px solid var(--border)',
              backgroundColor: filterChannel === 'instagram' ? 'rgba(225, 48, 108, 0.15)' : 'var(--bg-primary)',
              color: filterChannel === 'instagram' ? '#e1306c' : 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Instagram ({instagramCount})
          </button>
        </div>
      </div>

      <div className="chat-list">
        {filteredChats.map(chat => {
          const isIg = isInstagramChat(chat);
          return (
            <div 
              key={chat.author} 
              className={`chat-item ${activeChat?.author === chat.author ? 'active' : ''}`}
              onClick={() => setActiveChat(chat)}
            >
              <div className="chat-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                  {/* Badge de Canal */}
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
                  ) : (
                    <span 
                      title="WhatsApp Oficial"
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
            No hay conversaciones {filterChannel !== 'all' ? `en ${filterChannel}` : ''} aún.
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatList;
