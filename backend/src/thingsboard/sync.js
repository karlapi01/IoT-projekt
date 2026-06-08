const db = require('../db/schema');
const { tbLogin, tbGet } = require('./client');

async function syncMenzeFromThingsBoard() {
  let token;
  try {
    token = await tbLogin();
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

  const tbAssetIds = menzaAssets.map(a => a.id.id);
  const localTbMenze = db.prepare('SELECT id, name, tb_asset_id FROM menze WHERE tb_asset_id IS NOT NULL').all();
  for (const m of localTbMenze) {
    if (!tbAssetIds.includes(m.tb_asset_id)) {
      db.prepare('DELETE FROM menze WHERE id = ?').run(m.id);
      console.log(`[TB Sync] Removed stale menza: ${m.name} (asset no longer in ThingsBoard)`);
    }
  }

  for (const asset of menzaAssets) {
    const assetId = asset.id.id;
    const name = asset.name;

    let deviceId = null;
    try {
      const rels = await tbGet(
        `/api/relations?fromId=${assetId}&fromType=ASSET&relationTypeGroup=COMMON`,
        token
      );
      const deviceRel = rels.find(r => r.type === 'Contains' && r.to.entityType === 'DEVICE');
      if (deviceRel) {
        deviceId = deviceRel.to.id;
      } else {
        console.warn(`[TB Sync] ${name}: no Contains→DEVICE relation found (relations: ${JSON.stringify(rels.map(r => `${r.type} → ${r.to.entityType}`))})`);
      }
    } catch (err) {
      console.warn(`[TB Sync] ${name}: failed to fetch relations — ${err.message}`);
    }

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
      if (deviceId) {
        const conflict = db.prepare('SELECT name FROM menze WHERE tb_device_id=? AND tb_asset_id!=?').get(deviceId, assetId);
        if (conflict) {
          console.warn(`[TB Sync] WARNING: device ${deviceId} is linked to both "${name}" and "${conflict.name}" in ThingsBoard — fix the Contains relation in TB for one of them`);
        }
      }
      db.prepare(`UPDATE OR IGNORE menze SET name=?, location=?, address=?, lat=?, lng=?, working_hours=?,
                  tb_device_id=?
                  WHERE tb_asset_id=?`)
        .run(name, location, address, lat, lng, workingHours, deviceId, assetId);
      console.log(`[TB Sync] Updated: ${name} (location: ${location ?? '—'}, address: ${address ?? '—'})`);
    } else {
      const mqtt_token = `token-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const result = db.prepare(`
        INSERT INTO menze (name, location, tenant_id, mqtt_token, tb_device_id, tb_asset_id, address, lat, lng, working_hours)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(name, location, adminId, mqtt_token, deviceId, assetId, address, lat, lng, workingHours);

      console.log(`[TB Sync] Inserted: ${name} (location: ${location ?? '—'}, address: ${address ?? '—'}) — zones will be created on first telemetry`);
    }
  }

  console.log('[TB Sync] Sync complete');
}

module.exports = { syncMenzeFromThingsBoard };
