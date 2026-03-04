import uuid
import os


def safe_filename(original_name: str, extension: str):
    return f"{uuid.uuid4()}.{extension}"


def ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)

def safe_delete(path: str):
    if os.path.exists(path):
        os.remove(path)