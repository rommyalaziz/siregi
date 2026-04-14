import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if already logged in
    const session = localStorage.getItem('msa_session');
    if (session) {
      navigate('/dashboard');
    }

    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { data: user, error: authError } = await supabase
        .from('app_users')
        .select('*')
        .eq('username', email)
        .single();

      if (authError || !user) {
        throw new Error('Nama pengguna tidak ditemukan');
      }

      if (user.password !== password) {
        throw new Error('Kata sandi salah');
      }

      // Login success
      localStorage.setItem('msa_session', JSON.stringify({
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role
      }));

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`login-split-layout ${isVisible ? 'fade-in' : ''}`}>
      <div className="login-image-section">
        <div className="login-image-overlay"></div>
        <div className="login-brand-left">
          <div className="login-logo-large">
            <Building2 size={40} color="#FFFFFF" />
          </div>
          <h1>MAREGI</h1>
          <p>MSA Performance & Branch Tracker</p>
        </div>
      </div>

      <div className="login-form-section">
        <div className="login-form-box">
          <div className="login-header">
            <h2>Selamat datang kembali</h2>
            <p className="login-subtitle">Silakan masukkan detail Anda untuk masuk.</p>
          </div>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Nama Pengguna / Email</label>
              <input
                type="text"
                placeholder="Masukkan nama pengguna Anda"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Kata Sandi</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="login-submit-btn" disabled={isLoading}>
              {isLoading ? 'Sedang Masuk...' : 'Login / Masuk'}
            </button>
          </form>
          <div className="login-credit">
            Crafted with ❤️ by rommyalaziz
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
