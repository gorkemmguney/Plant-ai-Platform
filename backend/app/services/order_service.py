from decimal import Decimal

from app.models.customer import Cust
from app.services.notification_service import create_notification

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import Prod
from app.models.order import CustOrd, CustOrdItem
from app.schemas.order import OrderCreateIn

DEFAULT_ORDER_STATUS_ID = 5

_STATUS_MESSAGES = {
    5: "Siparişiniz alındı.",
    6: "Siparişiniz hazırlanıyor.",
    7: "Siparişiniz kargoya verildi.",
    8: "Siparişiniz teslim edildi.",
    9: "Siparişiniz iptal edildi.",
}


async def update_order_status(db: AsyncSession, cust_ord_id: int, gnl_st_id: int) -> CustOrd:
    result = await db.execute(
        select(CustOrd).options(selectinload(CustOrd.items)).where(CustOrd.cust_ord_id == cust_ord_id)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Sipariş bulunamadı")

    order.gnl_st_id = gnl_st_id
    await db.flush()

    cust_result = await db.execute(select(Cust).where(Cust.cust_id == order.cust_id))
    cust = cust_result.scalar_one_or_none()
    if cust is not None:
        message = _STATUS_MESSAGES.get(gnl_st_id, "Sipariş durumunuz güncellendi.")
        await create_notification(db, cust.user_id, "Sipariş Güncellemesi", message)

    await db.commit()
    await db.refresh(order)
    return order


async def create_order(db: AsyncSession, cust_id: int, payload: OrderCreateIn) -> list[CustOrd]:
    if not payload.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sepet boş olamaz")

    # Sepetteki ürünleri satıcıya göre grupluyoruz — her satıcı yalnızca
    # kendi ürünlerini içeren ayrı bir sipariş görecek (seller_id=None olan
    # sahipsiz ürünler kendi grubunda tek bir siparişte toplanır).
    items_by_seller: dict[int | None, list[CustOrdItem]] = {}
    totals_by_seller: dict[int | None, Decimal] = {}

    for item in payload.items:
        result = await db.execute(select(Prod).where(Prod.prod_id == item.prod_id))
        product = result.scalar_one_or_none()
        if product is None:
            raise HTTPException(status_code=404, detail=f"Ürün bulunamadı: {item.prod_id}")
        if product.stock < item.quantity:
            raise HTTPException(status_code=400, detail=f"Yetersiz stok: {product.name}")

        product.stock -= item.quantity
        line_total = product.price * item.quantity

        seller_key = product.seller_id
        items_by_seller.setdefault(seller_key, []).append(
            CustOrdItem(
                prod_id=product.prod_id,
                prod_name=product.name,
                quantity=item.quantity,
                unit_price=product.price,
            )
        )
        totals_by_seller[seller_key] = totals_by_seller.get(seller_key, Decimal("0")) + line_total

    new_orders: list[CustOrd] = []
    for seller_key, order_items in items_by_seller.items():
        order = CustOrd(
            cust_id=cust_id,
            sale_cnl_id=payload.sale_cnl_id,
            total_price=totals_by_seller[seller_key],
            gnl_st_id=DEFAULT_ORDER_STATUS_ID,
            items=order_items,
        )
        db.add(order)
        new_orders.append(order)

    await db.commit()

    result_orders: list[CustOrd] = []
    for order in new_orders:
        result = await db.execute(
            select(CustOrd).options(selectinload(CustOrd.items)).where(CustOrd.cust_ord_id == order.cust_ord_id)
        )
        result_orders.append(result.scalar_one())

    return result_orders
