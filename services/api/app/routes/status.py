from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

status_bp = Blueprint("status", __name__)


@status_bp.get("/")
def healthcheck():
    return jsonify({"status": "ok"})


@status_bp.get("/me")
@jwt_required()
def current_user():
    identity = get_jwt_identity()
    return jsonify({"user": identity})

