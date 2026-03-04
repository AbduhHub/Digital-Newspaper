from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form, Query, Response, Request
from datetime import datetime
import os
import shutil
from concurrent.futures import ThreadPoolExecutor

from auth import require_admin
from app.db import epapers
from app.tasks.pdf_tasks import process_pdf
from utils.files import ensure_dir
from app.config import UPLOAD_DIR
from app.audit import log_action
from app.services.limiter import limiter

router = APIRouter(prefix="/epapers", tags=["epapers"])

BASE_UPLOAD = os.path.join(UPLOAD_DIR, "epapers")

ensure_dir(BASE_UPLOAD)

executor = ThreadPoolExecutor(max_workers=2)




@router.get("/")
def list_epapers(
    response: Response,
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=50)
):
    skip = (page - 1) * limit

    docs = list(
        epapers.find({}, {"_id": 0})
        .sort("date", -1)
        .skip(skip)
        .limit(limit)
    )

    response.headers["Cache-Control"] = "public, max-age=120"

    return docs


@router.get("/{date}")
def get_epaper(date: str):
    doc = epapers.find_one({"date": date}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Epaper not found")
    return doc


@router.post("/", dependencies=[Depends(require_admin)])
@limiter.limit("5/minute")
def upload_epaper(
    request: Request,
    date: str = Form(...),
    file: UploadFile = File(...)
):
    # Validate date format
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD")

    # Prevent duplicate epaper
    if epapers.find_one({"date": date}):
        raise HTTPException(400, "Epaper for this date already exists")

    MAX_PDF_SIZE = 20 * 1024 * 1024

    if file.content_type != "application/pdf":
        raise HTTPException(400, "Only PDF allowed")

    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)

    if size > MAX_PDF_SIZE:
        raise HTTPException(400, "PDF too large (max 20MB)")

    date_dir = os.path.join(BASE_UPLOAD, date)
    ensure_dir(date_dir)

    pdf_path = os.path.join(date_dir, "paper.pdf")

    # Write file
    with open(pdf_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Verify PDF header
    with open(pdf_path, "rb") as f:
        header = f.read(4)
        if header != b"%PDF":
            os.remove(pdf_path)
            raise HTTPException(400, "Invalid PDF file")

    # Process in background
    executor.submit(process_pdf, pdf_path, date)

    return {"message": "Upload queued", "date": date}


@router.delete("/{date}", dependencies=[Depends(require_admin)])
def delete_epaper(date: str):

    result = epapers.delete_one({"date": date})

    if result.deleted_count == 0:
        raise HTTPException(404, "Epaper not found")

    # Also delete folder
    import shutil
    from app.config import UPLOAD_DIR

    folder = os.path.join(UPLOAD_DIR, "epapers", date)
    if os.path.exists(folder):
        shutil.rmtree(folder)

    log_action("epaper_deleted", {"date": date})

    return {"status": "deleted"}