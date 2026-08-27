from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Cust(Base):
    __tablename__ = "cust"

    cust_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("app_user.user_id", ondelete="CASCADE"), unique=True, nullable=False
    )
    customer_type: Mapped[str] = mapped_column(String(50), nullable=False, default="IND")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=True)

    user = relationship("AppUser", back_populates="cust_profile")
    ind_profile = relationship("Ind", back_populates="cust", uselist=False, cascade="all, delete-orphan")
    org_profile = relationship("Org", back_populates="cust", uselist=False, cascade="all, delete-orphan")


class Org(Base):
    __tablename__ = "org"

    org_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cust_id: Mapped[int | None] = mapped_column(
        ForeignKey("cust.cust_id", ondelete="CASCADE"), unique=True, nullable=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("app_user.user_id", ondelete="CASCADE"), unique=True, nullable=False
    )
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    store_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    seller_status: Mapped[str] = mapped_column(String(20), default="none", nullable=False)
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    tax_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tax_office: Mapped[str | None] = mapped_column(String(100), nullable=True)
    store_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    bank_iban: Mapped[str | None] = mapped_column(String(34), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=True)

    cust = relationship("Cust", back_populates="org_profile")
    user = relationship("AppUser", back_populates="org_profile")


class Ind(Base):
    __tablename__ = "ind"

    ind_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cust_id: Mapped[int | None] = mapped_column(
        ForeignKey("cust.cust_id", ondelete="CASCADE"), unique=True, nullable=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("app_user.user_id", ondelete="CASCADE"), unique=True, nullable=False
    )
    username: Mapped[str | None] = mapped_column(String(80), unique=True, nullable=True)
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    tc_no: Mapped[str | None] = mapped_column(String(11), nullable=True)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(10), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=True)

    cust = relationship("Cust", back_populates="ind_profile")
    user = relationship("AppUser", back_populates="ind_profile")
