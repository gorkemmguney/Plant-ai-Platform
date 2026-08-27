from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class GnlSt(Base):
    __tablename__ = "gnl_st"

    gnl_st_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # CNTC_MEDIUM doğrulama durumları için 3 parçalı lookup alanları (spec: TM-Forum tarzı).
    # Mevcut sipariş/ürün statülerinde NULL kalır; sadece doğrulama statülerinde dolar.
    ent_code_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ent_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    shrt_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_actv: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)


class GnlTp(Base):
    __tablename__ = "gnl_tp"

    # Genel TİP lookup'ı (doğrulama tipleri, iletişim veri tipleri vb.).
    # ent_code_name = kategori, ent_name = alt-grup (EMAIL/GSM), shrt_code = tip kodu.
    gnl_tp_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ent_code_name: Mapped[str] = mapped_column(String(100), nullable=False)
    ent_name: Mapped[str] = mapped_column(String(50), nullable=False)
    shrt_code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_actv: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)


class Prod(Base):
    __tablename__ = "prod"

    prod_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    gnl_st_id: Mapped[int] = mapped_column(ForeignKey("gnl_st.gnl_st_id"), nullable=False)
    seller_id: Mapped[int | None] = mapped_column(
        ForeignKey("app_user.user_id", ondelete="CASCADE", name="fk_prod_seller"), nullable=True
    )
    prod_spec_id: Mapped[int] = mapped_column(ForeignKey("prod_spec.prod_spec_id"), nullable=False)
    category: Mapped[str] = mapped_column(String(20), server_default="plant", nullable=False)  # 'plant' (çiçek) | 'supply' (malzeme)
    image_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ProdSpec(Base):
    __tablename__ = "prod_spec"

    prod_spec_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)


class GnlChar(Base):
    __tablename__ = "gnl_char"

    gnl_char_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    code: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True)

class GnlCharVal(Base):
    __tablename__ = "gnl_char_val"

    gnl_char_val_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    gnl_char_id: Mapped[int] = mapped_column(ForeignKey("gnl_char.gnl_char_id"), nullable=False)
    value: Mapped[str] = mapped_column(String(255), nullable=False)


class ProdCharVal(Base):
    __tablename__ = "prod_char_val"

    prod_char_val_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    prod_id: Mapped[int] = mapped_column(ForeignKey("prod.prod_id", ondelete="CASCADE"), nullable=False)
    prod_spec_id: Mapped[int] = mapped_column(ForeignKey("prod_spec.prod_spec_id"), nullable=False)
    gnl_char_id: Mapped[int] = mapped_column(ForeignKey("gnl_char.gnl_char_id"), nullable=False)
    gnl_char_val_id: Mapped[int] = mapped_column(ForeignKey("gnl_char_val.gnl_char_val_id"), nullable=False)


class ProdOfr(Base):
    __tablename__ = "prod_ofr"

    prod_ofr_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    prod_id: Mapped[int] = mapped_column(ForeignKey("prod.prod_id", ondelete="CASCADE"), nullable=False)
    discount_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
