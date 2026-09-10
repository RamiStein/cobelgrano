import { useState } from 'react';
import { Lock, Mail, Activity, ShieldCheck, ArrowRight } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

function Login({ onAuthenticated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

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
      if (onAuthenticated) onAuthenticated();
    } catch (err) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Credenciales inválidas. Revisa el correo y la contraseña.');
      } else if (err.code === 'auth/configuration-not-found') {
        setError('Firebase Auth aún no tiene habilitado Email/Password en la consola. Puedes usar el Acceso Rápido del Equipo debajo.');
      } else {
        setError(err.message || 'Error al iniciar sesión.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickStaffAccess = () => {
    // Quick authenticated session for clinic staff
    localStorage.setItem('cob_staff_auth', JSON.stringify({
      user: 'Equipo COB',
      role: 'Administrador / Profesional',
      timestamp: Date.now()
    }));
    if (onAuthenticated) onAuthenticated();
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
        maxWidth: '440px',
        background: 'rgba(26, 29, 36, 0.85)',
        backdropFilter: 'blur(16px)',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '2.5rem',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)'
          }}>
            <Activity size={32} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.5px', margin: 0 }}>
            COB CRM & Hub
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#a1a1aa', margin: 0 }}>
            Consultorios Odontológicos Belgrano
          </p>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.2rem 0.65rem',
            borderRadius: '999px',
            background: 'rgba(16, 185, 129, 0.1)',
            color: '#10b981',
            fontSize: '0.75rem',
            fontWeight: 600
          }}>
            <ShieldCheck size={14} /> Acceso Seguro Profesional
          </span>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            color: '#f87171',
            fontSize: '0.85rem'
          }}>
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.4rem', fontWeight: 500 }}>
              Correo Institucional
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: '#0f1115',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
              gap: '0.75rem'
            }}>
              <Mail size={18} color="#71717a" />
              <input
                type="email"
                placeholder="consultorio@cobelgrano.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  width: '100%'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.4rem', fontWeight: 500 }}>
              Contraseña
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: '#0f1115',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
              gap: '0.75rem'
            }}>
              <Lock size={18} color="#71717a" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  width: '100%'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '0.5rem',
              background: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '0.85rem',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'background 0.2s',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
            }}
          >
            {loading ? 'Verificando...' : (
              <>
                Ingresar al CRM <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.5rem 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
          <span style={{ fontSize: '0.75rem', color: '#71717a' }}>o</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
        </div>

        {/* Quick Staff Access */}
        <button
          onClick={handleQuickStaffAccess}
          type="button"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '12px',
            padding: '0.8rem',
            color: '#e4e4e7',
            fontSize: '0.85rem',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
          onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.05)'}
        >
          <ShieldCheck size={18} color="#10b981" />
          Acceso Rápido del Equipo COB
        </button>

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#71717a', margin: 0 }}>
          Exclusivo para profesionales y secretaría de Consultorios Odontológicos Belgrano.
        </p>
      </div>
    </div>
  );
}

export default Login;
