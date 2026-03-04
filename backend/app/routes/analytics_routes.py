from fastapi import APIRouter
from app.analytics import track
from app.services.limiter import limiter

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.post("/")
@limiter.limit("10/minute")
def analytics_event(data: dict):
    track(data["event"], data.get("meta", {}))
    return {"status": "ok"}