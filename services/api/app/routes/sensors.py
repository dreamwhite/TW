from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..extensions import mongo
from ..models import SensorRepository


sensors_bp = Blueprint("sensors", __name__)


def _repository() -> SensorRepository:
    return SensorRepository(mongo)


@sensors_bp.get("/")
@jwt_required()
def list_sensors():
    items = [sensor.to_dict() for sensor in _repository().list_all()]
    return jsonify({"items": items})


@sensors_bp.post("/")
@jwt_required()
def create_sensor():
    payload = request.get_json(force=True, silent=True) or {}
    errors = _validate_payload(payload, creating=True)
    if errors:
        return jsonify({"errors": errors}), 400

    try:
        sensor = _repository().create(payload)
    except Exception as exc:  # pragma: no cover - surfaced to client
        return jsonify({"error": str(exc)}), 400

    return jsonify(sensor.to_dict()), 201


@sensors_bp.put("/<sensor_id>")
@jwt_required()
def update_sensor(sensor_id: str):
    payload = request.get_json(force=True, silent=True) or {}
    errors = _validate_payload(payload, creating=False)
    if errors:
        return jsonify({"errors": errors}), 400

    sensor = _repository().update(sensor_id, payload)
    if not sensor:
        return jsonify({"error": "Sensore non trovato"}), 404
    return jsonify(sensor.to_dict())


@sensors_bp.delete("/<sensor_id>")
@jwt_required()
def delete_sensor(sensor_id: str):
    deleted = _repository().delete(sensor_id)
    if not deleted:
        return jsonify({"error": "Sensore non trovato"}), 404
    return jsonify({"status": "deleted"})


def _validate_payload(payload: dict, creating: bool) -> dict[str, str]:
    errors: dict[str, str] = {}

    if creating:
        if not payload.get("name"):
            errors["name"] = "Il nome è obbligatorio"
        if not payload.get("topic"):
            errors["topic"] = "Il topic MQTT è obbligatorio"
    else:
        if "name" in payload and not payload.get("name"):
            errors["name"] = "Il nome non può essere vuoto"
        if "topic" in payload and not payload.get("topic"):
            errors["topic"] = "Il topic non può essere vuoto"

    if "threshold" in payload:
        try:
            if payload["threshold"] is not None:
                payload["threshold"] = float(payload["threshold"])
        except (TypeError, ValueError):
            errors["threshold"] = "La soglia deve essere numerica"

    return errors
