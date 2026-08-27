from datetime import datetime
from pydantic import BaseModel, Field


class CommAttachmentOut(BaseModel):
    comm_attachment_id: int
    attachment_type: str
    url: str
    mime_type: str | None = None
    file_name: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class CommMessageCreate(BaseModel):
    content: str = Field(..., min_length=1)
    attachment_url: str | None = None


class CommMessageOut(BaseModel):
    comm_message_id: int
    comm_interaction_id: int
    sender_id: int
    sender_name: str
    sender_role: str
    content: str
    message_state: str
    read_at: datetime | None = None
    created_at: datetime
    attachments: list[CommAttachmentOut] = []

    class Config:
        from_attributes = True


class CommInteractionStart(BaseModel):
    seller_id: int
    related_prod_id: int | None = None
    related_ord_id: int | None = None
    subject: str | None = None
    initial_message: str | None = None


class CommInteractionOut(BaseModel):
    comm_interaction_id: int
    interaction_type: str
    status: str
    channel_type: str
    subject: str | None = None
    customer_id: int
    seller_id: int
    partner_name: str
    partner_avatar: str | None = None
    related_prod_id: int | None = None
    related_prod_name: str | None = None
    related_prod_image: str | None = None
    related_ord_id: int | None = None
    last_message_text: str | None = None
    last_message_at: datetime
    unread_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
