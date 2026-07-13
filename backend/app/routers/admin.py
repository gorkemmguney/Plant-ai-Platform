from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.firebase import set_role_claim
from app.core.security import require_role
from app.db.session import get_db
from app.models.user import AppUser, Role, UserRole
from app.rbac.roles import ROLE_HIERARCHY, RoleName
from app.schemas.user import RoleAssignIn

router = APIRouter(prefix="/admin", tags=["admin"])


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
