from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, tuple_
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Drug, Price
from app.pricing import get_compare_numbers
from app.schemas import CompareRequest, CompareResult, DrugResult, PriceResult

router = APIRouter(tags=["drugs"])


@router.get("/drugs", response_model=list[DrugResult])
def search_drugs(
    q: Annotated[str, Query(min_length=2)],
    db: Annotated[Session, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
):
    latest_dates = select(Price.drug_id, func.max(Price.effective_date)).group_by(
        Price.drug_id
    )

    latest_prices = (
        select(Price.drug_id, Price.nadac_per_unit, Price.effective_date)
        .where(tuple_(Price.drug_id, Price.effective_date).in_(latest_dates))
        .subquery()
    )
    page_rows = db.execute(
        select(
            Drug.id,
            Drug.ndc,
            Drug.ndc_description,
            Drug.pricing_unit,
            Drug.last_seen_date,
            latest_prices.c.nadac_per_unit,
            latest_prices.c.effective_date,
        )
        .join(latest_prices, (Drug.id == latest_prices.c.drug_id))
        .where(Drug.ndc_description.ilike(f"%{q}%"))
        .order_by(Drug.ndc_description, Drug.id)
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).all()
    return page_rows


@router.get("/drugs/{drug_id}/prices", response_model=list[PriceResult])
def get_price_history(drug_id: int, db: Annotated[Session, Depends(get_db)]):
    if db.get(Drug, drug_id) is None:
        raise HTTPException(status_code=404, detail="Drug not found")
    return db.execute(
        select(Price.effective_date, Price.nadac_per_unit)
        .where(Price.drug_id == drug_id)
        .order_by(Price.effective_date.desc())
    ).all()


@router.post("/compare", response_model=CompareResult)
def compare(body: CompareRequest, db: Annotated[Session, Depends(get_db)]):
    drug = db.get(Drug, body.drug_id)
    if drug is None:
        raise HTTPException(status_code=404, detail="Drug not found")
    price_row = db.scalars(
        select(Price)
        .where(Price.drug_id == body.drug_id)
        .order_by(Price.effective_date.desc())
        .limit(1)
    ).first()
    if price_row is None:
        raise HTTPException(status_code=404, detail="Price not found")

    compare_numbers = get_compare_numbers(
        price_row.nadac_per_unit, body.quantity, body.quoted_price
    )
    return CompareResult(
        drug_id=drug.id,
        ndc_description=drug.ndc_description,
        pricing_unit=drug.pricing_unit,
        nadac_per_unit=price_row.nadac_per_unit,
        effective_date=price_row.effective_date,
        quantity=body.quantity,
        quoted_price=body.quoted_price,
        nadac_total=compare_numbers["nadac_total"],
        difference=compare_numbers["difference"],
        markup_percent=compare_numbers["markup_percent"],
    )
