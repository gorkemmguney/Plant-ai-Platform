from decimal import Decimal

from app.models.customer import Cust
from app.services.notification_service import create_notification

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import GnlChar, GnlCharVal, Prod, ProdCharVal
from app.models.address import CustomerAddress
from app.models.order import CustOrd, CustOrdCharVal, CustOrdItem, CustOrdItemCharVal
from app.models.user import AppUser
from app.schemas.order import OrderCreateIn

DEFAULT_ORDER_STATUS_ID = 5

# "is_hidden" artık cust_ord'da ayrı bir kolon değil; bu code'a sahip gnl_char
# üzerinden cust_ord_char_val'de tutuluyor (bkz. migration e5f7a8c19d02).
IS_HIDDEN_GNL_CHAR_CODE = "IS_HIDDEN"

_is_hidden_gnl_char_id_cache: int | None = None


async def _get_is_hidden_gnl_char_id(db: AsyncSession) -> int:
    global _is_hidden_gnl_char_id_cache
    if _is_hidden_gnl_char_id_cache is not None:
        return _is_hidden_gnl_char_id_cache

    result = await db.execute(select(GnlChar.gnl_char_id).where(GnlChar.code == IS_HIDDEN_GNL_CHAR_CODE))
    gnl_char_id = result.scalar_one_or_none()
    if gnl_char_id is None:
        raise RuntimeError(
            f"'{IS_HIDDEN_GNL_CHAR_CODE}' code'lu gnl_char kaydı bulunamadı — migration e5f7a8c19d02 çalışmamış olabilir"
        )
    _is_hidden_gnl_char_id_cache = gnl_char_id
    return gnl_char_id


async def attach_hidden_flags(db: AsyncSession, orders: list[CustOrd]) -> list[CustOrd]:
    """Her CustOrd nesnesine transient (DB kolonu OLMAYAN) `is_hidden` attribute'unu ekler.
    Değer cust_ord_char_val'deki IS_HIDDEN kaydının varlığından hesaplanır."""
    if not orders:
        return orders

    gnl_char_id = await _get_is_hidden_gnl_char_id(db)
    order_ids = [o.cust_ord_id for o in orders]
    result = await db.execute(
        select(CustOrdCharVal.cust_ord_id).where(
            CustOrdCharVal.gnl_char_id == gnl_char_id,
            CustOrdCharVal.cust_ord_id.in_(order_ids),
            CustOrdCharVal.value == "true",
        )
    )
    hidden_ids = set(result.scalars().all())
    for order in orders:
        order.is_hidden = order.cust_ord_id in hidden_ids
    return orders


async def set_order_hidden(db: AsyncSession, cust_ord_id: int, hidden: bool) -> None:
    """Müşterinin sipariş gizleme tercihini cust_ord_char_val üzerinde günceller."""
    gnl_char_id = await _get_is_hidden_gnl_char_id(db)
    result = await db.execute(
        select(CustOrdCharVal).where(
            CustOrdCharVal.cust_ord_id == cust_ord_id,
            CustOrdCharVal.gnl_char_id == gnl_char_id,
        )
    )
    existing = result.scalar_one_or_none()

    if hidden and existing is None:
        db.add(CustOrdCharVal(cust_ord_id=cust_ord_id, gnl_char_id=gnl_char_id, value="true"))
    elif not hidden and existing is not None:
        await db.delete(existing)

_STATUS_MESSAGES = {
    5: "Siparişiniz alındı.",
    6: "Siparişiniz hazırlanıyor.",
    7: "Siparişiniz kargoya verildi.",
    8: "Siparişiniz teslim edildi.",
    9: "Siparişiniz iptal edildi.",
}

# Bildirim basligi da asamaya gore degissin
_STATUS_TITLES = {
    5: "🛒 Sipariş Alındı",
    6: "📦 Hazırlanıyor",
    7: "🚚 Kargoya Verildi",
    8: "✅ Teslim Edildi",
    9: "❌ Sipariş İptal Edildi",
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
        title = _STATUS_TITLES.get(gnl_st_id, "Sipariş Güncellemesi")
        message = _STATUS_MESSAGES.get(gnl_st_id, "Sipariş durumunuz güncellendi.")
        await create_notification(db, cust.user_id, title, f"#{order.cust_ord_id} — {message}")

    await db.commit()

    # NOT: db.refresh(order) sadece siparişin kendi kolonlarını tazeler,
    # item.char_values gibi iç içe ilişkiler "expired" kalıp response
    # serileştirilirken MissingGreenlet hatasına yol açar — tam ağacı
    # eager-load ile yeniden çekiyoruz.
    result = await db.execute(
        select(CustOrd).options(selectinload(CustOrd.items)).where(CustOrd.cust_ord_id == cust_ord_id)
    )
    order = result.scalar_one()
    await attach_hidden_flags(db, [order])
    return order


async def _valid_char_values_for_product(db: AsyncSession, prod_id: int) -> dict[int, tuple[int, str]]:
    """Bir ürüne satıcı tarafından atanmış geçerli karakteristik değerlerini döner.
    Dönen dict: {gnl_char_val_id: (gnl_char_id, value_text)}
    """
    result = await db.execute(
        select(ProdCharVal.gnl_char_val_id, ProdCharVal.gnl_char_id, GnlCharVal.value)
        .join(GnlCharVal, GnlCharVal.gnl_char_val_id == ProdCharVal.gnl_char_val_id)
        .where(ProdCharVal.prod_id == prod_id)
    )
    return {val_id: (char_id, value) for (val_id, char_id, value) in result.all()}


async def create_order(db: AsyncSession, cust_id: int, payload: OrderCreateIn) -> list[CustOrd]:
    if not payload.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sepet boş olamaz")

    # Teslimat adresi bu müşteriye mi ait, gerçekten kayıtlı mı doğrula
    address = (
        await db.execute(
            select(CustomerAddress).where(
                CustomerAddress.address_id == payload.address_id, CustomerAddress.cust_id == cust_id
            )
        )
    ).scalar_one_or_none()
    if address is None:
        raise HTTPException(status_code=400, detail="Geçersiz teslimat adresi")

    items_by_seller: dict[int | None, list[CustOrdItem]] = {}
    totals_by_seller: dict[int | None, Decimal] = {}
   
    pending_char_snapshots: list[tuple[CustOrdItem, list[tuple[int, str]]]] = []

    for item in payload.items:
        result = await db.execute(select(Prod).where(Prod.prod_id == item.prod_id))
        product = result.scalar_one_or_none()
        if product is None:
            raise HTTPException(status_code=404, detail=f"Ürün bulunamadı: {item.prod_id}")
        if product.stock < item.quantity:
            raise HTTPException(status_code=400, detail=f"Yetersiz stok: {product.name}")

    
        char_snapshots: list[tuple[int, str]] = []
        if item.selected_char_value_ids:
            valid_values = await _valid_char_values_for_product(db, product.prod_id)
            seen_char_ids: set[int] = set()
            for val_id in item.selected_char_value_ids:
                if val_id not in valid_values:
                    raise HTTPException(
                        status_code=400,
                        detail=f"'{product.name}' için geçersiz karakteristik değeri: {val_id}",
                    )
                char_id, value_text = valid_values[val_id]
                if char_id in seen_char_ids:
                    raise HTTPException(
                        status_code=400,
                        detail=f"'{product.name}' için aynı karakteristikten yalnızca bir değer seçebilirsiniz",
                    )
                seen_char_ids.add(char_id)
                char_snapshots.append((char_id, value_text))

        product.stock -= item.quantity
        line_total = product.price * item.quantity

        seller_store_name = None
        if product.seller_id is not None:
            seller = (
                await db.execute(select(AppUser).where(AppUser.user_id == product.seller_id))
            ).scalar_one_or_none()
            if seller is not None:
                seller_store_name = seller.store_name or f"{seller.first_name} {seller.last_name}"

        order_item = CustOrdItem(
            prod_id=product.prod_id,
            prod_name=product.name,
            quantity=item.quantity,
            unit_price=product.price,
            seller_id=product.seller_id,
            seller_store_name=seller_store_name,
        )

        seller_key = product.seller_id
        items_by_seller.setdefault(seller_key, []).append(order_item)
        totals_by_seller[seller_key] = totals_by_seller.get(seller_key, Decimal("0")) + line_total

        if char_snapshots:
            pending_char_snapshots.append((order_item, char_snapshots))

    new_orders: list[CustOrd] = []
    for seller_key, order_items in items_by_seller.items():
        order = CustOrd(
            cust_id=cust_id,
            sale_cnl_id=payload.sale_cnl_id,
            address_id=payload.address_id,
            total_price=totals_by_seller[seller_key],
            gnl_st_id=DEFAULT_ORDER_STATUS_ID,
            items=order_items,
        )
        db.add(order)
        new_orders.append(order)

    
    await db.flush()

    for order_item, char_snapshots in pending_char_snapshots:
        for gnl_char_id, value_text in char_snapshots:
            db.add(
                CustOrdItemCharVal(
                    cust_ord_item_id=order_item.cust_ord_item_id,
                    gnl_char_id=gnl_char_id,
                    value=value_text,
                )
            )

    await db.flush()

    # Sipariş oluşturulur oluşturulmaz müşteriye "Sipariş Alındı" bildirimi düşsün
    cust_row = (await db.execute(select(Cust).where(Cust.cust_id == cust_id))).scalar_one_or_none()
    if cust_row is not None:
        for order in new_orders:
            await create_notification(
                db,
                cust_row.user_id,
                _STATUS_TITLES[DEFAULT_ORDER_STATUS_ID],
                f"#{order.cust_ord_id} — {_STATUS_MESSAGES[DEFAULT_ORDER_STATUS_ID]}",
            )

    await db.commit()

    result_orders: list[CustOrd] = []
    for order in new_orders:
        result = await db.execute(
            select(CustOrd).options(selectinload(CustOrd.items)).where(CustOrd.cust_ord_id == order.cust_ord_id)
        )
        result_orders.append(result.scalar_one())

    await attach_hidden_flags(db, result_orders)
    return result_orders
