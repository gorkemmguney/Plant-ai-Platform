from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class OrderItemIn(BaseModel):
    prod_id: int
    quantity: int
    # Müşterinin bu ürün için seçtiği varyant değerleri (gnl_char_val_id listesi).
    # Her karakteristik için en fazla bir değer seçilebilir (ör. Renk'ten sadece biri).
    selected_char_value_ids: list[int] = []


class OrderCreateIn(BaseModel):
    sale_cnl_id: int
    address_id: int  # teslimat adresi — zorunlu
    items: list[OrderItemIn]
    coupon_id: int | None = None  # sepette seçilen indirim kuponu (opsiyonel)


class OrderItemCharOut(BaseModel):
    """Sipariş anında seçilen karakteristik değerinin ANLIK KOPYASI (snapshot).
    char_name burada YOK — ürün/karakteristik silinse bile bozulmasın diye
    sadece gnl_char_id + seçilen değerin metni saklanıyor. İsim eşlemesi için
    mobil taraf GET /catalog/characteristics listesini kullanabilir."""

    model_config = ConfigDict(from_attributes=True)

    gnl_char_id: int
    value: str


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cust_ord_item_id: int
    prod_id: int | None = None
    prod_name: str
    quantity: int
    unit_price: Decimal
    char_values: list[OrderItemCharOut] = []


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cust_ord_id: int
    cust_id: int
    address_id: int | None = None
    total_price: Decimal
    order_date: datetime
    gnl_st_id: int
    is_hidden: bool = False
    items: list[OrderItemOut] = []


class OrderStatusUpdateIn(BaseModel):
    gnl_st_id: int


class OrderVisibilityUpdateIn(BaseModel):
    is_hidden: bool
