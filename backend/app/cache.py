import json
from app.redis_client import redis_client

def get_cache(key):
    try:
        data = redis_client.get(key)
        if data:
            return json.loads(data)
    except Exception:
        pass
    return None


def set_cache(key, value, ttl=60):
    try:
        redis_client.setex(
            key,
            ttl,
            json.dumps(value)
        )
    except Exception:
        pass