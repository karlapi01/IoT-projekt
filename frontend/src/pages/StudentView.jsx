import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import Navbar from '../components/Navbar';
import { api } from '../api/client';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function menzaIcon(wait) {
  const color = !wait || wait.stale ? '#94a3b8'
    : wait.occupied_zones === 0    ? '#22c55e'
    : wait.occupied_zones >= wait.total_zones ? '#ef4444'
    : '#f59e0b';

  return L.divIcon({
    className: '',
    html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:${color};border:2px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,.4)">
    </div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -12],
  });
}

function FlyToUser({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 15, { duration: 1.2 });
  }, [position, map]);
  return null;
}

function distanceM([lat1, lng1], [lat2, lng2]) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function StudentView() {
  const [menze, setMenze]       = useState([]);
  const [selected, setSelected] = useState(null);
  const [zones, setZones]       = useState([]);
  const [wait, setWait]         = useState(null);
  const [tab, setTab]           = useState('live');

  const [waitMap, setWaitMap]       = useState({});   // menzaId → wait object
  const [userPos, setUserPos]       = useState(null); // [lat, lng]
  const [geoError, setGeoError]     = useState('');
  const [locating, setLocating]     = useState(false);

  useEffect(() => {
    api.get('/menze').then(m => { setMenze(m); if (m.length > 0) setSelected(m[0]); });
  }, []);

  useEffect(() => {
    if (!selected || tab !== 'live') return;
    loadData(selected.id);
    const iv = setInterval(() => loadData(selected.id), 4000);
    return () => clearInterval(iv);
  }, [selected, tab]);

  useEffect(() => {
    if (tab !== 'map') return;
    fetchAllWait();
    const iv = setInterval(fetchAllWait, 30000);
    return () => clearInterval(iv);
  }, [tab, menze]);

  async function loadData(id) {
    const [z, w] = await Promise.all([api.get(`/menze/${id}/zones`), api.get(`/menze/${id}/wait`)]);
    setZones(z);
    setWait(w);
  }

  async function fetchAllWait() {
    const mapped = await menze
      .filter(m => m.lat && m.lng)
      .reduce(async (accP, m) => {
        const acc = await accP;
        try {
          const w = await api.get(`/menze/${m.id}/wait`);
          acc[m.id] = w;
        } catch (_) {}
        return acc;
      }, Promise.resolve({}));
    setWaitMap(mapped);
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setGeoError('Vaš preglednik ne podržava geolokaciju.');
      return;
    }
    setLocating(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserPos([pos.coords.latitude, pos.coords.longitude]);
        setLocating(false);
      },
      err => {
        setGeoError('Geolokacija nije dostupna: ' + err.message);
        setLocating(false);
      }
    );
  }

  const occupiedCount = zones.filter(z => z.occupied).length;
  const mappableMenze = menze.filter(m => m.lat && m.lng);

  const sortedMenze = userPos
    ? [...mappableMenze].sort((a, b) =>
        distanceM(userPos, [a.lat, a.lng]) - distanceM(userPos, [b.lat, b.lng]))
    : mappableMenze;

  const defaultCenter = mappableMenze.length > 0
    ? [mappableMenze[0].lat, mappableMenze[0].lng]
    : [45.815, 15.982];

  return (
    <>
      <Navbar />
      <div className="page">
        <h2 style={{ marginBottom: '1.2rem', fontSize: '1.4rem', fontWeight: 700 }}>Stanje menze</h2>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem' }}>
          <button className={`btn ${tab === 'live' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('live')}>
            Live stanje
          </button>
          <button className={`btn ${tab === 'map' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('map')}>
            Karta
          </button>
        </div>

        {tab === 'live' && (
          <>
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
                        {wait.stale ? (
                          <p style={{ fontWeight: 700, fontSize: '1.1rem', color: '#94a3b8' }}>—</p>
                        ) : (
                          <p style={{ fontWeight: 800, fontSize: '2rem', color: occupiedCount > 0 ? '#f59e0b' : '#22c55e' }}>
                            ~{wait.estimated_wait_minutes} min
                          </p>
                        )}
                        {wait.stale && (
                          <p style={{ fontSize: '.72rem', color: '#ef4444', marginTop: '.2rem' }}>Nema svježih podataka</p>
                        )}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '.85rem', color: '#64748b', marginBottom: '.2rem' }}>Zauzetost</p>
                        <p style={{ fontWeight: 800, fontSize: '2rem', color: wait.stale ? '#94a3b8' : 'inherit' }}>
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
          </>
        )}

        {tab === 'map' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <button className="btn btn-primary" onClick={locateMe} disabled={locating}>
                {locating ? 'Tražim lokaciju...' : '📍 Prikaži moju lokaciju'}
              </button>
              {userPos && <span style={{ fontSize: '.85rem', color: '#64748b' }}>Lokacija pronađena</span>}
              {geoError && <span style={{ fontSize: '.85rem', color: '#ef4444' }}>{geoError}</span>}
            </div>

            {mappableMenze.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem' }}>
                Nijedna menza nema postavljene koordinate.
              </div>
            ) : (
              <>
                <div style={{ borderRadius: '12px', overflow: 'hidden', marginBottom: '1.5rem', height: '420px' }}>
                  <MapContainer center={defaultCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {userPos && (
                      <>
                        <FlyToUser position={userPos} />
                        <Circle
                          center={userPos}
                          radius={40}
                          pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.3 }}
                        />
                      </>
                    )}

                    {mappableMenze.map(m => {
                      const w = waitMap[m.id];
                      const dist = userPos ? Math.round(distanceM(userPos, [m.lat, m.lng])) : null;
                      return (
                        <Marker key={m.id} position={[m.lat, m.lng]} icon={menzaIcon(w)}>
                          <Popup>
                            <div style={{ minWidth: '160px' }}>
                              <strong style={{ fontSize: '.95rem' }}>{m.name}</strong>
                              {m.address && <p style={{ margin: '.2rem 0 0', fontSize: '.8rem', color: '#64748b' }}>{m.address}</p>}
                              {dist !== null && (
                                <p style={{ margin: '.3rem 0 0', fontSize: '.8rem' }}>
                                  {dist < 1000 ? `${dist} m` : `${(dist / 1000).toFixed(1)} km`}
                                </p>
                              )}
                              {w && !w.stale ? (
                                <>
                                  <p style={{ margin: '.3rem 0 0', fontSize: '.85rem', fontWeight: 600,
                                    color: w.occupied_zones === 0 ? '#22c55e' : w.occupied_zones >= w.total_zones ? '#ef4444' : '#f59e0b' }}>
                                    ~{w.estimated_wait_minutes} min čekanja
                                  </p>
                                  <p style={{ margin: '.1rem 0 0', fontSize: '.78rem', color: '#64748b' }}>
                                    {w.occupied_zones}/{w.total_zones} zona zauzeto
                                  </p>
                                </>
                              ) : (
                                <p style={{ margin: '.3rem 0 0', fontSize: '.8rem', color: '#94a3b8' }}>Nema podataka</p>
                              )}
                              {m.lat && m.lng && (
                                <a
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}`}
                                  target="_blank" rel="noreferrer"
                                  style={{ display: 'inline-block', marginTop: '.5rem', fontSize: '.8rem', color: '#3b82f6' }}>
                                  Upute u Google Mapsu →
                                </a>
                              )}
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                </div>

                <p className="section-title">
                  {userPos ? 'Menze po udaljenosti' : 'Sve menze'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                  {sortedMenze.map(m => {
                    const w = waitMap[m.id];
                    const dist = userPos ? Math.round(distanceM(userPos, [m.lat, m.lng])) : null;
                    return (
                      <div key={m.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem' }}>
                        <div>
                          <p style={{ fontWeight: 700, fontSize: '1rem' }}>{m.name}</p>
                          {m.address && <p style={{ fontSize: '.82rem', color: '#94a3b8', marginTop: '.1rem' }}>{m.address}</p>}
                          {dist !== null && (
                            <p style={{ fontSize: '.8rem', color: '#64748b', marginTop: '.2rem' }}>
                              {dist < 1000 ? `${dist} m` : `${(dist / 1000).toFixed(1)} km`}
                            </p>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {w && !w.stale ? (
                            <>
                              <p style={{ fontWeight: 800, fontSize: '1.4rem',
                                color: w.occupied_zones === 0 ? '#22c55e' : w.occupied_zones >= w.total_zones ? '#ef4444' : '#f59e0b' }}>
                                ~{w.estimated_wait_minutes} min
                              </p>
                              <p style={{ fontSize: '.78rem', color: '#64748b' }}>{w.occupied_zones}/{w.total_zones} zona</p>
                            </>
                          ) : (
                            <p style={{ color: '#94a3b8', fontSize: '.85rem' }}>Nema podataka</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
