from fastapi import APIRouter, HTTPException, Depends, Request, Query, Response
from datetime import datetime
from pymongo.errors import DuplicateKeyError

from app.db import articles
from models import ArticleCreate
from utils.slug import generate_slug
from auth import require_admin
from app.audit import log_action
from app.analytics import track
from system_logger import logger
from app.services.limiter import limiter
from app.cache import get_cache, set_cache

router = APIRouter(prefix="/articles", tags=["articles"])


@router.post("/", dependencies=[Depends(require_admin)])
@limiter.limit("10/minute")
def create_article(
    request: Request,
    data: ArticleCreate
):

    base_slug = generate_slug(data.title)
    slug = base_slug
    counter = 1

    doc = {
        **data.dict(),
        "slug": slug,
        "excerpt": data.content[:140],
        "created_at": datetime.utcnow()
    }

    try:
        articles.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(409, "Slug collision")

    # clear article caches
    from app.redis_client import redis_client
    for key in redis_client.scan_iter("articles:*"):
        redis_client.delete(key)

    log_action("article_created", {
        "slug": slug,
        "title": data.title
    })

    logger.info(f"Article created: {slug}")

    return {"message": "Article created", "slug": slug}




@router.get("/")
@limiter.limit("10/minute")
def list_articles(
    request: Request,
    response: Response,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50)
):
    base_url = str(request.base_url).rstrip("/")
    skip = (page - 1) * limit


    cache_key = f"articles:{page}:{limit}"

    cached = get_cache(cache_key)
    if cached is not None:
        return cached

    docs = list(
        articles.find({}, {"_id": 0, "content": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )

    for doc in docs:
        if doc.get("image") and not doc["image"].startswith("http"):
            doc["image"] = f"{base_url}{doc['image']}"

    set_cache(cache_key, docs, 60)

    response.headers["Cache-Control"] = "public, max-age=60"

    return docs


@router.get("/{slug}")
@limiter.limit("10/minute")
def get_article(slug: str, request: Request):
    article = articles.find_one({"slug": slug}, {"_id": 0})

    if not article:
        raise HTTPException(404, "Article not found")

    if article.get("image") and not article["image"].startswith("http"):
        base_url = str(request.base_url).rstrip("/")
        article["image"] = f"{base_url}{article['image']}"

    track("article_view", {"slug": slug})
    return article


@router.delete("/{slug}", dependencies=[Depends(require_admin)])
@limiter.limit("10/minute")
def delete_article(slug: str, request: Request):

    result = articles.delete_one({"slug": slug})

    if result.deleted_count == 0:
        raise HTTPException(404, "Article not found")

    from app.redis_client import redis_client
    for key in redis_client.scan_iter("articles:*"):
        redis_client.delete(key)

    log_action("article_deleted", {"slug": slug})

    return {"status": "deleted"}