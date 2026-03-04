from fastapi import APIRouter, UploadFile, File, HTTPException, Request
import os
import shutil
from PIL import Image

from utils.images import optimize_image
from utils.files import safe_filename, ensure_dir
from app.services.limiter import limiter
from app.config import UPLOAD_DIR


router = APIRouter()

ADS_UPLOAD_DIR = os.path.join(UPLOAD_DIR, "ads")
ensure_dir(ADS_UPLOAD_DIR)


@router.post("/upload/ad-image")
@limiter.limit("10/minute")
async def upload_ad_image(
    request:Request,
    file: UploadFile = File(...)
    ):

    MAX_IMAGE_SIZE = 5 * 1024 * 1024  # Maximum 5MB

    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "Only image files allowed")

    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)

    if size > MAX_IMAGE_SIZE:
        raise HTTPException(400, "Image too large (max 5MB)")

    ext = file.filename.split(".")[-1].lower()
    filename = safe_filename(file.filename, ext)

    if not file.filename.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
        raise HTTPException(400, "Unsupported image format")
    
    file_path = os.path.join(ADS_UPLOAD_DIR, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        Image.open(file_path).verify()
    except Exception:
        os.remove(file_path)
        raise HTTPException(400, "Invalid image file")
    
    optimize_image(file_path)

    return {
        "image": f"/uploads/ads/{filename}"
    }



@router.post("/upload/article-image")
@limiter.limit("10/minute")
async def upload_article_image(
    request: Request,
    file: UploadFile = File(...)
    ):

    MAX_IMAGE_SIZE = 5 * 1024 * 1024  # Maximum 5MB

    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "Only image files allowed")

    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)

    if size > MAX_IMAGE_SIZE:
        raise HTTPException(400, "Image too large (max 5MB)")

    ARTICLE_UPLOAD_DIR = os.path.join(UPLOAD_DIR, "articles")
    ensure_dir(ARTICLE_UPLOAD_DIR)

    ext = file.filename.split(".")[-1].lower()
    filename = safe_filename(file.filename, ext)
    file_path = os.path.join(ARTICLE_UPLOAD_DIR, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    try:
        Image.open(file_path).verify()
    except Exception:
        os.remove(file_path)
        raise HTTPException(400, "Invalid image file")
    optimize_image(file_path)

    return {
        "image": f"/uploads/articles/{filename}"
    }