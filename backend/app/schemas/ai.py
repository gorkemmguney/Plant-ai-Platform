from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class ChatMessageIn(BaseModel):
    ai_chat_id: int | None = None  # None ise yeni sohbet başlatılır
    message: str


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ai_chat_id: int
    ai_message_id: int
    role: str
    message: str
    created_at: datetime


class ImageAnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    analysis_id: int
    image_url: str
    result: str | None = None
    confidence: Decimal | None = None
    created_at: datetime


class FeedbackIn(BaseModel):
    ai_message_id: int
    is_helpful: bool
    comment: str | None = None
