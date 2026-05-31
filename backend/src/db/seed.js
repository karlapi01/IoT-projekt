const bcrypt = require('bcryptjs');
const db = require('./schema'); // migrations run automatically in schema.js

const hash = (pw) => bcrypt.hashSync(pw, 10);

// Admin
const adminResult = db.prepare(`
  INSERT OR IGNORE INTO users (name, email, password, role)
  VALUES ('Admin', 'admin@redometar.hr', ?, 'admin')
`).run(hash('admin123'));

// Customer — Cassandra FER, vlasnik FER menze
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

console.log('Seed complete.');
console.log('  admin@redometar.hr   / admin123    (admin)');
console.log('  cassandra@fer.hr     / customer123 (customer)');
console.log('  sc@unizg.hr          / sc123       (customer)');
console.log('  ivan@student.hr      / student123  (student)');
console.log('');
console.log('Run backend to sync menze from ThingsBoard automatically.');
