from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId


@dataclass
class Sensor:
    id: str
    name: str
    topic: str
    unit: str | None
    icon: str | None
    type: str | None
    description: str | None
    threshold: float | None
    demo: bool
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_document(cls, document: dict[str, Any]) -> "Sensor":
        return cls(
            id=str(document["_id"]),
            name=document.get("name", ""),
            topic=document.get("topic", ""),
            unit=document.get("unit"),
            icon=document.get("icon"),
            type=document.get("type"),
            description=document.get("description"),
            threshold=document.get("threshold"),
            demo=document.get("demo", False),
            created_at=document.get("created_at", datetime.now(timezone.utc)),
            updated_at=document.get("updated_at", datetime.now(timezone.utc)),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "topic": self.topic,
            "unit": self.unit,
            "icon": self.icon,
            "type": self.type,
            "description": self.description,
            "threshold": self.threshold,
            "demo": self.demo,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class SensorRepository:
    COLLECTION = "sensors"

    def __init__(self, mongo) -> None:
        self._collection = mongo.get_collection(self.COLLECTION)
        self._collection.create_index("topic", unique=True)

    def list_all(self) -> list[Sensor]:
        cursor = self._collection.find().sort("created_at", -1)
        return [Sensor.from_document(doc) for doc in cursor]

    def create(self, payload: dict[str, Any]) -> Sensor:
        now = datetime.now(timezone.utc)
        document = {
            "name": payload["name"].strip(),
            "topic": payload["topic"].strip(),
            "unit": payload.get("unit"),
            "icon": payload.get("icon"),
            "type": payload.get("type"),
            "description": payload.get("description"),
            "threshold": payload.get("threshold"),
            "demo": bool(payload.get("demo", False)),
            "created_at": now,
            "updated_at": now,
        }
        result = self._collection.insert_one(document)
        document["_id"] = result.inserted_id
        return Sensor.from_document(document)

    def update(self, sensor_id: str, payload: dict[str, Any]) -> Sensor | None:
        try:
            object_id = ObjectId(sensor_id)
        except (TypeError, ValueError):
            return None

        update_doc: dict[str, Any] = {
            "updated_at": datetime.now(timezone.utc),
        }
        for key in ("name", "topic", "unit", "icon", "type", "description", "threshold", "demo"):
            if key in payload:
                update_doc[key] = payload[key]

        result = self._collection.update_one({"_id": object_id}, {"$set": update_doc})
        if result.matched_count == 0:
            return None
        document = self._collection.find_one({"_id": object_id})
        return Sensor.from_document(document)

    def delete(self, sensor_id: str) -> bool:
        try:
            object_id = ObjectId(sensor_id)
        except (TypeError, ValueError):
            return False
        result = self._collection.delete_one({"_id": object_id})
        return result.deleted_count > 0

    def get(self, sensor_id: str) -> Sensor | None:
        try:
            object_id = ObjectId(sensor_id)
        except (TypeError, ValueError):
            return None
        document = self._collection.find_one({"_id": object_id})
        return Sensor.from_document(document) if document else None
