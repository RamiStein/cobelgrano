import { User, Tag as TagIcon } from 'lucide-react';

function ChatList({ chats, activeChat, setActiveChat }) {
  
  const getDisplayNumber = (chat) => {
    if (chat.contactId && chat.contactId.includes('@c.us')) {
      return chat.contactId.split('@')[0];
    }
    return chat.author.split('@')[0];
  };

  const formatName = (chat) => {
    if (chat.name) return chat.name;
    if (chat.pushname) return chat.pushname;
    return getDisplayNumber(chat);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="sidebar" style={{ width: '350px' }}>
      <div className="sidebar-header">
        <h1>Conversaciones</h1>
      </div>
      <div className="chat-list">
        {chats.map(chat => (
          <div 
            key={chat.author} 
            className={`chat-item ${activeChat?.author === chat.author ? 'active' : ''}`}
            onClick={() => setActiveChat(chat)}
          >
            <div className="chat-header">
              <span className="chat-name">{formatName(chat)}</span>
              <span className="chat-time">{formatDate(chat.lastActivity)}</span>
            </div>
            <div className="chat-preview" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
              <span style={{opacity: 0.7}}>{getDisplayNumber(chat)}</span>
              {chat.tag && (
                <span className="tag-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <TagIcon size={10} /> {chat.tag}
                </span>
              )}
            </div>
          </div>
        ))}
        {chats.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No hay chats aún.
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatList;
