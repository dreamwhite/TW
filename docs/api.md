# API and MQTT Bridge

The backend exposes a small REST surface under `/api` and forwards publish/subscribe operations to MQTT. All protected routes require `Authorization: Bearer <JWT>`.

## Auth + setup
- `POST /api/auth/login` — body `{ email, password }`, returns `{ token, user }`.
- `POST /api/setup/complete` — body `{ email, password, mqtt_host?, mqtt_port?, mqtt_username?, mqtt_password?, mqtt_client_id?, mqtt_subscribe_topic?, mqtt_publish_topic?, mqtt_control_topic? }`; creates admin if missing, stores MQTT params in `settings`, marks `configured=true`.
- `GET /api/status/` — health check.
- `GET /api/status/me` — returns current user info (requires JWT).

## Settings (MQTT) — admin only
- `GET /api/settings/mqtt` — returns current MQTT config (merged env + stored): `mqtt_host`, `mqtt_port`, `mqtt_username`, `mqtt_client_id`, `mqtt_subscribe_topic`, `mqtt_publish_topic`, `mqtt_control_topic`, `mqtt_qos`, `has_password`, `configured`.
- `PUT /api/settings/mqtt` — updates MQTT connection and restarts the bridge. Body fields:
  ```json
  {
    "mqtt_host": "mosquitto",
    "mqtt_port": 1883,
    "mqtt_username": "demo",
    "mqtt_password": "secret",         // omit to keep, "" to clear
    "mqtt_client_id": "web-gateway",
    "mqtt_subscribe_topic": "gateway/in/#",
    "mqtt_publish_topic": "gateway/out",
    "mqtt_control_topic": "/threshold",
    "mqtt_qos": 1
  }
  ```
  Host and port are required; QoS must be 0/1/2. Password is not returned in responses.

## Messages
- `GET /api/messages?limit=25` — latest MQTT logs (inbound + outbound), sorted by `received_at` desc; `limit` max 100.
- `POST /api/messages` — publish and log outbound traffic. Body:
  ```json
  {
    "topic": "gateway/out/temperature", // optional; falls back to configured publish topic
    "payload": { "value": 22.5 }
  }
  ```
  Response echoes stored message with parsed and raw payload.

## Sensors
- `GET /api/sensors` — list sensors.
- `POST /api/sensors` — create:
  ```json
  {
    "name": "Office temp",
    "topic": "sensors/office/temperature",
    "unit": "°C",
    "type": "temperature",
    "description": "Indoor probe",
    "threshold": 30,
    "control_topic": "sensors/office/threshold"
  }
  ```
- `PUT /api/sensors/:id` — update any field above.
- `DELETE /api/sensors/:id` — remove sensor.

Sensor changes trigger `syncSensors` in the bridge to refresh subscriptions. If `control_topic` is set and a threshold exists, the bridge can publish control payloads when thresholds change.

## MQTT bridge behavior
- Connects using env or stored settings; supports username/password, custom client ID, QoS.
- Subscribes to:
  - Wildcard from `MQTT_SUBSCRIBE_TOPIC` (optional).
  - Each sensor's `topic` stored in Mongo.
- Logs inbound messages to `messages` with parsed JSON payload and the original raw string.
- Publishes outbound messages from `POST /api/messages` and optional threshold control payloads.

## Error handling
- Invalid credentials → `401`.
- Missing JWT on protected routes → `401`.
- Not found resources → `404`.
- Unexpected errors → `500` with `{ error: "Internal server error" }`.
