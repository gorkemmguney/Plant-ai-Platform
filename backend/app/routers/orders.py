from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_current_user, get_user_roles, require_role
from app.db.session import get_db
from app.models.campaign import UserCoupon
from app.models.catalog import Prod
from app.models.order import CustOrd, CustOrdItem
from app.models.user import AppUser
from app.rbac.roles import RoleName

from app.schemas.order import (
    OrderCreateIn,
    OrderOut,
    OrderStatusUpdateIn,
    OrderVisibilityUpdateIn,
)
from app.services.order_service import (
    attach_hidden_flags,
    create_order,
    set_order_hidden,
    update_order_status,
)

router = APIRouter(prefix="/orders", tags=["Orders"])

# Müşterinin iptal edebileceği durumlar (Alındı, Hazırlanıyor); sonrası iptal edilemez
CANCELLABLE_STATUSES = {5, 6}
CANCELLED_STATUS = 9


@router.post("", response_model=list[OrderOut])
async def create_new_order(
    payload: OrderCreateIn,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.CUSTOMER, RoleName.ADMIN)),
):
    orders = await create_order(db, user.user_id, payload)

    # Kupon seçildiyse: sadece kuponun ait olduğu mağazanın siparişine indirim uygula
    if payload.coupon_id is not None:
        coupon = (
            await db.execute(
                select(UserCoupon).where(
                    UserCoupon.coupon_id == payload.coupon_id,
                    UserCoupon.user_id == user.user_id,
                    UserCoupon.is_used == False,
                )
            )
        ).scalar_one_or_none()

        if coupon is not None:
            coupon_campaign = await coupon.awaitable_attrs.campaign if hasattr(coupon, "awaitable_attrs") else None
            seller_id_for_coupon = coupon_campaign.seller_id if coupon_campaign else None

            applied_order = None
            if seller_id_for_coupon is not None:
                for o in orders:
                    first_item = o.items[0] if o.items else None
                    if first_item:
                        prod = (await db.execute(select(Prod).where(Prod.prod_id == first_item.prod_id))).scalar_one_or_none()
                        if prod and prod.seller_id == seller_id_for_coupon:
                            applied_order = o
                            break
            if applied_order is None and orders:
                applied_order = orders[0]

            if applied_order is not None:
                applied_order.total_price = max(0, applied_order.total_price - coupon.discount_amount)
                coupon.is_used = True
                await db.commit()

    return orders


@router.get("/my", response_model=list[OrderOut])
async def list_my_orders(
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.CUSTOMER, RoleName.ADMIN)),
):
    result = await db.execute(
        select(CustOrd)
        .options(selectinload(CustOrd.items))
        .where(CustOrd.user_id == user.user_id)
        .order_by(CustOrd.order_date.desc())
    )
    orders = list(result.scalars().all())
    await attach_hidden_flags(db, orders)
    return orders


@router.get("/all", response_model=list[OrderOut])
async def list_all_orders(
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.SELLER, RoleName.ADMIN)),
):
    query = (
        select(CustOrd)
        .options(selectinload(CustOrd.items))
        .where(
            CustOrd.cust_ord_id.in_(
                select(CustOrdItem.cust_ord_id)
                .join(Prod, Prod.prod_id == CustOrdItem.prod_id)
                .where(Prod.seller_id == user.user_id)
            )
        )
        .order_by(CustOrd.order_date.desc())
    )

    result = await db.execute(query)
    orders = list(result.scalars().all())
    await attach_hidden_flags(db, orders)
    return orders


async def _ensure_seller_owns_order(cust_ord_id: int, user: AppUser, db: AsyncSession) -> None:
    roles = await get_user_roles(user, db)
    if RoleName.ADMIN in roles:
        return
    result = await db.execute(
        select(CustOrdItem.cust_ord_item_id)
        .join(Prod, Prod.prod_id == CustOrdItem.prod_id)
        .where(CustOrdItem.cust_ord_id == cust_ord_id, Prod.seller_id == user.user_id)
        .limit(1)
    )
    if result.first() is None:
        raise HTTPException(status_code=403, detail="Bu sipariş üzerinde işlem yapma yetkiniz yok")


@router.patch("/{cust_ord_id}/status", response_model=OrderOut)
async def update_order_status_endpoint(
    cust_ord_id: int,
    payload: OrderStatusUpdateIn,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.SELLER, RoleName.ADMIN)),
):
    await _ensure_seller_owns_order(cust_ord_id, user, db)
    return await update_order_status(db, cust_ord_id, payload.gnl_st_id)


@router.patch("/{cust_ord_id}/visibility", response_model=OrderOut)
async def update_order_visibility(
    cust_ord_id: int,
    payload: OrderVisibilityUpdateIn,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.CUSTOMER, RoleName.ADMIN)),
):
    result = await db.execute(
        select(CustOrd).options(selectinload(CustOrd.items)).where(CustOrd.cust_ord_id == cust_ord_id)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Sipariş bulunamadı")
    if order.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Bu sipariş size ait değil")

    await set_order_hidden(db, order.cust_ord_id, payload.is_hidden)
    await db.commit()
    await db.refresh(order, attribute_names=["items"])
    order.is_hidden = payload.is_hidden
    return order


@router.post("/{cust_ord_id}/cancel", response_model=OrderOut)
async def cancel_my_order(
    cust_ord_id: int,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.CUSTOMER, RoleName.ADMIN)),
):
    result = await db.execute(
        select(CustOrd).options(selectinload(CustOrd.items)).where(CustOrd.cust_ord_id == cust_ord_id)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Sipariş bulunamadı")
    if order.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Bu sipariş size ait değil")
    if order.gnl_st_id not in CANCELLABLE_STATUSES:
        raise HTTPException(status_code=400, detail="Bu sipariş artık iptal edilemez")

    # Stokları geri ekle
    for item in order.items:
        prod_result = await db.execute(select(Prod).where(Prod.prod_id == item.prod_id))
        prod = prod_result.scalar_one_or_none()
        if prod is not None:
            prod.stock += item.quantity

    order.gnl_st_id = CANCELLED_STATUS
    await db.commit()
    await db.refresh(order, attribute_names=["items"])
    return order
