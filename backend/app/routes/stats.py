from fastapi import APIRouter, Depends, Request
from app.db import db
from auth import require_admin
from app.services.limiter import limiter

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/", dependencies=[Depends(require_admin)])
@limiter.limit("10/minute")
def stats(request: Request):
    return {
        "article_views": db.analytics.count_documents({"event": "article_view"}),
        "ad_impressions": db.analytics.count_documents({"event": "ad_impression"})
    }