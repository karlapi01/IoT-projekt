const bcrypt = require('bcryptjs');
const db = require('./schema');

const hash = (pw) => bcrypt.hashSync(pw, 10);

// Migrate: add mqtt_token column if it doesn't exist yet
try {
  db.prepare('ALTER TABLE menze ADD COLUMN mqtt_token TEXT UNIQUE').run();
} catch (_) {}

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
const tenantId = tenantResult.lastInsertRowid || db.prepare("SELECT id FROM users WHERE email='tenant@fer.hr'").get().id;

// Menze — mqtt_token matches what CafeteriaConfig reads from env vars (MENZA1_TOKEN, etc.)
// For local dev we use fixed demo tokens so you don't need env vars set
const menze = [
  { name: 'Studentski dom Stjepan Radić', location: 'Zagreb', token: 'demo-token-menza1', zones: [{name:'Zona 1',virtual:0},{name:'Zona 2',virtual:1}] },
  { name: 'SC menza',                     location: 'Zagreb', token: 'demo-token-menza2', zones: [{name:'Zona 1',virtual:0},{name:'Zona 2',virtual:0},{name:'Zona 3',virtual:1}] },
  { name: 'Studentski dom Cvjetno',        location: 'Zagreb', token: 'demo-token-menza3', zones: [{name:'Zona 1',virtual:0},{name:'Zona 2',virtual:1}] },
];

for (const m of menze) {
  const r = db.prepare(`
    INSERT OR IGNORE INTO menze (name, location, tenant_id, mqtt_token)
    VALUES (?, ?, ?, ?)
  `).run(m.name, m.location, tenantId, m.token);

  const menzaId = r.lastInsertRowid || db.prepare('SELECT id FROM menze WHERE mqtt_token=?').get(m.token).id;

  for (const z of m.zones) {
    db.prepare(`INSERT OR IGNORE INTO zones (menza_id, name, is_virtual) VALUES (?, ?, ?)`)
      .run(menzaId, z.name, z.virtual);
  }
}

// Customer
const custResult = db.prepare(`
  INSERT OR IGNORE INTO users (name, email, password, role, tenant_id)
  VALUES ('Ivan Student', 'ivan@student.hr', ?, 'customer', ?)
`).run(hash('customer123'), tenantId);
const customerId = custResult.lastInsertRowid || db.prepare("SELECT id FROM users WHERE email='ivan@student.hr'").get().id;

const allMenze = db.prepare('SELECT id FROM menze WHERE tenant_id=?').all(tenantId);
for (const m of allMenze) {
  db.prepare('INSERT OR IGNORE INTO customer_menza_access (customer_id, menza_id) VALUES (?,?)').run(customerId, m.id);
}

console.log('Seed complete.');
console.log('  admin@redometar.hr  / admin123');
console.log('  tenant@fer.hr       / tenant123');
console.log('  ivan@student.hr     / customer123');
console.log('');
console.log('MQTT tokens (use as MENZA1_TOKEN etc. env vars in Java):');
console.log('  demo-token-menza1  → Studentski dom Stjepan Radić');
console.log('  demo-token-menza2  → SC menza');
console.log('  demo-token-menza3  → Studentski dom Cvjetno');
