from datetime import datetime
from pydantic import BaseModel, Field


class TMFPartyCharacteristic(BaseModel):
    name: str
    value: str | None = None
    value_type: str = "string"


class UserProfileUpdateIn(BaseModel):
    first_name: str | None = Field(None, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    store_name: str | None = Field(None, max_length=150)
    bio: str | None = Field(None, max_length=500)
    city: str | None = Field(None, max_length=100)
    avatar_url: str | None = Field(None, max_length=500)
    cover_image_url: str | None = Field(None, max_length=500)


class CustomerPartyProfileOut(BaseModel):
    user_id: int
    first_name: str
    last_name: str
    email: str
    city: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    cover_image_url: str | None = None
    points: int = 0
    followers_count: int = 0
    following_count: int = 0
    is_followed_by_me: bool = False
    badges: list[str] = []
    plant_count: int = 0
    post_count: int = 0
    order_count: int = 0
    created_at: datetime
    party_characteristics: list[TMFPartyCharacteristic] = []

    class Config:
        from_attributes = True


class SellerPartyProfileOut(BaseModel):
    user_id: int
    store_name: str | None = None
    first_name: str
    last_name: str
    email: str
    seller_status: str = "none"
    city: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    cover_image_url: str | None = None
    followers_count: int = 0
    following_count: int = 0
    is_followed_by_me: bool = False
    rating_score: float = 5.0
    review_count: int = 0
    product_count: int = 0
    badges: list[str] = []
    created_at: datetime
    party_characteristics: list[TMFPartyCharacteristic] = []

    class Config:
        from_attributes = True


class GenericPartyProfileOut(BaseModel):
    user_id: int
    role: str  # 'customer' | 'seller' | 'admin'
    customer_profile: CustomerPartyProfileOut | None = None
    seller_profile: SellerPartyProfileOut | None = None


class UserPostSummaryOut(BaseModel):
    post_id: int
    user_id: int
    author_name: str
    title: str
    content: str
    image_url: str | None = None
    tag: str
    like_count: int
    comment_count: int
    is_liked_by_me: bool
    created_at: datetime


class UserPlantSummaryOut(BaseModel):
    cust_prod_id: int
    nickname: str
    species: str
    health_status: str
    image_url: str | None = None
    created_at: datetime
