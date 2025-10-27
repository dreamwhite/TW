from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..extensions import mongo
from ..services import MessageService

messages_bp = Blueprint("messages", __name__)


def _service() -> MessageService:
    return MessageService(mongo)


@messages_bp.get("/")
@jwt_required()
def list_messages():
    try:
        limit = int(request.args.get("limit", "25"))
    except ValueError:
        limit = 25
    limit = max(1, min(limit, 100))
    items = _service().latest(limit)
    return jsonify({"items": items, "count": len(items)})


@messages_bp.post("/")
@jwt_required()
def publish_message():
    payload = request.get_json(force=True, silent=True) or {}
    message_payload = payload.get("payload")
    topic = payload.get("topic") or current_app.config["MQTT_PUBLISH_TOPIC"]

    if message_payload is None:
        return (
            jsonify({"error": "Missing 'payload' field"}),
            400,
        )

    from ..mqtt.client import mqtt_bridge

    mqtt_bridge.publish(
        topic,
        message_payload,
        meta={"published_by": get_jwt_identity(), "via": "http"},
    )

    return jsonify({"status": "queued", "topic": topic})
