from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Bundle(Base):
    """Hazır ürün paketi (ör. 'Başlangıç Bitki Seti')."""

    __tablename__ = "bundle"

    bundle_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list["BundleItem"]] = relationship(back_populates="bundle", cascade="all, delete-orphan")


class BundleItem(Base):
    """Bir pakete dahil ürün + adet."""

    __tablename__ = "bundle_item"

    bundle_item_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bundle_id: Mapped[int] = mapped_column(ForeignKey("bundle.bundle_id"), nullable=False)
    prod_id: Mapped[int] = mapped_column(ForeignKey("prod.prod_id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, server_default="1", nullable=False)

    bundle: Mapped["Bundle"] = relationship(back_populates="items")
