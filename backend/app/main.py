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
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse



app = FastAPI(default_response_class=ORJSONResponse)

app.state.limiter = limiter




MAX_REQUEST_SIZE = 25 * 1024 * 1024  # 25MB hard cap

class LimitUploadSizeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")

        if content_length:
            try:
                if int(content_length) > MAX_REQUEST_SIZE:
                    return JSONResponse(
                        status_code=413,
                        content={"detail": "Request too large"},
                    )
            except ValueError:
                pass

        return await call_next(request)

app.add_middleware(LimitUploadSizeMiddleware)

app.add_middleware(SlowAPIMiddleware)

os.makedirs(UPLOAD_DIR, exist_ok=True)


app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    GZipMiddleware,
    minimum_size=1000
)

if os.getenv("ENV") != "production":
    app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="epapers")


app.include_router(auth_routes.router)
# app.include_router(auth_routes.router, prefix="/api")
app.include_router(epaper.router)
app.include_router(articles.router)
app.include_router(ads.router)
app.include_router(analytics_routes.router)
app.include_router(stats.router)
app.include_router(upload.router)   


@app.on_event("startup")
def startup():
    init_indexes()



@app.get("/health")
def health():
    return {"status": "ok"}


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