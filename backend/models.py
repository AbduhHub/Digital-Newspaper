from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class ArticleCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    content: str = Field(min_length=10)
    image: Optional[str] = None
    featured: bool = False


class ArticleResponse(BaseModel):
    title: str
    slug: str
    content: str
    image: Optional[str]
    featured: bool
    created_at: datetime

    class Config:
        from_attributes = True


AdPlacement = Literal[
    "sidebar",
    "between_pages",
    "homepage",
    "article_top"
]


class AdCreate(BaseModel):
    image: str
    placement: AdPlacement
    active: bool = True


class AdResponse(BaseModel):
    image: str
    placement: AdPlacement
    active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class EPaperResponse(BaseModel):
    date: datetime
    pdf: str
    thumbnail: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"