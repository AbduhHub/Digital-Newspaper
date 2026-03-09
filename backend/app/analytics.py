from datetime import datetime
from app.db import db
from concurrent.futures import ThreadPoolExecutor
import queue

analytics = db["analytics"]

executor = ThreadPoolExecutor(max_workers=2)


def _write_event(event: str, meta: dict):
    try:
        analytics.insert_one({
            "event": event,
            "meta": meta,
            "timestamp": datetime.utcnow()
        })
    except Exception:
        pass  # never break main request

def track(event: str, meta: dict):
    if executor._work_queue.qsize() > 1000:
        return
    executor.submit(_write_event, event, meta)
