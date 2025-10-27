from __future__ import annotations

import json

from flask import current_app, request
from flask_jwt_extended import decode_token
from flask_sock import Sock

from ..mqtt.client import mqtt_bridge
from .hub import hub


def register_websocket_routes(sock: Sock) -> None:
    @sock.route("/ws")
    def websocket_connection(ws):  # pragma: no cover - exercised through runtime
        token = request.args.get("token")
        if not token:
            ws.close()
            return
        try:
            decoded = decode_token(token)
        except Exception:
            ws.close()
            return

        user_email = decoded["sub"]
        hub.register(ws, user_email)
        ws.send(json.dumps({"type": "connected", "data": {"user": user_email}}))

        try:
            while True:
                message = ws.receive()
                if message is None:
                    break
                try:
                    payload = json.loads(message)
                except json.JSONDecodeError:
                    ws.send(json.dumps({"type": "error", "data": {"message": "Invalid JSON"}}))
                    continue

                action = payload.get("action", "publish")
                topic = payload.get("topic") or current_app.config["MQTT_PUBLISH_TOPIC"]
                body = payload.get("payload")
                if action != "publish" or body is None:
                    ws.send(
                        json.dumps(
                            {
                                "type": "error",
                                "data": {"message": "Missing payload or unsupported action"},
                            }
                        )
                    )
                    continue

                mqtt_bridge.publish(
                    topic,
                    body,
                    meta={"via": "websocket", "published_by": user_email},
                )
                ws.send(
                    json.dumps(
                        {
                            "type": "publish_ack",
                            "data": {"topic": topic, "user": user_email},
                        }
                    )
                )
        finally:
            hub.unregister(ws)
            ws.close()
