from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.requests import Request

import os
import traceback

from app.routes import epaper, articles, ads, auth_routes, analytics_routes, stats, upload
from app.db import init_indexes
from app.config import UPLOAD_DIR, ALLOWED_ORIGINS
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
from fastapi.responses import JSONResponse

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from fastapi.responses import PlainTextResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.services.limiter import limiter



class LimitUploadSizeMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_upload_size: int):
        super().__init__(app)
        self.max_upload_size = max_upload_size

    async def dispatch(self, request, call_next):
        if request.method == "POST":
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > self.max_upload_size:
                from fastapi.responses import PlainTextResponse
                return PlainTextResponse(
                    "Request body too large",
                    status_code=413
                )
        return await call_next(request)
    

app = FastAPI()
app.add_middleware(
    LimitUploadSizeMiddleware,
    max_upload_size=25 * 1024 * 1024  # 25MB hard cap
)
app.state.limiter = limiter

app.add_middleware(SlowAPIMiddleware)


MAX_REQUEST_SIZE = 25 * 1024 * 1024  # 25MB hard cap

class LimitUploadSizeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")

        if content_length:
            if int(content_length) > MAX_REQUEST_SIZE:
                return JSONResponse(
                    status_code=413,
                    content={"detail": "Request too large"},
                )

        return await call_next(request)

app.add_middleware(LimitUploadSizeMiddleware)

os.makedirs(UPLOAD_DIR, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
# app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


app.include_router(auth_routes.router)
app.include_router(epaper.router)
app.include_router(articles.router)
app.include_router(ads.router)
app.include_router(analytics_routes.router)
app.include_router(stats.router)
app.include_router(upload.router)


@app.on_event("startup")
def startup():
    init_indexes()


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    traceback.print_exc()

    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"}
    )



@app.exception_handler(RateLimitExceeded)
def rate_limit_handler(request, exc):
    return PlainTextResponse(
        "Rate limit exceeded",
        status_code=429
    )