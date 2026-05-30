// Simulates HC-SR04 sensor readings — runs as a background loop
const db = require('./db/schema');

function tick() {
  const zones = db.prepare('SELECT * FROM zones').all();
  zones.forEach((z) => {
    // ~60% chance a zone is occupied at any given tick
    const occupied = Math.random() < 0.6 ? 1 : 0;
    db.prepare('INSERT INTO zone_states (zone_id, occupied) VALUES (?, ?)').run(z.id, occupied);
  });
}

function startSimulator(intervalMs = 5000) {
  console.log(`[Simulator] Running every ${intervalMs / 1000}s`);
  tick();
  setInterval(tick, intervalMs);
}

module.exports = { startSimulator };
