from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, model_validator


class IndividualIn(BaseModel):
    tc_no: str | None = None
    birth_date: date | None = None
    gender: str | None = None


class OrganizationIn(BaseModel):
    company_name: str
    tax_number: str | None = None
    tax_office: str | None = None


class CustomerCreateIn(BaseModel):
    customer_type: str  # 'individual' | 'organization'
    individual: IndividualIn | None = None
    organization: OrganizationIn | None = None

    @model_validator(mode="after")
    def check_payload(self):
        if self.customer_type not in ("IND", "ORG"):
            raise ValueError("customer_type 'IND' veya 'ORG' olmalı")
        if self.customer_type == "IND" and self.individual is None:
            raise ValueError("customer_type 'IND' ise 'individual' alanı zorunlu")
        if self.customer_type == "ORG" and self.organization is None:
            raise ValueError("customer_type 'ORG' ise 'organization' alanı zorunlu")
        return self


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    cust_id: int = 0
    user_id: int
    customer_type: str
    is_active: bool = True
    created_at: datetime | None = None

