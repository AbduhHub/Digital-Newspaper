from fastapi import APIRouter, HTTPException, Depends
from models import LoginRequest
from auth import authenticate_user, create_access_token, require_admin
from app.services.limiter import limiter

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/validate")
def validate_admin(user=Depends(require_admin)):
    return {"valid": True}


@router.post("/login")
@limiter.limit("10/minute")
def login(data: LoginRequest):
    if not authenticate_user(data.username, data.password):
        raise HTTPException(401, "Invalid credentials")

    token = create_access_token({"sub": data.username})

    return {
        "access_token": token,
        "token_type": "bearer"
    }