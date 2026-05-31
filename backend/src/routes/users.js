const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db/schema');
const auth = require('../middleware/auth');

// Admin: list all users
router.get('/', auth('admin'), (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users').all();
  res.json(users);
});

// Admin: create customer or student
router.post('/', auth('admin'), (req, res) => {
  const { name, email, password, role, menza_ids } = req.body;

  if (!['admin', 'customer', 'student'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const hashed = bcrypt.hashSync(password, 10);

  try {
    const result = db.prepare(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
    ).run(name, email, hashed, role);

    if (role === 'customer' && menza_ids?.length) {
      const stmt = db.prepare('INSERT OR IGNORE INTO customer_menza_access (customer_id, menza_id) VALUES (?, ?)');
      menza_ids.forEach((mid) => stmt.run(result.lastInsertRowid, mid));
    }

    res.status(201).json({ id: result.lastInsertRowid, name, email, role });
  } catch {
    res.status(400).json({ error: 'Email already exists' });
  }
});

// Admin: delete user
router.delete('/:id', auth('admin'), (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
