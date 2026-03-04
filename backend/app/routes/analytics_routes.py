from fastapi import APIRouter
from app.analytics import track

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.post("/")
def analytics_event(data: dict):
    track(data["event"], data.get("meta", {}))
    return {"status": "ok"}