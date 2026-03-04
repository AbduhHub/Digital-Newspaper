import os
from datetime import datetime

from app.db import epapers
from app.audit import log_action
from system_logger import logger
from app.services.pdf_processor import pdf_to_images
from app.config import UPLOAD_DIR
from app.config import ALLOWED_ORIGINS


def process_pdf(path: str, date: str):
    try:
        logger.info(f"Processing PDF for date: {date}")

        output_dir = os.path.join(UPLOAD_DIR, "epapers", date)

        images = pdf_to_images(path, output_dir, date)

        

        BACKEND_URL = ALLOWED_ORIGINS[0].replace("3000", "8000")

        web_images = []
        for img in images:
            normalized = img.replace("\\", "/")
            if not normalized.startswith("/"):
                normalized = "/" + normalized
            full_url = f"{BACKEND_URL}{normalized}"
            web_images.append(full_url)

        cover = web_images[0] if web_images else None

        epapers.update_one(
            {"date": date},
            {
                "$set": {
                    "date": date,
                    "pdf": f"{BACKEND_URL}/uploads/epapers/{date}/paper.pdf",
                    "images": web_images,
                    "cover_image": cover,
                    "created_at": datetime.utcnow()
                }
            },
            upsert=True
        )

        log_action("epaper_processed", {"date": date})
        logger.info(f"Epaper processed: {date}")

    except Exception as e:
        logger.error(f"Processing failed for {date} → {str(e)}")