from enum import StrEnum


class RoleName(StrEnum):
    ADMIN = "admin"
    SELLER = "seller"
    CUSTOMER = "customer"



ROLE_HIERARCHY: dict[str, int] = {
    RoleName.CUSTOMER: 0,
    RoleName.SELLER: 1,
    RoleName.ADMIN: 2,
}
