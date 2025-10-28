from __future__ import annotations

import json
import logging
from threading import Event, Lock
from typing import Any

import paho.mqtt.client as mqtt

from ..services import MessageService

logger = logging.getLogger(__name__)


class MQTTBridge:
    def __init__(self) -> None:
        self._client: mqtt.Client | None = None
        self._mongo = None
        self._connected = Event()
        self._connect_lock = Lock()
        self._message_service: MessageService | None = None
        self._config: dict[str, Any] | None = None

    def init_app(self, app, mongo) -> None:
        with self._connect_lock:
            if self._client:
                return

            self._mongo = mongo
            self._config = app.config
            self._message_service = MessageService(mongo)

            self._client = mqtt.Client(client_id=app.config["MQTT_CLIENT_ID"])
            username = app.config.get("MQTT_USERNAME")
            password = app.config.get("MQTT_PASSWORD")
            if username and password:
                self._client.username_pw_set(username=username, password=password)

            self._client.on_connect = self._on_connect
            self._client.on_message = self._on_message
            self._client.on_disconnect = self._on_disconnect

            try:
                self._client.connect(
                    app.config["MQTT_BROKER_HOST"],
                    app.config["MQTT_BROKER_PORT"],
                    keepalive=60,
                )
                self._client.loop_start()
            except Exception as exc:  # pragma: no cover - connection errors surfaced at runtime
                logger.exception("Could not connect to MQTT broker: %s", exc)

    def publish(
        self,
        topic: str,
        payload: Any,
        *,
        meta: dict[str, Any] | None = None,
        direction: str = "outbound",
    ) -> None:
        if not self._client:
            raise RuntimeError("MQTT client not initialized")
        qos = (self._config or {}).get("MQTT_QOS", 1)
        if isinstance(payload, (dict, list)):
            payload_to_send = json.dumps(payload)
        else:
            payload_to_send = str(payload)

        self._client.publish(topic, payload_to_send, qos=qos)
        if self._message_service:
            self._message_service.log_message(
                direction=direction,
                topic=topic,
                payload=payload_to_send,
                meta=meta,
            )

    # pylint: disable=unused-argument
    def _on_connect(self, client, userdata, flags, rc):  # pragma: no cover
        if rc == 0:
            self._connected.set()
            topic = self._config["MQTT_SUBSCRIBE_TOPIC"]
            qos = self._config.get("MQTT_QOS", 1)
            client.subscribe(topic, qos=qos)
            logger.info("Connected to MQTT broker, subscribed to %s", topic)
        else:
            logger.error("Failed to connect to MQTT broker. RC=%s", rc)

    def _on_disconnect(self, _client, _userdata, rc):  # pragma: no cover
        self._connected.clear()
        if rc != 0:
            logger.warning("Unexpected MQTT disconnection. Code=%s", rc)

    def _on_message(self, _client, _userdata, msg):  # pragma: no cover
        payload = msg.payload.decode("utf-8")
        if self._message_service:
            stored = self._message_service.log_message(
                direction="inbound",
                topic=msg.topic,
                payload=payload,
                meta={"qos": msg.qos},
            )
        else:
            stored = {
                "direction": "inbound",
                "topic": msg.topic,
                "payload": payload,
                "raw_payload": payload,
            }

        logger.debug("MQTT message received: topic=%s", msg.topic)


mqtt_bridge = MQTTBridge()
