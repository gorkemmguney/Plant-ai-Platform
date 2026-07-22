from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Review(Base):
    __tablename__ = "review"

    review_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    prod_id: Mapped[int] = mapped_column(ForeignKey("prod.prod_id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    cust_ord_item_id: Mapped[int] = mapped_column(
        ForeignKey("cust_ord_item.cust_ord_item_id", ondelete="CASCADE"), nullable=False
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5 yıldız
    comment: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    seller_reply: Mapped[str | None] = mapped_column(String(1000), nullable=True)  # satıcının cevabı (opsiyonel)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
