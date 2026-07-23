from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CustProd(Base):
    __tablename__ = "cust_prod"

    cust_prod_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cust_id: Mapped[int] = mapped_column(ForeignKey("cust.cust_id", ondelete="CASCADE"), nullable=False)
    prod_spec_id: Mapped[int] = mapped_column(ForeignKey("prod_spec.prod_spec_id"), nullable=False)
    
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    
    health_status: Mapped[str] = mapped_column(String(50), default="healthy", nullable=False)
    
    # Care routines
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    watering_interval_days: Mapped[int] = mapped_column(Integer, default=7, nullable=False)
    last_watered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    fertilizing_interval_days: Mapped[int | None] = mapped_column(Integer, default=30, nullable=True)
    last_fertilized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    
    repotting_interval_days: Mapped[int | None] = mapped_column(Integer, default=365, nullable=True)
    last_repotted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    customer: Mapped["Cust"] = relationship(foreign_keys=[cust_id])
    specification: Mapped["ProdSpec"] = relationship(foreign_keys=[prod_spec_id])
    care_logs: Mapped[list["CustProdCareLog"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )
    growth_logs: Mapped[list["CustProdGrowthLog"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )


class CustProdCareLog(Base):
    __tablename__ = "cust_prod_care_log"

    care_log_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cust_prod_id: Mapped[int] = mapped_column(ForeignKey("cust_prod.cust_prod_id", ondelete="CASCADE"), nullable=False)
    care_type: Mapped[str] = mapped_column(String(50), nullable=False)  # 'water', 'fertilize', 'repot', 'prune'
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    product: Mapped["CustProd"] = relationship(back_populates="care_logs")


class CustProdGrowthLog(Base):
    __tablename__ = "cust_prod_growth_log"

    growth_log_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cust_prod_id: Mapped[int] = mapped_column(ForeignKey("cust_prod.cust_prod_id", ondelete="CASCADE"), nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    note: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    product: Mapped["CustProd"] = relationship(back_populates="growth_logs")
