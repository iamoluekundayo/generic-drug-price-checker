"""Pydantic schemas: the shapes of JSON the API accepts and returns."""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class DrugResult(BaseModel):
    id: int
    ndc: str
    ndc_description: str
    pricing_unit: str
    last_seen_date: date
    nadac_per_unit: Decimal
    effective_date: date
    model_config = ConfigDict(from_attributes=True)


class PriceResult(BaseModel):
    effective_date: date
    nadac_per_unit: Decimal
    model_config = ConfigDict(from_attributes=True)


class CompareRequest(BaseModel):
    drug_id: int
    quantity: Decimal = Field(gt=0)
    quoted_price: Decimal = Field(ge=0)


class CompareResult(BaseModel):
    drug_id: int
    ndc_description: str
    pricing_unit: str
    nadac_per_unit: Decimal
    effective_date: date
    quantity: Decimal
    quoted_price: Decimal
    nadac_total: Decimal
    difference: Decimal
    markup_percent: Decimal | None
