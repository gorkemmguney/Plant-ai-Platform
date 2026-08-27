import random
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, get_user_roles, require_role, resolve_role_id
from app.core.storage import upload_image
from app.db.session import get_db
from app.models.catalog import GnlChar, GnlCharVal, Prod, ProdCharVal, ProdSpec
from app.models.customer import Ind, Org
from app.models.customer_product import CustProd
from app.models.misc import BsnInter, BsnSpec
from app.models.order import CustOrdItem
from app.models.user import AppUser
from app.rbac.roles import RoleName
from app.schemas.catalog import (
    CharValueCreateIn,
    CharValueOut,
    CharacteristicCreateIn,
    CharacteristicOut,
    ProdSpecOut,
    ProductCharacteristicOut,
    ProductCreateIn,
    ProductOut,
    ProductUpdateIn,
    SellerOut,
)


router = APIRouter(prefix="/catalog", tags=["catalog"])


def _display_name(store_name: str | None, first_name: str | None, last_name: str | None) -> str | None:
    if store_name:
        return store_name
    parts = [p for p in (first_name, last_name) if p]
    return " ".join(parts) if parts else None


def _product_out(
    prod: Prod,
    store_name: str | None,
    first_name: str | None,
    last_name: str | None,
    chars: list[ProductCharacteristicOut],
) -> ProductOut:
    return ProductOut(
        prod_id=prod.prod_id,
        seller_id=prod.seller_id,
        seller_name=_display_name(store_name, first_name, last_name),
        prod_spec_id=prod.prod_spec_id,
        name=prod.name,
        category=prod.category,
        description=prod.description,
        price=prod.price,
        stock=prod.stock,
        is_active=prod.is_active,
        image_url=prod.image_url,
        created_at=prod.created_at,
        updated_at=getattr(prod, "updated_at", None) or prod.created_at,
        characteristics=chars,
    )



async def _seller_name(db: AsyncSession, seller_id: int | None) -> tuple[str | None, str | None, str | None]:
    if seller_id is None:
        return None, None, None
    org = (await db.execute(select(Org).where(Org.user_id == seller_id))).scalar_one_or_none()
    ind = (await db.execute(select(Ind).where(Ind.user_id == seller_id))).scalar_one_or_none()

    store = (org.store_name or org.company_name) if org else None
    first = (org.first_name if org else None) or (ind.first_name if ind else None)
    last = (org.last_name if org else None) or (ind.last_name if ind else None)
    return store, first, last


async def _ensure_owner_or_admin(product: Prod, user: AppUser, db: AsyncSession) -> None:
    roles = await get_user_roles(user, db)
    if RoleName.ADMIN in roles:
        return
    if product.seller_id != user.user_id:
        raise HTTPException(status_code=403, detail="Bu ürün üzerinde işlem yapma yetkiniz yok")


async def _characteristics_for_products(db: AsyncSession, prod_ids: list[int]) -> dict[int, list[ProductCharacteristicOut]]:
    if not prod_ids:
        return {}
    result = await db.execute(
        select(
            ProdCharVal.prod_id,
            GnlChar.gnl_char_id,
            GnlChar.name.label("char_name"),
            GnlCharVal.gnl_char_val_id,
            GnlCharVal.value.label("val_value"),
        )
        .join(GnlCharVal, GnlCharVal.gnl_char_val_id == ProdCharVal.gnl_char_val_id)
        .join(GnlChar, GnlChar.gnl_char_id == ProdCharVal.gnl_char_id)
        .where(ProdCharVal.prod_id.in_(prod_ids))
        .order_by(ProdCharVal.prod_id, GnlChar.gnl_char_id, GnlCharVal.gnl_char_val_id)
    )

    grouped: dict[int, list[ProductCharacteristicOut]] = {}
    for pid, char_id, char_name, val_id, val_text in result.all():
        grouped.setdefault(pid, []).append(
            ProductCharacteristicOut(
                gnl_char_id=char_id,
                char_name=char_name,
                gnl_char_val_id=val_id,
                value=val_text,
            )
        )

    return grouped



# Karakteristik Tanımları (Admin)


@router.get("/characteristics", response_model=list[CharacteristicOut])
async def list_characteristics(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GnlChar).order_by(GnlChar.gnl_char_id))
    chars = result.scalars().all()

    val_res = await db.execute(select(GnlCharVal).order_by(GnlCharVal.gnl_char_id, GnlCharVal.gnl_char_val_id))
    all_vals = val_res.scalars().all()

    val_map: dict[int, list[CharValueOut]] = {}
    for v in all_vals:
        val_map.setdefault(v.gnl_char_id, []).append(
            CharValueOut(gnl_char_val_id=v.gnl_char_val_id, value=v.value)
        )

    return [
        CharacteristicOut(
            gnl_char_id=c.gnl_char_id,
            name=c.name,
            values=val_map.get(c.gnl_char_id, []),
        )
        for c in chars
    ]


@router.post("/characteristics", response_model=CharacteristicOut)
async def create_characteristic(
    payload: CharacteristicCreateIn,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    char = GnlChar(name=payload.name.strip())
    db.add(char)
    await db.commit()
    await db.refresh(char)
    return CharacteristicOut(gnl_char_id=char.gnl_char_id, name=char.name, values=[])


@router.delete("/characteristics/{gnl_char_id}")
async def delete_characteristic(
    gnl_char_id: int,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    char = (await db.execute(select(GnlChar).where(GnlChar.gnl_char_id == gnl_char_id))).scalar_one_or_none()
    if char is None:
        raise HTTPException(status_code=404, detail="Karakteristik bulunamadı")
    await db.delete(char)
    await db.commit()
    return {"detail": "Karakteristik silindi"}


@router.post("/characteristics/{gnl_char_id}/values", response_model=CharValueOut)
async def add_characteristic_value(
    gnl_char_id: int,
    payload: CharValueCreateIn,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):

    char = (await db.execute(select(GnlChar).where(GnlChar.gnl_char_id == gnl_char_id))).scalar_one_or_none()
    if char is None:
        raise HTTPException(status_code=404, detail="Karakteristik bulunamadı")

    val = GnlCharVal(gnl_char_id=gnl_char_id, value=payload.value.strip())
    db.add(val)
    await db.commit()
    await db.refresh(val)
    return CharValueOut(gnl_char_val_id=val.gnl_char_val_id, value=val.value)



@router.delete("/characteristic-values/{gnl_char_val_id}")
async def delete_characteristic_value(
    gnl_char_val_id: int,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    val = (await db.execute(select(GnlCharVal).where(GnlCharVal.gnl_char_val_id == gnl_char_val_id))).scalar_one_or_none()
    if val is None:
        raise HTTPException(status_code=404, detail="Karakteristik değeri bulunamadı")
    await db.delete(val)
    await db.commit()
    return {"detail": "Değer silindi"}


# Urunler


@router.get("/products", response_model=list[ProductOut])
async def list_products(
    char_value_ids: str | None = Query(
        default=None, description="Virgülle ayrılmış gnl_char_val_id listesi (AND mantığı), ör: 3,7"
    ),
    category: str | None = Query(default=None, description="Ürün kategorisi filtresi: 'plant' veya 'supply'"),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Prod, Org.store_name, Org.company_name, Ind.first_name, Ind.last_name)
        .outerjoin(Org, Org.user_id == Prod.seller_id)
        .outerjoin(Ind, Ind.user_id == Prod.seller_id)
        .outerjoin(AppUser, AppUser.user_id == Prod.seller_id)
        .where(
            Prod.seller_id.isnot(None),
            Prod.stock > 0,
            Prod.is_active.is_(True),
            AppUser.is_active.is_(True),
        )
    )

    if category:
        query = query.where(Prod.category == category)

    if char_value_ids:
        try:
            ids = [int(x) for x in char_value_ids.split(",") if x.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="char_value_ids sayısal id listesi olmalı, ör: 3,7")
        if ids:
            query = query.where(
                Prod.prod_id.in_(
                    select(ProdCharVal.prod_id)
                    .where(ProdCharVal.gnl_char_val_id.in_(ids))
                    .group_by(ProdCharVal.prod_id)
                    .having(func.count(func.distinct(ProdCharVal.gnl_char_val_id)) == len(ids))
                )
            )

    result = await db.execute(query)
    rows = result.all()
    char_map = await _characteristics_for_products(db, [prod.prod_id for (prod, *_r) in rows])
    return [
        _product_out(prod, store_name or company_name, first, last, char_map.get(prod.prod_id, []))
        for (prod, store_name, company_name, first, last) in rows
    ]


@router.get("/products/{prod_id}/related", response_model=list[ProductOut])
async def related_products(
    prod_id: int,
    limit: int = Query(default=4, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
):
    target = (await db.execute(select(Prod).where(Prod.prod_id == prod_id))).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")

    order_ids = select(CustOrdItem.cust_ord_id).where(CustOrdItem.prod_id == prod_id)
    co_rows = (
        await db.execute(
            select(CustOrdItem.prod_id)
            .where(CustOrdItem.cust_ord_id.in_(order_ids), CustOrdItem.prod_id != prod_id)
            .group_by(CustOrdItem.prod_id)
            .order_by(func.count().desc())
        )
    ).scalars().all()

    ordered_ids: list[int] = list(co_rows)

    async def _extend(condition):
        ids = (
            await db.execute(
                select(Prod.prod_id)
                .where(condition, Prod.prod_id != prod_id, Prod.stock > 0, Prod.is_active.is_(True))
            )
        ).scalars().all()
        for pid in ids:
            if pid not in ordered_ids:
                ordered_ids.append(pid)

    if target.seller_id is not None:
        await _extend(Prod.seller_id == target.seller_id)
    if target.category == "plant":
        await _extend(Prod.category == "supply")
    await _extend(Prod.prod_spec_id == target.prod_spec_id)

    fixed = list(co_rows)
    rest = [pid for pid in ordered_ids if pid not in fixed]
    random.shuffle(rest)
    ordered_ids = fixed + rest

    if not ordered_ids:
        return []

    rows = (
        await db.execute(
            select(Prod, Org.store_name, Org.company_name, Ind.first_name, Ind.last_name)
            .outerjoin(Org, Org.user_id == Prod.seller_id)
            .outerjoin(Ind, Ind.user_id == Prod.seller_id)
            .where(Prod.prod_id.in_(ordered_ids), Prod.stock > 0, Prod.is_active.is_(True))
        )
    ).all()
    by_id = {prod.prod_id: (prod, store_name or company_name, first, last) for (prod, store_name, company_name, first, last) in rows}

    result: list[ProductOut] = []
    for pid in ordered_ids:
        entry = by_id.get(pid)
        if entry is None:
            continue
        prod, store_name, first, last = entry
        result.append(_product_out(prod, store_name, first, last, []))
        if len(result) >= limit:
            break
    return result


@router.get("/products/recommended", response_model=list[ProductOut])
async def recommended_products(
    limit: int = Query(default=6, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(get_current_user),
):
    spec_rows = (
        await db.execute(
            select(CustProd.prod_spec_id)
            .where(CustProd.user_id == user.user_id)
            .group_by(CustProd.prod_spec_id)
            .order_by(func.count().desc())
        )
    ).scalars().all()
    spec_ids = list(spec_rows)

    if not spec_ids:
        return []

    plant_ids: list[int] = []
    for sid in spec_ids:
        rows = (
            await db.execute(
                select(Prod.prod_id).where(
                    Prod.prod_spec_id == sid, Prod.stock > 0, Prod.is_active.is_(True), Prod.category == "plant"
                )
            )
        ).scalars().all()
        pool = [pid for pid in rows if pid not in plant_ids]
        random.shuffle(pool)
        plant_ids.extend(pool)

    supply_ids = (
        await db.execute(
            select(Prod.prod_id).where(
                Prod.category == "supply", Prod.stock > 0, Prod.is_active.is_(True)
            )
        )
    ).scalars().all()
    supply_ids = list(supply_ids)
    random.shuffle(supply_ids)

    n_supply = min(len(supply_ids), max(1, limit // 3))
    n_plant = limit - n_supply
    ordered_ids = plant_ids[:n_plant] + supply_ids[:n_supply]
    for pid in plant_ids[n_plant:] + supply_ids[n_supply:]:
        if len(ordered_ids) >= limit:
            break
        if pid not in ordered_ids:
            ordered_ids.append(pid)

    if not ordered_ids:
        return []

    rows = (
        await db.execute(
            select(Prod, Org.store_name, Org.company_name, Ind.first_name, Ind.last_name)
            .outerjoin(Org, Org.user_id == Prod.seller_id)
            .outerjoin(Ind, Ind.user_id == Prod.seller_id)
            .where(Prod.prod_id.in_(ordered_ids), Prod.stock > 0, Prod.is_active.is_(True))
        )
    ).all()
    by_id = {prod.prod_id: (prod, store_name or company_name, first, last) for (prod, store_name, company_name, first, last) in rows}

    result: list[ProductOut] = []
    for pid in ordered_ids:
        entry = by_id.get(pid)
        if entry is None:
            continue
        prod, store_name, first, last = entry
        result.append(_product_out(prod, store_name, first, last, []))
        if len(result) >= limit:
            break
    return result


@router.get("/sellers", response_model=list[SellerOut])
async def list_sellers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            AppUser.user_id, Org.store_name, Org.company_name, Ind.first_name, Ind.last_name, func.count(Prod.prod_id),
        )
        .join(Prod, Prod.seller_id == AppUser.user_id)
        .outerjoin(Org, Org.user_id == AppUser.user_id)
        .outerjoin(Ind, Ind.user_id == AppUser.user_id)
        .where(
            Prod.stock > 0,
            Prod.is_active.is_(True),
            AppUser.is_active.is_(True),
        )
        .group_by(AppUser.user_id, Org.store_name, Org.company_name, Ind.first_name, Ind.last_name)
        .order_by(AppUser.user_id)
    )
    return [
        SellerOut(
            seller_id=uid,
            seller_name=_display_name(store_name or company_name, first, last) or f"Satıcı #{uid}",
            product_count=count,
        )
        for (uid, store_name, company_name, first, last, count) in result.all()
    ]


@router.get("/product-specs", response_model=list[ProdSpecOut])
async def list_product_specs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProdSpec).order_by(ProdSpec.name))
    return result.scalars().all()


@router.get("/products/my-products", response_model=list[ProductOut])
async def list_my_products(
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.SELLER, RoleName.ADMIN)),
):
    result = await db.execute(select(Prod).where(Prod.seller_id == user.user_id))
    products = result.scalars().all()
    store_name, first, last = await _seller_name(db, user.user_id)
    char_map = await _characteristics_for_products(db, [p.prod_id for p in products])
    return [
        _product_out(p, store_name, first, last, char_map.get(p.prod_id, []))
        for p in products
    ]


@router.get("/products/{prod_id}", response_model=ProductOut)
async def get_product(prod_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Prod).where(Prod.prod_id == prod_id, Prod.is_active.is_(True))
    )
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    store_name, first, last = await _seller_name(db, product.seller_id)
    char_map = await _characteristics_for_products(db, [product.prod_id])
    return _product_out(product, store_name, first, last, char_map.get(product.prod_id, []))


@router.post("/products", response_model=ProductOut)
async def create_product(
    payload: ProductCreateIn,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.SELLER, RoleName.ADMIN)),
):
    data = payload.model_dump(exclude={"char_value_ids", "sale_cnl_id"})
    product = Prod(**data, seller_id=user.user_id)
    db.add(product)
    await db.flush()

    await _sync_product_characteristics(db, product, payload.char_value_ids)

    await _log_prod_event("PROD_ADD", user, db, payload.sale_cnl_id)
    await db.commit()

    store_name, first, last = await _seller_name(db, user.user_id)
    char_map = await _characteristics_for_products(db, [product.prod_id])
    return _product_out(product, store_name, first, last, char_map.get(product.prod_id, []))


@router.patch("/products/{prod_id}", response_model=ProductOut)
async def update_product(
    prod_id: int,
    payload: ProductUpdateIn,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.SELLER, RoleName.ADMIN)),
):
    product = (await db.execute(select(Prod).where(Prod.prod_id == prod_id))).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")

    await _ensure_owner_or_admin(product, user, db)

    update_data = payload.model_dump(exclude_unset=True, exclude={"char_value_ids", "sale_cnl_id"})
    for key, value in update_data.items():
        setattr(product, key, value)

    if payload.char_value_ids is not None:
        await _sync_product_characteristics(db, product, payload.char_value_ids)

    await _log_prod_event("PROD_EDIT", user, db, payload.sale_cnl_id)
    await db.commit()
    await db.refresh(product)

    store_name, first, last = await _seller_name(db, product.seller_id)
    char_map = await _characteristics_for_products(db, [product.prod_id])
    return _product_out(product, store_name, first, last, char_map.get(product.prod_id, []))


@router.delete("/products/{prod_id}")
async def delete_product(
    prod_id: int,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.SELLER, RoleName.ADMIN)),
):
    product = (await db.execute(select(Prod).where(Prod.prod_id == prod_id))).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")

    await _ensure_owner_or_admin(product, user, db)

    await _log_prod_event("PROD_DEL", user, db)
    await db.delete(product)
    await db.commit()
    return {"detail": "Ürün silindi"}


async def _sync_product_characteristics(db: AsyncSession, product: Prod, char_val_ids: list[int]) -> None:
    await db.execute(delete(ProdCharVal).where(ProdCharVal.prod_id == product.prod_id))
    if not char_val_ids:
        return

    result = await db.execute(
        select(GnlCharVal.gnl_char_val_id, GnlCharVal.gnl_char_id).where(
            GnlCharVal.gnl_char_val_id.in_(char_val_ids)
        )
    )
    valid_map = {val_id: char_id for val_id, char_id in result.all()}

    for val_id in char_val_ids:
        char_id = valid_map.get(val_id)
        if char_id is None:
            raise HTTPException(status_code=400, detail=f"Geçersiz gnl_char_val_id: {val_id}")
        db.add(ProdCharVal(prod_id=product.prod_id, gnl_char_val_id=val_id, gnl_char_id=char_id))


async def _log_prod_event(event_type: str, user: AppUser, db: AsyncSession, sale_cnl_id: int | None = None) -> None:
    role_id = await resolve_role_id(user, db, priority=[RoleName.SELLER.value, RoleName.ADMIN.value])
    bsn_spec = (
        await db.execute(select(BsnSpec).where(BsnSpec.code == event_type, BsnSpec.role_id == role_id))
    ).scalar_one_or_none()
    if bsn_spec is not None:
        db.add(
            BsnInter(
                user_id=user.user_id,
                bsn_spec_id=bsn_spec.bsn_spec_id,
                sale_cnl_id=sale_cnl_id,
            )
        )
