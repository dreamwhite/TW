# MQTT Web Gateway

Tiny web dashboard and REST gateway that translates HTTP calls into MQTT messages (and logs inbound traffic). Built for course work, kept intentionally simple (Express + Mongo + vanilla JS).

## Features

- JWT-protected REST API (login, sensors CRUD, message publish/logs)
- MQTT bridge (subscribe + publish) with MongoDB logging
- Bootstrap-based dashboard served by Nginx
- Docker Compose stack with Mongo + Mongo Express for quick inspection
- pnpm scripts to run the full stack or wipe local data

## Tech Stack

- Backend: Node.js (Express), MongoDB, JWT, mqtt.js
- Frontend: Static HTML/JS/CSS (Bootstrap 5) served via Nginx
- Infra: Docker + Docker Compose; external MQTT broker required

## Project Layout

```
frontend/           # Static UI + Nginx config
services/api/       # Express API, MQTT bridge, Mongo services
data/mongo/         # Bind mount for Mongo data (ignored by git)
docker-compose.yml  # Orchestration for frontend, backend, mongo, mongo-express
package.json        # Root pnpm scripts (stack, clean, etc.)
docs/               # Architecture notes
```

## Services & Ports (defaults)

- Frontend + proxy: http://localhost:8080
- Backend direct: http://localhost:5001 (maps to 5000 in container)
- MongoDB: mongodb://localhost:27017 (data in `data/mongo`)
- Mongo Express: http://localhost:8081 (basic auth admin/admin)

## Quick Start (Docker Compose)

1) Copy env:
```
cp .env.example .env
```
Fill in MQTT host/creds and change the JWT secret.

2) Start everything:
```
pnpm run stack
```
or
```
docker compose up --build
```

3) Open the setup wizard: http://localhost:8080/setup.html  
Create the admin user and (optionally) set MQTT params. The backend marks setup as done and the MQTT bridge starts with those values.

Useful scripts (root):
- `pnpm run stack:dev` — frontend + backend + mongo with rebuild
- `pnpm run clean` — wipe `data/mongo` to start fresh
- Backend only (no Docker): `cd services/api && pnpm install && pnpm run local`

## API Cheatsheet

- `POST /api/auth/login` → returns JWT
- `GET /api/status/` → health check
- `GET /api/status/me` → current user (JWT)
- `GET /api/messages?limit=25` → latest MQTT logs
- `POST /api/messages` → publish `{ topic?, payload }` via MQTT
- `GET /api/sensors` → list sensors
- `POST /api/sensors` → create sensor
- `PUT /api/sensors/:id` → update sensor
- `DELETE /api/sensors/:id` → delete sensor

Data model (Mongo collections):
- `users` (email, password_hash, roles, created_at)
- `sensors` (name, topic, unit, icon, type, description, threshold, timestamps)
- `messages` (direction, topic, payload/raw_payload, meta, received_at)
- `settings` (configured flag + MQTT params)

## Notes

- Default admin is auto-created from env if no users exist.
- MQTT broker is external; set host/port/user/pass via env or setup wizard.
- Mongo data lives in `data/mongo` (bind mount, gitignored).

## Student

- Ivan Cafiero — matricola `0124003383`
