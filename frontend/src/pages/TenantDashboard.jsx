import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import { api } from '../api/client';

export default function TenantDashboard() {
  const [menze, setMenze]     = useState([]);
  const [customers, setCustomers] = useState([]);
  const [tab, setTab]         = useState('menze');
  const [modal, setModal]     = useState(null);
  const [form, setForm]       = useState({});
  const [error, setError]     = useState('');
  const [msg, setMsg]         = useState('');
  const [selectedMenza, setSelectedMenza] = useState(null);
  const [zones, setZones]     = useState([]);
  const [wait, setWait]       = useState(null);

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!selectedMenza) return;
    loadZones(selectedMenza.id);
    const iv = setInterval(() => loadZones(selectedMenza.id), 4000);
    return () => clearInterval(iv);
  }, [selectedMenza]);

  async function loadAll() {
    const [m, c] = await Promise.all([api.get('/menze'), api.get('/users/customers')]);
    setMenze(m);
    setCustomers(c);
  }

  async function loadZones(menzaId) {
    const [z, w] = await Promise.all([
      api.get(`/menze/${menzaId}/zones`),
      api.get(`/menze/${menzaId}/wait`),
    ]);
    setZones(z);
    setWait(w);
  }

  async function createMenza(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/menze', form);
      setMsg('Menza dodana.'); setModal(null); loadAll();
    } catch (err) { setError(err.message); }
  }

  async function createCustomer(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/users', { ...form, role: 'customer', menza_ids: form.menza_ids || [] });
      setMsg('Korisnik dodan.'); setModal(null); loadAll();
    } catch (err) { setError(err.message); }
  }

  async function deleteMenza(id) {
    if (!confirm('Obrisati menzu?')) return;
    await api.delete(`/menze/${id}`);
    if (selectedMenza?.id === id) setSelectedMenza(null);
    loadAll();
  }

  function toggleMenzaAccess(menzaId) {
    const ids = form.menza_ids || [];
    setForm({ ...form, menza_ids: ids.includes(menzaId) ? ids.filter(x => x !== menzaId) : [...ids, menzaId] });
  }

  return (
    <>
      <Navbar />
      <div className="page">
        <h2 style={{ marginBottom: '1.2rem', fontSize: '1.4rem', fontWeight: 700 }}>Tenant Dashboard</h2>
        {msg && <p className="success-msg" style={{ marginBottom: '1rem' }}>{msg}</p>}

        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem' }}>
          {['menze','customers'].map(t => (
            <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t)}>
              {t === 'menze' ? 'Moje menze' : 'Korisnici'}
            </button>
          ))}
        </div>

        {tab === 'menze' && (
          <div style={{ display: 'grid', gridTemplateColumns: selectedMenza ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>Menze ({menze.length})</h3>
                <button className="btn btn-primary" onClick={() => { setForm({}); setError(''); setModal('menza'); }}>+ Nova menza</button>
              </div>
              {menze.length === 0 && <p style={{ color: '#94a3b8' }}>Nema menza. Dodajte prvu.</p>}
              {menze.map(m => (
                <div key={m.id} className="card" style={{
                  marginBottom: '.7rem', cursor: 'pointer',
                  border: selectedMenza?.id === m.id ? '2px solid #3b82f6' : '2px solid transparent',
                  padding: '1rem'
                }} onClick={() => setSelectedMenza(m)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{m.name}</strong>
                      {m.location && <p style={{ fontSize: '.82rem', color: '#64748b' }}>{m.location}</p>}
                      {m.mqtt_token && (
                        <p style={{ fontSize: '.75rem', color: '#94a3b8', marginTop: '.3rem', fontFamily: 'monospace' }}>
                          MQTT token: <span style={{ color: '#475569', userSelect: 'all' }}>{m.mqtt_token}</span>
                        </p>
                      )}
                    </div>
                    <button className="btn btn-danger" style={{ fontSize: '.8rem', padding: '.25rem .6rem' }}
                      onClick={e => { e.stopPropagation(); deleteMenza(m.id); }}>Obriši</button>
                  </div>
                </div>
              ))}
            </div>

            {selectedMenza && (
              <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>{selectedMenza.name} — Zone</h3>
                {wait && (
                  <div style={{ background: '#f0f9ff', borderRadius: 8, padding: '.8rem 1rem', marginBottom: '1rem', fontSize: '.9rem' }}>
                    <strong>Procijenjeno čekanje:</strong> ~{wait.estimated_wait_minutes} min &nbsp;|&nbsp;
                    {wait.occupied_zones}/{wait.total_zones} zona zauzeto
                  </div>
                )}
                <div className="grid-2">
                  {zones.map(z => (
                    <div key={z.id} className={`zone-card ${z.occupied ? 'occupied' : 'free'}`}>
                      <div className={`zone-dot ${z.occupied ? 'occupied' : 'free'}`}></div>
                      <div style={{ fontWeight: 700, fontSize: '.95rem' }}>{z.name}</div>
                      {z.is_virtual === 1 && <div style={{ fontSize: '.75rem', color: '#94a3b8' }}>virtualni</div>}
                      <div style={{ marginTop: '.3rem' }}>
                        <span className={`badge ${z.occupied ? 'badge-red' : 'badge-green'}`}>
                          {z.occupied ? 'Zauzeto' : 'Slobodno'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'customers' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>Korisnici ({customers.length})</h3>
              <button className="btn btn-primary" onClick={() => { setForm({}); setError(''); setModal('customer'); }}>+ Novi korisnik</button>
            </div>
            {customers.length === 0 && <p style={{ color: '#94a3b8' }}>Nema korisnika.</p>}
            <table>
              <thead><tr><th>Ime</th><th>Email</th><th>Kreiran</th></tr></thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id}><td>{c.name}</td><td>{c.email}</td><td>{new Date(c.created_at).toLocaleDateString('hr')}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

      {modal === 'customer' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Novi korisnik</h2>
            <form onSubmit={createCustomer}>
              <div className="form-group"><label>Ime</label><input required value={form.name||''} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div className="form-group"><label>Email</label><input type="email" required value={form.email||''} onChange={e => setForm({...form, email: e.target.value})} /></div>
              <div className="form-group"><label>Lozinka</label><input type="password" required value={form.password||''} onChange={e => setForm({...form, password: e.target.value})} /></div>
              <div className="form-group">
                <label>Pristup menzama</label>
                {menze.map(m => (
                  <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontWeight: 400, marginBottom: '.3rem' }}>
                    <input type="checkbox" checked={(form.menza_ids||[]).includes(m.id)} onChange={() => toggleMenzaAccess(m.id)} />
                    {m.name}
                  </label>
                ))}
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
    </>
  );
}
