from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class OrderItemIn(BaseModel):
    prod_id: int
    quantity: int


class OrderCreateIn(BaseModel):
    sale_cnl_id: int
    items: list[OrderItemIn]


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cust_ord_item_id: int
    prod_id: int
    quantity: int
    unit_price: Decimal


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cust_ord_id: int
    cust_id: int
    total_price: Decimal
    order_date: datetime
    gnl_st_id: int
    items: list[OrderItemOut] = []
