"""HTTP routes for searching drugs, viewing their NADAC price history, and comparing a pharmacy's quoted price against the NADAC benchmark."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, tuple_
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Drug, Price
from app.pricing import get_compare_numbers, get_latest_price
from app.schemas import CompareRequest, CompareResult, DrugResult, PriceResult

router = APIRouter(tags=["drugs"])


@router.get("/drugs", response_model=list[DrugResult])
def search_drugs(
    q: Annotated[str, Query(min_length=2)],
    db: Annotated[Session, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """Search drugs by description and return each match with its latest price.

    Matching is a case-insensitive substring search on ``ndc_description``.
    Results are sorted alphabetically by description and paginated.

    Args:
        q: Search text (at least 2 characters).
        db: Database session, injected by FastAPI.
        page: 1-based page number.
        page_size: Number of results per page (1-100).


    Returns:
        A list of rows matching ``DrugResult``: The drug's identifying fields plus its most recent ``nadac_per_unit`` and that price's ``effective_date``

    Note:
        Drugs that have no price rows at all are left out, because the latest-price subquery is joined with an inner join
    """
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
    """
    Args:
        drug_id: Primary key of the drug.
        db: Database session, injected by FastAPI.

    Returns:
        A list of ``(effective_date, nadac_per_unit)`` rows ordered from most recent to oldest. The list is empty if the drug exists but has not prices.

    Raises:
        HTTPException: 404 if no drug with ``drug_id`` exists.
    """
    # Check that the drug exists first, so an unknown id returns 404
    # instead of an empty list that looks like "no prices yet."
    if db.get(Drug, drug_id) is None:
        raise HTTPException(status_code=404, detail="Drug not found")
    return db.execute(
        select(Price.effective_date, Price.nadac_per_unit)
        .where(Price.drug_id == drug_id)
        .order_by(Price.effective_date.desc())
    ).all()


@router.post("/compare", response_model=CompareResult)
def compare(body: CompareRequest, db: Annotated[Session, Depends(get_db)]):
    """Compare a quoted price against the drug's latest NADAC price.

    The NADAC per-unit price is scaled by the requested quantity, and the
    result is set against the quoted price to show the difference and the
    markup percentage.

    Args:
        body:

    Raises:
        HTTPException: 404 if the drug does not exist, or if it has no
            price to compare against.
    """
    drug = db.get(Drug, body.drug_id)
    if drug is None:
        raise HTTPException(status_code=404, detail="Drug not found")
    price = get_latest_price(db, drug.id)
    if price is None:
        raise HTTPException(status_code=404, detail="No price for this drug")

    # Returns a dict with "nadac_total", "difference", and "markup_percent".
    compare_numbers = get_compare_numbers(
        price.nadac_per_unit, body.quantity, body.quoted_price
    )

    return CompareResult(
        drug_id=drug.id,
        ndc_description=drug.ndc_description,
        pricing_unit=drug.pricing_unit,
        nadac_per_unit=price.nadac_per_unit,
        effective_date=price.effective_date,
        quantity=body.quantity,
        quoted_price=body.quoted_price,
        nadac_total=compare_numbers["nadac_total"],
        difference=compare_numbers["difference"],
        markup_percent=compare_numbers["markup_percent"],
    )
