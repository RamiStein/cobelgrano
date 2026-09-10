import { useState, useEffect } from 'react';
import { MessageSquare, Clock, Tag, Activity } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

function Dashboard() {
  const [stats, setStats] = useState({
    totalMessages: 0,
    totalTime: 0,
    tags: []
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const messagesSnapshot = await getDocs(collection(db, 'messages'));
      const contactsSnapshot = await getDocs(collection(db, 'contacts'));
      
      const tagMap = {};
      contactsSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.tag) {
              tagMap[data.tag] = (tagMap[data.tag] || 0) + 1;
          }
      });
      
      const tagsArray = Object.keys(tagMap).map(tag => ({ tag, count: tagMap[tag] }));
      
      setStats({
          totalMessages: messagesSnapshot.size,
          totalTime: 0, // Not implemented in firebase version yet
          tags: tagsArray
      });
    } catch (err) {
      console.error(err);
    }
  };

  const formatTime = (ms) => {
    if (!ms) return '0 min';
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes} min`;
  };

  return (
    <div style={{ padding: '3rem', flex: 1, overflowY: 'auto' }}>
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Activity color="var(--accent)" /> Panel de Control
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>Resumen de tu actividad en la aplicación.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card fade-in" style={{ animationDelay: '0.1s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--accent)' }}>
            <MessageSquare size={20} />
            <span className="stat-label">Mensajes Registrados</span>
          </div>
          <div className="stat-value">{stats.totalMessages}</div>
        </div>

        <div className="stat-card fade-in" style={{ animationDelay: '0.2s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#3b82f6' }}>
            <Clock size={20} />
            <span className="stat-label">Tiempo en la App (Leyendo/Escuchando)</span>
          </div>
          <div className="stat-value">{formatTime(stats.totalTime)}</div>
        </div>
        
        <div className="stat-card fade-in" style={{ animationDelay: '0.3s' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f59e0b' }}>
            <Tag size={20} />
            <span className="stat-label">Total de Etiquetas Diferentes</span>
          </div>
          <div className="stat-value">{stats.tags?.length || 0}</div>
        </div>
      </div>

      <div style={{ marginTop: '3rem' }} className="fade-in" style={{ animationDelay: '0.4s' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontWeight: 500 }}>Razones de comunicación (Etiquetas en chats)</h2>
        
        {stats.tags && stats.tags.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            {stats.tags.map(tag => (
              <div key={tag.tag} style={{ 
                background: 'var(--bg-glass)', 
                padding: '1rem 1.5rem', 
                borderRadius: '12px',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
              }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{tag.tag}</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 600 }}>{tag.count} <span style={{fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-secondary)'}}>chat(s)</span></span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)' }}>Aún no has etiquetado ningún chat.</p>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
