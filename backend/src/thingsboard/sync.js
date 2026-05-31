const db = require('../db/schema');

const TB_URL = process.env.TB_URL || 'http://161.53.133.253:8080';
const TB_EMAIL = process.env.TB_EMAIL || 'dona.weiner@fer.hr';
const TB_PASSWORD = process.env.TB_PASSWORD || 'Redometar5';

async function tbGet(path, token) {
  const res = await fetch(`${TB_URL}${path}`, {
    headers: { 'X-Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`TB API ${path} → ${res.status}`);
  return res.json();
}

async function login() {
  const res = await fetch(`${TB_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: TB_EMAIL, password: TB_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  return (await res.json()).token;
}

async function syncMenzeFromThingsBoard() {
  let token;
  try {
    token = await login();
  } catch (err) {
    console.error('[TB Sync] Login failed:', err.message);
    return;
  }

  let allAssets;
  try {
    const data = await tbGet('/api/tenant/assets?pageSize=100&page=0', token);
    allAssets = data.data;
  } catch (err) {
    console.error('[TB Sync] Failed to fetch assets:', err.message);
    return;
  }

  const menzaAssets = allAssets.filter(a => a.type === 'menza');
  console.log(`[TB Sync] Found ${menzaAssets.length} menza assets`);

  const adminId = db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get()?.id;
  if (!adminId) {
    console.error('[TB Sync] No admin user found — run seed first');
    return;
  }

  for (const asset of menzaAssets) {
    const assetId = asset.id.id;
    const name = asset.name;

    // Get linked device (FROM asset Contains DEVICE)
    let deviceId = null;
    try {
      const rels = await tbGet(
        `/api/relations?fromId=${assetId}&fromType=ASSET&relationTypeGroup=COMMON`,
        token
      );
      const deviceRel = rels.find(r => r.type === 'Contains' && r.to.entityType === 'DEVICE');
      if (deviceRel) deviceId = deviceRel.to.id;
    } catch (_) {}

    // Get parent lokacija name (TO asset Contains this asset)
    let location = null;
    try {
      const rels = await tbGet(
        `/api/relations?toId=${assetId}&toType=ASSET&relationTypeGroup=COMMON`,
        token
      );
      const parentRel = rels.find(r => r.type === 'Contains' && r.from.entityType === 'ASSET');
      if (parentRel) {
        const parentAsset = allAssets.find(a => a.id.id === parentRel.from.id);
        if (parentAsset?.type === 'lokacija') location = parentAsset.name;
      }
    } catch (_) {}

    // Get server attributes (address, lat, lng, workingHours)
    let address = null, lat = null, lng = null, workingHours = null;
    try {
      const attrs = await tbGet(
        `/api/plugins/telemetry/ASSET/${assetId}/values/attributes/SERVER_SCOPE`,
        token
      );
      const get = key => attrs.find(a => a.key === key)?.value ?? null;
      address = get('address');
      lat = get('lat');
      lng = get('lng');
      workingHours = get('workingHours');
    } catch (_) {}

    const existing = db.prepare('SELECT * FROM menze WHERE tb_asset_id = ?').get(assetId);

    if (existing) {
      db.prepare(`UPDATE menze SET name=?, location=?, tb_device_id=?, address=?, lat=?, lng=?, working_hours=?
                  WHERE tb_asset_id=?`)
        .run(name, location, deviceId, address, lat, lng, workingHours, assetId);
      console.log(`[TB Sync] Updated: ${name} (location: ${location ?? '—'}, address: ${address ?? '—'})`);
    } else {
      const mqtt_token = `token-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const result = db.prepare(`
        INSERT INTO menze (name, location, tenant_id, mqtt_token, tb_device_id, tb_asset_id, address, lat, lng, working_hours)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(name, location, adminId, mqtt_token, deviceId, assetId, address, lat, lng, workingHours);

      const menzaId = result.lastInsertRowid;
      db.prepare('INSERT OR IGNORE INTO zones (menza_id, name, is_virtual) VALUES (?, ?, ?)').run(menzaId, 'Zona 1', 0);
      db.prepare('INSERT OR IGNORE INTO zones (menza_id, name, is_virtual) VALUES (?, ?, ?)').run(menzaId, 'Zona 2', 0);
      console.log(`[TB Sync] Inserted: ${name} (location: ${location ?? '—'}, address: ${address ?? '—'})`);
    }
  }

  console.log('[TB Sync] Sync complete');
}

module.exports = { syncMenzeFromThingsBoard };
