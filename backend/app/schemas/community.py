from datetime import datetime
from pydantic import BaseModel, ConfigDict


class CommunityPostCreate(BaseModel):
    title: str
    content: str
    tag: str = "general"  # 'general' | 'care' | 'disease' | 'swap'
    ask_ai: bool = False


class CommunityCommentCreate(BaseModel):
    content: str


class CommunityCommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    comment_id: int
    post_id: int
    user_id: int | None = None
    author_name: str
    content: str
    is_ai_reply: bool
    created_at: datetime


class CommunityPostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    post_id: int
    user_id: int
    author_name: str
    title: str
    content: str
    image_url: str | None = None
    tag: str
    ask_ai: bool
    like_count: int = 0
    comment_count: int = 0
    is_liked_by_me: bool = False
    created_at: datetime
    updated_at: datetime
