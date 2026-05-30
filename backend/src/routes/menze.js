const router = require('express').Router();
const db = require('../db/schema');
const auth = require('../middleware/auth');

// Get menze accessible to the current user
router.get('/', auth('admin', 'tenant', 'customer'), (req, res) => {
  const { id, role } = req.user;
  let menze;

  if (role === 'admin') {
    menze = db.prepare('SELECT m.*, u.name as tenant_name FROM menze m JOIN users u ON m.tenant_id = u.id').all();
  } else if (role === 'tenant') {
    menze = db.prepare('SELECT * FROM menze WHERE tenant_id = ?').all(id);
  } else {
    menze = db.prepare(`
      SELECT m.* FROM menze m
      JOIN customer_menza_access cma ON m.id = cma.menza_id
      WHERE cma.customer_id = ?
    `).all(id);
  }

  res.json(menze);
});

// Admin/Tenant: create menza
router.post('/', auth('admin', 'tenant'), (req, res) => {
  const { name, location, zone_count } = req.body;
  const tenant_id = req.user.role === 'tenant' ? req.user.id : req.body.tenant_id;

  if (!tenant_id) return res.status(400).json({ error: 'tenant_id required' });

  // Generate a unique MQTT token for this menza
  const mqtt_token = `token-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const result = db.prepare(
    'INSERT INTO menze (name, location, tenant_id, mqtt_token) VALUES (?, ?, ?, ?)'
  ).run(name, location, tenant_id, mqtt_token);
  const menzaId = result.lastInsertRowid;

  const numZones = Math.max(1, Math.min(parseInt(zone_count) || 2, 10));
  for (let i = 1; i <= numZones; i++) {
    const isVirtual = i > 1 ? 1 : 0;
    db.prepare('INSERT INTO zones (menza_id, name, is_virtual) VALUES (?, ?, ?)').run(menzaId, `Zona ${i}`, isVirtual);
  }

  res.status(201).json({ id: menzaId, name, location, tenant_id, mqtt_token });
});

// Delete menza
router.delete('/:id', auth('admin', 'tenant'), (req, res) => {
  const menza = db.prepare('SELECT * FROM menze WHERE id = ?').get(req.params.id);
  if (!menza) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'tenant' && menza.tenant_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  db.prepare('DELETE FROM menze WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Get zones + latest state for a menza
router.get('/:id/zones', auth('admin', 'tenant', 'customer'), (req, res) => {
  const zones = db.prepare('SELECT * FROM zones WHERE menza_id = ?').all(req.params.id);
  const result = zones.map((z) => {
    const latest = db.prepare(
      'SELECT occupied, recorded_at FROM zone_states WHERE zone_id = ? ORDER BY recorded_at DESC LIMIT 1'
    ).get(z.id);
    return { ...z, occupied: latest?.occupied ?? 0, last_update: latest?.recorded_at ?? null };
  });
  res.json(result);
});

// Manual sensor push (for testing without Java simulator)
router.post('/:id/sensor', auth('admin', 'tenant'), (req, res) => {
  const { zone_id, occupied } = req.body;
  db.prepare('INSERT INTO zone_states (zone_id, occupied) VALUES (?, ?)').run(zone_id, occupied ? 1 : 0);
  res.json({ ok: true });
});

// Estimated wait time — matches ThingsBoard Rule Chain logic from progress report:
// both free → 0 min | only zone1 occupied → 5 min | both occupied → 10 min
// For menze with more zones, each extra occupied zone adds 5 min
router.get('/:id/wait', auth('admin', 'tenant', 'customer'), (req, res) => {
  const zones = db.prepare(
    'SELECT * FROM zones WHERE menza_id = ? ORDER BY id'
  ).all(req.params.id);

  const states = zones.map((z) => {
    const latest = db.prepare(
      'SELECT occupied FROM zone_states WHERE zone_id = ? ORDER BY recorded_at DESC LIMIT 1'
    ).get(z.id);
    return { ...z, occupied: latest?.occupied ?? 0 };
  });

  const occupiedCount = states.filter(z => z.occupied).length;
  const zone1Occupied = states[0]?.occupied ?? 0;

  // Mirrors ThingsBoard Rule Chain: 0 / 5 / 10 min
  let estimated_wait_minutes;
  if (occupiedCount === 0) {
    estimated_wait_minutes = 0;
  } else if (zone1Occupied && occupiedCount === 1) {
    estimated_wait_minutes = 5;
  } else {
    estimated_wait_minutes = occupiedCount * 5;
  }

  res.json({
    occupied_zones: occupiedCount,
    total_zones: zones.length,
    estimated_wait_minutes,
  });
});

module.exports = router;
