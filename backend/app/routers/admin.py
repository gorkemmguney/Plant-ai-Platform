from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.firebase import set_role_claim
from app.core.security import require_role
from app.db.session import get_db
from app.models.user import AppUser, Role, UserRole
from app.rbac.roles import RoleName
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

    db.add(UserRole(user_id=payload.user_id, role_id=role.role_id))
    await db.commit()

    set_role_claim(target_user.firebase_uid, payload.role_name)
    return {"detail": "Rol atandı"}
