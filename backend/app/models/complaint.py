from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Complaint(Base):
    __tablename__ = "complaint"

    complaint_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    complaint_type: Mapped[str] = mapped_column(String(50), nullable=False)  # 'general' | 'order' | 'product' | 'seller'
    # Talebin hangi panelden acildigi — admin panelinde iki ayri liste icin
    source_panel: Mapped[str] = mapped_column(String(20), server_default="customer", nullable=False)  # 'customer' | 'seller'
    
    # Referans nesneleri (şikayet türüne göre isteğe bağlı)
    cust_ord_id: Mapped[int | None] = mapped_column(ForeignKey("cust_ord.cust_ord_id", ondelete="SET NULL"), nullable=True)
    prod_id: Mapped[int | None] = mapped_column(ForeignKey("prod.prod_id", ondelete="SET NULL"), nullable=True)
    reported_seller_id: Mapped[int | None] = mapped_column(ForeignKey("app_user.user_id", ondelete="SET NULL"), nullable=True)
    
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String(20), server_default="pending", nullable=False)  # 'pending' | 'in_progress' | 'resolved' | 'rejected'
    admin_note: Mapped[str | None] = mapped_column(String, nullable=True)
    # Talebi acan kisinin ek aciklamasi — SADECE admin cevap vermeden once yazilabilir
    user_reply: Mapped[str | None] = mapped_column(String, nullable=True)
    
    # AI Analiz Alanları
    sentiment: Mapped[str | None] = mapped_column(String(30), nullable=True)  # 'angry' | 'sad' | 'neutral'
    urgency: Mapped[str | None] = mapped_column(String(30), nullable=True)    # 'high' | 'medium' | 'low'
    ai_summary: Mapped[str | None] = mapped_column(String, nullable=True)
    ai_tags: Mapped[str | None] = mapped_column(String, nullable=True)        # Virgülle ayrılmış etiketler (örn. 'kargo,iade')
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # İlişkiler
    user: Mapped["AppUser"] = relationship(foreign_keys=[user_id])
    reported_seller: Mapped["AppUser | None"] = relationship(foreign_keys=[reported_seller_id])
    order: Mapped["CustOrd | None"] = relationship()
    product: Mapped["Prod | None"] = relationship()
