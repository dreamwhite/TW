from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    get_jwt,
    get_jwt_identity,
    jwt_required,
)

from .service import AuthService

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/login")
def login():
    payload = request.get_json(force=True, silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Missing credentials"}), 400

    service = AuthService()
    user = service.authenticate(email, password)
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401

    token = service.issue_token(user)
    return jsonify({"access_token": token, "email": user.email, "roles": user.roles})


@auth_bp.post("/register")
@jwt_required()
def register_user():
    claims = get_jwt()
    roles = claims.get("roles", [])
    if "admin" not in roles:
        return jsonify({"error": "Admin role required"}), 403

    payload = request.get_json(force=True, silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    role_list = payload.get("roles") or ["user"]

    if not email or not password:
        return jsonify({"error": "Missing email or password"}), 400

    service = AuthService()
    try:
        user = service.register_user(email=email, password=password, roles=role_list)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    return (
        jsonify(
            {
                "email": user.email,
                "roles": user.roles,
            }
        ),
        201,
    )


@auth_bp.get("/me")
@jwt_required()
def me():
    return jsonify({"email": get_jwt_identity(), "claims": get_jwt()})
