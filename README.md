# MQTT Web Gateway — Demo Stack

Web demo that bridges HTTP and MQTT with a tiny dashboard. The stack pairs an Express API with MongoDB for auth/logging, a static Bootstrap UI served by Nginx, and a simple MQTT bridge that publishes/subscribes using your broker.

Important: this is a coursework/demo project. The MQTT broker is external and must be provided by you.

---

## TL;DR — Quick Start

```bash
cp .env.example .env          # set secrets + MQTT broker details
docker compose up --build
```

- Site: http://localhost:8080
- API health: http://localhost:5001/api/status/
- Mongo Express (UI): http://localhost:8081 (admin/admin)

---

## Scope (real vs optional)

| Feature | State | Notes |
|---|---|---|
| REST API + JWT auth | Real | Session is JWT-based; defaults come from `.env` or wizard |
| MQTT bridge (pub/sub) | Real | Uses mqtt.js; broker config saved in Mongo after setup |
| Dashboard (Bootstrap) | Real | Static pages served by Nginx; proxies `/api` to backend |
| Setup wizard | Real | Creates admin + MQTT params; required on first boot if no users |
| Threshold control topic | Optional | Publishes control payloads when sensors define `control_topic` |
| Seed data | Simulated | Mongo starts empty; default admin can be auto-created from env |

---

## Index
1. [Architecture](#architecture)
2. [Technologies](#technologies)
3. [Main Flow](#main-flow)
4. [Requirements](#requirements)
5. [Quick Start (Docker)](#quick-start-docker)
6. [Services and Ports](#services-and-ports)
7. [Mongo Express Credentials](#mongo-express-credentials)
8. [Environment Config (.env)](#environment-config-env)
9. [MQTT + Sensors](#mqtt--sensors)
10. [API (summary)](#api-summary)
11. [Data Model](#data-model)
12. [Reset database](#reset-database)
13. [Troubleshooting](#troubleshooting)
14. [Notes](#notes)

---

## Architecture

**Main components**
- **Frontend**: static pages in `frontend/static/` (Bootstrap UI, setup wizard, dashboard)
- **API**: Node/Express server in `services/api` (`/api` prefix everywhere)
- **MQTT bridge**: `services/api/src/mqttBridge.js` (publish/subscribe + logging + autosubscribe sensors)
- **Database**: MongoDB with Mongo Express UI (`data/mongo` bind mount)
- **Reverse proxy**: Nginx serves the static UI and proxies `/api` and `/ws`

**Why Mongo + MQTT?**
- **MongoDB** persists users, sensors, settings, and message logs.
- **MQTT** is the external broker you point the bridge to; the app just translates HTTP to MQTT and stores traffic for inspection.

---

## Technologies

- **Backend**: Node.js, Express, MongoDB driver, JWT, mqtt.js, bcryptjs, morgan, CORS
- **Frontend**: Static HTML/CSS/JS (Bootstrap 5), vanilla JS fetch calls
- **Infra**: Docker + Docker Compose; optional pnpm dev scripts for hot-reload UI

---

## Main Flow

### 1) Setup + Auth
1. Visit `setup.html` on first run to create the admin and save MQTT params.
2. Login stores the JWT client-side; protected endpoints expect `Authorization: Bearer <token>`.

### 2) Publish from the dashboard
1. User posts via the UI or `POST /api/messages` with `{ topic?, payload }`.
2. API publishes to MQTT (`mqtt.js`) and logs the outbound message in Mongo.

### 3) Inbound MQTT → Logs
1. Bridge subscribes to sensor topics (and optional wildcard).
2. Each inbound payload is stored in `messages` with `direction: inbound`.
3. UI fetches `GET /api/messages?limit=25` to show recent traffic.

### 4) Sensors CRUD
- UI uses `/api/sensors` endpoints to manage topics, thresholds, units, etc.
- If a sensor has `control_topic`, the bridge can publish threshold control messages.

---

## Requirements

- Docker + Docker Compose
- External MQTT broker reachable from the stack
- (Optional) Node.js + pnpm for local dev without Docker

---

## Quick Start (Docker)

1. Copy env and set secrets/broker:
   ```bash
   cp .env.example .env
   ```
2. Start the stack:
   ```bash
   docker compose up --build
   ```
   or
   ```bash
   pnpm run stack
   ```
3. Open http://localhost:8080 and complete the setup wizard (admin + MQTT).
4. Login and start publishing/monitoring messages.

---

## Services and Ports

| Service | Tech | Port |
|---|---|---:|
| frontend | Nginx (static UI + proxy) | 8080 |
| backend | Node/Express API | 5001 (maps to 5000 in container) |
| mongo | MongoDB | 27017 |
| mongo-express | Mongo UI | 8081 |
| mosquitto (optional) | MQTT broker | 1883 |

---

## Mongo Express Credentials

- Username: `admin`
- Password: `admin`

(Dev/demo only; change if you expose it.)

---

## Environment Config (.env)

Frontend is static; backend and bridge read env vars (see `.env.example`).

Key settings:
- `JWT_SECRET_KEY` / `JWT_ACCESS_TOKEN_EXPIRES` — auth
- `MONGO_URI`, `MONGO_DB_NAME` — database
- `MQTT_*` — broker host/port/creds/topics/QoS
- `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD` — auto-create admin if DB is empty
- `CORS_ALLOWED_ORIGINS` — allowed origins for the API
- `MQTT_BROKER_HOST`, `MQTT_BROKER_PORT` — point to your broker (default `mosquitto` in Compose)

---

## MQTT + Sensors

- Default publish topic: `MQTT_PUBLISH_TOPIC` (fallback `gateway/out`).
- Default subscribe wildcard: optional `MQTT_SUBSCRIBE_TOPIC`; per-sensor topics auto-subscribed from Mongo.
- Sensors support optional `threshold` and `control_topic` to push control messages when thresholds change.
- To change broker host/port/creds after the wizard, use `/settings.html` (admin) which updates the `settings` collection and restarts the bridge.

---

## API (summary)

- `POST /api/auth/login` → returns JWT
- `GET /api/status/` → health check
- `GET /api/status/me` → current user (JWT)
- `GET /api/messages?limit=25` → latest MQTT logs
- `POST /api/messages` → publish `{ topic?, payload }`
- `GET /api/sensors` → list sensors
- `POST /api/sensors` → create sensor
- `PUT /api/sensors/:id` → update sensor
- `DELETE /api/sensors/:id` → delete sensor
- `POST /api/setup/complete` → mark setup done + persist MQTT params

---

## Data Model

- `users` — email, password hash, roles, timestamps
- `settings` — `configured` flag + MQTT params from the wizard
- `sensors` — name, topic, unit, type, description, threshold, control topic, timestamps
- `messages` — direction (`inbound`/`outbound`), topic, parsed + raw payload, metadata, `received_at`

---

## Reset database

- Docker volume/bind lives in `data/mongo`.
- Wipe data:
  ```bash
  pnpm run clean
  ```
  or remove the bind mount:
  ```bash
  rm -rf data/mongo && mkdir -p data/mongo
  ```

---

## Troubleshooting

- **MQTT not connecting** → check broker host/port/creds in `.env` or redo setup.
- **No logs shown** → ensure subscribe topic covers your sensor topics; confirm Mongo is healthy.
- **Ports busy** → adjust `docker-compose.yml` or stop local services on 8080/8081/5001/27017.
- **Wizard keeps showing** → Mongo volume already had data; remove `data/mongo` or call setup endpoint.

---

## Notes

- Default admin is auto-created from env only if no users exist.
- Mongo bind mount is gitignored (`data/mongo`).
- For dev without Docker: `pnpm run dev` spins up backend + Mongo via Compose and live-reloads the UI via `live-server`.

## Student

- Ivan Cafiero — matricola `0124003383`
