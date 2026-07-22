from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, get_user_roles, require_role
from app.db.session import get_db
from app.models.catalog import Prod
from app.models.customer import Cust
from app.models.order import CustOrd, CustOrdItem
from app.models.review import Review
from app.models.user import AppUser
from app.rbac.roles import RoleName
from app.schemas.review import RatingSummaryOut, ReviewCreateIn, ReviewOut, ReviewSummaryOut, SellerReplyIn

router = APIRouter(prefix="/reviews", tags=["reviews"])

# order_service.py ile aynı durum kodları — sadece TESLİM EDİLMİŞ siparişler puanlanabilir
DELIVERED_STATUS_ID = 8


def _review_out(review: Review, first: str | None, last: str | None) -> ReviewOut:
    name = f"{first or ''} {last or ''}".strip() or None
    return ReviewOut(
        review_id=review.review_id,
        prod_id=review.prod_id,
        cust_ord_item_id=review.cust_ord_item_id,
        rating=review.rating,
        comment=review.comment,
        seller_reply=review.seller_reply,
        created_at=review.created_at,
        reviewer_name=name,
    )


@router.post("", response_model=ReviewOut)
async def create_review(
    payload: ReviewCreateIn,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.CUSTOMER, RoleName.ADMIN)),
):
    # Müşteri profili
    cust = (await db.execute(select(Cust).where(Cust.user_id == user.user_id))).scalar_one_or_none()
    if cust is None:
        raise HTTPException(status_code=400, detail="Müşteri profili bulunamadı")

    # Bu sipariş kalemi gerçekten bu müşteriye mi ait, TESLİM EDİLMİŞ bir
    # siparişte mi, ve gerçekten bu ürüne mi ait — doğrula
    item_check = (
        await db.execute(
            select(CustOrdItem.cust_ord_item_id)
            .join(CustOrd, CustOrd.cust_ord_id == CustOrdItem.cust_ord_id)
            .where(
                CustOrdItem.cust_ord_item_id == payload.cust_ord_item_id,
                CustOrdItem.prod_id == payload.prod_id,
                CustOrd.cust_id == cust.cust_id,
                CustOrd.gnl_st_id == DELIVERED_STATUS_ID,
            )
            .limit(1)
        )
    ).first()
    if item_check is None:
        raise HTTPException(
            status_code=400,
            detail="Bu ürünü değerlendirebilmek için siparişinin teslim edilmiş olması gerekiyor",
        )

    # Bu SİPARİŞ KALEMİ zaten değerlendirilmiş mi? (aynı ürün farklı bir
    # siparişte tekrar teslim alınırsa yeniden değerlendirilebilir)
    existing = (
        await db.execute(
            select(Review).where(
                Review.user_id == user.user_id, Review.cust_ord_item_id == payload.cust_ord_item_id
            )
        )
    ).scalar_one_or_none()

    if existing is not None:
        raise HTTPException(status_code=400, detail="Bu siparişi zaten değerlendirdin")

    review = Review(
        prod_id=payload.prod_id,
        cust_ord_item_id=payload.cust_ord_item_id,
        user_id=user.user_id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)

    await db.commit()
    await db.refresh(review)
    return _review_out(review, user.first_name, user.last_name)


@router.get("/mine", response_model=list[ReviewOut])
async def my_reviews(
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(get_current_user),
):
    result = await db.execute(
        select(Review, Prod.name)
        .join(Prod, Prod.prod_id == Review.prod_id)
        .where(Review.user_id == user.user_id)
        .order_by(Review.created_at.desc())
    )
    out: list[ReviewOut] = []
    for review, prod_name in result.all():
        item = _review_out(review, user.first_name, user.last_name)
        item.prod_name = prod_name
        out.append(item)
    return out


@router.get("/seller", response_model=list[ReviewOut])
async def seller_reviews(
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.SELLER, RoleName.ADMIN)),
):
    """Satıcının kendi ürünlerine gelen tüm yorumlar (cevaplamak için)."""
    result = await db.execute(
        select(Review, Prod.name, AppUser.first_name, AppUser.last_name)
        .join(Prod, Prod.prod_id == Review.prod_id)
        .join(AppUser, AppUser.user_id == Review.user_id)
        .where(Prod.seller_id == user.user_id)
        .order_by(Review.created_at.desc())
    )
    out: list[ReviewOut] = []
    for review, prod_name, first, last in result.all():
        item = _review_out(review, first, last)
        item.prod_name = prod_name
        out.append(item)
    return out


@router.get("/product/{prod_id}", response_model=ReviewSummaryOut)
async def product_reviews(prod_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Review, AppUser.first_name, AppUser.last_name)
        .join(AppUser, AppUser.user_id == Review.user_id)
        .where(Review.prod_id == prod_id)
        .order_by(Review.created_at.desc())
    )
    rows = result.all()
    reviews = [_review_out(r, f, l) for (r, f, l) in rows]
    count = len(reviews)
    average = round(sum(r.rating for r in reviews) / count, 1) if count else 0.0
    return ReviewSummaryOut(average=average, count=count, reviews=reviews)


@router.get("/store/{seller_id}", response_model=RatingSummaryOut)
async def store_rating(seller_id: int, db: AsyncSession = Depends(get_db)):
    # Mağaza puanı = o satıcının tüm ürünlerine gelen yorumların ortalaması
    result = await db.execute(
        select(func.avg(Review.rating), func.count(Review.review_id))
        .join(Prod, Prod.prod_id == Review.prod_id)
        .where(Prod.seller_id == seller_id)
    )
    avg, count = result.first()
    return RatingSummaryOut(average=round(float(avg), 1) if avg else 0.0, count=count or 0)


@router.post("/{review_id}/reply", response_model=ReviewOut)
async def reply_to_review(
    review_id: int,
    payload: SellerReplyIn,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.SELLER, RoleName.ADMIN)),
):
    review = (await db.execute(select(Review).where(Review.review_id == review_id))).scalar_one_or_none()
    if review is None:
        raise HTTPException(status_code=404, detail="Yorum bulunamadı")

    # Satıcı yalnızca kendi ürününe gelen yoruma cevap verebilir (admin her yoruma)
    prod = (await db.execute(select(Prod).where(Prod.prod_id == review.prod_id))).scalar_one_or_none()
    user_roles = await get_user_roles(user, db)
    is_admin = RoleName.ADMIN.value in user_roles
    if not is_admin and (prod is None or prod.seller_id != user.user_id):
        raise HTTPException(status_code=403, detail="Bu yoruma cevap verme yetkiniz yok")

    review.seller_reply = payload.reply
    await db.commit()
    await db.refresh(review)

    reviewer = (
        await db.execute(select(AppUser.first_name, AppUser.last_name).where(AppUser.user_id == review.user_id))
    ).first()
    first, last = (reviewer[0], reviewer[1]) if reviewer else (None, None)
    return _review_out(review, first, last)
