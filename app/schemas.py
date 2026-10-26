from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class DrugResult(BaseModel):
    id: int
    ndc: str
    ndc_description: str
    pricing_unit: str
    last_seen_date: date
    nadac_per_unit: Decimal
    effective_date: date
    model_config = ConfigDict(from_attributes=True)


# Add Get /drugs/{id}/prices search endpoint and schemas
class PriceResult(BaseModel):
    effective_date: date
    nadac_per_unit: Decimal
    model_config = ConfigDict(from_attributes=True)
