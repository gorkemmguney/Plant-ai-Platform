from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Cust, Ind, Org
from app.schemas.customer import CustomerCreateIn


async def get_customer_by_user_id(db: AsyncSession, user_id: int) -> Cust | None:
    result = await db.execute(select(Cust).where(Cust.user_id == user_id))
    return result.scalar_one_or_none()


async def create_customer_profile(db: AsyncSession, user_id: int, payload: CustomerCreateIn) -> Cust:
    existing = await get_customer_by_user_id(db, user_id)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu kullanıcı için müşteri profili zaten var",
        )

    cust = Cust(user_id=user_id, customer_type=payload.customer_type, is_active=True)
    db.add(cust)
    try:
        await db.flush()
    except IntegrityError:
        # İki eşzamanlı istek (ör. mobil tarafta aynı anda tetiklenen iki
        # "profil var mı" kontrolü) burada yarışabilir — cust.user_id artık
        # DB'de UNIQUE olduğu için ikincisi burada patlar. Hatayı yutup zaten
        # oluşmuş olan profili döndürüyoruz, kullanıcı 500 görmesin.
        await db.rollback()
        existing = await get_customer_by_user_id(db, user_id)
        if existing is not None:
            return existing
        raise

    if payload.customer_type == "IND":
        db.add(
            Ind(
                cust_id=cust.cust_id,
                tc_no=payload.individual.tc_no,
                birth_date=payload.individual.birth_date,
                gender=payload.individual.gender,
            )
        )
    else:
        db.add(
            Org(
                cust_id=cust.cust_id,
                company_name=payload.organization.company_name,
                tax_number=payload.organization.tax_number,
                tax_office=payload.organization.tax_office,
            )
        )

    await db.commit()
    await db.refresh(cust)
    return cust
