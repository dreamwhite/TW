from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any


class MessageService:
    def __init__(self, mongo) -> None:
        self._mongo = mongo
        self._collection = mongo.get_collection("messages")
        self._ensure_indexes()

    def _ensure_indexes(self) -> None:
        self._collection.create_index("received_at")

    def log_message(
        self,
        *,
        direction: str,
        topic: str,
        payload: str,
        meta: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        document = {
            "direction": direction,
            "topic": topic,
            "payload": self._parse_payload(payload),
            "raw_payload": payload,
            "received_at": datetime.now(timezone.utc),
        }
        if meta:
            document["meta"] = meta

        self._collection.insert_one(document)
        return self._normalize(document)

    def latest(self, limit: int = 50) -> list[dict[str, Any]]:
        cursor = (
            self._collection.find()
            .sort("received_at", -1)
            .limit(limit)
        )
        return [self._normalize(doc) for doc in cursor]

    def _parse_payload(self, payload: str) -> Any:
        try:
            return json.loads(payload)
        except (TypeError, json.JSONDecodeError):
            return payload

    def _normalize(self, doc: dict[str, Any]) -> dict[str, Any]:
        normalized = {
            "direction": doc["direction"],
            "topic": doc["topic"],
            "payload": doc.get("payload"),
            "raw_payload": doc.get("raw_payload"),
            "received_at": doc["received_at"].isoformat(),
        }
        if "meta" in doc:
            normalized["meta"] = doc["meta"]
        return normalized

