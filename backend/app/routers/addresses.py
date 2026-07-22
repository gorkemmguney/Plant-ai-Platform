from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.address import CustomerAddress
from app.models.customer import Cust
from app.models.location import Il, Ilce, Mahalle
from app.models.user import AppUser
from app.schemas.address import AddressCreateIn, AddressOut, AddressUpdateIn

router = APIRouter(prefix="/addresses", tags=["addresses"])


async def _get_cust_id(user: AppUser, db: AsyncSession) -> int:
    cust = (await db.execute(select(Cust).where(Cust.user_id == user.user_id))).scalar_one_or_none()
    if cust is None:
        raise HTTPException(status_code=400, detail="Müşteri profili bulunamadı")
    return cust.cust_id


async def _address_out(db: AsyncSession, addr: CustomerAddress) -> AddressOut:
    il = (await db.execute(select(Il).where(Il.il_id == addr.il_id))).scalar_one()
    ilce = (await db.execute(select(Ilce).where(Ilce.ilce_id == addr.ilce_id))).scalar_one()
    mahalle = (await db.execute(select(Mahalle).where(Mahalle.mahalle_id == addr.mahalle_id))).scalar_one()
    return AddressOut(
        address_id=addr.address_id,
        title=addr.title,
        il_id=addr.il_id,
        il_name=il.name,
        ilce_id=addr.ilce_id,
        ilce_name=ilce.name,
        mahalle_id=addr.mahalle_id,
        mahalle_name=mahalle.name,
        address_line=addr.address_line,
        is_default=addr.is_default,
        created_at=addr.created_at,
    )


@router.get("", response_model=list[AddressOut])
async def list_my_addresses(db: AsyncSession = Depends(get_db), user: AppUser = Depends(get_current_user)):
    cust_id = await _get_cust_id(user, db)
    addresses = (
        await db.execute(
            select(CustomerAddress)
            .where(CustomerAddress.cust_id == cust_id)
            .order_by(CustomerAddress.is_default.desc(), CustomerAddress.created_at.desc())
        )
    ).scalars().all()
    return [await _address_out(db, a) for a in addresses]


@router.post("", response_model=AddressOut)
async def create_address(
    payload: AddressCreateIn,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(get_current_user),
):
    cust_id = await _get_cust_id(user, db)

    # Seçilen il/ilçe/mahalle gerçekten var mı ve birbirine bağlı mı doğrula
    ilce = (await db.execute(select(Ilce).where(Ilce.ilce_id == payload.ilce_id))).scalar_one_or_none()
    if ilce is None or ilce.il_id != payload.il_id:
        raise HTTPException(status_code=400, detail="Geçersiz il/ilçe seçimi")
    mahalle = (await db.execute(select(Mahalle).where(Mahalle.mahalle_id == payload.mahalle_id))).scalar_one_or_none()
    if mahalle is None or mahalle.ilce_id != payload.ilce_id:
        raise HTTPException(status_code=400, detail="Geçersiz mahalle seçimi")

    if payload.is_default:
        await db.execute(
            update(CustomerAddress).where(CustomerAddress.cust_id == cust_id).values(is_default=False)
        )

    address = CustomerAddress(cust_id=cust_id, **payload.model_dump())
    db.add(address)
    await db.commit()
    await db.refresh(address)
    return await _address_out(db, address)


@router.patch("/{address_id}", response_model=AddressOut)
async def update_address(
    address_id: int,
    payload: AddressUpdateIn,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(get_current_user),
):
    cust_id = await _get_cust_id(user, db)
    address = (
        await db.execute(
            select(CustomerAddress).where(
                CustomerAddress.address_id == address_id, CustomerAddress.cust_id == cust_id
            )
        )
    ).scalar_one_or_none()
    if address is None:
        raise HTTPException(status_code=404, detail="Adres bulunamadı")

    if payload.is_default:
        await db.execute(
            update(CustomerAddress).where(CustomerAddress.cust_id == cust_id).values(is_default=False)
        )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(address, field, value)

    await db.commit()
    await db.refresh(address)
    return await _address_out(db, address)


@router.delete("/{address_id}")
async def delete_address(
    address_id: int,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(get_current_user),
):
    cust_id = await _get_cust_id(user, db)
    address = (
        await db.execute(
            select(CustomerAddress).where(
                CustomerAddress.address_id == address_id, CustomerAddress.cust_id == cust_id
            )
        )
    ).scalar_one_or_none()
    if address is None:
        raise HTTPException(status_code=404, detail="Adres bulunamadı")

    await db.delete(address)
    await db.commit()
    return {"detail": "Adres silindi"}
