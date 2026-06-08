const bcrypt = require('bcryptjs');
const db = require('./schema');

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

// Student — Ivan
db.prepare(`
  INSERT OR IGNORE INTO users (name, email, password, role)
  VALUES ('Ivan Student', 'ivan@student.hr', ?, 'student')
`).run(hash('student123'));

