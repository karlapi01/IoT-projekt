const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db/schema');
const auth = require('../middleware/auth');

// Admin: list all users
router.get('/', auth('admin'), (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, tenant_id, created_at FROM users').all();
  res.json(users);
});

// Admin: create tenant or admin; Tenant: create customer
router.post('/', auth('admin', 'tenant'), (req, res) => {
  const { name, email, password, role, menza_ids } = req.body;
  const caller = req.user;

  if (caller.role === 'tenant' && role !== 'customer') {
    return res.status(403).json({ error: 'Tenants can only create customers' });
  }
  if (caller.role === 'admin' && !['tenant', 'admin'].includes(role)) {
    return res.status(403).json({ error: 'Admins can create admin or tenant users' });
  }

  const hashed = bcrypt.hashSync(password, 10);
  const tenant_id = caller.role === 'tenant' ? caller.id : null;

  try {
    const result = db.prepare(
      'INSERT INTO users (name, email, password, role, tenant_id) VALUES (?, ?, ?, ?, ?)'
    ).run(name, email, hashed, role, tenant_id);

    if (role === 'customer' && menza_ids?.length) {
      const stmt = db.prepare('INSERT OR IGNORE INTO customer_menza_access (customer_id, menza_id) VALUES (?, ?)');
      menza_ids.forEach((mid) => stmt.run(result.lastInsertRowid, mid));
    }

    res.status(201).json({ id: result.lastInsertRowid, name, email, role });
  } catch (e) {
    res.status(400).json({ error: 'Email already exists' });
  }
});

// Admin: delete user
router.delete('/:id', auth('admin'), (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Tenant: list own customers
router.get('/customers', auth('tenant'), (req, res) => {
  const customers = db.prepare(
    'SELECT id, name, email, created_at FROM users WHERE tenant_id = ? AND role = ?'
  ).all(req.user.id, 'customer');
  res.json(customers);
});

module.exports = router;
