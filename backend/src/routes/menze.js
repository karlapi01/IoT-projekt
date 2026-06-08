const router = require('express').Router();
const db = require('../db/schema');
const auth = require('../middleware/auth');
const { tbLogin, tbPost } = require('../thingsboard/client');
const { syncMenzeFromThingsBoard } = require('../thingsboard/sync');

router.post('/sync', auth('admin'), async (req, res) => {
  try {
    await syncMenzeFromThingsBoard();
    const menze = db.prepare('SELECT * FROM menze').all();
    res.json({ ok: true, count: menze.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', auth('admin', 'customer', 'student'), (req, res) => {
  const { id, role } = req.user;
  let menze;

  if (role === 'admin') {
    menze = db.prepare('SELECT m.*, u.name as owner_name FROM menze m JOIN users u ON m.tenant_id = u.id').all();
  } else if (role === 'customer') {
    menze = db.prepare(`
      SELECT m.* FROM menze m
      JOIN customer_menza_access cma ON m.id = cma.menza_id
      WHERE cma.customer_id = ?
    `).all(id);
  } else {
    menze = db.prepare('SELECT * FROM menze').all();
  }

  res.json(menze);
});

router.post('/', auth('admin'), (req, res) => {
  const { name, location, zone_count } = req.body;
  const tenant_id = req.user.id;

  const mqtt_token = `token-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const result = db.prepare(
    'INSERT INTO menze (name, location, tenant_id, mqtt_token) VALUES (?, ?, ?, ?)'
  ).run(name, location, tenant_id, mqtt_token);
  const menzaId = result.lastInsertRowid;

  const numZones = Math.max(1, Math.min(parseInt(zone_count) || 2, 10));
  for (let i = 1; i <= numZones; i++) {
    db.prepare('INSERT INTO zones (menza_id, name, is_virtual) VALUES (?, ?, ?)').run(menzaId, `Zona ${i}`, 0);
  }

  res.status(201).json({ id: menzaId, name, location, tenant_id, mqtt_token });
});

router.delete('/:id', auth('admin'), (req, res) => {
  const menza = db.prepare('SELECT * FROM menze WHERE id = ?').get(req.params.id);
  if (!menza) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM menze WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/:id/zones', auth('admin', 'customer', 'student'), (req, res) => {
  const zones = db.prepare('SELECT * FROM zones WHERE menza_id = ?').all(req.params.id);
  const result = zones.map((z) => {
    const latest = db.prepare(
      'SELECT occupied, recorded_at FROM zone_states WHERE zone_id = ? ORDER BY recorded_at DESC LIMIT 1'
    ).get(z.id);
    return { ...z, occupied: latest?.occupied ?? 0, last_update: latest?.recorded_at ?? null };
  });
  res.json(result);
});

router.patch('/:id', auth('admin', 'customer'), async (req, res) => {
  const menza = db.prepare('SELECT * FROM menze WHERE id = ?').get(req.params.id);
  if (!menza) return res.status(404).json({ error: 'Not found' });

  if (req.user.role === 'customer') {
    const access = db.prepare('SELECT 1 FROM customer_menza_access WHERE customer_id=? AND menza_id=?')
      .get(req.user.id, menza.id);
    if (!access) return res.status(403).json({ error: 'Forbidden' });
  }

  const { address, lat, lng, working_hours } = req.body;

  db.prepare(`UPDATE menze SET address=COALESCE(?,address), lat=COALESCE(?,lat),
              lng=COALESCE(?,lng), working_hours=COALESCE(?,working_hours) WHERE id=?`)
    .run(address ?? null, lat ?? null, lng ?? null, working_hours ?? null, menza.id);

  if (menza.tb_asset_id) {
    try {
      const token = await tbLogin();

      const attrs = {};
      if (address !== undefined) attrs.address = address;
      if (lat !== undefined) attrs.lat = lat;
      if (lng !== undefined) attrs.lng = lng;
      if (working_hours !== undefined) attrs.workingHours = working_hours;

      await tbPost(`/api/plugins/telemetry/ASSET/${menza.tb_asset_id}/SERVER_SCOPE`, token, attrs);
    } catch (err) {
      console.warn('[TB] Failed to write attributes back:', err.message);
    }
  }

  res.json(db.prepare('SELECT * FROM menze WHERE id = ?').get(menza.id));
});

router.get('/:id/stats', auth('admin', 'customer', 'student'), (req, res) => {
  const period = req.query.period === 'week' ? 'week' : 'day';
  const zones = db.prepare('SELECT id FROM zones WHERE menza_id = ?').all(req.params.id);
  if (zones.length === 0) return res.json([]);

  const zoneIds = zones.map(z => z.id);
  const placeholders = zoneIds.map(() => '?').join(',');

  let rows;
  if (period === 'day') {
    rows = db.prepare(`
      SELECT
        strftime('%Y-%m-%dT%H:', datetime(recorded_at, '+2 hours')) ||
        printf('%02d', (CAST(strftime('%M', datetime(recorded_at, '+2 hours')) AS INTEGER) / 5) * 5)
        AS bucket,
        AVG(occupied) AS avg_occupied
      FROM zone_states
      WHERE zone_id IN (${placeholders})
        AND recorded_at >= datetime('now', '-24 hours')
      GROUP BY bucket
      ORDER BY bucket
    `).all(...zoneIds);
  } else {
    rows = db.prepare(`
      SELECT
        strftime('%Y-%m-%d', datetime(recorded_at, '+2 hours')) AS bucket,
        AVG(occupied) AS avg_occupied
      FROM zone_states
      WHERE zone_id IN (${placeholders})
        AND recorded_at >= datetime('now', '-7 days')
      GROUP BY bucket
      ORDER BY bucket
    `).all(...zoneIds);
  }

  res.json(rows.map(r => ({
    bucket: r.bucket,
    occupancy_pct: Math.round(r.avg_occupied * 100),
  })));
});

router.post('/:id/sensor', auth('admin', 'customer'), (req, res) => {
  const { zone_id, occupied } = req.body;
  if (zone_id == null) return res.status(400).json({ error: 'zone_id required' });

  const zone = db.prepare('SELECT id FROM zones WHERE id = ? AND menza_id = ?').get(zone_id, req.params.id);
  if (!zone) return res.status(404).json({ error: 'Zone not found for this menza' });

  db.prepare('INSERT INTO zone_states (zone_id, occupied) VALUES (?, ?)').run(zone_id, occupied ? 1 : 0);
  res.json({ ok: true });
});

router.get('/:id/wait', auth('admin', 'customer', 'student'), (req, res) => {
  const menza = db.prepare(
    'SELECT estimated_wait_minutes, occupied_zones, telemetry_updated_at FROM menze WHERE id = ?'
  ).get(req.params.id);

  if (!menza) return res.status(404).json({ error: 'Not found' });

  const { total } = db.prepare('SELECT COUNT(*) as total FROM zones WHERE menza_id = ?').get(req.params.id);

  const updatedAt = menza.telemetry_updated_at ?? null;
  const stale = !updatedAt || (Date.now() - new Date(updatedAt + 'Z').getTime() > 5 * 60 * 1000);

  res.json({
    occupied_zones: menza.occupied_zones ?? 0,
    total_zones: total,
    estimated_wait_minutes: stale ? null : (menza.estimated_wait_minutes ?? 0),
    telemetry_updated_at: updatedAt,
    stale,
  });
});

router.get('/:id/peakhours', auth('admin', 'customer', 'student'), (req, res) => {
  const zones = db.prepare('SELECT id FROM zones WHERE menza_id = ?').all(req.params.id);
  if (zones.length === 0) return res.json([]);

  const zoneIds = zones.map(z => z.id);
  const placeholders = zoneIds.map(() => '?').join(',');

  const rows = db.prepare(`
    SELECT
      CAST(strftime('%H', datetime(recorded_at, '+2 hours')) AS INTEGER) AS hour,
      AVG(occupied) AS avg_occupied,
      COUNT(*) AS sample_count
    FROM zone_states
    WHERE zone_id IN (${placeholders})
    GROUP BY hour
    ORDER BY hour
  `).all(...zoneIds);

  const byHour = Object.fromEntries(rows.map(r => [r.hour, r]));
  const result = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    occupancy_pct: byHour[h] ? Math.round(byHour[h].avg_occupied * 100) : null,
    sample_count: byHour[h]?.sample_count ?? 0,
  }));

  res.json(result);
});

module.exports = router;
