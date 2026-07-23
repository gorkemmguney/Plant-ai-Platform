from datetime import datetime
from pydantic import BaseModel, ConfigDict


class CustProdCareLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    care_log_id: int
    cust_prod_id: int
    care_type: str
    notes: str | None = None
    created_at: datetime


class CustProdGrowthLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    growth_log_id: int
    cust_prod_id: int
    image_url: str | None = None
    note: str
    created_at: datetime


class CustProdCareLogCreateIn(BaseModel):
    care_type: str  # 'water' | 'fertilize' | 'repot' | 'prune'
    notes: str | None = None


class CustProdGrowthLogCreateIn(BaseModel):
    image_url: str | None = None
    note: str


class CustProdCreateIn(BaseModel):
    name: str
    prod_spec_id: int
    location: str | None = None
    watering_interval_days: int = 7
    fertilizing_interval_days: int | None = 30
    repotting_interval_days: int | None = 365
    description: str | None = None
    image_url: str | None = None


class CustProdUpdateIn(BaseModel):
    name: str
    location: str | None = None
    watering_interval_days: int
    fertilizing_interval_days: int | None = 30
    repotting_interval_days: int | None = 365
    health_status: str
    description: str | None = None
    image_url: str | None = None


class CustProdOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cust_prod_id: int
    cust_id: int
    prod_spec_id: int
    name: str
    description: str | None = None
    image_url: str | None = None
    health_status: str
    
    location: str | None = None
    
    watering_interval_days: int
    last_watered_at: datetime
    
    fertilizing_interval_days: int | None = None
    last_fertilized_at: datetime | None = None
    
    repotting_interval_days: int | None = None
    last_repotted_at: datetime | None = None
    
    created_at: datetime
    updated_at: datetime
    
    # Species details for easy UI rendering
    species_name: str | None = None
    
    # Nested logs
    care_logs: list[CustProdCareLogOut] = []
    growth_logs: list[CustProdGrowthLogOut] = []
