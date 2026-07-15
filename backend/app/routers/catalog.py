from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import get_user_roles, require_role
from app.db.session import get_db
from app.models.catalog import Prod, ProdSpec
from app.models.user import AppUser
from app.rbac.roles import RoleName
from app.schemas.catalog import ProdSpecOut, ProductCreateIn, ProductOut, ProductUpdateIn, SellerOut

router = APIRouter(prefix="/catalog", tags=["catalog"])


def _full_name(first: str | None, last: str | None) -> str | None:
    name = f"{first or ''} {last or ''}".strip()
    return name or None


def _display_name(store_name: str | None, first: str | None, last: str | None) -> str | None:
    return store_name or _full_name(first, last)


def _product_out(prod: Prod, store_name: str | None, first: str | None, last: str | None) -> ProductOut:
    return ProductOut(
        prod_id=prod.prod_id,
        name=prod.name,
        description=prod.description,
        price=prod.price,
        stock=prod.stock,
        gnl_st_id=prod.gnl_st_id,
        prod_spec_id=prod.prod_spec_id,
        seller_id=prod.seller_id,
        seller_name=_display_name(store_name, first, last),
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


@router.get("/products", response_model=list[ProductOut])
async def list_products(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Prod, AppUser.store_name, AppUser.first_name, AppUser.last_name)
        .outerjoin(AppUser, AppUser.user_id == Prod.seller_id)
        .where(
            Prod.seller_id.isnot(None),
            Prod.stock > 0,
            Prod.is_active.is_(True),
            AppUser.is_active.is_(True),
        )
    )
    return [_product_out(prod, store_name, first, last) for (prod, store_name, first, last) in result.all()]


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
    # Satıcı kendi ürünlerini (pasif olanlar dahil) görebilsin diye burada is_active filtrelemiyoruz.
    result = await db.execute(select(Prod).where(Prod.seller_id == user.user_id))
    return result.scalars().all()


@router.get("/products/{prod_id}", response_model=ProductOut)
async def get_product(prod_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Prod).where(Prod.prod_id == prod_id, Prod.is_active.is_(True))
    )
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    store_name, first, last = await _seller_name(db, product.seller_id)
    return _product_out(product, store_name, first, last)


@router.post("/products", response_model=ProductOut)
async def create_product(
    payload: ProductCreateIn,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.SELLER, RoleName.ADMIN)),
):
    product = Prod(**payload.model_dump(), seller_id=user.user_id)
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return _product_out(product, user.store_name, user.first_name, user.last_name)


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

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    await db.commit()
    await db.refresh(product)
    store_name, first, last = await _seller_name(db, product.seller_id)
    return _product_out(product, store_name, first, last)


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

    # Soft delete: sipariş geçmişindeki referanslar bozulmasın diye fiziksel silme yapmıyoruz.
    product.is_active = False
    from datetime import datetime, timezone
    product.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"detail": "Ürün pasifleştirildi"}
