import os
import subprocess
from pathlib import Path
from PIL import Image
import glob


def pdf_to_images(pdf_path: str, output_dir: str, date: str):

    Path(output_dir).mkdir(parents=True, exist_ok=True)

    # cmd = [
    #     "pdftoppm",
    #     "-png",
    #     "-r",
    #     "220",
    #     pdf_path,
    #     f"{output_dir}/page",
    # ]

    cmd = [
        "pdftoppm",
        "-png",
        "-r",
        "450",
        "-aa",
        "yes",
        "-aaVector",
        "yes",
        pdf_path,
        f"{output_dir}/page",
    ]

    subprocess.run(cmd, check=True)

    png_files = sorted(
        glob.glob(f"{output_dir}/page-*.png"),
        key=lambda x: int(x.split("-")[-1].split(".")[0])
    )

    image_urls = []

    for i, png in enumerate(png_files, start=1):

        img = Image.open(png)

        webp_name = f"page-{i}.webp"
        webp_path = os.path.join(output_dir, webp_name)

        img.thumbnail((2200, 2200))

        img.save(webp_path, "WEBP", quality=95, method=6)

        os.remove(png)

        image_urls.append(
            f"/uploads/epapers/{date}/{webp_name}"
        )

    return image_urls




























# import os
# import subprocess
# from pathlib import Path


# def pdf_to_images(pdf_path: str, output_dir: str, date: str):

#     Path(output_dir).mkdir(parents=True, exist_ok=True)

#     cmd = [
#         "pdftoppm",
#         "-jpeg",
#         "-jpegopt",
#         "quality=70",
#         "-r",
#         "120",
#         pdf_path,
#         f"{output_dir}/page",
#     ]

#     subprocess.run(cmd, check=True)

#     pages = sorted(
#         [
#             f for f in os.listdir(output_dir)
#             if f.startswith("page") and f.endswith(".jpg")
#         ],
#         key=lambda x: int(x.split("-")[1].split(".")[0])
#     )

#     image_urls = []

#     for i, filename in enumerate(pages, start=1):

#         new_name = f"page-{i}.jpg"

#         old_path = os.path.join(output_dir, filename)
#         new_path = os.path.join(output_dir, new_name)

#         if filename != new_name:
#             os.rename(old_path, new_path)

#         image_urls.append(
#             f"/uploads/epapers/{date}/{new_name}"
#         )

#     return image_urls
