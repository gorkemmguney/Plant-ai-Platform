from enum import StrEnum


class RoleName(StrEnum):
    ADMIN = "admin"
    SELLER = "seller"
    CUSTOMER = "customer"


# Hangi rolün hangi kaynaklara erişebileceğine dair basit bir harita.
# Router seviyesinde require_role(...) dependency'si ile kullanılır.
ROLE_HIERARCHY: dict[str, int] = {
    RoleName.CUSTOMER: 0,
    RoleName.SELLER: 1,
    RoleName.ADMIN: 2,
}
