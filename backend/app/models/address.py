from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CustomerAddress(Base):

    __tablename__ = "customer_address"

    address_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cust_id: Mapped[int] = mapped_column(ForeignKey("cust.cust_id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(50), nullable=False)  # "Ev", "İş" vb.
    il_id: Mapped[int] = mapped_column(ForeignKey("il.il_id"), nullable=False)
    ilce_id: Mapped[int] = mapped_column(ForeignKey("ilce.ilce_id"), nullable=False)
    mahalle_id: Mapped[int] = mapped_column(ForeignKey("mahalle.mahalle_id"), nullable=False)
    address_line: Mapped[str] = mapped_column(String(500), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
