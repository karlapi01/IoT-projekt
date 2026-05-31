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
    role TEXT NOT NULL CHECK(role IN ('admin', 'customer', 'student')),
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
    tb_asset_id TEXT UNIQUE,
    address TEXT,
    lat REAL,
    lng REAL,
    working_hours TEXT,
    estimated_wait_minutes INTEGER DEFAULT 0,
    occupied_zones INTEGER DEFAULT 0,
    total_zones INTEGER DEFAULT 0,
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

const migrations = [
  `ALTER TABLE menze ADD COLUMN mqtt_token TEXT UNIQUE`,
  `ALTER TABLE menze ADD COLUMN tb_device_id TEXT UNIQUE`,
  `ALTER TABLE menze ADD COLUMN tb_asset_id TEXT UNIQUE`,
  `ALTER TABLE menze ADD COLUMN address TEXT`,
  `ALTER TABLE menze ADD COLUMN lat REAL`,
  `ALTER TABLE menze ADD COLUMN lng REAL`,
  `ALTER TABLE menze ADD COLUMN working_hours TEXT`,
  `ALTER TABLE menze ADD COLUMN estimated_wait_minutes INTEGER DEFAULT 0`,
  `ALTER TABLE menze ADD COLUMN occupied_zones INTEGER DEFAULT 0`,
  `ALTER TABLE menze ADD COLUMN total_zones INTEGER DEFAULT 0`,
  `ALTER TABLE menze ADD COLUMN telemetry_updated_at DATETIME`,
];
for (const sql of migrations) { try { db.exec(sql); } catch (_) {} }

module.exports = db;
