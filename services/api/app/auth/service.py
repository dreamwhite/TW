from __future__ import annotations

from dataclasses import asdict
from typing import Any

from flask_jwt_extended import create_access_token

from ..extensions import mongo
from ..models import User, UserRepository


class AuthService:
    def __init__(self, repository: UserRepository | None = None) -> None:
        self.repository = repository or UserRepository(mongo)

    def authenticate(self, email: str, password: str) -> User | None:
        user = self.repository.find_by_email(email)
        if not user or not user.verify_password(password):
            return None
        return user

    def issue_token(self, user: User) -> str:
        return create_access_token(
            identity=user.email,
            additional_claims={"roles": user.roles},
        )

    def register_user(self, *, email: str, password: str, roles: list[str] | None = None) -> User:
        from pymongo.errors import DuplicateKeyError

        try:
            return self.repository.create_user(email=email, password=password, roles=roles)
        except DuplicateKeyError as exc:
            raise ValueError("User already exists") from exc

    def ensure_default_user(self, *, email: str, password: str) -> dict[str, Any]:
        user = self.repository.find_by_email(email)
        if user:
            return {"created": False, "email": user.email}
        user = self.register_user(email=email, password=password, roles=["admin"])
        return {"created": True, "email": user.email, "roles": user.roles}
