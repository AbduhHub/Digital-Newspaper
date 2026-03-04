import os
import subprocess
from pathlib import Path
from PIL import Image

def pdf_to_images(pdf_path: str, output_dir: str, date: str):
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    cmd = [
        "pdftoppm",
        "-jpeg",
        "-r",
        "120",
        pdf_path,
        f"{output_dir}/page",
    ]

    subprocess.run(cmd, check=True)

    pages = sorted([
        f for f in os.listdir(output_dir)
        if f.startswith("page") and f.endswith(".jpg")
    ])

    image_urls = []

    for i, filename in enumerate(pages, start=1):
        new_name = f"page-{i}.jpg"
        old_path = os.path.join(output_dir, filename)
        new_path = os.path.join(output_dir, new_name)

        if filename != new_name:
            os.rename(old_path, new_path)

        img = Image.open(new_path)
        webp_path = new_path.replace(".jpg", ".webp")

        img.save(webp_path, "WEBP", quality=80)
        os.remove(new_path)

        image_urls.append(
            f"/uploads/epapers/{date}/{os.path.basename(webp_path)}"
        )

    return image_urls