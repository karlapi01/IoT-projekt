const bcrypt = require('bcryptjs');
const db = require('./schema');

const hash = (pw) => bcrypt.hashSync(pw, 10);

// Migrations
try { db.prepare('ALTER TABLE menze ADD COLUMN mqtt_token TEXT UNIQUE').run(); } catch (_) {}
try { db.prepare('ALTER TABLE menze ADD COLUMN tb_device_id TEXT UNIQUE').run(); } catch (_) {}
try { db.prepare('ALTER TABLE menze ADD COLUMN tb_asset_id TEXT UNIQUE').run(); } catch (_) {}
try { db.prepare('ALTER TABLE menze ADD COLUMN address TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE menze ADD COLUMN lat REAL').run(); } catch (_) {}
try { db.prepare('ALTER TABLE menze ADD COLUMN lng REAL').run(); } catch (_) {}
try { db.prepare('ALTER TABLE menze ADD COLUMN working_hours TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE menze ADD COLUMN estimated_wait_minutes INTEGER DEFAULT 0').run(); } catch (_) {}
try { db.prepare('ALTER TABLE menze ADD COLUMN occupied_zones INTEGER DEFAULT 0').run(); } catch (_) {}
try { db.prepare('ALTER TABLE menze ADD COLUMN total_zones INTEGER DEFAULT 0').run(); } catch (_) {}

// Admin
const adminResult = db.prepare(`
  INSERT OR IGNORE INTO users (name, email, password, role)
  VALUES ('Admin', 'admin@redometar.hr', ?, 'admin')
`).run(hash('admin123'));

// Customer — Cassandra FER, vlasnica FER menze
db.prepare(`
  INSERT OR IGNORE INTO users (name, email, password, role)
  VALUES ('Cassandra FER', 'cassandra@fer.hr', ?, 'customer')
`).run(hash('customer123'));

// Customer — SC
db.prepare(`
  INSERT OR IGNORE INTO users (name, email, password, role)
  VALUES ('SC Customer', 'sc@unizg.hr', ?, 'customer')
`).run(hash('sc123'));

// Student — Ivan, read-only pregled svih menza
db.prepare(`
  INSERT OR IGNORE INTO users (name, email, password, role)
  VALUES ('Ivan Student', 'ivan@student.hr', ?, 'student')
`).run(hash('student123'));

// Menze se NE seedaju ovdje — dolaze iz ThingsBoard sync (syncMenzeFromThingsBoard)

console.log('Seed complete.');
console.log('  admin@redometar.hr   / admin123    (admin)');
console.log('  cassandra@fer.hr     / customer123 (customer)');
console.log('  sc@unizg.hr          / sc123       (customer)');
console.log('  ivan@student.hr      / student123  (student)');
console.log('');
console.log('Run backend to sync menze from ThingsBoard automatically.');
