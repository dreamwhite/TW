from __future__ import annotations

from typing import Any

from flask import current_app, request
from flask_jwt_extended import decode_token
from flask_socketio import disconnect, emit, session

def register_socketio_events(socketio, mongo, mqtt_bridge) -> None:
    @socketio.on("connect")
    def handle_connect(auth):
        token = None
        if isinstance(auth, dict):
            token = auth.get("token")
        if not token:
            token = request.args.get("token")
        if not token:
            raise ConnectionRefusedError("missing token")  # pragma: no cover
        try:
            decoded = decode_token(token)
        except Exception as exc:  # pragma: no cover
            raise ConnectionRefusedError("invalid token") from exc
        session["user_email"] = decoded["sub"]
        emit("connected", {"user": decoded["sub"]})

    @socketio.on("publish")
    def handle_publish(data: dict[str, Any]):
        user_email = session.get("user_email")
        if not user_email:
            disconnect()
            return

        topic = data.get("topic") or current_app.config["MQTT_PUBLISH_TOPIC"]
        payload = data.get("payload")
        if payload is None:
            emit("error", {"error": "missing payload"})
            return

        mqtt_bridge.publish(
            topic,
            payload,
            meta={"via": "websocket", "published_by": user_email},
        )
        emit(
            "publish_ack",
            {"status": "queued", "topic": topic},
        )

    @socketio.on("disconnect")
    def handle_disconnect():  # pragma: no cover - logging placeholder
        session.pop("user_email", None)
