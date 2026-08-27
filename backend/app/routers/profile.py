from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.catalog import Prod
from app.models.community import CommunityComment, CommunityLike, CommunityPost
from app.models.customer_product import CustProd
from app.models.order import CustOrd
from app.models.review import Review
from app.models.customer import Ind, Org
from app.models.user import AppUser

from app.models.user_follow import UserFollow
from app.schemas.profile import (
    CustomerPartyProfileOut,
    GenericPartyProfileOut,
    SellerPartyProfileOut,
    TMFPartyCharacteristic,
    UserPlantSummaryOut,
    UserPostSummaryOut,
    UserProfileUpdateIn,
)

router = APIRouter(prefix="/users/profile", tags=["profile"])


def _parse_badges(badges_str: str | None, default_badges: list[str]) -> list[str]:
    combined = set(default_badges)
    if badges_str:
        for b in badges_str.split(","):
            b_clean = b.strip()
            if b_clean:
                combined.add(b_clean)
    return list(combined)


async def _get_follow_counts(user_id: int, current_user_id: int, db: AsyncSession):
    # Followers count
    f_res = await db.execute(
        select(func.count(UserFollow.follow_id)).where(UserFollow.following_id == user_id)
    )
    followers_cnt = f_res.scalar_one() or 0

    # Following count
    ing_res = await db.execute(
        select(func.count(UserFollow.follow_id)).where(UserFollow.follower_id == user_id)
    )
    following_cnt = ing_res.scalar_one() or 0

    # Is followed by me
    is_followed = False
    if current_user_id != user_id:
        chk_res = await db.execute(
            select(UserFollow).where(
                UserFollow.follower_id == current_user_id,
                UserFollow.following_id == user_id,
            )
        )
        is_followed = chk_res.scalar_one_or_none() is not None

    return followers_cnt, following_cnt, is_followed


async def _build_customer_profile(user: AppUser, current_user_id: int, db: AsyncSession) -> CustomerPartyProfileOut:
    ind_res = await db.execute(select(Ind).where(Ind.user_id == user.user_id))
    ind = ind_res.scalar_one_or_none()

    first_name = (ind.first_name if ind and ind.first_name else None) or (ind.username if ind and ind.username else None) or (ind.email.split("@")[0].capitalize() if ind and ind.email and "@" in ind.email else f"Kullanıcı #{user.user_id}")
    last_name = (ind.last_name if ind else "") or ""
    email = (ind.email if ind else "") or ""

    followers_cnt, following_cnt, is_followed = await _get_follow_counts(user.user_id, current_user_id, db)


    # Plant count
    plant_count_res = await db.execute(
        select(func.count(CustProd.cust_prod_id)).where(CustProd.user_id == user.user_id)
    )
    plant_count = plant_count_res.scalar_one() or 0

    # Post count
    post_count_res = await db.execute(
        select(func.count(CommunityPost.post_id)).where(CommunityPost.user_id == user.user_id)
    )
    post_count = post_count_res.scalar_one() or 0

    # Order count
    ord_count_res = await db.execute(
        select(func.count(CustOrd.cust_ord_id)).where(CustOrd.user_id == user.user_id)
    )
    order_count = ord_count_res.scalar_one() or 0

    # Dynamic badges
    auto_badges = ["PLANT_LOVER"]
    if plant_count >= 3:
        auto_badges.append("PLANT_DOCTOR")
    if post_count >= 2:
        auto_badges.append("COMMUNITY_STAR")
    if user.points >= 500:
        auto_badges.append("GOLD_MEMBER")

    badges = _parse_badges(user.badges, auto_badges)

    tmf_chars = [
        TMFPartyCharacteristic(name="bio", value=user.bio),
        TMFPartyCharacteristic(name="city", value=user.city),
        TMFPartyCharacteristic(name="points", value=str(user.points), value_type="integer"),
        TMFPartyCharacteristic(name="followersCount", value=str(followers_cnt), value_type="integer"),
        TMFPartyCharacteristic(name="followingCount", value=str(following_cnt), value_type="integer"),
        TMFPartyCharacteristic(name="plantCount", value=str(plant_count), value_type="integer"),
        TMFPartyCharacteristic(name="postCount", value=str(post_count), value_type="integer"),
    ]

    return CustomerPartyProfileOut(
        user_id=user.user_id,
        first_name=first_name,
        last_name=last_name,
        email=email,
        city=user.city,
        bio=user.bio,
        avatar_url=user.avatar_url,
        cover_image_url=user.cover_image_url,
        points=user.points,
        followers_count=followers_cnt,
        following_count=following_cnt,
        is_followed_by_me=is_followed,
        badges=badges,
        plant_count=plant_count,
        post_count=post_count,
        order_count=order_count,
        created_at=user.created_at,
        party_characteristics=tmf_chars,
    )


async def _build_seller_profile(user: AppUser, current_user_id: int, db: AsyncSession) -> SellerPartyProfileOut:
    org_res = await db.execute(select(Org).where(Org.user_id == user.user_id))
    org = org_res.scalar_one_or_none()

    ind_res = await db.execute(select(Ind).where(Ind.user_id == user.user_id))
    ind = ind_res.scalar_one_or_none()

    first_name = (org.first_name if org and org.first_name else (ind.first_name if ind else "")) or ""
    last_name = (org.last_name if org and org.last_name else (ind.last_name if ind else "")) or ""
    email = (org.email if org and org.email else (ind.email if ind else "")) or ""
    store_name = (org.store_name or org.company_name if org else "") or f"{first_name} Mağazası"
    seller_status = (org.seller_status if org else "none") or "none"

    followers_cnt, following_cnt, is_followed = await _get_follow_counts(user.user_id, current_user_id, db)

    # Product count
    prod_count_res = await db.execute(
        select(func.count(Prod.prod_id)).where(
            Prod.seller_id == user.user_id,
            Prod.is_active == True,
            Prod.deleted_at == None,
        )
    )

    product_count = prod_count_res.scalar_one() or 0

    # Review rating calculation from Review table
    rev_res = await db.execute(
        select(func.avg(Review.rating), func.count(Review.review_id))
        .join(Prod, Prod.prod_id == Review.prod_id)
        .where(Prod.seller_id == user.user_id)
    )
    row = rev_res.fetchone()
    avg_rating = round(float(row[0]), 1) if row and row[0] is not None else user.rating_score or 5.0
    review_cnt = int(row[1]) if row and row[1] is not None else user.review_count or 0

    # Badges
    auto_badges = ["FAST_SHIPPER"]
    if seller_status == "verified":
        auto_badges.append("VERIFIED_SELLER")
    if avg_rating >= 4.5:
        auto_badges.append("TOP_RATED_SELLER")
    if product_count >= 5:
        auto_badges.append("PREMIUM_STORE")

    badges = _parse_badges(user.badges, auto_badges)

    tmf_chars = [
        TMFPartyCharacteristic(name="storeName", value=store_name),
        TMFPartyCharacteristic(name="sellerStatus", value=seller_status),
        TMFPartyCharacteristic(name="bio", value=user.bio),
        TMFPartyCharacteristic(name="city", value=user.city),
        TMFPartyCharacteristic(name="ratingScore", value=str(avg_rating), value_type="float"),
        TMFPartyCharacteristic(name="reviewCount", value=str(review_cnt), value_type="integer"),
        TMFPartyCharacteristic(name="followersCount", value=str(followers_cnt), value_type="integer"),
        TMFPartyCharacteristic(name="followingCount", value=str(following_cnt), value_type="integer"),
        TMFPartyCharacteristic(name="productCount", value=str(product_count), value_type="integer"),
    ]

    return SellerPartyProfileOut(
        user_id=user.user_id,
        store_name=store_name,
        first_name=first_name,
        last_name=last_name,
        email=email,
        seller_status=seller_status,
        city=user.city,
        bio=user.bio,
        avatar_url=user.avatar_url,
        cover_image_url=user.cover_image_url,
        followers_count=followers_cnt,
        following_count=following_cnt,
        is_followed_by_me=is_followed,
        rating_score=avg_rating,
        review_count=review_cnt,
        product_count=product_count,
        badges=badges,
        created_at=user.created_at,
        party_characteristics=tmf_chars,
    )


@router.get("/me", response_model=GenericPartyProfileOut)
async def get_my_profile(
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """
    TM Forum TMF632 & TMF669: Returns current user's complete party profile.
    """
    user_res = await db.execute(
        select(AppUser).options(selectinload(AppUser.roles)).where(AppUser.user_id == current_user.user_id)
    )
    user = user_res.scalar_one()

    org_res = await db.execute(select(Org).where(Org.user_id == user.user_id))
    org = org_res.scalar_one_or_none()

    is_seller = any(ur.role.role_name == "seller" for ur in user.roles if ur.role) or (org is not None and org.seller_status != "none")

    if is_seller:
        seller_prof = await _build_seller_profile(user, current_user.user_id, db)
        return GenericPartyProfileOut(user_id=user.user_id, role="seller", seller_profile=seller_prof)
    else:
        cust_prof = await _build_customer_profile(user, current_user.user_id, db)
        return GenericPartyProfileOut(user_id=user.user_id, role="customer", customer_profile=cust_prof)


@router.get("/{user_id}", response_model=GenericPartyProfileOut)
async def get_public_profile(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """
    TM Forum TMF632 & TMF669: Returns public party profile for any specified user.
    """
    user_res = await db.execute(
        select(AppUser).options(selectinload(AppUser.roles)).where(AppUser.user_id == user_id)
    )
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı.")

    org_res = await db.execute(select(Org).where(Org.user_id == user.user_id))
    org = org_res.scalar_one_or_none()

    is_seller = any(ur.role.role_name == "seller" for ur in user.roles if ur.role) or (org is not None and org.seller_status != "none")

    if is_seller:
        seller_prof = await _build_seller_profile(user, current_user.user_id, db)
        return GenericPartyProfileOut(user_id=user.user_id, role="seller", seller_profile=seller_prof)
    else:
        cust_prof = await _build_customer_profile(user, current_user.user_id, db)
        return GenericPartyProfileOut(user_id=user.user_id, role="customer", customer_profile=cust_prof)


@router.put("/me", response_model=GenericPartyProfileOut)
async def update_my_profile(
    body: UserProfileUpdateIn,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """
    TM Forum TMF632: Updates current user's profile information.
    """
    user_res = await db.execute(
        select(AppUser).options(selectinload(AppUser.roles)).where(AppUser.user_id == current_user.user_id)
    )
    user = user_res.scalar_one()

    # Update Ind profile
    ind_res = await db.execute(select(Ind).where(Ind.user_id == user.user_id))
    ind = ind_res.scalar_one_or_none()
    if ind is None:
        ind = Ind(user_id=user.user_id)
        db.add(ind)

    if body.first_name is not None:
        ind.first_name = body.first_name.strip()
    if body.last_name is not None:
        ind.last_name = body.last_name.strip()

    # Update Org profile if seller or if store_name provided
    if body.store_name is not None:
        org_res = await db.execute(select(Org).where(Org.user_id == user.user_id))
        org = org_res.scalar_one_or_none()
        if org is None:
            org = Org(user_id=user.user_id, company_name=body.store_name.strip(), store_name=body.store_name.strip())
            db.add(org)
        else:
            org.store_name = body.store_name.strip()
            if not org.company_name:
                org.company_name = body.store_name.strip()

    # Update AppUser Bio/City/Avatars
    if body.bio is not None:
        user.bio = body.bio.strip()
    if body.city is not None:
        user.city = body.city.strip()
    if body.avatar_url is not None:
        user.avatar_url = body.avatar_url.strip()
    if body.cover_image_url is not None:
        user.cover_image_url = body.cover_image_url.strip()

    db.add(user)
    await db.commit()
    await db.refresh(user)

    org_res = await db.execute(select(Org).where(Org.user_id == user.user_id))
    org = org_res.scalar_one_or_none()
    is_seller = any(ur.role.role_name == "seller" for ur in user.roles if ur.role) or (org is not None and org.seller_status != "none")

    if is_seller:
        seller_prof = await _build_seller_profile(user, current_user.user_id, db)
        return GenericPartyProfileOut(user_id=user.user_id, role="seller", seller_profile=seller_prof)
    else:
        cust_prof = await _build_customer_profile(user, current_user.user_id, db)
        return GenericPartyProfileOut(user_id=user.user_id, role="customer", customer_profile=cust_prof)



@router.post("/{user_id}/follow")
async def toggle_follow(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """
    TM Forum TMF632 Party Relationship: Toggle follow/unfollow a user.
    """
    if current_user.user_id == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kendi kendinizi takip edemezsiniz.")

    chk_res = await db.execute(
        select(UserFollow).where(
            UserFollow.follower_id == current_user.user_id,
            UserFollow.following_id == user_id,
        )
    )
    existing = chk_res.scalar_one_or_none()

    if existing:
        await db.delete(existing)
        await db.commit()
        return {"is_following": False, "message": "Takip bırakıldı."}
    else:
        follow = UserFollow(follower_id=current_user.user_id, following_id=user_id)
        db.add(follow)
        await db.commit()
        return {"is_following": True, "message": "Takip edildi."}


@router.get("/{user_id}/posts", response_model=list[UserPostSummaryOut])
async def get_user_posts(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """
    Returns community posts created by the specified user.
    """
    res = await db.execute(
        select(CommunityPost)
        .options(
            selectinload(CommunityPost.user).selectinload(AppUser.ind_profile),
            selectinload(CommunityPost.user).selectinload(AppUser.org_profile)
        )
        .where(CommunityPost.user_id == user_id)
        .order_by(CommunityPost.created_at.desc())
    )
    posts = res.scalars().all()

    out = []
    for p in posts:
        # Count likes
        l_res = await db.execute(select(func.count(CommunityLike.like_id)).where(CommunityLike.post_id == p.post_id))
        like_count = l_res.scalar_one() or 0

        # Count comments
        c_res = await db.execute(select(func.count(CommunityComment.comment_id)).where(CommunityComment.post_id == p.post_id))
        comment_count = c_res.scalar_one() or 0

        # Liked by current user?
        chk_res = await db.execute(
            select(CommunityLike).where(
                CommunityLike.post_id == p.post_id,
                CommunityLike.user_id == current_user.user_id,
            )
        )
        is_liked = chk_res.scalar_one_or_none() is not None

        author_name = "Kullanıcı"
        if p.user:
            if p.user.ind_profile:
                author_name = f"{p.user.ind_profile.first_name or ''} {p.user.ind_profile.last_name or ''}".strip() or p.user.ind_profile.username
            elif p.user.org_profile:
                author_name = p.user.org_profile.store_name or p.user.org_profile.company_name

        out.append(
            UserPostSummaryOut(
                post_id=p.post_id,
                user_id=p.user_id,
                author_name=author_name,
                title=p.title,
                content=p.content,
                image_url=p.image_url,
                tag=p.tag,
                like_count=like_count,
                comment_count=comment_count,
                is_liked_by_me=is_liked,
                created_at=p.created_at,
            )
        )
    return out


@router.get("/{user_id}/plants", response_model=list[UserPlantSummaryOut])
async def get_user_plants(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """
    Returns plants in the specified user's garden.
    """
    res = await db.execute(
        select(CustProd)
        .where(CustProd.user_id == user_id)
        .order_by(CustProd.created_at.desc())
    )
    plants = res.scalars().all()

    return [
        UserPlantSummaryOut(
            cust_prod_id=p.cust_prod_id,
            nickname=p.name or "Bitkim",
            species=p.description or "Bitki Türü",
            health_status=p.health_status or "healthy",
            image_url=p.image_url,
            created_at=p.created_at,
        )
        for p in plants
    ]



@router.get("/{user_id}/liked-posts", response_model=list[UserPostSummaryOut])
async def get_user_liked_posts(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """
    Returns community posts liked by the specified user.
    """
    res = await db.execute(
        select(CommunityPost)
        .join(CommunityLike, CommunityLike.post_id == CommunityPost.post_id)
        .options(
            selectinload(CommunityPost.user).selectinload(AppUser.ind_profile),
            selectinload(CommunityPost.user).selectinload(AppUser.org_profile)
        )
        .where(CommunityLike.user_id == user_id)
        .order_by(CommunityLike.created_at.desc())
    )
    posts = res.scalars().all()

    out = []
    for p in posts:
        l_res = await db.execute(select(func.count(CommunityLike.like_id)).where(CommunityLike.post_id == p.post_id))
        like_count = l_res.scalar_one() or 0

        c_res = await db.execute(select(func.count(CommunityComment.comment_id)).where(CommunityComment.post_id == p.post_id))
        comment_count = c_res.scalar_one() or 0

        chk_res = await db.execute(
            select(CommunityLike).where(
                CommunityLike.post_id == p.post_id,
                CommunityLike.user_id == current_user.user_id,
            )
        )
        is_liked = chk_res.scalar_one_or_none() is not None

        author_name = "Kullanıcı"
        if p.user:
            if p.user.ind_profile:
                author_name = f"{p.user.ind_profile.first_name or ''} {p.user.ind_profile.last_name or ''}".strip() or p.user.ind_profile.username
            elif p.user.org_profile:
                author_name = p.user.org_profile.store_name or p.user.org_profile.company_name

        out.append(
            UserPostSummaryOut(
                post_id=p.post_id,
                user_id=p.user_id,
                author_name=author_name,
                title=p.title,
                content=p.content,
                image_url=p.image_url,
                tag=p.tag,
                like_count=like_count,
                comment_count=comment_count,
                is_liked_by_me=is_liked,
                created_at=p.created_at,
            )
        )
    return out
