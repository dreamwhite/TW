from flask_jwt_extended import JWTManager
from flask_sock import Sock


class Mongo:
    """Minimal MongoDB helper that works inside and outside request contexts."""

    def __init__(self) -> None:
        self.client = None
        self.db = None

    def init_app(self, app) -> None:
        from pymongo import MongoClient

        uri = app.config["MONGO_URI"]
        db_name = app.config["MONGO_DB_NAME"]
        self.client = MongoClient(uri, tz_aware=True)
        self.db = self.client[db_name]

    def get_collection(self, name: str):
        if self.db is None:
            raise RuntimeError("Mongo client not initialized")
        return self.db[name]


mongo = Mongo()
jwt = JWTManager()
sock = Sock()
