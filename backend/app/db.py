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

    analytics.create_index("timestamp", expireAfterSeconds=60 * 60 * 24 * 90)
    analytics.create_index("event")

    epapers.create_index("date", unique=True)

    articles.create_index("slug", unique=True)
    articles.create_index("created_at")

    ads.create_index("placement")
    ads.create_index("active")