# Docker Compose

Compose orchestrates the four local services and wires envs from `.env`. Use it for both demo and day-to-day development.

## Services
- **backend** — builds `services/api`, exposes 5001→5000, depends on `mongo`.
- **frontend** — builds `frontend` (Nginx serving `frontend/static`), exposes 8080, proxies `/api` and `/ws` to backend.
- **mongo** — MongoDB 6 with bind mount `./data/mongo` and simple healthcheck.
- **mongo-express** — UI on 8081 with basic auth (admin/admin), points at `mongo`.

## Running
```bash
cp .env.example .env   # edit secrets + MQTT broker
docker compose up --build
```

Alternative scripts (root `package.json`):
- `pnpm run stack` — `docker compose up --build`
- `pnpm run stack:dev` — rebuild + start frontend, backend, mongo
- `pnpm run dev` — Compose for backend+mongo, live-reload frontend via `live-server`

Stop / clean:
```bash
docker compose down               # stop containers
pnpm run clean                    # wipe ./data/mongo bind mount
```

## Ports and networking
- Frontend: `8080`
- Backend: `5001` (internal 5000)
- Mongo: `27017` (internal)
- Mongo Express: `8081`

Mongo is only reachable from other containers unless you intentionally use the published `27017`. Change port mappings in `docker-compose.yml` if clashes occur.

## Environment
- `env_file: .env` attached to backend; see `.env.example` for available keys.
- Mongo service reads `MONGO_INITDB_DATABASE` from env (defaults to `gateway`).
- Broker credentials are not baked into images; update `.env` or re-run setup to switch brokers.

## Volumes and persistence
- Mongo data: `./data/mongo` bind mount. Delete the folder to reset the database.
- No other volumes are used; images can be rebuilt safely with `--build`.

## Healthchecks
- Mongo: simple `ping` via `mongosh`.
- Backend: HTTP GET `http://localhost:5000/api/status/` from inside the container.

If healthchecks fail, Compose keeps dependents in `starting` until healthy or retries are exhausted.
