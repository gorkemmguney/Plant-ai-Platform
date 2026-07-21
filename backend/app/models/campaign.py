from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Campaign(Base):
    __tablename__ = "campaign"

    campaign_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    required_points: Mapped[int] = mapped_column(Integer, nullable=False)  # kullanmak için gereken puan
    reward_text: Mapped[str | None] = mapped_column(String(200), nullable=True)  # ne kazanılır (ör. "₺50 indirim")
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), server_default="0", nullable=False)  # sepette düşülecek TL
    seller_id: Mapped[int | None] = mapped_column(ForeignKey("app_user.user_id"), nullable=True)  # kampanya hangi mağazaya ait
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserCoupon(Base):
    """Kampanya kullanılınca oluşan, kullanıcıya ait indirim kuponu.
    Sepette seçilip harcanır; harcanınca is_used = True olur."""

    __tablename__ = "user_coupon"

    coupon_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id"), nullable=False)
    campaign_id: Mapped[int | None] = mapped_column(ForeignKey("campaign.campaign_id"), nullable=True)  # hangi kampanyadan (tek seferlik kontrolü)
    seller_id: Mapped[int | None] = mapped_column(ForeignKey("app_user.user_id"), nullable=True)  # kupon hangi mağazada geçerli
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    is_used: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
