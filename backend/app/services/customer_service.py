from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Cust, Ind, Org
from app.schemas.customer import CustomerCreateIn, CustomerOut


async def get_customer_by_user_id(db: AsyncSession, user_id: int) -> CustomerOut | None:
    cust_res = await db.execute(select(Cust).where(Cust.user_id == user_id))
    cust = cust_res.scalar_one_or_none()
    if cust:
        return CustomerOut(
            cust_id=cust.cust_id,
            user_id=user_id,
            customer_type=cust.customer_type,
            is_active=cust.is_active,
            created_at=cust.created_at,
        )

    return None


async def create_customer_profile(db: AsyncSession, user_id: int, payload: CustomerCreateIn) -> CustomerOut:
    existing = await get_customer_by_user_id(db, user_id)
    if existing is not None:
        return existing

    cust_res = await db.execute(select(Cust).where(Cust.user_id == user_id))
    cust = cust_res.scalar_one_or_none()
    if cust is None:
        cust = Cust(user_id=user_id, customer_type=payload.customer_type, is_active=True)
        db.add(cust)
        try:
            await db.flush()
        except Exception:
            await db.rollback()
            cust = (await db.execute(select(Cust).where(Cust.user_id == user_id))).scalar_one_or_none()

    cust_id_val = cust.cust_id if cust else None

    if payload.customer_type == "IND":
        ind_res = await db.execute(select(Ind).where(Ind.user_id == user_id))
        ind = ind_res.scalar_one_or_none()
        if ind is None:
            ind = Ind(
                user_id=user_id,
                cust_id=cust_id_val,
                tc_no=payload.individual.tc_no if payload.individual else None,
                birth_date=payload.individual.birth_date if payload.individual else None,
                gender=payload.individual.gender if payload.individual else None,
            )
            db.add(ind)
        else:
            ind.cust_id = cust_id_val
            if payload.individual:
                if payload.individual.tc_no:
                    ind.tc_no = payload.individual.tc_no
                if payload.individual.birth_date:
                    ind.birth_date = payload.individual.birth_date
                if payload.individual.gender:
                    ind.gender = payload.individual.gender
    else:
        org_res = await db.execute(select(Org).where(Org.user_id == user_id))
        org = org_res.scalar_one_or_none()
        if org is None:
            org = Org(
                user_id=user_id,
                cust_id=cust_id_val,
                company_name=payload.organization.company_name if payload.organization else "Mağaza",
                tax_number=payload.organization.tax_number if payload.organization else None,
                tax_office=payload.organization.tax_office if payload.organization else None,
            )
            db.add(org)
        else:
            org.cust_id = cust_id_val
            if payload.organization:
                if payload.organization.company_name:
                    org.company_name = payload.organization.company_name
                if payload.organization.tax_number:
                    org.tax_number = payload.organization.tax_number
                if payload.organization.tax_office:
                    org.tax_office = payload.organization.tax_office

    try:
        await db.commit()
    except Exception:
        await db.rollback()

    res = await get_customer_by_user_id(db, user_id)
    if res is not None:
        return res

    return CustomerOut(
        cust_id=cust_id_val or 0,
        user_id=user_id,
        customer_type=payload.customer_type,
        is_active=True,
    )
