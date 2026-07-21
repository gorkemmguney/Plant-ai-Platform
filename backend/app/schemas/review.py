from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ReviewCreateIn(BaseModel):
    prod_id: int
    rating: int = Field(ge=1, le=5)  # 1-5 yıldız
    comment: str | None = None


class SellerReplyIn(BaseModel):
    reply: str


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    review_id: int
    prod_id: int
    rating: int
    comment: str | None = None
    seller_reply: str | None = None
    created_at: datetime
    reviewer_name: str | None = None


class ReviewSummaryOut(BaseModel):
    average: float  # ortalama puan (0 = hiç yorum yok)
    count: int
    reviews: list[ReviewOut] = []


class RatingSummaryOut(BaseModel):
    average: float
    count: int
