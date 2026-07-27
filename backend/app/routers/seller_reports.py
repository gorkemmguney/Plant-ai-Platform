from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_role
from app.db.session import get_db
from app.models.catalog import Prod
from app.models.order import CustOrd, CustOrdItem
from app.models.review import Review
from app.models.user import AppUser
from app.rbac.roles import RoleName
from app.services.ai_service import generate_seller_report

router = APIRouter(prefix="/seller", tags=["seller-reports"])

DELIVERED_STATUS_ID = 8
CANCELLED_STATUS_ID = 9


class SellerReportOut(BaseModel):
    report: str
    stats: dict


@router.get("/ai-report", response_model=SellerReportOut)
async def seller_ai_report(
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.SELLER, RoleName.ADMIN)),
):
    seller_id = user.user_id

    total_products = (
        await db.execute(select(func.count(Prod.prod_id)).where(Prod.seller_id == seller_id))
    ).scalar() or 0
    active_products = (
        await db.execute(
            select(func.count(Prod.prod_id)).where(
                Prod.seller_id == seller_id, Prod.is_active.is_(True), Prod.stock > 0
            )
        )
    ).scalar() or 0
    out_of_stock = (
        await db.execute(
            select(func.count(Prod.prod_id)).where(
                Prod.seller_id == seller_id, Prod.is_active.is_(True), Prod.stock <= 0
            )
        )
    ).scalar() or 0

    base_items = (
        select(CustOrdItem, CustOrd.gnl_st_id)
        .join(Prod, Prod.prod_id == CustOrdItem.prod_id)
        .join(CustOrd, CustOrd.cust_ord_id == CustOrdItem.cust_ord_id)
        .where(Prod.seller_id == seller_id)
    ).subquery()
    total_order_items = (await db.execute(select(func.count()).select_from(base_items))).scalar() or 0

    delivered_orders = (
        await db.execute(
            select(func.count(func.distinct(CustOrd.cust_ord_id)))
            .select_from(CustOrdItem)
            .join(Prod, Prod.prod_id == CustOrdItem.prod_id)
            .join(CustOrd, CustOrd.cust_ord_id == CustOrdItem.cust_ord_id)
            .where(Prod.seller_id == seller_id, CustOrd.gnl_st_id == DELIVERED_STATUS_ID)
        )
    ).scalar() or 0

    cancelled_orders = (
        await db.execute(
            select(func.count(func.distinct(CustOrd.cust_ord_id)))
            .select_from(CustOrdItem)
            .join(Prod, Prod.prod_id == CustOrdItem.prod_id)
            .join(CustOrd, CustOrd.cust_ord_id == CustOrdItem.cust_ord_id)
            .where(Prod.seller_id == seller_id, CustOrd.gnl_st_id == CANCELLED_STATUS_ID)
        )
    ).scalar() or 0

    revenue = (
        await db.execute(
            select(func.coalesce(func.sum(CustOrdItem.unit_price * CustOrdItem.quantity), 0))
            .select_from(CustOrdItem)
            .join(Prod, Prod.prod_id == CustOrdItem.prod_id)
            .join(CustOrd, CustOrd.cust_ord_id == CustOrdItem.cust_ord_id)
            .where(Prod.seller_id == seller_id, CustOrd.gnl_st_id != CANCELLED_STATUS_ID)
        )
    ).scalar() or 0

    top_rows = (
        await db.execute(
            select(Prod.name, func.sum(CustOrdItem.quantity).label("qty"))
            .select_from(CustOrdItem)
            .join(Prod, Prod.prod_id == CustOrdItem.prod_id)
            .join(CustOrd, CustOrd.cust_ord_id == CustOrdItem.cust_ord_id)
            .where(Prod.seller_id == seller_id, CustOrd.gnl_st_id != CANCELLED_STATUS_ID)
            .group_by(Prod.name)
            .order_by(func.sum(CustOrdItem.quantity).desc())
            .limit(5)
        )
    ).all()
    top_products = [{"name": n, "qty": int(q or 0)} for n, q in top_rows]

    cancel_rows = (
        await db.execute(
            select(Prod.name, func.sum(CustOrdItem.quantity).label("qty"))
            .select_from(CustOrdItem)
            .join(Prod, Prod.prod_id == CustOrdItem.prod_id)
            .join(CustOrd, CustOrd.cust_ord_id == CustOrdItem.cust_ord_id)
            .where(Prod.seller_id == seller_id, CustOrd.gnl_st_id == CANCELLED_STATUS_ID)
            .group_by(Prod.name)
            .order_by(func.sum(CustOrdItem.quantity).desc())
            .limit(5)
        )
    ).all()
    cancelled_products = [{"name": n, "qty": int(q or 0)} for n, q in cancel_rows]

    rating_row = (
        await db.execute(
            select(func.avg(Review.rating), func.count(Review.review_id))
            .select_from(Review)
            .join(Prod, Prod.prod_id == Review.prod_id)
            .where(Prod.seller_id == seller_id)
        )
    ).first()
    avg_rating = round(float(rating_row[0]), 2) if rating_row and rating_row[0] else None
    review_count = int(rating_row[1]) if rating_row else 0

    low_rows = (
        await db.execute(
            select(Prod.name, func.avg(Review.rating).label("rating"))
            .select_from(Review)
            .join(Prod, Prod.prod_id == Review.prod_id)
            .where(Prod.seller_id == seller_id)
            .group_by(Prod.name)
            .having(func.avg(Review.rating) < 3.5)
            .order_by(func.avg(Review.rating))
            .limit(5)
        )
    ).all()
    low_rated = [{"name": n, "rating": round(float(r), 1)} for n, r in low_rows]

    stats = {
        "total_products": total_products,
        "active_products": active_products,
        "out_of_stock": out_of_stock,
        "total_order_items": total_order_items,
        "delivered_orders": delivered_orders,
        "cancelled_orders": cancelled_orders,
        "total_revenue": float(revenue),
        "avg_rating": avg_rating,
        "review_count": review_count,
        "top_products": top_products,
        "cancelled_products": cancelled_products,
        "low_rated": low_rated,
    }

    report = await generate_seller_report(stats)
    return SellerReportOut(report=report, stats=stats)
