# Gateway Architecture

## Overview

Compose brings up four main containers:

- **frontend** (Nginx): serves static UI and reverse-proxies `/api` to the backend.
- **backend** (Express): REST API with JWT auth and MQTT bridge (publish/subscribe + logging).
- **mongo** (MongoDB): persistent storage for users, settings, sensors, and message logs (bind mount `./data/mongo`).
- **mongo-express**: web UI to browse Mongo (port 8081, basic auth admin/admin).

MQTT broker is external; configure host/port/creds via setup wizard or env.

Default ports:
- Frontend/proxy: 8080
- Backend direct: 5001 (maps to 5000 in container)
- Mongo: 27017 (`data/mongo` for persistence)
- Mongo Express: 8081

## Backend modules

```
services/api/src
├── config.js         # Env parsing + defaults
├── db.js             # Mongo connection + indexes
├── mqttBridge.js     # mqtt.js client with inbound/outbound logging
├── middleware/       # JWT guards (requireAuth/requireAdmin)
├── routes/           # Auth, status, setup, messages, sensors
└── services/         # Helpers for users, sensors, messages, settings
```

- User service seeds default admin (env) and issues JWTs.
- Message service logs MQTT traffic with an index on `received_at`.
- MQTT bridge manages connection, subscribe, and publish with logging.
- Settings/setup store wizard state + MQTT params in Mongo.
- Sensors API exposes CRUD for configured devices/topics.

## Main flows

### Auth
1. Client calls `POST /api/auth/login` with credentials.
2. Backend validates via Mongo, returns a JWT.
3. Subsequent calls include `Authorization: Bearer <token>`.

### Publish from the UI
1. Logged-in user posts a message from the form.
2. Browser sends `POST /api/messages`.
3. Backend verifies JWT, publishes via MQTT (`mqtt.js`), logs to Mongo.
4. Broker delivers to subscribers; log stays for dashboard.

### Inbound MQTT
1. `MQTTBridge` receives a payload on the subscribed topic.
2. Message is normalized and stored in Mongo with direction `inbound`.
3. Frontend fetches latest logs via `GET /api/messages`.

## Security

- JWT (HS256) required for protected routes.
- Mongo and backend are network-local in Compose; only frontend and mongo-express expose ports.
- Secrets live in `.env`; change JWT secret before shipping.

## Future work

- Finer-grained roles/permissions.
- Richer dashboard (filters, charts, real-time view).
- TLS for Nginx/MQTT in non-local environments.
- Wizard improvements (advanced validation, MQTT connectivity test).
