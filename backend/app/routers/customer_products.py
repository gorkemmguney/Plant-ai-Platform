from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_current_user, require_role
from app.db.session import get_db
from app.models.customer import Cust
from app.models.catalog import ProdSpec
from app.models.customer_product import CustProd, CustProdCareLog, CustProdGrowthLog
from app.models.user import AppUser
from app.rbac.roles import RoleName
from app.schemas.customer_product import (
    CustProdCreateIn,
    CustProdUpdateIn,
    CustProdOut,
    CustProdCareLogCreateIn,
    CustProdCareLogOut,
    CustProdGrowthLogCreateIn,
    CustProdGrowthLogOut,
)

router = APIRouter(prefix="/customer-products", tags=["customer-products"])


async def _get_cust_id(user: AppUser, db: AsyncSession) -> int:
    result = await db.execute(select(Cust).where(Cust.user_id == user.user_id))
    cust = result.scalar_one_or_none()
    if cust is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu kullanıcı için müşteri profili bulunamadı"
        )
    return cust.cust_id


def _map_to_out(cp: CustProd) -> CustProdOut:
    # Sort logs by created_at descending
    sorted_care = sorted(cp.care_logs, key=lambda l: l.created_at, reverse=True) if cp.care_logs else []
    sorted_growth = sorted(cp.growth_logs, key=lambda l: l.created_at, reverse=True) if cp.growth_logs else []

    return CustProdOut(
        cust_prod_id=cp.cust_prod_id,
        cust_id=cp.cust_id,
        prod_spec_id=cp.prod_spec_id,
        name=cp.name,
        description=cp.description,
        image_url=cp.image_url,
        health_status=cp.health_status,
        location=cp.location,
        watering_interval_days=cp.watering_interval_days,
        last_watered_at=cp.last_watered_at,
        fertilizing_interval_days=cp.fertilizing_interval_days,
        last_fertilized_at=cp.last_fertilized_at,
        repotting_interval_days=cp.repotting_interval_days,
        last_repotted_at=cp.last_repotted_at,
        created_at=cp.created_at,
        updated_at=cp.updated_at,
        species_name=cp.specification.name if cp.specification else "Bilinmeyen Tür",
        care_logs=[CustProdCareLogOut.model_validate(l) for l in sorted_care],
        growth_logs=[CustProdGrowthLogOut.model_validate(l) for l in sorted_growth],
    )


@router.post("", response_model=CustProdOut, status_code=status.HTTP_201_CREATED)
async def create_customer_product(
    payload: CustProdCreateIn,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.CUSTOMER, RoleName.ADMIN))
):
    cust_id = await _get_cust_id(user, db)
    
    # Verify prod_spec exists
    spec_res = await db.execute(select(ProdSpec).where(ProdSpec.prod_spec_id == payload.prod_spec_id))
    spec = spec_res.scalar_one_or_none()
    if not spec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Seçilen bitki spesifikasyonu (türü) bulunamadı"
        )

    new_prod = CustProd(
        cust_id=cust_id,
        prod_spec_id=payload.prod_spec_id,
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
        image_url=payload.image_url,
        location=payload.location.strip() if payload.location else None,
        watering_interval_days=payload.watering_interval_days,
        fertilizing_interval_days=payload.fertilizing_interval_days,
        repotting_interval_days=payload.repotting_interval_days,
        health_status="healthy",
    )
    db.add(new_prod)
    await db.commit()
    
    # Reload with specification and log relationships
    res = await db.execute(
        select(CustProd)
        .options(
            selectinload(CustProd.specification),
            selectinload(CustProd.care_logs),
            selectinload(CustProd.growth_logs)
        )
        .where(CustProd.cust_prod_id == new_prod.cust_prod_id)
    )
    cp = res.scalar_one()
    return _map_to_out(cp)


@router.get("", response_model=list[CustProdOut])
async def list_customer_products(
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.CUSTOMER, RoleName.ADMIN))
):
    cust_id = await _get_cust_id(user, db)
    
    res = await db.execute(
        select(CustProd)
        .options(
            selectinload(CustProd.specification),
            selectinload(CustProd.care_logs),
            selectinload(CustProd.growth_logs)
        )
        .where(CustProd.cust_id == cust_id)
        .order_by(CustProd.created_at.desc())
    )
    cps = res.scalars().all()
    return [_map_to_out(cp) for cp in cps]


@router.get("/{cust_prod_id}", response_model=CustProdOut)
async def get_customer_product_detail(
    cust_prod_id: int,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.CUSTOMER, RoleName.ADMIN))
):
    cust_id = await _get_cust_id(user, db)
    
    res = await db.execute(
        select(CustProd)
        .options(
            selectinload(CustProd.specification),
            selectinload(CustProd.care_logs),
            selectinload(CustProd.growth_logs)
        )
        .where(CustProd.cust_prod_id == cust_prod_id, CustProd.cust_id == cust_id)
    )
    cp = res.scalar_one_or_none()
    if not cp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bitki profili bulunamadı veya erişim yetkiniz yok"
        )
    return _map_to_out(cp)


@router.patch("/{cust_prod_id}", response_model=CustProdOut)
async def update_customer_product(
    cust_prod_id: int,
    payload: CustProdUpdateIn,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.CUSTOMER, RoleName.ADMIN))
):
    cust_id = await _get_cust_id(user, db)
    
    res = await db.execute(
        select(CustProd)
        .options(
            selectinload(CustProd.specification),
            selectinload(CustProd.care_logs),
            selectinload(CustProd.growth_logs)
        )
        .where(CustProd.cust_prod_id == cust_prod_id, CustProd.cust_id == cust_id)
    )
    cp = res.scalar_one_or_none()
    if not cp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bitki profili bulunamadı veya düzenleme yetkiniz yok"
        )

    cp.name = payload.name.strip()
    cp.location = payload.location.strip() if payload.location else None
    cp.watering_interval_days = payload.watering_interval_days
    cp.fertilizing_interval_days = payload.fertilizing_interval_days
    cp.repotting_interval_days = payload.repotting_interval_days
    cp.health_status = payload.health_status
    cp.description = payload.description.strip() if payload.description else None
    cp.image_url = payload.image_url
    
    await db.commit()
    await db.refresh(cp)
    return _map_to_out(cp)


@router.delete("/{cust_prod_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer_product(
    cust_prod_id: int,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.CUSTOMER, RoleName.ADMIN))
):
    cust_id = await _get_cust_id(user, db)
    
    res = await db.execute(
        select(CustProd).where(CustProd.cust_prod_id == cust_prod_id, CustProd.cust_id == cust_id)
    )
    cp = res.scalar_one_or_none()
    if not cp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bitki profili bulunamadı veya silme yetkiniz yok"
        )

    await db.delete(cp)
    await db.commit()
    return


@router.post("/{cust_prod_id}/water", response_model=CustProdOut)
async def water_customer_product(
    cust_prod_id: int,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.CUSTOMER, RoleName.ADMIN))
):
    cust_id = await _get_cust_id(user, db)
    
    res = await db.execute(
        select(CustProd)
        .options(
            selectinload(CustProd.specification),
            selectinload(CustProd.care_logs),
            selectinload(CustProd.growth_logs)
        )
        .where(CustProd.cust_prod_id == cust_prod_id, CustProd.cust_id == cust_id)
    )
    cp = res.scalar_one_or_none()
    if not cp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bitki profili bulunamadı veya sulama yetkiniz yok"
        )

    now_time = datetime.now(timezone.utc)
    cp.last_watered_at = now_time
    
    # Log care action
    db.add(
        CustProdCareLog(
            cust_prod_id=cust_prod_id,
            care_type="water",
            notes="Sulanma eylemi (Hızlı buton)"
        )
    )
    await db.commit()
    await db.refresh(cp)
    return _map_to_out(cp)


@router.post("/{cust_prod_id}/care", response_model=CustProdOut)
async def add_care_log(
    cust_prod_id: int,
    payload: CustProdCareLogCreateIn,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.CUSTOMER, RoleName.ADMIN))
):
    cust_id = await _get_cust_id(user, db)
    
    res = await db.execute(
        select(CustProd)
        .options(
            selectinload(CustProd.specification),
            selectinload(CustProd.care_logs),
            selectinload(CustProd.growth_logs)
        )
        .where(CustProd.cust_prod_id == cust_prod_id, CustProd.cust_id == cust_id)
    )
    cp = res.scalar_one_or_none()
    if not cp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bitki profili bulunamadı veya bakım ekleme yetkiniz yok"
        )

    now_time = datetime.now(timezone.utc)
    if payload.care_type == "water":
        cp.last_watered_at = now_time
    elif payload.care_type == "fertilize":
        cp.last_fertilized_at = now_time
    elif payload.care_type == "repot":
        cp.last_repotted_at = now_time

    # Add log
    db.add(
        CustProdCareLog(
            cust_prod_id=cust_prod_id,
            care_type=payload.care_type,
            notes=payload.notes.strip() if payload.notes else None
        )
    )
    await db.commit()
    await db.refresh(cp)
    return _map_to_out(cp)


@router.post("/{cust_prod_id}/growth", response_model=CustProdOut)
async def add_growth_log(
    cust_prod_id: int,
    payload: CustProdGrowthLogCreateIn,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.CUSTOMER, RoleName.ADMIN))
):
    cust_id = await _get_cust_id(user, db)
    
    res = await db.execute(
        select(CustProd)
        .options(
            selectinload(CustProd.specification),
            selectinload(CustProd.care_logs),
            selectinload(CustProd.growth_logs)
        )
        .where(CustProd.cust_prod_id == cust_prod_id, CustProd.cust_id == cust_id)
    )
    cp = res.scalar_one_or_none()
    if not cp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bitki profili bulunamadı veya günlük ekleme yetkiniz yok"
        )

    db.add(
        CustProdGrowthLog(
            cust_prod_id=cust_prod_id,
            image_url=payload.image_url,
            note=payload.note.strip()
        )
    )
    await db.commit()
    await db.refresh(cp)
    return _map_to_out(cp)
