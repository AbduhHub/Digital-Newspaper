from fastapi import APIRouter, Depends
from app.db import db
from auth import require_admin

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/", dependencies=[Depends(require_admin)])
def stats():
    return {
        "article_views": db.analytics.count_documents({"event": "article_view"}),
        "ad_impressions": db.analytics.count_documents({"event": "ad_impression"})
    }