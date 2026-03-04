from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError
from app.config import MONGO_URI, DB_NAME

client = MongoClient(
    MONGO_URI,
    serverSelectionTimeoutMS=5000,
    retryWrites=True
)

try:
    client.server_info()
except ServerSelectionTimeoutError:
    raise RuntimeError("Failed to connect to MongoDB")

db = client[DB_NAME]

epapers = db["epapers"]
articles = db["articles"]
ads = db["ads"]

def init_indexes():
    analytics = db["analytics"]

    for name, info in analytics.index_information().items():
        if info["key"] == [("timestamp", 1)]:
            if info.get("expireAfterSeconds") != 60 * 60 * 24 * 90:
                analytics.drop_index(name)

    analytics.create_index(
        "timestamp",
        expireAfterSeconds=60 * 60 * 24 * 90
    )

    analytics.create_index("event")