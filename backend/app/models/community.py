from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CommunityPost(Base):
    __tablename__ = "community_post"

    post_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    tag: Mapped[str] = mapped_column(String(50), server_default="general", nullable=False)  # 'general' | 'care' | 'disease' | 'swap'
    ask_ai: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["AppUser"] = relationship(foreign_keys=[user_id])
    likes: Mapped[list["CommunityLike"]] = relationship(back_populates="post", cascade="all, delete-orphan")
    comments: Mapped[list["CommunityComment"]] = relationship(back_populates="post", cascade="all, delete-orphan")


class CommunityLike(Base):
    __tablename__ = "community_like"

    like_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("community_post.post_id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    post: Mapped["CommunityPost"] = relationship(back_populates="likes")
    user: Mapped["AppUser"] = relationship(foreign_keys=[user_id])


class CommunityComment(Base):
    __tablename__ = "community_comment"

    comment_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("community_post.post_id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("app_user.user_id", ondelete="SET NULL"), nullable=True)
    
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_ai_reply: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    post: Mapped["CommunityPost"] = relationship(back_populates="comments")
    user: Mapped["AppUser | None"] = relationship(foreign_keys=[user_id])
