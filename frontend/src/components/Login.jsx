import { useState } from 'react';
import { Lock, Mail, Activity, ShieldCheck, ArrowRight, Building2, Home, Sparkles, Smartphone } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

function Login({ onAuthenticated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor completa todos los campos.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      if (onAuthenticated) onAuthenticated('cob');
    } catch (err) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Credenciales inválidas. Revisa el correo y la contraseña.');
      } else {
        setError('Acceso mediante correo no disponible. Utiliza los accesos directos debajo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAccess = (workspace = 'cob') => {
    localStorage.setItem('cob_staff_auth', JSON.stringify({
      user: workspace === 'personal' ? 'Espacio Personal' : 'Equipo COB',
      workspace: workspace,
      timestamp: Date.now()
    }));
    localStorage.setItem('cob_crm_workspace', workspace);
    if (onAuthenticated) onAuthenticated(workspace);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      background: 'radial-gradient(circle at 50% 30%, #1a222d 0%, #0c0e12 100%)',
      padding: '1.5rem',
      fontFamily: 'var(--font-main, sans-serif)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: 'rgba(26, 29, 36, 0.9)',
        backdropFilter: 'blur(16px)',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '2.5rem 2rem',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(16, 185, 129, 0.3)'
            }}>
              <Activity size={28} color="#ffffff" />
            </div>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(99, 102, 241, 0.3)'
            }}>
              <Sparkles size={28} color="#ffffff" />
            </div>
          </div>

          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ffffff', margin: '0.2rem 0 0' }}>
            COB Hub & Organizador
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#a1a1aa', margin: 0 }}>
            Plataforma Unificada Multi-Espacio (Clínica Dental + Organización Personal)
          </p>
        </div>

        {/* Acceso Directo por Espacio */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#71717a', fontWeight: '600', textAlign: 'center', letterSpacing: '0.5px' }}>
            SELECCIONA TU ESPACIO PARA INGRESAR:
          </span>

          {/* Opción 1: Consultorio COB */}
          <button
            onClick={() => handleQuickAccess('cob')}
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem 1.25rem',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1.5px solid #10b981',
              borderRadius: '14px',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.12)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Building2 size={22} color="white" />
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '0.95rem', color: '#ffffff' }}>
                  🏢 Consultorio COB
                </strong>
                <span style={{ fontSize: '0.75rem', color: '#6ee7b7' }}>
                  Pacientes, turnos y WhatsApp Dental
                </span>
              </div>
            </div>
            <ArrowRight size={20} color="#10b981" />
          </button>

          {/* Opción 2: Personal & Familia (Compañera) */}
          <button
            onClick={() => handleQuickAccess('personal')}
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem 1.25rem',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              border: '1.5px solid #6366f1',
              borderRadius: '14px',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.12)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#6366f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Home size={22} color="white" />
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '0.95rem', color: '#ffffff' }}>
                  🏠 Personal & Familia (Compañera)
                </strong>
                <span style={{ fontSize: '0.75rem', color: '#a5b4fc' }}>
                  Organizador, Grupos Escolares & Vincular 2do Teléfono
                </span>
              </div>
            </div>
            <ArrowRight size={20} color="#818cf8" />
          </button>
        </div>

        {/* Separador */}
        <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setShowEmailForm(!showEmailForm)}
            style={{
              background: 'none',
              border: 'none',
              color: '#71717a',
              fontSize: '0.75rem',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            {showEmailForm ? 'Ocultar inicio con correo' : 'O ingresar con correo electrónico'}
          </button>
        </div>

        {/* Formulario tradicional (Opcional si se despliega) */}
        {showEmailForm && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {error && (
              <div style={{
                padding: '0.75rem',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#ef4444',
                fontSize: '0.8rem'
              }}>
                {error}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.3rem' }}>
                Correo Institucional
              </label>
              <input
                type="email"
                placeholder="consultorio@cobelgrano.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#0f1115',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.3rem' }}>
                Contraseña
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#0f1115',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '0.75rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {loading ? 'Verificando...' : 'Entrar con correo'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default Login;
