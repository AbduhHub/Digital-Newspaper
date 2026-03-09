from fastapi import APIRouter, HTTPException, Request, Depends, Response
from pydantic import BaseModel, Field
from typing import List
from datetime import datetime
import re

from app.db import ads
from app.auth import require_admin
from app.models import AdPlacement
from app.services.limiter import limiter

router = APIRouter(prefix="/ads", tags=["ads"])


# Pydantic Schemas

class CreateAdRequest(BaseModel):
    image: str = Field(..., min_length=1)
    placement: AdPlacement
    priority: int = Field(default=1, ge=0, le=100)


class UpdatePriorityRequest(BaseModel):
    priority: int = Field(..., ge=0, le=100)


# Helpers

def normalize_image(base_url: str, image: str) -> str:
    if image.startswith("http"):
        return image
    return f"{base_url}{image}"


def find_by_filename(filename: str):
    """
    Safely find ad by filename (escaped regex).
    Matches end of image path.
    """
    safe_filename = re.escape(filename)
    return ads.find_one({
        "image": {"$regex": f"/{safe_filename}$"}
    })


# PUBLIC — Get ads by placement

@router.get("/{placement}")
@limiter.limit("60/minute")
def get_ads(
    placement: AdPlacement,
    request: Request,
    response: Response
) -> List[dict]:

    from app.config import BASE_URL
    base_url = BASE_URL

    docs = list(
        ads.find(
            {
                "placement": placement,
                "active": True
            },
            {"_id": 0}
        )
        .sort([
            ("priority", 1),
            ("created_at", -1)
        ])
        .limit(10)
    )

    for d in docs:
        image = d.get("image")
        if image:
            d["image"] = normalize_image(base_url, image)

    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=30"

    return docs


# ADMIN — List all ads

@router.get("/", dependencies=[Depends(require_admin)])
@limiter.limit("60/minute")
def list_all_ads(request: Request, response: Response):

    from app.config import BASE_URL
    base_url = BASE_URL

    docs = list(
        ads.find({}, {"_id": 0})
        .sort("created_at", -1)
        .limit(200)
    )

    for d in docs:
        image = d.get("image")
        if image:
            d["image"] = normalize_image(base_url, image)

    response.headers["Cache-Control"] = "no-store"

    return docs


# ADMIN — Create ad

@router.post("/", dependencies=[Depends(require_admin)])
@limiter.limit("5/minute")
def create_ad(data: CreateAdRequest, request: Request):

    # Prevent duplicates
    if ads.find_one({"image": data.image}):
        raise HTTPException(status_code=400, detail="Ad already exists")

    ads.insert_one({
        "image": data.image,
        "placement": data.placement,
        "priority": data.priority,
        "active": True,
        "created_at": datetime.utcnow()
    })

    return {"status": "ok"}


# ADMIN — Toggle active

@router.put("/{filename}", dependencies=[Depends(require_admin)])
@limiter.limit("5/minute")
def toggle_ad(filename: str, request: Request):

    result = find_by_filename(filename)

    if not result:
        raise HTTPException(status_code=404, detail="Ad not found")

    new_status = not result.get("active", True)

    ads.update_one(
        {"_id": result["_id"]},
        {"$set": {"active": new_status}}
    )

    return {"status": "updated", "active": new_status}


# ADMIN — Update priority

@router.put("/{filename}/priority", dependencies=[Depends(require_admin)])
@limiter.limit("5/minute")
def update_priority(filename: str, request: Request, data: UpdatePriorityRequest):

    result = find_by_filename(filename)

    if not result:
        raise HTTPException(status_code=404, detail="Ad not found")

    ads.update_one(
        {"_id": result["_id"]},
        {"$set": {"priority": data.priority}}
    )

    return {"status": "updated", "priority": data.priority}


# ADMIN — Delete ad

@router.delete("/{filename}", dependencies=[Depends(require_admin)])
@limiter.limit("5/minute")
def delete_ad(filename: str, request: Request):

    result = find_by_filename(filename)

    if not result:
        raise HTTPException(status_code=404, detail="Ad not found")

    ads.delete_one({"_id": result["_id"]})

    return {"status": "deleted"}