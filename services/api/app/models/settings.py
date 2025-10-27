from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class Settings:
    configured: bool
    mqtt_host: str | None = None
    mqtt_port: int | None = None
    mqtt_username: str | None = None
    mqtt_client_id: str | None = None


class SettingsRepository:
    COLLECTION = "settings"
    DOCUMENT_ID = "global"

    def __init__(self, mongo) -> None:
        self._collection = mongo.get_collection(self.COLLECTION)

    def fetch(self) -> Settings:
        doc = self._collection.find_one({"_id": self.DOCUMENT_ID})
        if not doc:
            return Settings(configured=False)
        return Settings(
            configured=doc.get("configured", False),
            mqtt_host=doc.get("mqtt_host"),
            mqtt_port=doc.get("mqtt_port"),
            mqtt_username=doc.get("mqtt_username"),
            mqtt_client_id=doc.get("mqtt_client_id"),
        )

    def upsert(self, payload: dict[str, Any]) -> Settings:
        payload_to_store = {
            "configured": payload.get("configured", False),
            "mqtt_host": payload.get("mqtt_host"),
            "mqtt_port": payload.get("mqtt_port"),
            "mqtt_username": payload.get("mqtt_username"),
            "mqtt_client_id": payload.get("mqtt_client_id"),
        }
        payload_to_store = {k: v for k, v in payload_to_store.items() if v is not None}
        self._collection.update_one(
            {"_id": self.DOCUMENT_ID},
            {"$set": payload_to_store},
            upsert=True,
        )
        return self.fetch()
