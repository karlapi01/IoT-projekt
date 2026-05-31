import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import { api } from '../api/client';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

export default function CustomerDashboard() {
  const [menze, setMenze]             = useState([]);
  const [selectedMenza, setSelectedMenza] = useState(null);
  const [zones, setZones]             = useState([]);
  const [wait, setWait]               = useState(null);
  const [tab, setTab]                 = useState('live');
  const [stats, setStats]             = useState([]);
  const [period, setPeriod]           = useState('day');
  const [editForm, setEditForm]       = useState({});
  const [editMsg, setEditMsg]         = useState('');

  useEffect(() => {
    api.get('/menze').then(m => { setMenze(m); if (m.length > 0) setSelectedMenza(m[0]); });
  }, []);

  useEffect(() => {
    if (!selectedMenza) return;
    if (tab === 'live') {
      loadZones(selectedMenza.id);
      const iv = setInterval(() => loadZones(selectedMenza.id), 4000);
      return () => clearInterval(iv);
    } else if (tab === 'stats') {
      loadStats(selectedMenza.id, period);
      const iv = setInterval(() => loadStats(selectedMenza.id, period), 60000);
      return () => clearInterval(iv);
    } else if (tab === 'settings') {
      setEditForm({
        address: selectedMenza.address || '',
        lat: selectedMenza.lat || '',
        lng: selectedMenza.lng || '',
        working_hours: selectedMenza.working_hours || '',
      });
      setEditMsg('');
    }
  }, [selectedMenza, tab, period]);

  async function loadZones(menzaId) {
    const [z, w] = await Promise.all([
      api.get(`/menze/${menzaId}/zones`),
      api.get(`/menze/${menzaId}/wait`),
    ]);
    setZones(z);
    setWait(w);
  }

  async function loadStats(menzaId, p) {
    const data = await api.get(`/menze/${menzaId}/stats?period=${p}`);
    setStats(data);
  }

  async function saveSettings(e) {
    e.preventDefault();
    setEditMsg('');
    const updated = await api.patch(`/menze/${selectedMenza.id}`, {
      address: editForm.address || null,
      lat: editForm.lat ? parseFloat(editForm.lat) : null,
      lng: editForm.lng ? parseFloat(editForm.lng) : null,
      working_hours: editForm.working_hours || null,
    });
    setMenze(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
    setSelectedMenza(prev => ({ ...prev, ...updated }));
    setEditMsg('Promjene spremljene i sinkronizirane s ThingsBoardom.');
  }

  function formatBucket(bucket) {
    if (period === 'day') {
      // "2025-05-31T13:05" → "13:05"
      return bucket.slice(11, 16);
    }
    // "2025-05-31" → "31.05."
    const [, m, d] = bucket.split('-');
    return `${d}.${m}.`;
  }

  return (
    <>
      <Navbar />
      <div className="page">
        <h2 style={{ marginBottom: '1.2rem', fontSize: '1.4rem', fontWeight: 700 }}>Moje menze</h2>

        {menze.length > 1 && (
          <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {menze.map(m => (
              <button key={m.id}
                className={`btn ${selectedMenza?.id === m.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedMenza(m)}>
                {m.name}
              </button>
            ))}
          </div>
        )}

        {selectedMenza && (
          <>
            <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem' }}>
              <button className={`btn ${tab === 'live' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('live')}>Live stanje</button>
              <button className={`btn ${tab === 'stats' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('stats')}>Statistika</button>
              <button className={`btn ${tab === 'settings' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('settings')}>Postavke</button>
            </div>

            {tab === 'live' && (
              <>
                <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '2rem', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: '.85rem', color: '#64748b', marginBottom: '.2rem' }}>Menza</p>
                    <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>{selectedMenza.name}</p>
                    {selectedMenza.location && <p style={{ fontSize: '.82rem', color: '#94a3b8' }}>{selectedMenza.location}</p>}
                    {selectedMenza.mqtt_token && (
                      <p style={{ fontSize: '.75rem', color: '#94a3b8', marginTop: '.3rem', fontFamily: 'monospace' }}>
                        MQTT: <span style={{ color: '#475569', userSelect: 'all' }}>{selectedMenza.mqtt_token}</span>
                      </p>
                    )}
                  </div>
                  {wait && (
                    <>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '.85rem', color: '#64748b', marginBottom: '.2rem' }}>Procijenjeno čekanje</p>
                        {wait.stale ? (
                          <p style={{ fontWeight: 700, fontSize: '1.1rem', color: '#94a3b8' }}>—</p>
                        ) : (
                          <p style={{ fontWeight: 800, fontSize: '2rem', color: wait.occupied_zones > 0 ? '#f59e0b' : '#22c55e' }}>
                            ~{wait.estimated_wait_minutes} min
                          </p>
                        )}
                        {wait.stale && (
                          <p style={{ fontSize: '.72rem', color: '#ef4444', marginTop: '.2rem' }}>Nema svježih podataka</p>
                        )}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '.85rem', color: '#64748b', marginBottom: '.2rem' }}>Zauzetost</p>
                        <p style={{ fontWeight: 800, fontSize: '2rem' }}>
                          {wait.occupied_zones}/{wait.total_zones}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <p className="section-title">Zone čekanja</p>
                <div className="grid-2">
                  {zones.map(z => (
                    <div key={z.id} className={`zone-card ${z.occupied ? 'occupied' : 'free'}`}>
                      <div className={`zone-dot ${z.occupied ? 'occupied' : 'free'}`}></div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', margin: '.3rem 0' }}>{z.name}</div>
                      {z.is_virtual === 1 && <div style={{ fontSize: '.75rem', color: '#94a3b8', marginBottom: '.3rem' }}>virtualni senzor</div>}
                      <span className={`badge ${z.occupied ? 'badge-red' : 'badge-green'}`}>
                        {z.occupied ? 'Zauzeto' : 'Slobodno'}
                      </span>
                      {z.last_update && (
                        <p style={{ fontSize: '.75rem', color: '#94a3b8', marginTop: '.4rem' }}>
                          {new Date(z.last_update + 'Z').toLocaleTimeString('hr')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <p style={{ fontSize: '.78rem', color: '#94a3b8', marginTop: '1.5rem', textAlign: 'right' }}>
                  Osvježava se svakih 4 sekunde
                </p>
              </>
            )}

            {tab === 'stats' && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3>Zauzetost — {selectedMenza.name}</h3>
                  <div style={{ display: 'flex', gap: '.5rem' }}>
                    <button className={`btn ${period === 'day' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPeriod('day')}>24h</button>
                    <button className={`btn ${period === 'week' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPeriod('week')}>7 dana</button>
                  </div>
                </div>

                {stats.length === 0 ? (
                  <p style={{ color: '#94a3b8', textAlign: 'center', padding: '3rem 0' }}>
                    Nema dovoljno podataka za prikaz.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={stats} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="occupancyGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="bucket"
                        tickFormatter={formatBucket}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tickFormatter={v => `${v}%`}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        width={45}
                      />
                      <Tooltip
                        formatter={v => [`${v}%`, 'Zauzetost']}
                        labelFormatter={formatBucket}
                        contentStyle={{ fontSize: '.85rem', borderRadius: 8 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="occupancy_pct"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="url(#occupancyGradient)"
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}

                {stats.length > 0 && (
                  <div style={{ display: 'flex', gap: '2rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                    <div>
                      <p style={{ fontSize: '.82rem', color: '#64748b' }}>Prosječna zauzetost</p>
                      <p style={{ fontWeight: 700, fontSize: '1.3rem' }}>
                        {Math.round(stats.reduce((s, r) => s + r.occupancy_pct, 0) / stats.length)}%
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '.82rem', color: '#64748b' }}>Maksimum</p>
                      <p style={{ fontWeight: 700, fontSize: '1.3rem' }}>
                        {Math.max(...stats.map(r => r.occupancy_pct))}%
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '.82rem', color: '#64748b' }}>Mjerenja</p>
                      <p style={{ fontWeight: 700, fontSize: '1.3rem' }}>{stats.length}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'settings' && (
              <div className="card">
                <h3 style={{ marginBottom: '1.5rem' }}>Postavke — {selectedMenza.name}</h3>
                {editMsg && <p className="success-msg" style={{ marginBottom: '1rem' }}>{editMsg}</p>}
                <form onSubmit={saveSettings}>
                  <div className="form-group">
                    <label>Adresa</label>
                    <input value={editForm.address || ''} onChange={e => setEditForm({ ...editForm, address: e.target.value })} placeholder="npr. Unska 3, Zagreb" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label>Latitude</label>
                      <input type="number" step="any" value={editForm.lat || ''} onChange={e => setEditForm({ ...editForm, lat: e.target.value })} placeholder="45.8003" />
                    </div>
                    <div className="form-group">
                      <label>Longitude</label>
                      <input type="number" step="any" value={editForm.lng || ''} onChange={e => setEditForm({ ...editForm, lng: e.target.value })} placeholder="15.9714" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Radno vrijeme</label>
                    <input value={editForm.working_hours || ''} onChange={e => setEditForm({ ...editForm, working_hours: e.target.value })} placeholder="npr. 07:00-15:00" />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button type="submit" className="btn btn-primary">Spremi i sinkroniziraj s ThingsBoardom</button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}

        {menze.length === 0 && (
          <div className="card" style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem' }}>
            Nemate pristup nijednoj menzi.
          </div>
        )}
      </div>
    </>
  );
}
