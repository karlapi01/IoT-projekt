const bcrypt = require('bcryptjs');
const db = require('./schema');

const hash = (pw) => bcrypt.hashSync(pw, 10);

// Migrations
try { db.prepare('ALTER TABLE menze ADD COLUMN mqtt_token TEXT UNIQUE').run(); } catch (_) {}
try { db.prepare('ALTER TABLE menze ADD COLUMN tb_device_id TEXT UNIQUE').run(); } catch (_) {}

// Admin
db.prepare(`
  INSERT OR IGNORE INTO users (name, email, password, role)
  VALUES ('Admin', 'admin@redometar.hr', ?, 'admin')
`).run(hash('admin123'));

// Tenant
const tenantResult = db.prepare(`
  INSERT OR IGNORE INTO users (name, email, password, role)
  VALUES ('FER Tenant', 'tenant@fer.hr', ?, 'tenant')
`).run(hash('tenant123'));
const tenantId = tenantResult.changes > 0 ? tenantResult.lastInsertRowid : db.prepare("SELECT id FROM users WHERE email='tenant@fer.hr'").get().id;

// Menze — mqtt_token matches what CafeteriaConfig reads from env vars (MENZA1_TOKEN, etc.)
// For local dev we use fixed demo tokens so you don't need env vars set
const menze = [
  { name: 'Studentski dom Stjepan Radić', location: 'Zagreb', token: 'demo-token-menza1', tbDeviceId: '0334ac10-5c62-11f1-a544-db21b46190ed', zones: [{name:'Zona 1',virtual:0},{name:'Zona 2',virtual:1}] },
  { name: 'SC menza',                     location: 'Zagreb', token: 'demo-token-menza2', tbDeviceId: '1fca22c0-5c61-11f1-a544-db21b46190ed', zones: [{name:'Zona 1',virtual:0},{name:'Zona 2',virtual:0},{name:'Zona 3',virtual:1}] },
  { name: 'Studentski dom Cvjetno',        location: 'Zagreb', token: 'demo-token-menza3', tbDeviceId: '8f80d180-5c71-11f1-a544-db21b46190ed', zones: [{name:'Zona 1',virtual:0},{name:'Zona 2',virtual:1}] },
  { name: 'FER',                           location: 'Zagreb', token: 'demo-token-menza4', tbDeviceId: '40f87c40-5ad0-11f1-a544-db21b46190ed', zones: [{name:'Zona 1',virtual:0},{name:'Zona 2',virtual:0}] },
];

for (const m of menze) {
  const r = db.prepare(`
    INSERT OR IGNORE INTO menze (name, location, tenant_id, mqtt_token, tb_device_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(m.name, m.location, tenantId, m.token, m.tbDeviceId);

  // Update tb_device_id if menza already existed without it
  db.prepare('UPDATE menze SET tb_device_id = ? WHERE mqtt_token = ? AND tb_device_id IS NULL')
    .run(m.tbDeviceId, m.token);

  const menzaId = r.changes > 0 ? r.lastInsertRowid : db.prepare('SELECT id FROM menze WHERE mqtt_token=?').get(m.token).id;

  for (const z of m.zones) {
    db.prepare(`INSERT OR IGNORE INTO zones (menza_id, name, is_virtual) VALUES (?, ?, ?)`)
      .run(menzaId, z.name, z.virtual);
  }
}

// Customer — Ivan (pristup svim menzama)
const custResult = db.prepare(`
  INSERT OR IGNORE INTO users (name, email, password, role, tenant_id)
  VALUES ('Ivan Student', 'ivan@student.hr', ?, 'customer', ?)
`).run(hash('customer123'), tenantId);
const customerId = custResult.changes > 0 ? custResult.lastInsertRowid : db.prepare("SELECT id FROM users WHERE email='ivan@student.hr'").get().id;

const allMenze = db.prepare('SELECT id FROM menze WHERE tenant_id=?').all(tenantId);
for (const m of allMenze) {
  db.prepare('INSERT OR IGNORE INTO customer_menza_access (customer_id, menza_id) VALUES (?,?)').run(customerId, m.id);
}

// Customer — Cassandra FER (pristup samo FER menzi)
const cassandraResult = db.prepare(`
  INSERT OR IGNORE INTO users (name, email, password, role, tenant_id)
  VALUES ('Cassandra FER', 'cassandra@fer.hr', ?, 'customer', ?)
`).run(hash('customer123'), tenantId);
const cassandraId = cassandraResult.changes > 0 ? cassandraResult.lastInsertRowid : db.prepare("SELECT id FROM users WHERE email='cassandra@fer.hr'").get().id;

const ferMenza = db.prepare("SELECT id FROM menze WHERE tb_device_id='40f87c40-5ad0-11f1-a544-db21b46190ed'").get();
if (ferMenza) {
  db.prepare('INSERT OR IGNORE INTO customer_menza_access (customer_id, menza_id) VALUES (?,?)').run(cassandraId, ferMenza.id);
}

console.log('Seed complete.');
console.log('  admin@redometar.hr  / admin123');
console.log('  tenant@fer.hr       / tenant123');
console.log('  ivan@student.hr     / customer123');
console.log('  cassandra@fer.hr    / customer123');
console.log('');
console.log('MQTT tokens (use as MENZA1_TOKEN etc. env vars in Java):');
console.log('  demo-token-menza1  → Studentski dom Stjepan Radić');
console.log('  demo-token-menza2  → SC menza');
console.log('  demo-token-menza3  → Studentski dom Cvjetno');
console.log('  (ESP32_menza1 šalje direktno na ThingsBoard, nema lokalnog tokena)');
