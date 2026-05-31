const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbPath = path.resolve(process.env.DB_PATH || './data/redometar.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'tenant', 'customer')),
    tenant_id INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS menze (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT,
    tenant_id INTEGER NOT NULL REFERENCES users(id),
    mqtt_token TEXT UNIQUE,
    tb_device_id TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menza_id INTEGER NOT NULL REFERENCES menze(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_virtual INTEGER DEFAULT 0,
    UNIQUE(menza_id, name)
  );

  CREATE TABLE IF NOT EXISTS zone_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id INTEGER NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    occupied INTEGER NOT NULL DEFAULT 0,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS customer_menza_access (
    customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    menza_id INTEGER NOT NULL REFERENCES menze(id) ON DELETE CASCADE,
    PRIMARY KEY (customer_id, menza_id)
  );
`);

module.exports = db;
