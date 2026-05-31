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

// Subscribe to live telemetry from ThingsBoard
const { startThingsBoardSubscriber } = require('./thingsboard/subscriber');
startThingsBoardSubscriber();
