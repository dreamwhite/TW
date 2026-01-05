# MQTT Web Gateway Docs

Documentation hub for the demo stack that bridges HTTP requests and MQTT messages with an Express API, MongoDB logging, and a static Bootstrap dashboard behind Nginx.

## What lives here
- `ARCHITECTURE.md` — containers, modules, and data flow
- `docker-compose.md` — how to run/override the stack with Compose or pnpm scripts
- `mongodb.md` — collections, data location, and inspection tips
- `api.md` — REST endpoints and MQTT bridge behavior

## Project at a glance
- Purpose: translate REST calls into MQTT publish/subscribe traffic, log messages, and manage sensor metadata.
- Components: static UI (`frontend/static`), Express API (`services/api`), MQTT bridge (`services/api/src/mqttBridge.js`), MongoDB + Mongo Express, Nginx proxy.
- Data: stored in Mongo (`data/mongo` bind mount); MQTT broker is external and configured via `.env` or the setup wizard.

## Running the stack
1. Copy env: `cp .env.example .env` and set JWT + broker details.
2. Start locally: `docker compose up --build` (or `pnpm run stack`).
3. Open `http://localhost:8080` → complete `setup.html` → login.

For dev with live-reload UI: `pnpm run dev` (Compose for backend + mongo, `live-server` for the static frontend).

## Repo layout (quick map)
```
frontend/        # Static HTML/CSS/JS + Nginx config
services/api/    # Express API, MQTT bridge, Mongo services
data/mongo/      # Mongo bind mount (ignored by git)
docs/            # You are here
docker-compose.yml
```
