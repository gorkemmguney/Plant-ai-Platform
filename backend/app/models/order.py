from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SaleCnl(Base):
    __tablename__ = "sale_cnl"

    sale_cnl_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)


class CustOrd(Base):
    __tablename__ = "cust_ord"

    cust_ord_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cust_id: Mapped[int] = mapped_column(ForeignKey("cust.cust_id"), nullable=False)
    sale_cnl_id: Mapped[int] = mapped_column(ForeignKey("sale_cnl.sale_cnl_id"), nullable=False)
    address_id: Mapped[int | None] = mapped_column(
        ForeignKey("customer_address.address_id", ondelete="SET NULL"), nullable=True
    )
    total_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    order_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    gnl_st_id: Mapped[int] = mapped_column(ForeignKey("gnl_st.gnl_st_id"), nullable=False)

    items: Mapped[list["CustOrdItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")
    char_values: Mapped[list["CustOrdCharVal"]] = relationship(lazy="selectin", cascade="all, delete-orphan")


class CustOrdItem(Base):
    __tablename__ = "cust_ord_item"

    cust_ord_item_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cust_ord_id: Mapped[int] = mapped_column(ForeignKey("cust_ord.cust_ord_id", ondelete="CASCADE"), nullable=False)
    prod_id: Mapped[int | None] = mapped_column(
        ForeignKey("prod.prod_id", ondelete="SET NULL", name="fk_cust_ord_item_prod"), nullable=True
    )
    prod_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    seller_id: Mapped[int | None] = mapped_column(
        ForeignKey("app_user.user_id", ondelete="SET NULL", name="fk_cust_ord_item_seller"), nullable=True
    )
    seller_store_name: Mapped[str | None] = mapped_column(String(150), nullable=True)

    order: Mapped["CustOrd"] = relationship(back_populates="items")
    char_values: Mapped[list["CustOrdItemCharVal"]] = relationship(lazy="selectin", cascade="all, delete-orphan")


class CustOrdCharVal(Base):
    __tablename__ = "cust_ord_char_val"

    cust_ord_char_val_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cust_ord_id: Mapped[int] = mapped_column(ForeignKey("cust_ord.cust_ord_id", ondelete="CASCADE"), nullable=False)
    gnl_char_id: Mapped[int] = mapped_column(ForeignKey("gnl_char.gnl_char_id"), nullable=False)
    value: Mapped[str] = mapped_column(String(255), nullable=False)


class CustOrdItemCharVal(Base):
    __tablename__ = "cust_ord_item_char_val"

    cust_ord_item_char_val_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cust_ord_item_id: Mapped[int] = mapped_column(ForeignKey("cust_ord_item.cust_ord_item_id", ondelete="CASCADE"), nullable=False)
    gnl_char_id: Mapped[int] = mapped_column(ForeignKey("gnl_char.gnl_char_id"), nullable=False)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
