from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import get_user_roles, require_role
from app.db.session import get_db
from app.models.catalog import Prod
from app.models.user import AppUser
from app.rbac.roles import RoleName
from app.schemas.catalog import ProductCreateIn, ProductOut, ProductUpdateIn

router = APIRouter(prefix="/catalog", tags=["catalog"])


async def _ensure_owner_or_admin(product: Prod, user: AppUser, db: AsyncSession) -> None:
    roles = await get_user_roles(user, db)
    if RoleName.ADMIN in roles:
        return
    if product.owner_user_id != user.user_id:
        raise HTTPException(
            status_code=403,
            detail="Bu ürün üzerinde işlem yapma yetkiniz yok",
        )


@router.get("/products", response_model=list[ProductOut])
async def list_products(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Prod))
    return result.scalars().all()


@router.get("/products/my-products", response_model=list[ProductOut])
async def list_my_products(
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.SELLER, RoleName.ADMIN)),
):
    result = await db.execute(select(Prod).where(Prod.owner_user_id == user.user_id))
    return result.scalars().all()


@router.get("/products/{prod_id}", response_model=ProductOut)
async def get_product(prod_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Prod).where(Prod.prod_id == prod_id))
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    return product


@router.post("/products", response_model=ProductOut)
async def create_product(
    payload: ProductCreateIn,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.SELLER, RoleName.ADMIN)),
):
    product = Prod(**payload.model_dump(), owner_user_id=user.user_id)
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


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
    return product


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

    await db.delete(product)
    await db.commit()
    return {"detail": "Ürün silindi"}
