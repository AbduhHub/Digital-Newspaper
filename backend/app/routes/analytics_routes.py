from fastapi import APIRouter, Request
from app.analytics import track
from app.services.limiter import limiter

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.post("/")
@limiter.limit("60/minute")
def analytics_event(data: dict, request: Request):
    event = data.get("event")
    
    if not event:
        return {"status": "ignored"}
    track(event, data.get("meta", {}))
    return {"status": "ok"}