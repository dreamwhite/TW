# MongoDB Guide

MongoDB stores users, MQTT message logs, sensor metadata, and setup state. It runs in the `mongo` service with a bind mount so data survives container restarts.

## Connection
- Default URI (backend): `mongodb://mongo:27017`
- Default DB name: `gateway`
- Bind mount: `./data/mongo` (safe to delete for a clean slate)
- Healthcheck: `mongosh --quiet --eval 'db.runCommand({ ping: 1 })'`

From your host you can connect with the published port:
```bash
mongosh "mongodb://localhost:27017/gateway"
```

## Collections and documents

`users` (unique index on `email`)
- Shape: `_id` (ObjectId), `email` (lowercase, unique), `password_hash` (bcrypt), `roles` (array, default `["user"]` or `["admin"]`), `created_at` (Date).
- Creation: on first boot, if DB is empty, `ensureDefaultAdmin` seeds an admin using `.env` (`DEFAULT_ADMIN_EMAIL`/`DEFAULT_ADMIN_PASSWORD`). The setup wizard also creates the admin if missing.

`settings` (singleton, `_id: "global"`)
- Shape: `_id` (string `"global"`), `configured` (bool), `mqtt_host`, `mqtt_port` (number), `mqtt_username`, `mqtt_password`, `mqtt_client_id`, `mqtt_subscribe_topic`, `mqtt_publish_topic`, `mqtt_control_topic`, `mqtt_qos`.
- Lifecycle: `ensureSetupDocument` creates `{ configured: false }` if absent. The setup wizard seeds host/port/creds/client_id; the Settings page/API (`PUT /api/settings/mqtt`) can update host/port/user/pass, topics, QoS, and marks `configured=true`. Stored values override env defaults and are applied on every boot/reconnect. In Compose the default `.env.example` broker host points to the local `mosquitto` service; change it if you use an external broker.

`sensors` (unique index on `topic`)
- Shape: `_id` (ObjectId), `name`, `topic` (unique), `unit`, `icon`, `type`, `description`, `threshold` (number or null), `control_topic` (string or null), `created_at` (Date), `updated_at` (Date).
- Behavior: CRUD via `/api/sensors`; thresholds are coerced to numbers when provided. `control_topic` is used for threshold control messages; if absent the bridge falls back to `MQTT_CONTROL_TOPIC` from env. Subscriptions auto-refresh after each change.

`messages` (index on `received_at`)
- Shape: `_id` (ObjectId), `direction` (`"inbound"`/`"outbound"`), `topic`, `payload` (parsed JSON if possible; otherwise raw string/number), `raw_payload` (original string), `meta` (optional object), `received_at` (Date).
- Producers:
  - Inbound MQTT: meta includes `{ qos }` from the bridge.
  - Outbound via REST: meta includes `{ published_by: <email>, via: "http" }`.
  - Threshold/control publishes reuse `publish()` and log like any outbound message (meta may be empty).
- Queries: `/api/messages` sorts by `received_at` desc; `GET /api/sensors/:id/values` filters by sensor topic.

Indexes created at startup (`ensureIndexes` in `db.js`):
- `users.email` unique
- `sensors.topic` unique
- `messages.received_at` descending
No TTL/pruning is applied; message logs grow until you delete or rotate them.

## Seeding and defaults
- On first boot, if no users exist, the backend creates an admin from `.env` (`DEFAULT_ADMIN_EMAIL`/`DEFAULT_ADMIN_PASSWORD`).
- The setup wizard writes MQTT parameters into `settings` and sets `configured=true`.

## Inspection options
- **Mongo Express**: http://localhost:8081 (basic auth `admin/admin`).
- **CLI**: `mongosh mongodb://localhost:27017/gateway`.
- **Direct container**: `docker compose exec mongo mongosh`.

## Resetting data
- Remove the bind mount: `pnpm run clean` (or `rm -rf data/mongo && mkdir -p data/mongo`).
- After wiping, re-run the setup wizard to configure admin + MQTT params.

## Tips
- If the wizard keeps reappearing, check that `settings.configured` exists; wipe `data/mongo` if needed.
- When changing brokers, you can either edit `.env` and restart or re-run the wizard to persist new MQTT settings.
