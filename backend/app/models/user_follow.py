from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserFollow(Base):
    __tablename__ = "user_follow"

    follow_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    follower_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    following_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    follower: Mapped["AppUser"] = relationship("AppUser", foreign_keys=[follower_id])
    following: Mapped["AppUser"] = relationship("AppUser", foreign_keys=[following_id])
