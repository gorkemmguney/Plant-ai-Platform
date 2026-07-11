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

async def create_order(db: AsyncSession, cust_id: int, payload: OrderCreateIn) -> CustOrd:
    if not payload.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sepet boş olamaz")

    total = Decimal("0")
    order_items: list[CustOrdItem] = []

    for item in payload.items:
        result = await db.execute(select(Prod).where(Prod.prod_id == item.prod_id))
        product = result.scalar_one_or_none()
        if product is None:
            raise HTTPException(status_code=404, detail=f"Ürün bulunamadı: {item.prod_id}")
        if product.stock < item.quantity:
            raise HTTPException(status_code=400, detail=f"Yetersiz stok: {product.name}")

        product.stock -= item.quantity
        line_total = product.price * item.quantity
        total += line_total
        order_items.append(CustOrdItem(prod_id=product.prod_id, quantity=item.quantity, unit_price=product.price))

    order = CustOrd(
        cust_id=cust_id,
        sale_cnl_id=payload.sale_cnl_id,
        total_price=total,
        gnl_st_id=DEFAULT_ORDER_STATUS_ID,
        items=order_items,
    )
    db.add(order)
    await db.commit()

    result = await db.execute(
        select(CustOrd).options(selectinload(CustOrd.items)).where(CustOrd.cust_ord_id == order.cust_ord_id)
    )
    return result.scalar_one()
