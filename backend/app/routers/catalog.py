from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_role
from app.db.session import get_db
from app.models.catalog import Prod
from app.models.user import AppUser
from app.rbac.roles import RoleName
from app.schemas.catalog import ProductCreateIn, ProductOut, ProductUpdateIn

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/products", response_model=list[ProductOut])
async def list_products(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Prod))
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
    _: AppUser = Depends(require_role(RoleName.SELLER, RoleName.ADMIN)),
):
    product = Prod(**payload.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.patch("/products/{prod_id}", response_model=ProductOut)
async def update_product(
    prod_id: int,
    payload: ProductUpdateIn,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.SELLER, RoleName.ADMIN)),
):
    result = await db.execute(select(Prod).where(Prod.prod_id == prod_id))
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)

    await db.commit()
    await db.refresh(product)
    return product


@router.delete("/products/{prod_id}")
async def delete_product(
    prod_id: int,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.SELLER, RoleName.ADMIN)),
):
    result = await db.execute(select(Prod).where(Prod.prod_id == prod_id))
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    await db.delete(product)
    await db.commit()
    return {"detail": "Ürün silindi"}
