from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.bundle import Bundle
from app.models.catalog import Prod
from app.models.customer import Ind, Org
from app.models.user import AppUser

from app.schemas.bundle import BundleItemOut, BundleOut

router = APIRouter(prefix="/bundles", tags=["bundles"])


def _store_name(store_name: str | None, first: str | None, last: str | None) -> str | None:
    if store_name:
        return store_name
    full = " ".join(p for p in [first, last] if p)
    return full or None


@router.get("", response_model=list[BundleOut])
async def list_bundles(db: AsyncSession = Depends(get_db)):
    bundles = (
        await db.execute(
            select(Bundle).options(selectinload(Bundle.items)).where(Bundle.is_active.is_(True)).order_by(Bundle.bundle_id)
        )
    ).scalars().all()

    # Paketlerdeki ürünlerin güncel bilgisini (fiyat/stok/mağaza) tek sorguda çek
    prod_ids = {it.prod_id for b in bundles for it in b.items}
    prod_map: dict[int, tuple[Prod, str | None]] = {}
    if prod_ids:
        rows = (
            await db.execute(
                select(Prod, Org.store_name, Org.company_name, Ind.first_name, Ind.last_name)
                .outerjoin(Org, Org.user_id == Prod.seller_id)
                .outerjoin(Ind, Ind.user_id == Prod.seller_id)
                .where(Prod.prod_id.in_(prod_ids))
            )
        ).all()
        for prod, store_name, company_name, first, last in rows:
            prod_map[prod.prod_id] = (prod, _store_name(store_name or company_name, first, last))


    result: list[BundleOut] = []
    for b in bundles:
        items: list[BundleItemOut] = []
        total = 0.0
        for it in b.items:
            entry = prod_map.get(it.prod_id)
            if entry is None:
                continue
            prod, sname = entry
            items.append(
                BundleItemOut(
                    prod_id=prod.prod_id,
                    name=prod.name,
                    price=float(prod.price),
                    quantity=it.quantity,
                    stock=prod.stock,
                    seller_id=prod.seller_id,
                    seller_name=sname,
                )
            )
            total += float(prod.price) * it.quantity
        result.append(
            BundleOut(
                bundle_id=b.bundle_id,
                title=b.title,
                description=b.description,
                total_price=round(total, 2),
                items=items,
            )
        )
    return result
