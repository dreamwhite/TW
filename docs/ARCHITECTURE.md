# Architecture

## Containers and boundaries

- **frontend (Nginx)**: serves `frontend/static` and reverse-proxies `/api` and `/ws` to the backend.
- **backend (Express)**: REST API with JWT auth, setup wizard endpoints, and MQTT bridge. Exposes port 5000 internally, published as 5001.
- **mongo**: MongoDB instance; data lives in `./data/mongo` (bind mount).
- **mongo-express**: admin UI on port 8081 (basic auth `admin/admin` by default).
- **mosquitto (optional)**: local MQTT broker on 1883 for demo/testing; can be replaced with an external broker.

The MQTT broker is *not* in the stack. Point the bridge to your broker via `.env` or through the setup wizard.

## Backend layout

```
services/api/src
├── config.js          # Env parsing + defaults (JWT, Mongo, MQTT)
├── db.js              # Mongo connection helper + ObjectId export
├── mqttBridge.js      # mqtt.js client, auto-subscribe, logging, threshold control
├── middleware/        # JWT guards (requireAuth, requireAdmin)
├── routes/            # Auth, status, setup, messages, sensors
└── services/          # Business logic for users, sensors, messages, settings
```

Highlights
- **User service** seeds a default admin (from env) if DB is empty, and issues JWTs.
- **Settings service** stores wizard output (`configured` flag + MQTT params) in `settings`.
- **Sensor service** keeps metadata (topic, threshold, control topic) and feeds auto-subscriptions.
- **Message service** logs inbound/outbound traffic with parsed + raw payloads.
- **MQTT bridge** merges env and stored settings, subscribes to sensor topics and optional wildcard, publishes on demand.

## Data flow (happy path)

1. **Setup** — Wizard calls `/api/setup/complete` to create admin + save MQTT params; `configured=true` stored in Mongo.
2. **Auth** — User logs in via `/api/auth/login`; JWT returned and sent on subsequent requests.
3. **Publish** — UI posts to `/api/messages`; backend validates JWT, publishes via mqtt.js, logs as `outbound`.
4. **Inbound** — Broker sends messages on subscribed topics; bridge logs as `inbound`; UI fetches `/api/messages` to render history.
5. **Sensors** — CRUD via `/api/sensors`; updates trigger `syncSensors` to refresh subscriptions and optional threshold control publishing.

## Security and networking

- JWT (HS256) for protected routes; secret set via `.env`.
- CORS origins controlled by `CORS_ALLOWED_ORIGINS`.
- Only frontend (8080), backend (5001), and mongo-express (8081) publish ports; Mongo stays internal to Docker unless explicitly mapped.
- Secrets and broker creds should be rotated before deploying outside local/dev.
