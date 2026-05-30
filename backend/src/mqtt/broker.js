const aedes = require('aedes');
const net = require('net');
const db = require('../db/schema');

const MQTT_PORT = 1883;
// ThingsBoard telemetry topic — Java publishes to exactly this
const TELEMETRY_TOPIC = 'v1/devices/me/telemetry';

function startMqttBroker() {
  const broker = aedes();

  // Authenticate using the menza's mqtt_token as MQTT username (same as ThingsBoard Access Token auth)
  broker.authenticate = (client, username, password, done) => {
    const token = username ? username.toString() : null;
    if (!token) return done(null, false);

    const menza = db.prepare('SELECT id, name FROM menze WHERE mqtt_token = ?').get(token);
    if (!menza) {
      console.warn(`[MQTT] Rejected unknown token: ${token}`);
      return done(null, false);
    }

    // Store menza id on the client object for use in message handler
    client.menzaId = menza.id;
    client.menzaName = menza.name;
    console.log(`[MQTT] Connected: ${menza.name} (client ${client.id})`);
    done(null, true);
  };

  broker.on('publish', (packet, client) => {
    if (!client) return; // ignore internal broker messages
    if (packet.topic !== TELEMETRY_TOPIC) return;

    let payload;
    try {
      payload = JSON.parse(packet.payload.toString());
    } catch {
      console.warn(`[MQTT] Bad JSON from ${client.id}`);
      return;
    }

    // payload: { "zone1": true, "zone2": false, ... }
    handleTelemetry(client.menzaId, client.menzaName, payload);
  });

  broker.on('clientDisconnect', (client) => {
    if (client.menzaName) {
      console.log(`[MQTT] Disconnected: ${client.menzaName}`);
    }
  });

  const server = net.createServer(broker.handle);
  server.listen(MQTT_PORT, () => {
    console.log(`[MQTT] Broker listening on port ${MQTT_PORT}`);
    console.log(`[MQTT] Java simulator: set broker to tcp://localhost:${MQTT_PORT}`);
  });

  return broker;
}

function handleTelemetry(menzaId, menzaName, payload) {
  // payload keys are "zone1", "zone2", ... — match by position to DB zones
  const zones = db.prepare('SELECT id, name FROM zones WHERE menza_id = ? ORDER BY id').all(menzaId);

  const insert = db.prepare('INSERT INTO zone_states (zone_id, occupied) VALUES (?, ?)');

  let updated = 0;
  for (const zone of zones) {
    // zone.name is "Zona 1", "Zona 2" — map to payload key "zone1", "zone2"
    const key = 'zone' + zone.name.replace(/\D/g, '');
    if (key in payload) {
      insert.run(zone.id, payload[key] ? 1 : 0);
      updated++;
    }
  }

  if (updated > 0) {
    const occupied = zones.filter((z) => {
      const k = 'zone' + z.name.replace(/\D/g, '');
      return payload[k] === true;
    }).length;
    console.log(`[MQTT] ${menzaName}: ${occupied}/${zones.length} zones occupied`);
  }
}

module.exports = { startMqttBroker };
