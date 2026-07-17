from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class ComplaintCreate(BaseModel):
    complaint_type: str  # 'general' | 'order' | 'product' | 'seller'
    title: str
    description: str
    cust_ord_id: int | None = None
    prod_id: int | None = None
    reported_seller_id: int | None = None


class ComplaintAdminUpdate(BaseModel):
    status: str | None = None  # 'pending' | 'in_progress' | 'resolved' | 'rejected'
    admin_note: str | None = None


class ComplaintOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    complaint_id: int
    user_id: int
    complaint_type: str
    cust_ord_id: int | None = None
    prod_id: int | None = None
    reported_seller_id: int | None = None
    title: str
    description: str
    status: str
    admin_note: str | None = None
    sentiment: str | None = None
    urgency: str | None = None
    ai_summary: str | None = None
    ai_tags: str | None = None
    created_at: datetime
    updated_at: datetime

    # Detaylı UI gösterimi için yardımcı alanlar (endpoint'te doldurulacak)
    user_name: str | None = None
    user_email: str | None = None
    reported_seller_name: str | None = None
    product_name: str | None = None
    order_price: Decimal | None = None
    order_date: datetime | None = None
