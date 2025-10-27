from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request

from ..services.setup import SetupService


setup_bp = Blueprint("setup", __name__)


@setup_bp.get("/status")
def setup_status():
    status = SetupService().status()
    return jsonify({"configured": status.configured})


@setup_bp.post("/")
def run_setup():
    payload = request.get_json(force=True, silent=True) or {}
    service = SetupService()
    try:
        status = service.apply(payload)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    config = current_app.config
    if payload.get("mqtt_host"):
        config["MQTT_BROKER_HOST"] = payload["mqtt_host"]
    if payload.get("mqtt_port"):
        try:
            config["MQTT_BROKER_PORT"] = int(payload["mqtt_port"])
        except (TypeError, ValueError):
            pass
    if payload.get("mqtt_username"):
        config["MQTT_USERNAME"] = payload["mqtt_username"]
    if payload.get("mqtt_password"):
        config["MQTT_PASSWORD"] = payload["mqtt_password"]

    return jsonify({"configured": status.configured})
