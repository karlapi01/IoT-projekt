const bcrypt = require('bcryptjs');
const db = require('./schema');

const hash = (pw) => bcrypt.hashSync(pw, 10);

// Migrations
try { db.prepare('ALTER TABLE menze ADD COLUMN mqtt_token TEXT UNIQUE').run(); } catch (_) {}
try { db.prepare('ALTER TABLE menze ADD COLUMN tb_device_id TEXT UNIQUE').run(); } catch (_) {}
try { db.prepare('ALTER TABLE menze ADD COLUMN estimated_wait_minutes INTEGER DEFAULT 0').run(); } catch (_) {}
try { db.prepare('ALTER TABLE menze ADD COLUMN occupied_zones INTEGER DEFAULT 0').run(); } catch (_) {}
try { db.prepare('ALTER TABLE menze ADD COLUMN total_zones INTEGER DEFAULT 0').run(); } catch (_) {}

// Admin
const adminResult = db.prepare(`
  INSERT OR IGNORE INTO users (name, email, password, role)
  VALUES ('Admin', 'admin@redometar.hr', ?, 'admin')
`).run(hash('admin123'));
const adminId = adminResult.changes > 0 ? adminResult.lastInsertRowid : db.prepare("SELECT id FROM users WHERE email='admin@redometar.hr'").get().id;

// Menze — owned by admin, tb_device_id maps to ThingsBoard
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
  `).run(m.name, m.location, adminId, m.token, m.tbDeviceId);

  db.prepare('UPDATE menze SET tb_device_id = ? WHERE mqtt_token = ? AND tb_device_id IS NULL')
    .run(m.tbDeviceId, m.token);

  const menzaId = r.changes > 0 ? r.lastInsertRowid : db.prepare('SELECT id FROM menze WHERE mqtt_token=?').get(m.token).id;

  for (const z of m.zones) {
    db.prepare('INSERT OR IGNORE INTO zones (menza_id, name, is_virtual) VALUES (?, ?, ?)')
      .run(menzaId, z.name, z.virtual);
  }
}

// Customer — Cassandra FER, vlasnica FER menze
const cassandraResult = db.prepare(`
  INSERT OR IGNORE INTO users (name, email, password, role)
  VALUES ('Cassandra FER', 'cassandra@fer.hr', ?, 'customer')
`).run(hash('customer123'));
const cassandraId = cassandraResult.changes > 0 ? cassandraResult.lastInsertRowid : db.prepare("SELECT id FROM users WHERE email='cassandra@fer.hr'").get().id;

const ferMenza = db.prepare("SELECT id FROM menze WHERE tb_device_id='40f87c40-5ad0-11f1-a544-db21b46190ed'").get();
if (ferMenza) {
  db.prepare('INSERT OR IGNORE INTO customer_menza_access (customer_id, menza_id) VALUES (?,?)').run(cassandraId, ferMenza.id);
}

// Student — Ivan, read-only pregled svih menza
db.prepare(`
  INSERT OR IGNORE INTO users (name, email, password, role)
  VALUES ('Ivan Student', 'ivan@student.hr', ?, 'student')
`).run(hash('student123'));

console.log('Seed complete.');
console.log('  admin@redometar.hr   / admin123    (admin)');
console.log('  cassandra@fer.hr     / customer123 (customer — vlasnica FER menze)');
console.log('  ivan@student.hr      / student123  (student — read-only)');
