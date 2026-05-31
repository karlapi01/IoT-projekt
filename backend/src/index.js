require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth',  require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/menze', require('./routes/menze'));

app.get('/api/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`[HTTP] Backend running on http://localhost:${PORT}`);
});

const { syncMenzeFromThingsBoard } = require('./thingsboard/sync');
const { startThingsBoardSubscriber } = require('./thingsboard/subscriber');
const db = require('./db/schema');

const SYNC_INTERVAL_MS  = 5 * 60 * 1000; // re-sync every 5 minutes
const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000; // purge old zone_states daily

function purgeOldZoneStates() {
  const { changes } = db.prepare(
    `DELETE FROM zone_states WHERE recorded_at < datetime('now', '-30 days')`
  ).run();
  if (changes > 0) console.log(`[Purge] Deleted ${changes} zone_state rows older than 30 days`);
}

let subscriberHandle = { stop: () => {} };

async function syncAndResubscribe() {
  await syncMenzeFromThingsBoard();
  subscriberHandle.stop();
  subscriberHandle = await startThingsBoardSubscriber();
}

syncAndResubscribe();
setInterval(syncAndResubscribe, SYNC_INTERVAL_MS);
purgeOldZoneStates();
setInterval(purgeOldZoneStates, PURGE_INTERVAL_MS);
