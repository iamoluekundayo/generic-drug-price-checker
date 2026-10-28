"""Pydantic schemas: the shapes of JSON the API accepts and returns."""

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


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


class UserCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)


class UserResult(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class QuoteCreate(BaseModel):
    drug_id: int
    quantity: Decimal = Field(gt=0, decimal_places=3, max_digits=10)
    quoted_price: Decimal = Field(ge=0, decimal_places=2, max_digits=10)


class QuoteUpdate(BaseModel):
    quantity: Decimal | None = Field(
        default=None, decimal_places=3, gt=0, max_digits=10
    )
    quoted_price: Decimal | None = Field(
        default=None, decimal_places=2, ge=0, max_digits=10
    )


class QuoteResult(CompareResult):
    id: int
    created_at: datetime
