from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user_id: int
    email: str
    first_name: str
    last_name: str
    is_active: bool
    created_at: datetime
    roles: list[str] = []
    seller_status: str = "none"  # 'none' | 'pending' | 'verified' | 'rejected'
    store_name: str | None = None


class RoleAssignIn(BaseModel):
    user_id: int
    role_name: str  # 'admin' | 'seller' | 'customer'

class RoleSelectIn(BaseModel):
    role_name: str  # kayıt sırasında yalnızca 'customer' | 'seller'


class ProfileUpdateIn(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    store_name: str | None = None
