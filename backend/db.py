from pymongo import MongoClient

_client = None


def get_db(app):
    global _client
    if _client is None:
        _client = MongoClient(app.config["MONGO_URI"])
    return _client.get_default_database()
