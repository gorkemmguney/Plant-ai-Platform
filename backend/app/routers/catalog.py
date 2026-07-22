import random
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_user_roles, require_role
from app.core.storage import upload_image
from app.db.session import get_db
from app.models.catalog import GnlChar, GnlCharVal, Prod, ProdCharVal, ProdSpec
from app.models.order import CustOrdItem
from app.models.user import AppUser
from app.rbac.roles import RoleName
from app.schemas.catalog import (
    CharacteristicCreateIn,
    CharacteristicOut,
    CharValueCreateIn,
    CharValueOut,
    ProdSpecOut,
    ProductCharacteristicOut,
    ProductCreateIn,
    ProductOut,
    ProductUpdateIn,
    SellerOut,
)

router = APIRouter(prefix="/catalog", tags=["catalog"])


def _full_name(first: str | None, last: str | None) -> str | None:
    name = f"{first or ''} {last or ''}".strip()
    return name or None


def _display_name(store_name: str | None, first: str | None, last: str | None) -> str | None:
    return store_name or _full_name(first, last)


def _product_out(
    prod: Prod,
    store_name: str | None,
    first: str | None,
    last: str | None,
    characteristics: list[ProductCharacteristicOut] | None = None,
) -> ProductOut:
    return ProductOut(
        prod_id=prod.prod_id,
        name=prod.name,
        description=prod.description,
        price=prod.price,
        stock=prod.stock,
        gnl_st_id=prod.gnl_st_id,
        prod_spec_id=prod.prod_spec_id,
        category=prod.category,
        image_url=prod.image_url,
        seller_id=prod.seller_id,
        seller_name=_display_name(store_name, first, last),
        characteristics=characteristics or [],
    )


async def _seller_name(db: AsyncSession, seller_id: int | None) -> tuple[str | None, str | None, str | None]:
    if seller_id is None:
        return None, None, None
    result = await db.execute(
        select(AppUser.store_name, AppUser.first_name, AppUser.last_name).where(AppUser.user_id == seller_id)
    )
    row = result.first()
    return (row[0], row[1], row[2]) if row else (None, None, None)


async def _ensure_owner_or_admin(product: Prod, user: AppUser, db: AsyncSession) -> None:
    roles = await get_user_roles(user, db)
    if RoleName.ADMIN in roles:
        return
    if product.seller_id != user.user_id:
        raise HTTPException(status_code=403, detail="Bu ürün üzerinde işlem yapma yetkiniz yok")


async def _characteristics_for_products(db: AsyncSession, prod_ids: list[int]) -> dict[int, list[ProductCharacteristicOut]]:
    """Birden fazla ürünün karakteristiklerini TEK sorguda toplu olarak çeker."""
    if not prod_ids:
        return {}
    result = await db.execute(
        select(
            ProdCharVal.prod_id,
            GnlChar.gnl_char_id,
            GnlChar.name,
            GnlCharVal.gnl_char_val_id,
            GnlCharVal.value,
        )
        .join(GnlChar, GnlChar.gnl_char_id == ProdCharVal.gnl_char_id)
        .join(GnlCharVal, GnlCharVal.gnl_char_val_id == ProdCharVal.gnl_char_val_id)
        .where(ProdCharVal.prod_id.in_(prod_ids))
    )
    mapping: dict[int, list[ProductCharacteristicOut]] = {}
    for prod_id, gnl_char_id, char_name, gnl_char_val_id, value in result.all():
        mapping.setdefault(prod_id, []).append(
            ProductCharacteristicOut(
                gnl_char_id=gnl_char_id, char_name=char_name, gnl_char_val_id=gnl_char_val_id, value=value
            )
        )
    return mapping


async def _sync_product_characteristics(db: AsyncSession, prod: Prod, char_value_ids: list[int]) -> None:
    """Ürünün karakteristik atamalarını verilen gnl_char_val_id listesiyle değiştirir (tamamen yeniden yazar)."""
    await db.execute(delete(ProdCharVal).where(ProdCharVal.prod_id == prod.prod_id))
    if not char_value_ids:
        return

    result = await db.execute(select(GnlCharVal).where(GnlCharVal.gnl_char_val_id.in_(char_value_ids)))
    valid_values = {v.gnl_char_val_id: v for v in result.scalars().all()}
    missing = set(char_value_ids) - set(valid_values.keys())
    if missing:
        raise HTTPException(status_code=400, detail=f"Geçersiz karakteristik değeri id'leri: {sorted(missing)}")

    for val_id in char_value_ids:
        gval = valid_values[val_id]
        db.add(
            ProdCharVal(
                prod_id=prod.prod_id,
                prod_spec_id=prod.prod_spec_id,
                gnl_char_id=gval.gnl_char_id,
                gnl_char_val_id=gval.gnl_char_val_id,
            )
        )


# Karakteristikler (gnl_char / gnl_char_val) - herkese acik okuma, admin yazma


@router.get("/characteristics", response_model=list[CharacteristicOut])
async def list_characteristics(db: AsyncSession = Depends(get_db)):
    """Satıcının ürün formunda seçebileceği, müşterinin filtrede kullanabileceği tam liste."""
    result = await db.execute(select(GnlChar).order_by(GnlChar.name))
    chars = result.scalars().all()

    out: list[CharacteristicOut] = []
    for c in chars:
        vals_result = await db.execute(
            select(GnlCharVal).where(GnlCharVal.gnl_char_id == c.gnl_char_id).order_by(GnlCharVal.value)
        )
        vals = vals_result.scalars().all()
        out.append(
            CharacteristicOut(
                gnl_char_id=c.gnl_char_id,
                name=c.name,
                description=c.description,
                values=[CharValueOut(gnl_char_val_id=v.gnl_char_val_id, value=v.value) for v in vals],
            )
        )
    return out


@router.post("/characteristics", response_model=CharacteristicOut)
async def create_characteristic(
    payload: CharacteristicCreateIn,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    char = GnlChar(name=payload.name, description=payload.description)
    db.add(char)
    await db.commit()
    await db.refresh(char)
    return CharacteristicOut(gnl_char_id=char.gnl_char_id, name=char.name, description=char.description, values=[])


@router.delete("/characteristics/{gnl_char_id}")
async def delete_characteristic(
    gnl_char_id: int,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    result = await db.execute(select(GnlChar).where(GnlChar.gnl_char_id == gnl_char_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Karakteristik bulunamadı")
    await db.execute(delete(ProdCharVal).where(ProdCharVal.gnl_char_id == gnl_char_id))
    await db.execute(delete(GnlCharVal).where(GnlCharVal.gnl_char_id == gnl_char_id))
    await db.execute(delete(GnlChar).where(GnlChar.gnl_char_id == gnl_char_id))
    await db.commit()
    return {"detail": "Karakteristik ve bağlı değerler silindi"}


@router.post("/characteristics/{gnl_char_id}/values", response_model=CharValueOut)
async def create_characteristic_value(
    gnl_char_id: int,
    payload: CharValueCreateIn,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    char_result = await db.execute(select(GnlChar).where(GnlChar.gnl_char_id == gnl_char_id))
    if char_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Karakteristik bulunamadı")

    val = GnlCharVal(gnl_char_id=gnl_char_id, value=payload.value)
    db.add(val)
    await db.commit()
    await db.refresh(val)
    return CharValueOut(gnl_char_val_id=val.gnl_char_val_id, value=val.value)


@router.delete("/characteristics/values/{gnl_char_val_id}")
async def delete_characteristic_value(
    gnl_char_val_id: int,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    result = await db.execute(select(GnlCharVal).where(GnlCharVal.gnl_char_val_id == gnl_char_val_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Değer bulunamadı")
    await db.execute(delete(ProdCharVal).where(ProdCharVal.gnl_char_val_id == gnl_char_val_id))
    await db.execute(delete(GnlCharVal).where(GnlCharVal.gnl_char_val_id == gnl_char_val_id))
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
        select(Prod, AppUser.store_name, AppUser.first_name, AppUser.last_name)
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
        _product_out(prod, store_name, first, last, char_map.get(prod.prod_id, []))
        for (prod, store_name, first, last) in rows
    ]


@router.get("/products/{prod_id}/related", response_model=list[ProductOut])
async def related_products(
    prod_id: int,
    limit: int = Query(default=4, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
):
    """Bu ürünle 'birlikte alınan' öneriler. Yeterli sipariş verisi yoksa
    aynı mağaza ve aynı türdeki ürünlerle tamamlanır."""
    target = (await db.execute(select(Prod).where(Prod.prod_id == prod_id))).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")

    # 1) Gerçekten birlikte alınanlar (aynı siparişte geçen diğer ürünler, sıklığa göre)
    order_ids = select(CustOrdItem.cust_ord_id).where(CustOrdItem.prod_id == prod_id)
    co_rows = (
        await db.execute(
            select(CustOrdItem.prod_id)
            .where(CustOrdItem.cust_ord_id.in_(order_ids), CustOrdItem.prod_id != prod_id)
            .group_by(CustOrdItem.prod_id)
            .order_by(func.count().desc())
        )
    ).scalars().all()

    # Aday sıralaması: önce birlikte alınanlar, sonra aynı mağaza, sonra aynı tür
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
    # Bitki malzemeleri de öner (saksı, toprak, gübre vb.) — ama malzemenin yanına başka
    # malzeme değil, bitki önerelim diye yalnızca hedef bir bitkiyse ekle
    if target.category == "plant":
        await _extend(Prod.category == "supply")
    await _extend(Prod.prod_spec_id == target.prod_spec_id)

    # Gerçekten birlikte alınanları başta tut; gerisini karıştır ki her seferinde
    # farklı ürünler önerelim (hep aynı sırayla gelmesin)
    fixed = list(co_rows)
    rest = [pid for pid in ordered_ids if pid not in fixed]
    random.shuffle(rest)
    ordered_ids = fixed + rest

    if not ordered_ids:
        return []

    # Geçerli (stokta + aktif) ürünleri çek, aday sırasına göre diz, limitle
    rows = (
        await db.execute(
            select(Prod, AppUser.store_name, AppUser.first_name, AppUser.last_name)
            .outerjoin(AppUser, AppUser.user_id == Prod.seller_id)
            .where(Prod.prod_id.in_(ordered_ids), Prod.stock > 0, Prod.is_active.is_(True))
        )
    ).all()
    by_id = {prod.prod_id: (prod, store_name, first, last) for (prod, store_name, first, last) in rows}

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
            AppUser.user_id, AppUser.store_name, AppUser.first_name, AppUser.last_name, func.count(Prod.prod_id),
        )
        .join(Prod, Prod.seller_id == AppUser.user_id)
        .where(
            Prod.stock > 0,
            Prod.is_active.is_(True),
            AppUser.is_active.is_(True),
        )
        .group_by(AppUser.user_id, AppUser.store_name, AppUser.first_name, AppUser.last_name)
        .order_by(AppUser.user_id)
    )
    return [
        SellerOut(
            seller_id=uid,
            seller_name=_display_name(store_name, first, last) or f"Satıcı #{uid}",
            product_count=count,
        )
        for (uid, store_name, first, last, count) in result.all()
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
    char_map = await _characteristics_for_products(db, [p.prod_id for p in products])
    return [
        _product_out(p, user.store_name, user.first_name, user.last_name, char_map.get(p.prod_id, []))
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
    data = payload.model_dump(exclude={"char_value_ids"})
    product = Prod(**data, seller_id=user.user_id)
    db.add(product)
    await db.flush()

    await _sync_product_characteristics(db, product, payload.char_value_ids)

    await db.commit()
    await db.refresh(product)
    char_map = await _characteristics_for_products(db, [product.prod_id])
    return _product_out(product, user.store_name, user.first_name, user.last_name, char_map.get(product.prod_id, []))


@router.patch("/products/{prod_id}", response_model=ProductOut)
async def update_product(
    prod_id: int,
    payload: ProductUpdateIn,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.SELLER, RoleName.ADMIN)),
):
    result = await db.execute(select(Prod).where(Prod.prod_id == prod_id))
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")

    await _ensure_owner_or_admin(product, user, db)

    for field, value in payload.model_dump(exclude_unset=True, exclude={"char_value_ids"}).items():
        setattr(product, field, value)

    if payload.char_value_ids is not None:
        await _sync_product_characteristics(db, product, payload.char_value_ids)

    await db.commit()
    await db.refresh(product)
    store_name, first, last = await _seller_name(db, product.seller_id)
    char_map = await _characteristics_for_products(db, [product.prod_id])
    return _product_out(product, store_name, first, last, char_map.get(product.prod_id, []))


@router.post("/products/{prod_id}/image", response_model=ProductOut)
async def upload_product_image(
    prod_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.SELLER, RoleName.ADMIN)),
):
    """Satıcının ürüne fotoğraf yükleyip/güncelleyebilmesi için — Supabase Storage'a yükler."""
    result = await db.execute(select(Prod).where(Prod.prod_id == prod_id))
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")

    await _ensure_owner_or_admin(product, user, db)

    image_bytes = await file.read()
    image_url = upload_image(image_bytes, file.content_type or "image/jpeg", folder="products")
    product.image_url = image_url

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
    result = await db.execute(select(Prod).where(Prod.prod_id == prod_id))
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")

    await _ensure_owner_or_admin(product, user, db)

    product.is_active = False
    product.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"detail": "Ürün pasifleştirildi"}
