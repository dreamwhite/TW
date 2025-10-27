from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from werkzeug.security import check_password_hash, generate_password_hash


@dataclass
class User:
    email: str
    password_hash: str
    roles: list[str]
    created_at: datetime

    @classmethod
    def from_document(cls, doc: dict[str, Any]) -> "User":
        return cls(
            email=doc["email"],
            password_hash=doc["password_hash"],
            roles=doc.get("roles", []),
            created_at=doc.get("created_at", datetime.now(timezone.utc)),
        )

    def verify_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)


class UserRepository:
    COLLECTION = "users"

    def __init__(self, mongo) -> None:
        self._collection = mongo.get_collection(self.COLLECTION)
        self._collection.create_index("email", unique=True)

    def find_by_email(self, email: str) -> User | None:
        doc = self._collection.find_one({"email": email.lower()})
        return User.from_document(doc) if doc else None

    def create_user(self, *, email: str, password: str, roles: list[str] | None = None) -> User:
        document = {
            "email": email.lower(),
            "password_hash": generate_password_hash(password),
            "roles": roles or ["user"],
            "created_at": datetime.now(timezone.utc),
        }
        self._collection.insert_one(document)
        return User.from_document(document)

    def has_users(self) -> bool:
        return self._collection.count_documents({}) > 0
