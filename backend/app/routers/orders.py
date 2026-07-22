from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_user_roles, require_role
from app.db.session import get_db
from app.models.campaign import UserCoupon
from app.models.catalog import Prod
from app.models.customer import Cust
from app.models.order import CustOrd, CustOrdItem
from app.models.user import AppUser
from app.rbac.roles import RoleName
from app.schemas.order import OrderCreateIn, OrderOut, OrderStatusUpdateIn
from app.services.order_service import create_order, update_order_status

router = APIRouter(prefix="/orders", tags=["orders"])

# Müşterinin iptal edebileceği durumlar (Alındı, Hazırlanıyor); sonrası iptal edilemez
CANCELLABLE_STATUSES = {5, 6}
CANCELLED_STATUS = 9


async def _get_cust_id(user: AppUser, db: AsyncSession) -> int:
    result = await db.execute(select(Cust).where(Cust.user_id == user.user_id))
    cust = result.scalar_one_or_none()
    if cust is None:
        raise HTTPException(status_code=400, detail="Bu kullanıcı için müşteri profili bulunamadı")
    return cust.cust_id


@router.post("", response_model=list[OrderOut])
async def create_new_order(
    payload: OrderCreateIn,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.CUSTOMER, RoleName.ADMIN)),
):
    cust_id = await _get_cust_id(user, db)
    # Sepet birden fazla satıcının ürününü içeriyorsa, burada satıcı başına
    # ayrı bir sipariş oluşur — bu yüzden dönüş değeri her zaman bir listedir.
    orders = await create_order(db, cust_id, payload)

    # Kupon seçildiyse: sadece kuponun ait olduğu mağazanın siparişine indirim uygula
    if payload.coupon_id is not None:
        coupon = (
            await db.execute(
                select(UserCoupon).where(
                    UserCoupon.coupon_id == payload.coupon_id,
                    UserCoupon.user_id == user.user_id,
                )
            )
        ).scalar_one_or_none()
        if coupon is None or coupon.is_used:
            raise HTTPException(status_code=400, detail="Kupon geçersiz veya zaten kullanılmış")

        # Her sipariş tek bir satıcıya ait — kuponun mağazasına ait olanı bul
        target = None
        for o in orders:
            prod_ids = [it.prod_id for it in o.items if it.prod_id is not None]
            if not prod_ids:
                continue
            seller_id = (
                await db.execute(select(Prod.seller_id).where(Prod.prod_id == prod_ids[0]))
            ).scalar_one_or_none()
            if seller_id == coupon.seller_id:
                target = o
                break
        if target is None:
            raise HTTPException(
                status_code=400,
                detail="Bu kupon sadece kendi mağazasında geçerli; sepette o mağazadan ürün yok",
            )

        discount = float(coupon.discount_amount)
        target.total_price = max(0.0, float(target.total_price) - discount)
        coupon.is_used = True
        await db.commit()

    # Oyunlaştırma: harcanan her ₺ için 1 puan kazandır (indirim sonrası tutar üzerinden)
    earned = int(sum(float(o.total_price) for o in orders))
    if earned > 0:
        user.points = (user.points or 0) + earned
        await db.commit()
    return orders


@router.get("", response_model=list[OrderOut])
async def list_my_orders(
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.CUSTOMER, RoleName.ADMIN)),
):
    cust_id = await _get_cust_id(user, db)
    result = await db.execute(
        select(CustOrd).options(selectinload(CustOrd.items)).where(CustOrd.cust_id == cust_id)
    )
    return result.scalars().all()


@router.get("/all", response_model=list[OrderOut])
async def list_all_orders(
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.SELLER, RoleName.ADMIN)),
):
    # NOT: Bu endpoint "satıcının kendi mağaza siparişleri" ekranını besler.
    # Admin rolü olsa bile burada HER ZAMAN sadece kullanıcının kendi
    # ürünlerini içeren siparişler döner — admin'in platform genelinde tüm
    # siparişleri görebileceği ayrı bir endpoint şu an mevcut değil,
    # istenirse /admin altına ayrıca eklenebilir.
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
    return result.scalars().all()


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


@router.post("/{cust_ord_id}/cancel", response_model=OrderOut)
async def cancel_my_order(
    cust_ord_id: int,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.CUSTOMER, RoleName.ADMIN)),
):
    cust_id = await _get_cust_id(user, db)
    result = await db.execute(
        select(CustOrd).options(selectinload(CustOrd.items)).where(CustOrd.cust_ord_id == cust_ord_id)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Sipariş bulunamadı")
    if order.cust_id != cust_id:
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
    # Sipariş için kazanılan puanı geri al (0'ın altına düşürme)
    refunded_points = int(float(order.total_price))
    user.points = max(0, (user.points or 0) - refunded_points)
    await db.commit()

    # NOT: commit sonrası db.refresh(order) sadece siparişin kendi kolonlarını
    # tazeler — item.char_values gibi iç içe ilişkiler "expired" kalır ve
    # response serileştirilirken senkron/greenlet dışı erişim hatası verir
    # (MissingGreenlet). Bunun yerine tam ağacı eager-load ile yeniden çekiyoruz.
    result = await db.execute(
        select(CustOrd).options(selectinload(CustOrd.items)).where(CustOrd.cust_ord_id == cust_ord_id)
    )
    return result.scalar_one()
