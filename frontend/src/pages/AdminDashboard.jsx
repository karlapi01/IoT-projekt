import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import { api } from '../api/client';

export default function AdminDashboard() {
  const [users, setUsers]   = useState([]);
  const [menze, setMenze]   = useState([]);
  const [tab, setTab]       = useState('users');
  const [modal, setModal]   = useState(null);
  const [form, setForm]     = useState({});
  const [error, setError]   = useState('');
  const [msg, setMsg]       = useState('');
  const [accessUser, setAccessUser] = useState(null);
  const [accessIds, setAccessIds]   = useState([]);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [u, m] = await Promise.all([api.get('/users'), api.get('/menze')]);
    setUsers(u);
    setMenze(m);
  }

  function openModal(type) { setForm({}); setError(''); setModal(type); }

  async function createUser(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/users', { ...form, menza_ids: form.menza_ids || [] });
      setMsg('Korisnik dodan.'); setModal(null); loadAll();
    } catch (err) { setError(err.message); }
  }

  async function createMenza(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/menze', form);
      setMsg('Menza dodana.'); setModal(null); loadAll();
    } catch (err) { setError(err.message); }
  }

  async function openAccessModal(user) {
    const ids = await api.get(`/users/${user.id}/menze`);
    setAccessUser(user);
    setAccessIds(ids);
    setModal('access');
  }

  async function saveAccess() {
    await api.put(`/users/${accessUser.id}/menze`, { menza_ids: accessIds });
    setMsg(`Pristup ažuriran za ${accessUser.name}.`);
    setModal(null);
  }

  function toggleAccess(menzaId) {
    setAccessIds(prev => prev.includes(menzaId) ? prev.filter(x => x !== menzaId) : [...prev, menzaId]);
  }

  async function deleteUser(id) {
    if (!confirm('Obrisati korisnika?')) return;
    await api.delete(`/users/${id}`);
    loadAll();
  }

  async function deleteMenza(id) {
    if (!confirm('Obrisati menzu?')) return;
    await api.delete(`/menze/${id}`);
    loadAll();
  }

  function toggleMenzaAccess(menzaId) {
    const ids = form.menza_ids || [];
    setForm({ ...form, menza_ids: ids.includes(menzaId) ? ids.filter(x => x !== menzaId) : [...ids, menzaId] });
  }

  const roleColor = { admin: 'red', customer: 'blue', student: 'green' };

  return (
    <>
      <Navbar />
      <div className="page">
        <h2 style={{ marginBottom: '1.2rem', fontSize: '1.4rem', fontWeight: 700 }}>Admin Dashboard</h2>
        {msg && <p className="success-msg" style={{ marginBottom: '1rem' }}>{msg}</p>}

        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem' }}>
          {['users','menze'].map(t => (
            <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t)}>
              {t === 'users' ? 'Korisnici' : 'Menze'}
            </button>
          ))}
        </div>

        {tab === 'users' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>Svi korisnici ({users.length})</h3>
              <button className="btn btn-primary" onClick={() => openModal('user')}>+ Novi korisnik</button>
            </div>
            <table>
              <thead><tr><th>Ime</th><th>Email</th><th>Uloga</th><th>Kreiran</th><th></th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td><span className={`badge badge-${roleColor[u.role] ?? 'green'}`}>{u.role}</span></td>
                    <td>{new Date(u.created_at + 'Z').toLocaleDateString('hr')}</td>
                    <td style={{ display: 'flex', gap: '.4rem' }}>
                      {u.role === 'customer' && (
                        <button className="btn btn-secondary" style={{ padding: '.25rem .7rem', fontSize: '.8rem' }} onClick={() => openAccessModal(u)}>Menze</button>
                      )}
                      <button className="btn btn-danger" style={{ padding: '.25rem .7rem', fontSize: '.8rem' }} onClick={() => deleteUser(u.id)}>Obriši</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'menze' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>Sve menze ({menze.length})</h3>
              <button className="btn btn-primary" onClick={() => openModal('menza')}>+ Nova menza</button>
            </div>
            <table>
              <thead><tr><th>Naziv</th><th>Lokacija</th><th>MQTT token</th><th>Kreirana</th><th></th></tr></thead>
              <tbody>
                {menze.map(m => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{m.location || '—'}</td>
                    <td><code style={{ fontSize: '.78rem', color: '#475569' }}>{m.mqtt_token || '—'}</code></td>
                    <td>{new Date(m.created_at + 'Z').toLocaleDateString('hr')}</td>
                    <td><button className="btn btn-danger" style={{ padding: '.25rem .7rem', fontSize: '.8rem' }} onClick={() => deleteMenza(m.id)}>Obriši</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal === 'user' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Novi korisnik</h2>
            <form onSubmit={createUser}>
              <div className="form-group"><label>Ime</label><input required value={form.name||''} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div className="form-group"><label>Email</label><input type="email" required value={form.email||''} onChange={e => setForm({...form, email: e.target.value})} /></div>
              <div className="form-group"><label>Lozinka</label><input type="password" required value={form.password||''} onChange={e => setForm({...form, password: e.target.value})} /></div>
              <div className="form-group">
                <label>Uloga</label>
                <select required value={form.role||''} onChange={e => setForm({...form, role: e.target.value, menza_ids: []})}>
                  <option value="">-- odaberi --</option>
                  <option value="admin">admin</option>
                  <option value="customer">customer (vlasnik menze)</option>
                  <option value="student">student (read-only)</option>
                </select>
              </div>
              {form.role === 'customer' && (
                <div className="form-group">
                  <label>Pristup menzama</label>
                  {menze.map(m => (
                    <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontWeight: 400, marginBottom: '.3rem' }}>
                      <input type="checkbox" checked={(form.menza_ids||[]).includes(m.id)} onChange={() => toggleMenzaAccess(m.id)} />
                      {m.name}
                    </label>
                  ))}
                </div>
              )}
              {error && <p className="error-msg">{error}</p>}
              <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Odustani</button>
                <button type="submit" className="btn btn-primary">Dodaj</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'menza' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Nova menza</h2>
            <form onSubmit={createMenza}>
              <div className="form-group"><label>Naziv</label><input required value={form.name||''} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div className="form-group"><label>Lokacija</label><input value={form.location||''} onChange={e => setForm({...form, location: e.target.value})} /></div>
              <div className="form-group">
                <label>Broj zona (1–10)</label>
                <input type="number" min="1" max="10" value={form.zone_count||2} onChange={e => setForm({...form, zone_count: e.target.value})} />
              </div>
              {error && <p className="error-msg">{error}</p>}
              <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Odustani</button>
                <button type="submit" className="btn btn-primary">Dodaj</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {modal === 'access' && accessUser && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Pristup menzama — {accessUser.name}</h2>
            <p style={{ fontSize: '.85rem', color: '#64748b', marginBottom: '1rem' }}>Odaberi koje menze customer može vidjeti i upravljati.</p>
            {menze.map(m => (
              <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontWeight: 400, marginBottom: '.5rem' }}>
                <input type="checkbox" checked={accessIds.includes(m.id)} onChange={() => toggleAccess(m.id)} />
                <span><strong>{m.name}</strong>{m.location ? ` — ${m.location}` : ''}</span>
              </label>
            ))}
            <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Odustani</button>
              <button className="btn btn-primary" onClick={saveAccess}>Spremi</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
