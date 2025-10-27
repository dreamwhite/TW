from __future__ import annotations

from dataclasses import dataclass

from ..extensions import mongo
from ..models import SettingsRepository, UserRepository


@dataclass
class SetupStatus:
    configured: bool


class SetupService:
    def __init__(
        self,
        *,
        settings_repo: SettingsRepository | None = None,
        user_repo: UserRepository | None = None,
    ) -> None:
        self.settings_repo = settings_repo or SettingsRepository(mongo)
        self.user_repo = user_repo or UserRepository(mongo)

    def status(self) -> SetupStatus:
        settings = self.settings_repo.fetch()
        return SetupStatus(configured=settings.configured and self.user_repo.has_users())

    def apply(self, payload: dict) -> SetupStatus:
        mqtt_host = payload.get("mqtt_host")
        mqtt_port = payload.get("mqtt_port")
        mqtt_username = payload.get("mqtt_username")
        mqtt_password = payload.get("mqtt_password")
        admin_email = (payload.get("admin_email") or "").strip().lower()
        admin_password = payload.get("admin_password") or ""

        if not admin_email or not admin_password:
            raise ValueError("Email e password amministratore sono obbligatorie")

        mqtt_config = {}
        if mqtt_host:
            mqtt_config["MQTT_BROKER_HOST"] = mqtt_host
        if mqtt_port:
            mqtt_config["MQTT_BROKER_PORT"] = int(mqtt_port)
        if mqtt_username:
            mqtt_config["MQTT_USERNAME"] = mqtt_username
        if mqtt_password:
            mqtt_config["MQTT_PASSWORD"] = mqtt_password

        settings_payload = {
            "configured": True,
            "mqtt_host": mqtt_config.get("MQTT_BROKER_HOST"),
            "mqtt_port": mqtt_config.get("MQTT_BROKER_PORT"),
            "mqtt_username": mqtt_config.get("MQTT_USERNAME"),
        }

        self.settings_repo.upsert(settings_payload)

        existing = self.user_repo.find_by_email(admin_email)
        if existing:
            # Aggiorna solo le impostazioni, l'utente esiste già
            pass
        else:
            self.user_repo.create_user(email=admin_email, password=admin_password, roles=["admin"])

        return SetupStatus(configured=True)
