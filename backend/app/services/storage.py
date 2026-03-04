# import shutil
# import os
# from app.config import UPLOAD_DIR

# def save_pdf(file, date: str):
#     date_dir = os.path.join(UPLOAD_DIR, date)
#     os.makedirs(date_dir, exist_ok=True)

#     pdf_path = os.path.join(date_dir, "paper.pdf")
#     with open(pdf_path, "wb") as f:
#         shutil.copyfileobj(file.file, f)

#     return pdf_path, date_dir
