from pydantic import BaseModel


class BundleItemOut(BaseModel):
    prod_id: int
    name: str
    price: float
    quantity: int
    stock: int
    seller_id: int | None = None
    seller_name: str | None = None


class BundleOut(BaseModel):
    bundle_id: int
    title: str
    description: str | None = None
    total_price: float  # paketteki ürünlerin güncel toplam fiyatı
    items: list[BundleItemOut] = []
