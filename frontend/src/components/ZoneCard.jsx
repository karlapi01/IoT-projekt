export default function ZoneCard({ zone }) {
  const { name, occupied, is_virtual, last_update } = zone;

  return (
    <div className={`zone-card ${occupied ? 'occupied' : 'free'}`}>
      <div className={`zone-dot ${occupied ? 'occupied' : 'free'}`}></div>
      <div style={{ fontWeight: 700, fontSize: '1rem', margin: '.3rem 0' }}>{name}</div>
      {is_virtual === 1 && (
        <div style={{ fontSize: '.75rem', color: '#94a3b8', marginBottom: '.3rem' }}>virtualni senzor</div>
      )}
      <span className={`badge ${occupied ? 'badge-red' : 'badge-green'}`}>
        {occupied ? 'Zauzeto' : 'Slobodno'}
      </span>
      {last_update && (
        <p style={{ fontSize: '.75rem', color: '#94a3b8', marginTop: '.4rem' }}>
          {new Date(last_update + 'Z').toLocaleTimeString('hr')}
        </p>
      )}
    </div>
  );
}
