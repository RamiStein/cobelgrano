import { useState, useEffect } from 'react';
import { 
  X, Check, Settings, ShieldAlert, Filter, Pin, EyeOff, 
  MessageSquare, Users, Sparkles, RefreshCw, Trash2
} from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';

export default function ChatExtractionRulesModal({ 
  isOpen, 
  onClose, 
  chat = null, 
  categories = [], 
  allChats = [] 
}) {
  const [selectedChat, setSelectedChat] = useState(chat);
  const [isExcluded, setIsExcluded] = useState(false);
  const [mode, setMode] = useState('all'); // 'all', 'filtered', 'forced'
  const [allowedCategories, setAllowedCategories] = useState([]);
  const [forcedCategory, setForcedCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [allRules, setAllRules] = useState({});
  const [viewMode, setViewMode] = useState('single'); // 'single' o 'list'

  useEffect(() => {
    setSelectedChat(chat);
    setViewMode(chat ? 'single' : 'list');
  }, [chat]);

  const currentChatId = selectedChat?.author || selectedChat?.contactId || selectedChat?.id;

  // Escuchar regla del chat actual
  useEffect(() => {
    if (!currentChatId) return;

    const unsub = onSnapshot(doc(db, 'chat_rules', currentChatId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setIsExcluded(!!data.excluded);
        setMode(data.mode || (data.forcedCategory ? 'forced' : (data.allowedCategories?.length ? 'filtered' : 'all')));
        setAllowedCategories(Array.isArray(data.allowedCategories) ? data.allowedCategories : []);
        setForcedCategory(data.forcedCategory || (categories[0]?.id || ''));
      } else {
        // Valores predeterminados
        setIsExcluded(false);
        setMode('all');
        setAllowedCategories([]);
        setForcedCategory(categories[0]?.id || '');
      }
    });

    return () => unsub();
  }, [currentChatId, categories]);

  // Escuchar todas las reglas existentes para la vista de lista
  useEffect(() => {
    const unsubAll = onSnapshot(collection(db, 'chat_rules'), (snap) => {
      const map = {};
      snap.forEach(d => {
        map[d.id] = { id: d.id, ...d.data() };
      });
      setAllRules(map);
    });

    return () => unsubAll();
  }, []);

  if (!isOpen) return null;

  const handleToggleCategory = (catId) => {
    if (allowedCategories.includes(catId)) {
      setAllowedCategories(allowedCategories.filter(id => id !== catId));
    } else {
      setAllowedCategories([...allowedCategories, catId]);
    }
  };

  const handleSaveRule = async () => {
    if (!currentChatId) return;

    setSaving(true);
    try {
      const chatTitle = selectedChat?.name || selectedChat?.pushname || currentChatId;
      
      const payload = {
        chatId: currentChatId,
        chatName: chatTitle,
        excluded: isExcluded,
        mode: isExcluded ? 'excluded' : mode,
        allowedCategories: mode === 'filtered' ? allowedCategories : [],
        forcedCategory: mode === 'forced' ? forcedCategory : null,
        updatedAt: Date.now()
      };

      await setDoc(doc(db, 'chat_rules', currentChatId), payload, { merge: true });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('Error guardando regla de chat:', err);
      alert('Error guardando regla: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetRule = async (chatIdToReset) => {
    const targetId = chatIdToReset || currentChatId;
    if (!targetId) return;

    if (!confirm('¿Restablecer este chat al comportamiento automático predeterminado?')) return;

    try {
      await deleteDoc(doc(db, 'chat_rules', targetId));
      setIsExcluded(false);
      setMode('all');
      setAllowedCategories([]);
      setForcedCategory(categories[0]?.id || '');
      alert('Regla restablecida a automática.');
    } catch (err) {
      console.error('Error restableciendo regla:', err);
    }
  };

  const isGroup = selectedChat?.isGroup || currentChatId?.includes('@g.us');
  const chatDisplayName = selectedChat?.name || selectedChat?.pushname || currentChatId || 'Chat seleccionado';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--border)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(99, 102, 241, 0.08)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Settings size={22} color="#6366f1" />
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
                Configuración de Extracción de Chat
              </h2>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Determina con precisión qué mensajes e informaciones capturar de cada conversación.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* View Switcher Tabs (Chat individual vs Lista general) */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-primary)',
          padding: '0 1.5rem'
        }}>
          <button
            type="button"
            onClick={() => setViewMode('single')}
            style={{
              padding: '0.75rem 1rem',
              background: 'none',
              border: 'none',
              borderBottom: viewMode === 'single' ? '2px solid #6366f1' : '2px solid transparent',
              color: viewMode === 'single' ? '#6366f1' : 'var(--text-secondary)',
              fontWeight: viewMode === 'single' ? '700' : '500',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Configurar este Chat
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            style={{
              padding: '0.75rem 1rem',
              background: 'none',
              border: 'none',
              borderBottom: viewMode === 'list' ? '2px solid #6366f1' : '2px solid transparent',
              color: viewMode === 'list' ? '#6366f1' : 'var(--text-secondary)',
              fontWeight: viewMode === 'list' ? '700' : '500',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            Ver Todas las Reglas ({Object.keys(allRules).length})
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>

          {viewMode === 'single' ? (
            <>
              {/* Chat Info Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.8rem',
                padding: '0.9rem 1.1rem',
                backgroundColor: 'var(--bg-primary)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                marginBottom: '1.25rem'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: isGroup ? '#3b82f620' : '#10b98120',
                  color: isGroup ? '#3b82f6' : '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {isGroup ? <Users size={20} /> : <MessageSquare size={20} />}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {chatDisplayName}
                    </strong>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: '700',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      backgroundColor: isGroup ? '#3b82f620' : '#10b98120',
                      color: isGroup ? '#3b82f6' : '#10b981'
                    }}>
                      {isGroup ? 'Grupo de WhatsApp' : 'Chat Directo'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    ID: {currentChatId}
                  </span>
                </div>
              </div>

              {/* Toggle 1: ¿Monitorear este chat? */}
              <div style={{
                padding: '1rem',
                backgroundColor: isExcluded ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-primary)',
                borderRadius: '12px',
                border: isExcluded ? '1.5px solid #ef4444' : '1px solid var(--border)',
                marginBottom: '1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <div>
                  <strong style={{
                    fontSize: '0.9rem',
                    color: isExcluded ? '#ef4444' : 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}>
                    {isExcluded ? <EyeOff size={16} /> : <Sparkles size={16} color="#6366f1" />}
                    {isExcluded ? 'Chat Silenciado para el Organizador' : 'Analizar este chat en el Organizador'}
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.2rem' }}>
                    {isExcluded 
                      ? 'Los mensajes de este chat no generarán notas ni tareas en el sistema.'
                      : 'El motor inteligente analizará los mensajes relevantes de esta conversación.'}
                  </span>
                </div>

                <label style={{
                  position: 'relative',
                  display: 'inline-block',
                  width: '46px',
                  height: '24px',
                  flexShrink: 0,
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={!isExcluded}
                    onChange={(e) => setIsExcluded(!e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute',
                    cursor: 'pointer',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: !isExcluded ? '#10b981' : '#4b5563',
                    borderRadius: '24px',
                    transition: 'all 0.3s'
                  }}>
                    <span style={{
                      position: 'absolute',
                      content: '""',
                      height: '18px',
                      width: '18px',
                      left: !isExcluded ? '24px' : '3px',
                      bottom: '3px',
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      transition: 'all 0.3s'
                    }} />
                  </span>
                </label>
              </div>

              {/* If active, choose extraction mode */}
              {!isExcluded && (
                <div style={{
                  padding: '1.1rem',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  marginBottom: '1.25rem'
                }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block', marginBottom: '0.75rem' }}>
                    Modo de Extracción de Información:
                  </strong>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {/* Option 1: Auto */}
                    <label style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: mode === 'all' ? '1.5px solid #6366f1' : '1px solid var(--border)',
                      backgroundColor: mode === 'all' ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-secondary)',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="radio"
                        name="extraction_mode"
                        checked={mode === 'all'}
                        onChange={() => setMode('all')}
                        style={{ marginTop: '3px' }}
                      />
                      <div>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block' }}>
                          🔍 Detección Automática Completa
                        </strong>
                        <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                          Evalúa todas las categorías configuradas en tu espacio según sus palabras clave.
                        </span>
                      </div>
                    </label>

                    {/* Option 2: Filter */}
                    <label style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: mode === 'filtered' ? '1.5px solid #6366f1' : '1px solid var(--border)',
                      backgroundColor: mode === 'filtered' ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-secondary)',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="radio"
                        name="extraction_mode"
                        checked={mode === 'filtered'}
                        onChange={() => setMode('filtered')}
                        style={{ marginTop: '3px' }}
                      />
                      <div>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block' }}>
                          🎯 Filtrar Solo Categorías Específicas
                        </strong>
                        <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                          Solo extraerá información que coincida con las categorías que selecciones abajo.
                        </span>
                      </div>
                    </label>

                    {/* Sub-options for Filter */}
                    {mode === 'filtered' && (
                      <div style={{
                        marginTop: '0.4rem',
                        padding: '0.75rem 1rem',
                        backgroundColor: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        border: '1px dashed var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem'
                      }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                          Selecciona las categorías permitidas para este chat:
                        </span>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.4rem' }}>
                          {categories.map(cat => {
                            const isChecked = allowedCategories.includes(cat.id);
                            return (
                              <label
                                key={cat.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                  fontSize: '0.8rem',
                                  color: 'var(--text-primary)',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: isChecked ? `${cat.color}20` : 'transparent',
                                  border: isChecked ? `1px solid ${cat.color}` : '1px solid transparent',
                                  cursor: 'pointer'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleCategory(cat.id)}
                                />
                                <span>{cat.emoji || '📌'} {cat.label || cat.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Option 3: Force */}
                    <label style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: mode === 'forced' ? '1.5px solid #6366f1' : '1px solid var(--border)',
                      backgroundColor: mode === 'forced' ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-secondary)',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="radio"
                        name="extraction_mode"
                        checked={mode === 'forced'}
                        onChange={() => setMode('forced')}
                        style={{ marginTop: '3px' }}
                      />
                      <div>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block' }}>
                          📌 Forzar Categoría Fija
                        </strong>
                        <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                          Cualquier mensaje relevante en este chat irá automáticamente a la categoría que elijas.
                        </span>
                      </div>
                    </label>

                    {/* Sub-options for Force */}
                    {mode === 'forced' && (
                      <div style={{
                        marginTop: '0.4rem',
                        padding: '0.75rem 1rem',
                        backgroundColor: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        border: '1px dashed var(--border)'
                      }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                          Categoría obligatoria para este chat:
                        </label>
                        <select
                          value={forcedCategory}
                          onChange={(e) => setForcedCategory(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.55rem',
                            backgroundColor: 'var(--bg-primary)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem'
                          }}
                        >
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.emoji || '📌'} {c.label || c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                  </div>
                </div>
              )}
            </>
          ) : (
            /* List of all chats with configured rules */
            <div>
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  Reglas Personalizadas Guardadas
                </strong>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Aquí puedes ver todos los chats donde has configurado reglas específicas de extracción o silenciamiento.
                </p>
              </div>

              {Object.keys(allRules).length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '2.5rem 1rem',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: '12px',
                  border: '1px dashed var(--border)'
                }}>
                  <Settings size={32} style={{ color: 'var(--text-secondary)', opacity: 0.5, marginBottom: '0.5rem' }} />
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    No hay chats con reglas personalizadas todavía. Todos los chats se extraen con el modo automático general.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {Object.values(allRules).map(rule => (
                    <div
                      key={rule.chatId}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.85rem 1rem',
                        backgroundColor: 'var(--bg-primary)',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        gap: '0.75rem'
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block' }}>
                          {rule.chatName || rule.chatId}
                        </strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                          {rule.excluded ? (
                            <span style={{ fontSize: '0.7rem', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                              🔴 Silenciado
                            </span>
                          ) : rule.forcedCategory ? (
                            <span style={{ fontSize: '0.7rem', color: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                              📌 Forzar: {rule.forcedCategory}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                              🎯 Filtrado ({rule.allowedCategories?.length || 0} categorías)
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedChat({ author: rule.chatId, name: rule.chatName });
                            setViewMode('single');
                          }}
                          style={{
                            padding: '0.35rem 0.65rem',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            color: 'var(--text-secondary)',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResetRule(rule.chatId)}
                          title="Eliminar regla"
                          style={{
                            padding: '0.35rem',
                            background: 'none',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '6px',
                            color: '#ef4444',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-secondary)'
        }}>
          <div>
            {viewMode === 'single' && (
              <button
                type="button"
                onClick={() => handleResetRule()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Restablecer a modo automático
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button
              onClick={onClose}
              style={{
                padding: '0.6rem 1rem',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Cerrar
            </button>
            {viewMode === 'single' && (
              <button
                type="button"
                onClick={handleSaveRule}
                disabled={saving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem 1.3rem',
                  backgroundColor: savedSuccess ? '#10b981' : '#6366f1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                  transition: 'background 0.2s'
                }}
              >
                {savedSuccess ? <Check size={16} /> : <Settings size={16} />}
                {savedSuccess ? '¡Regla Guardada!' : (saving ? 'Guardando...' : 'Guardar Regla')}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
