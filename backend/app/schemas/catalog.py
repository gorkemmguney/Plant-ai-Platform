from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class CharValueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    gnl_char_val_id: int
    value: str


class CharacteristicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    gnl_char_id: int
    name: str
    description: str | None = None
    values: list[CharValueOut] = []


class CharacteristicCreateIn(BaseModel):
    name: str
    description: str | None = None


class CharValueCreateIn(BaseModel):
    value: str


class ProductCharacteristicOut(BaseModel):
    """Bir ürüne atanmış tek bir karakteristik+değer çifti (prod_char_val satırı)."""

    gnl_char_id: int
    char_name: str
    gnl_char_val_id: int
    value: str


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    prod_id: int
    name: str
    description: str | None = None
    price: Decimal
    stock: int
    gnl_st_id: int
    prod_spec_id: int
    category: str = "plant"
    image_url: str | None = None
    seller_id: int | None = None
    seller_name: str | None = None
    characteristics: list[ProductCharacteristicOut] = []


class SellerOut(BaseModel):
    seller_id: int
    seller_name: str
    product_count: int
    prod_spec_id: int | None = None
    owner_user_id: int | None = None


class ProdSpecOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    prod_spec_id: int
    name: str
    description: str | None = None


class ProductCreateIn(BaseModel):
    name: str
    description: str | None = None
    price: Decimal
    stock: int = 0
    gnl_st_id: int
    prod_spec_id: int
    char_value_ids: list[int] = []


class ProductUpdateIn(BaseModel):
    name: str | None = None
    description: str | None = None
    price: Decimal | None = None
    stock: int | None = None
    gnl_st_id: int | None = None
    prod_spec_id: int | None = None
    char_value_ids: list[int] | None = None


class ProductOfferOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    prod_ofr_id: int
    prod_id: int
    discount_rate: Decimal
    start_date: date | None = None
    end_date: date | None = None
