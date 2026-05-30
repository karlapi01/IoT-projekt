### Terminal 1 — Backend

```bash
cd path-to-project/backend
npm install
npm run seed
npm run dev
```

HTTP server on port 4000 and MQTT broker on port 1883

---

### Terminal 2 — Frontend

```bash
cd path-to-project/frontend
npm install
npm run dev
```

---

### Terminal 3 — Java Simulator

> The simulator currently points at the local MQTT broker instead of ThingsBoard.

Make sure the broker URL in `Main.java` is set to:

```java
private static final String BROKER_URL = "tcp://localhost:1883";
```

Also set the following env variables before running:

```bash
set MENZA1_TOKEN=demo-token-menza1
set MENZA2_TOKEN=demo-token-menza2
set MENZA3_TOKEN=demo-token-menza3
```
