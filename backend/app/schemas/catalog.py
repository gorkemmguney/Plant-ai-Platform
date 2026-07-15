from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    prod_id: int
    name: str
    description: str | None = None
    price: Decimal
    stock: int
    gnl_st_id: int
    seller_id: int | None = None
    seller_name: str | None = None


class SellerOut(BaseModel):
    seller_id: int
    seller_name: str
    product_count: int


class ProductCreateIn(BaseModel):
    name: str
    description: str | None = None
    price: Decimal
    stock: int = 0
    gnl_st_id: int


class ProductUpdateIn(BaseModel):
    name: str | None = None
    description: str | None = None
    price: Decimal | None = None
    stock: int | None = None
    gnl_st_id: int | None = None


class ProductOfferOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    prod_ofr_id: int
    prod_id: int
    discount_rate: Decimal
    start_date: date | None = None
    end_date: date | None = None
