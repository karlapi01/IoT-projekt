const WebSocket = require('ws');
const db = require('../db/schema');

const TB_URL = process.env.TB_URL || 'http://161.53.133.253:8080';
const TB_EMAIL = process.env.TB_EMAIL || 'dona.weiner@fer.hr';
const TB_PASSWORD = process.env.TB_PASSWORD || 'Redometar5';

async function login() {
  const res = await fetch(`${TB_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: TB_EMAIL, password: TB_PASSWORD }),
  });
  if (!res.ok) throw new Error(`ThingsBoard login failed: ${res.status}`);
  const data = await res.json();
  return data.token;
}


function handleTelemetry(menzaId, menzaName, payload) {
  const zones = db.prepare('SELECT id, name FROM zones WHERE menza_id = ? ORDER BY id').all(menzaId);
  const insert = db.prepare('INSERT INTO zone_states (zone_id, occupied) VALUES (?, ?)');

  let updated = 0;
  for (const zone of zones) {
    const key = 'zone' + zone.name.replace(/\D/g, '');
    if (key in payload) {
      // ThingsBoard format: [[timestamp, "true"]] — value is at index [0][1]
      const raw = Array.isArray(payload[key]) ? payload[key][0]?.[1] : payload[key];
      const occupied = raw === true || raw === 'true' || raw === 1 ? 1 : 0;
      insert.run(zone.id, occupied);
      updated++;
    }
  }

  if (updated > 0) {
    const occupied = zones.filter((z) => {
      const k = 'zone' + z.name.replace(/\D/g, '');
      const raw = Array.isArray(payload[k]) ? payload[k][0]?.[1] : payload[k];
      return raw === true || raw === 'true' || raw === 1;
    }).length;
    console.log(`[TB] ${menzaName}: ${occupied}/${zones.length} zones occupied`);
  }
}

async function startThingsBoardSubscriber() {
  let token;
  try {
    token = await login();
    console.log('[TB] Logged in successfully');
  } catch (err) {
    console.error('[TB] Login error:', err.message);
    return;
  }

  // Build subscriptions from menze that have a tb_device_id set
  const menze = db.prepare('SELECT * FROM menze WHERE tb_device_id IS NOT NULL').all();
  const subscriptions = [];

  let cmdId = 1;
  for (const menza of menze) {
    subscriptions.push({
      cmdId,
      menzaId: menza.id,
      menzaName: menza.name,
      deviceId: menza.tb_device_id,
    });
    cmdId++;
  }

  if (subscriptions.length === 0) {
    console.error('[TB] No menze could be matched to ThingsBoard devices. Check device names match.');
    return;
  }

  const wsUrl = `${TB_URL.replace('http', 'ws')}/api/ws/plugins/telemetry?token=${token}`;
  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    console.log('[TB] WebSocket connected');

    const cmds = subscriptions.map((s) => ({
      entityType: 'DEVICE',
      entityId: s.deviceId,
      scope: 'LATEST_TELEMETRY',
      cmdId: s.cmdId,
    }));

    ws.send(JSON.stringify({ tsSubCmds: cmds, historyCmds: [], attrSubCmds: [] }));
    console.log(`[TB] Subscribed to telemetry for: ${subscriptions.map((s) => s.menzaName).join(', ')}`);
  });

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    // ThingsBoard sends { subscriptionId, data: { zone1: [{ts, value}], ... } }
    const sub = subscriptions.find((s) => s.cmdId === msg.subscriptionId);
    if (!sub || !msg.data) return;

    handleTelemetry(sub.menzaId, sub.menzaName, msg.data);
  });

  ws.on('error', (err) => {
    console.error('[TB] WebSocket error:', err.message);
  });

  ws.on('close', () => {
    console.warn('[TB] WebSocket closed — reconnecting in 10s...');
    setTimeout(() => startThingsBoardSubscriber(), 10000);
  });
}

module.exports = { startThingsBoardSubscriber };
