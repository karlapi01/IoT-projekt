import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: '100%', maxWidth: 380 }}>
        <h1 style={{ marginBottom: '.4rem', fontSize: '1.6rem', fontWeight: 800 }}>Redometar</h1>
        <p style={{ color: '#64748b', marginBottom: '1.8rem', fontSize: '.9rem' }}>
          Sustav upravljanja redom čekanja u menzi
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="form-group">
            <label>Lozinka</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: '.5rem' }}>
            {loading ? 'Prijava...' : 'Prijava'}
          </button>
        </form>
        <div style={{ marginTop: '1.5rem', background: '#f8fafc', borderRadius: 8, padding: '1rem', fontSize: '.82rem', color: '#475569' }}>
          <strong>Demo korisnici:</strong><br />
          admin@redometar.hr / admin123 (admin)<br />
          cassandra@fer.hr / customer123 (customer)<br />
            sc@unizg.hr / sc123 (customer)<br />
          ivan@student.hr / student123 (student)
        </div>
      </div>
    </div>
  );
}
