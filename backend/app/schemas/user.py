from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user_id: int
    email: str = ""
    first_name: str = ""
    last_name: str = ""
    phone_number: str | None = None
    is_active: bool = True
    created_at: datetime | None = None
    roles: list[str] = []

    cust_id: int | None = None
    customer_type: str | None = "IND"
    points: int = 0
    seller_status: str = "none"  # 'none' | 'pending' | 'verified' | 'rejected'
    store_name: str | None = None
    store_address: str | None = None
    bank_iban: str | None = None


class RoleAssignIn(BaseModel):
    user_id: int
    role_name: str  # 'admin' | 'seller' | 'customer'


class RoleSelectIn(BaseModel):
    role_name: str  # kayıt sırasında yalnızca 'customer' | 'seller'


class ProfileUpdateIn(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone_number: str | None = None
    store_name: str | None = None
    store_address: str | None = None
    bank_iban: str | None = None



class PasswordVerifyIn(BaseModel):
    # Gizli siparişler gibi hassas ekranlara girmeden önce mevcut kullanıcının
    # şifresini backend üzerinden (Supabase'e sorarak) doğrulamak için.
    password: str
