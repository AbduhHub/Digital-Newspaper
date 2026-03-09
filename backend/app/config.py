from dotenv import load_dotenv
load_dotenv()
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = Path("/app/uploads")

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")
SECRET_KEY = os.getenv("SECRET_KEY")
BASE_URL = os.getenv("BASE_URL", "http://localhost")

if not MONGO_URI:
    raise RuntimeError("MONGO_URI environment variable is required")

if not DB_NAME:
    raise RuntimeError("DB_NAME environment variable is required")

origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://192.168.29.87:3000"
)

ALLOWED_ORIGINS = [o.strip() for o in origins.split(",")]