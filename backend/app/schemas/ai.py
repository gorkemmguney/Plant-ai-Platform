from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class ChatMessageIn(BaseModel):
    ai_chat_id: int | None = None  
    message: str


class ProductMinOut(BaseModel):
    prod_id: int
    name: str
    price: Decimal
    image_url: str | None = None
    stock: int


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ai_chat_id: int
    ai_message_id: int
    role: str
    message: str
    created_at: datetime
    recommended_products: list[ProductMinOut] = []
    action_performed: dict | None = None


class ChatSessionOut(BaseModel):

    ai_chat_id: int
    created_at: datetime
    last_message_at: datetime | None = None
    preview: str | None = None  # ilk kullanıcı mesajının kısa özeti
    message_count: int = 0


class ImageAnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    analysis_id: int
    image_url: str
    result: str | None = None
    confidence: Decimal | None = None
    created_at: datetime
    recommended_products: list[str] = []


class FeedbackIn(BaseModel):
    ai_message_id: int
    is_helpful: bool
    comment: str | None = None
