from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Drug, Quote, User
from app.pricing import get_compare_numbers, get_latest_price
from app.schemas import QuoteCreate, QuoteResult
from app.security import get_current_user

router = APIRouter(prefix="/quotes", tags=["quotes"])


def get_own_quote(db: Session, quote_id: int, user_id: int) -> Quote:
    quote = db.scalars(
        select(Quote).where(Quote.id == quote_id, Quote.user_id == user_id)
    ).first()
    if quote is None:
        raise HTTPException(status_code=404, detail="Quote not found")
    return quote


def to_quote_result(db: Session, quote: Quote) -> QuoteResult:
    # quote --> drug --> price
    drug = quote.drug
    price = get_latest_price(db, drug.id)
    if price is None:
        raise HTTPException(status_code=404, detail="Price not found")
    compare_numbers = get_compare_numbers(
        price.nadac_per_unit, quote.quantity, quote.quoted_price
    )
    return QuoteResult(
        id=quote.id,
        drug_id=drug.id,
        ndc_description=drug.ndc_description,
        pricing_unit=drug.pricing_unit,
        nadac_per_unit=price.nadac_per_unit,
        effective_date=price.effective_date,
        quantity=quote.quantity,
        quoted_price=quote.quoted_price,
        **compare_numbers,
        created_at=quote.created_at,
    )


@router.post("", response_model=QuoteResult, status_code=201)
def create_quotes(
    body: QuoteCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    drug = db.get(Drug, body.drug_id)
    if drug is None:
        raise HTTPException(status_code=404, detail="Drug not found")
    price = get_latest_price(db, drug.id)
    if price is None:
        raise HTTPException(status_code=404, detail="Price not found")
    quote = Quote(
        user_id=current_user.id,
        drug_id=drug.id,
        quantity=body.quantity,
        quoted_price=body.quoted_price,
    )
    db.add(quote)
    db.commit()
    db.refresh(quote)

    return to_quote_result(db, quote)
