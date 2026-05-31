import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import { api } from '../api/client';

export default function StudentView() {
  const [menze, setMenze]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [zones, setZones]   = useState([]);
  const [wait, setWait]     = useState(null);

  useEffect(() => {
    api.get('/menze').then(m => { setMenze(m); if (m.length > 0) setSelected(m[0]); });
  }, []);

  useEffect(() => {
    if (!selected) return;
    loadData(selected.id);
    const iv = setInterval(() => loadData(selected.id), 4000);
    return () => clearInterval(iv);
  }, [selected]);

  async function loadData(id) {
    const [z, w] = await Promise.all([api.get(`/menze/${id}/zones`), api.get(`/menze/${id}/wait`)]);
    setZones(z);
    setWait(w);
  }

  const occupiedCount = zones.filter(z => z.occupied).length;

  return (
    <>
      <Navbar />
      <div className="page">
        <h2 style={{ marginBottom: '1.2rem', fontSize: '1.4rem', fontWeight: 700 }}>Stanje menze</h2>

        {menze.length > 1 && (
          <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {menze.map(m => (
              <button key={m.id}
                className={`btn ${selected?.id === m.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelected(m)}>
                {m.name}
              </button>
            ))}
          </div>
        )}

        {selected && (
          <>
            <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '2rem', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '.85rem', color: '#64748b', marginBottom: '.2rem' }}>Menza</p>
                <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>{selected.name}</p>
                {selected.location && <p style={{ fontSize: '.82rem', color: '#94a3b8' }}>{selected.location}</p>}
              </div>
              {wait && (
                <>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '.85rem', color: '#64748b', marginBottom: '.2rem' }}>Procijenjeno čekanje</p>
                    <p style={{ fontWeight: 800, fontSize: '2rem', color: occupiedCount > 0 ? '#f59e0b' : '#22c55e' }}>
                      ~{wait.estimated_wait_minutes} min
                    </p>
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

        {menze.length === 0 && (
          <div className="card" style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem' }}>
            Nema dostupnih menza.
          </div>
        )}
      </div>
    </>
  );
}
