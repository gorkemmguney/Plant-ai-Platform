from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.firebase import set_role_claim
from app.core.security import get_user_roles, require_role
from app.db.session import get_db
from app.models.user import AppUser, Role, UserRole
from app.models.ai import AiImageAnalysis
from app.models.catalog import Prod
from app.models.misc import Notification
from app.rbac.roles import ROLE_HIERARCHY, RoleName
from app.schemas.user import RoleAssignIn, UserOut
from app.schemas.admin import AdminStatsOut, BroadcastNotificationIn

router = APIRouter(prefix="/admin", tags=["admin"])


async def _to_user_out(user: AppUser, db: AsyncSession) -> UserOut:
    return UserOut(
        user_id=user.user_id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        is_active=user.is_active,
        created_at=user.created_at,
        roles=await get_user_roles(user, db),
        seller_status=user.seller_status,
    )


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    result = await db.execute(select(AppUser).order_by(AppUser.user_id))
    users = result.scalars().all()
    return [await _to_user_out(user, db) for user in users]


@router.get("/sellers/pending", response_model=list[UserOut])
async def list_pending_sellers(
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    result = await db.execute(
        select(AppUser).where(AppUser.seller_status == "pending").order_by(AppUser.user_id)
    )
    users = result.scalars().all()
    return [await _to_user_out(user, db) for user in users]


@router.post("/verify-seller/{user_id}", response_model=UserOut)
async def verify_seller(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    user_result = await db.execute(select(AppUser).where(AppUser.user_id == user_id))
    target = user_result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    role_result = await db.execute(select(Role).where(Role.role_name == RoleName.SELLER.value))
    seller_role = role_result.scalar_one_or_none()
    if seller_role is None:
        raise HTTPException(status_code=404, detail="Satıcı rolü bulunamadı (seed eksik olabilir)")

    existing_result = await db.execute(
        select(UserRole).where(UserRole.user_id == user_id, UserRole.role_id == seller_role.role_id)
    )
    if existing_result.scalar_one_or_none() is None:
        db.add(UserRole(user_id=user_id, role_id=seller_role.role_id))

    target.seller_status = "verified"
    await db.commit()
    await db.refresh(target)

    roles = await get_user_roles(target, db)
    if roles:
        top_role = max(roles, key=lambda r: ROLE_HIERARCHY.get(r, -1))
        set_role_claim(target.firebase_uid, top_role)
    return await _to_user_out(target, db)


@router.post("/reject-seller/{user_id}", response_model=UserOut)
async def reject_seller(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    user_result = await db.execute(select(AppUser).where(AppUser.user_id == user_id))
    target = user_result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    target.seller_status = "rejected"
    await db.commit()
    await db.refresh(target)
    return await _to_user_out(target, db)


@router.post("/assign-role")
async def assign_role(
    payload: RoleAssignIn,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    role_result = await db.execute(select(Role).where(Role.role_name == payload.role_name))
    role = role_result.scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=404, detail="Rol bulunamadı")

    user_result = await db.execute(select(AppUser).where(AppUser.user_id == payload.user_id))
    target_user = user_result.scalar_one_or_none()
    if target_user is None:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    existing_result = await db.execute(
        select(UserRole).where(UserRole.user_id == payload.user_id, UserRole.role_id == role.role_id)
    )
    if existing_result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Kullanıcıda bu rol zaten var")

    db.add(UserRole(user_id=payload.user_id, role_id=role.role_id))
    await db.commit()
    set_role_claim(target_user.firebase_uid, payload.role_name)
    return {"detail": "Rol atandı"}


@router.post("/remove-role")
async def remove_role(
    payload: RoleAssignIn,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    role_result = await db.execute(select(Role).where(Role.role_name == payload.role_name))
    role = role_result.scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=404, detail="Rol bulunamadı")

    user_result = await db.execute(select(AppUser).where(AppUser.user_id == payload.user_id))
    target_user = user_result.scalar_one_or_none()
    if target_user is None:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    assignment_result = await db.execute(
        select(UserRole).where(UserRole.user_id == payload.user_id, UserRole.role_id == role.role_id)
    )
    assignment = assignment_result.scalar_one_or_none()
    if assignment is None:
        raise HTTPException(status_code=404, detail="Kullanıcıda bu rol zaten yok")

    await db.delete(assignment)
    await db.commit()

    # Firebase custom claim'i kalan rollerin en yükseğine göre yeniden hesapla
    remaining_result = await db.execute(
        select(Role.role_name)
        .join(UserRole, UserRole.role_id == Role.role_id)
        .where(UserRole.user_id == payload.user_id)
    )
    remaining_roles = [r for (r,) in remaining_result.all()]

    if remaining_roles:
        top_role = max(remaining_roles, key=lambda r: ROLE_HIERARCHY.get(r, -1))
        set_role_claim(target_user.firebase_uid, top_role)
    else:
        set_role_claim(target_user.firebase_uid, "")

    return {"detail": "Rol kaldırıldı", "remaining_roles": remaining_roles}


@router.get("/stats", response_model=AdminStatsOut)
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    # Total Users
    users_count = await db.scalar(select(func.count()).select_from(AppUser))

    # Total Sellers (Users who have the seller role)
    seller_role = await db.scalar(select(Role.role_id).where(Role.role_name == RoleName.SELLER.value))
    sellers_count = 0
    if seller_role:
        sellers_count = await db.scalar(
            select(func.count()).select_from(UserRole).where(UserRole.role_id == seller_role)
        )

    # Total Analyses
    analyses_count = await db.scalar(select(func.count()).select_from(AiImageAnalysis))

    # Total Products
    products_count = await db.scalar(select(func.count()).select_from(Prod))

    return AdminStatsOut(
        total_users=users_count or 0,
        total_sellers=sellers_count or 0,
        total_analyses=analyses_count or 0,
        total_products=products_count or 0,
    )


@router.post("/broadcast-notification")
async def broadcast_notification(
    payload: BroadcastNotificationIn,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    # Get all users IDs
    users_result = await db.execute(select(AppUser.user_id))
    user_ids = [uid for (uid,) in users_result.all()]
    
    if not user_ids:
        raise HTTPException(status_code=404, detail="Sistemde hiç kullanıcı bulunamadı")

    # Insert notification for every user
    for uid in user_ids:
        db.add(
            Notification(
                user_id=uid,
                title=payload.title,
                message=payload.message,
                is_read=False,
            )
        )
    await db.commit()
    return {"detail": f"{len(user_ids)} kullanıcıya duyuru başarıyla gönderildi."}

