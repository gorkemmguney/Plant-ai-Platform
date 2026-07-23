from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Notification(Base):
    __tablename__ = "notification"

    notification_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(String, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BsnInter(Base):
    __tablename__ = "bsn_inter"

    bsn_inter_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cust_id: Mapped[int] = mapped_column(ForeignKey("cust.cust_id"), nullable=False)
    prod_id: Mapped[int] = mapped_column(ForeignKey("prod.prod_id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BsnInterSpec(Base):
    __tablename__ = "bsn_inter_spec"

    bsn_inter_spec_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bsn_inter_id: Mapped[int] = mapped_column(ForeignKey("bsn_inter.bsn_inter_id", ondelete="CASCADE"), nullable=False)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)
    action_value: Mapped[str | None] = mapped_column(String(255), nullable=True)


class SchJob(Base):
    __tablename__ = "sch_job"

    sch_job_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_name: Mapped[str] = mapped_column(String(255), nullable=False)
    job_type: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    last_run: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_run: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserPreference(Base):
    __tablename__ = "user_preference"

    preference_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    gnl_char_id: Mapped[int] = mapped_column(ForeignKey("gnl_char.gnl_char_id"), nullable=False)
    gnl_char_val_id: Mapped[int] = mapped_column(ForeignKey("gnl_char_val.gnl_char_val_id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
