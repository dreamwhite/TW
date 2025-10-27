from __future__ import annotations

import json
from dataclasses import dataclass
from threading import Lock
from typing import Any, Iterable


class WebSocketHub:
    def __init__(self) -> None:
        self._connections: list[dict[str, Any]] = []
        self._lock = Lock()

    def register(self, socket, user_email: str) -> None:
        with self._lock:
            self._connections.append({"socket": socket, "user_email": user_email})

    def unregister(self, socket) -> None:
        with self._lock:
            self._connections = [
                conn for conn in self._connections if conn["socket"] is not socket
            ]

    def broadcast(self, event: str, payload: dict[str, Any]) -> None:
        message = json.dumps({"type": event, "data": payload})
        stale: list[WebSocketConnection] = []
        for connection in self._snapshot():
            try:
                connection["socket"].send(message)
            except Exception:
                stale.append(connection)
        for connection in stale:
            self.unregister(connection["socket"])

    def _snapshot(self) -> Iterable[dict[str, Any]]:
        with self._lock:
            return list(self._connections)


hub = WebSocketHub()
