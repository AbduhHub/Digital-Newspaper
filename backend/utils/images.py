from PIL import Image

MAX_PIXELS = 20_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


def optimize_image(path: str):
    with Image.open(path) as img:
        img.save(path, optimize=True, quality=75)