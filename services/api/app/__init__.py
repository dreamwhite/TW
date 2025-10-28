from flask import Flask
from flask_cors import CORS

from .auth.routes import auth_bp
from .config import get_config
from .extensions import jwt, mongo, sock
from .models import SettingsRepository
from .mqtt.client import mqtt_bridge
from .routes.status import status_bp
from .routes.messages import messages_bp
from .routes.setup import setup_bp
from .routes.sensors import sensors_bp
from .websocket import hub, register_websocket_routes


def create_app(config_name: str | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(get_config(config_name))

    CORS(
        app,
        origins=app.config["CORS_ALLOWED_ORIGINS"],
        supports_credentials=True,
    )

    mongo.init_app(app)
    jwt.init_app(app)
    sock.init_app(app)

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(status_bp, url_prefix="/api/status")
    app.register_blueprint(messages_bp, url_prefix="/api/messages")
    app.register_blueprint(sensors_bp, url_prefix="/api/sensors")
    app.register_blueprint(setup_bp, url_prefix="/api/setup")

    register_websocket_routes(sock)
    mqtt_bridge.init_app(app, mongo)
    mqtt_bridge.attach_broadcaster(hub.broadcast)

    with app.app_context():
        settings = SettingsRepository(mongo).fetch()
        if settings.mqtt_host:
            app.config["MQTT_BROKER_HOST"] = settings.mqtt_host
        if settings.mqtt_port:
            app.config["MQTT_BROKER_PORT"] = settings.mqtt_port
        if settings.mqtt_username:
            app.config["MQTT_USERNAME"] = settings.mqtt_username

        if settings.mqtt_client_id:
            app.config["MQTT_CLIENT_ID"] = settings.mqtt_client_id

    return app


__all__ = ["create_app"]
