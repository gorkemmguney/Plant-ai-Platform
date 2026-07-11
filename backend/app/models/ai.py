from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AiChat(Base):
    __tablename__ = "ai_chat"

    ai_chat_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    messages: Mapped[list["AiMessage"]] = relationship(back_populates="chat", cascade="all, delete-orphan")


class AiMessage(Base):
    __tablename__ = "ai_message"

    ai_message_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ai_chat_id: Mapped[int] = mapped_column(ForeignKey("ai_chat.ai_chat_id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # 'user' | 'assistant'
    message: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    chat: Mapped["AiChat"] = relationship(back_populates="messages")


class AiImageAnalysis(Base):
    __tablename__ = "ai_image_analysis"

    analysis_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    image_url: Mapped[str] = mapped_column(String(1024), nullable=False)  # Firebase Storage URL
    result: Mapped[str | None] = mapped_column(String, nullable=True)  # JSON string: tür, hastalık, bakım önerisi
    confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AiRecommendation(Base):
    __tablename__ = "ai_recommendation"

    recommendation_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    prod_id: Mapped[int] = mapped_column(ForeignKey("prod.prod_id"), nullable=False)
    recommendation: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AiFeedback(Base):
    __tablename__ = "ai_feedback"

    ai_feedback_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ai_message_id: Mapped[int] = mapped_column(ForeignKey("ai_message.ai_message_id", ondelete="CASCADE"), nullable=False)
    is_helpful: Mapped[bool] = mapped_column(Boolean, nullable=False)
    comment: Mapped[str | None] = mapped_column(String(500), nullable=True)
