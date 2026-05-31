const router = require('express').Router();
const db = require('../db/schema');
const auth = require('../middleware/auth');

// Get menze accessible to the current user
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
    // student sees all menze
    menze = db.prepare('SELECT * FROM menze').all();
  }

  res.json(menze);
});

// Admin only: create menza
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

// Admin only: delete menza
router.delete('/:id', auth('admin'), (req, res) => {
  const menza = db.prepare('SELECT * FROM menze WHERE id = ?').get(req.params.id);
  if (!menza) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM menze WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Get zones + latest state for a menza
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

// Occupancy stats — grouped by hour for last 24h or by day for last 7d
router.get('/:id/stats', auth('admin', 'customer', 'student'), (req, res) => {
  const period = req.query.period === 'week' ? 'week' : 'day';
  const zones = db.prepare('SELECT id FROM zones WHERE menza_id = ?').all(req.params.id);
  if (zones.length === 0) return res.json([]);

  const zoneIds = zones.map(z => z.id);
  const placeholders = zoneIds.map(() => '?').join(',');

  let rows;
  if (period === 'day') {
    // Last 24h grouped by 5 minutes, shifted to UTC+2
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
    // Last 7 days grouped by day, shifted to UTC+2
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

// Admin/customer: manual sensor push (for testing)
router.post('/:id/sensor', auth('admin', 'customer'), (req, res) => {
  const { zone_id, occupied } = req.body;
  db.prepare('INSERT INTO zone_states (zone_id, occupied) VALUES (?, ?)').run(zone_id, occupied ? 1 : 0);
  res.json({ ok: true });
});

// Wait time — sourced directly from ThingsBoard Rule Chain via telemetry
router.get('/:id/wait', auth('admin', 'customer', 'student'), (req, res) => {
  const menza = db.prepare(
    'SELECT estimated_wait_minutes, occupied_zones, total_zones FROM menze WHERE id = ?'
  ).get(req.params.id);

  if (!menza) return res.status(404).json({ error: 'Not found' });

  res.json({
    occupied_zones: menza.occupied_zones ?? 0,
    total_zones: menza.total_zones ?? 0,
    estimated_wait_minutes: menza.estimated_wait_minutes ?? 0,
  });
});

module.exports = router;
