import os


class BaseConfig:
    SECRET_KEY = os.getenv("SECRET_KEY", "change-me")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me-too")
    JWT_TOKEN_LOCATION = ["headers"]
    JWT_HEADER_NAME = "Authorization"
    JWT_HEADER_TYPE = "Bearer"
    JWT_ACCESS_TOKEN_EXPIRES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES", "900"))

    MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongo:27017")
    MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "gateway")

    MQTT_BROKER_HOST = os.getenv("MQTT_BROKER_HOST", "mqtt")
    MQTT_BROKER_PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
    MQTT_USERNAME = os.getenv("MQTT_USERNAME")
    MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")
    MQTT_CLIENT_ID = os.getenv("MQTT_CLIENT_ID", "web-gateway")
    MQTT_SUBSCRIBE_TOPIC = os.getenv("MQTT_SUBSCRIBE_TOPIC", "gateway/in/#")
    MQTT_PUBLISH_TOPIC = os.getenv("MQTT_PUBLISH_TOPIC", "gateway/out")
    MQTT_QOS = int(os.getenv("MQTT_QOS", "1"))

    CORS_ALLOWED_ORIGINS = os.getenv("CORS_ALLOWED_ORIGINS", "*").split(",")

    DEFAULT_ADMIN_EMAIL = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@example.com")
    DEFAULT_ADMIN_PASSWORD = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin123")


def get_config(_name: str | None = None) -> type[BaseConfig]:
    return BaseConfig
