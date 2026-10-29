from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Drug, Quote, User
from app.pricing import get_compare_numbers, get_latest_price
from app.schemas import QuoteCreate, QuoteResult, QuoteUpdate
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


@router.get("", response_model=list[QuoteResult])
def get_quotes(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[QuoteResult]:
    quote_instances = db.scalars(
        select(Quote)
        .where(Quote.user_id == current_user.id)
        .order_by(Quote.created_at)
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).all()
    quotes_list = [to_quote_result(db, quote) for quote in quote_instances]
    return quotes_list


@router.get("/{quote_id}", response_model=QuoteResult)
def get_quote(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    quote_id: int,
):
    quote = get_own_quote(db, quote_id, current_user.id)
    return to_quote_result(db, quote)


@router.patch("/{quote_id}", response_model=QuoteResult)
def update_quote(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    quote_id: int,
    updates: QuoteUpdate,
):
    quote = get_own_quote(db, quote_id, current_user.id)
    if updates.quantity is not None:
        quote.quantity = updates.quantity
    if updates.quoted_price is not None:
        quote.quoted_price = updates.quoted_price
    db.commit()
    return to_quote_result(db, quote)


@router.delete("quote/{quote_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quote(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    quote_id: int,
):
    db.execute(
        delete(Quote).where(Quote.id == quote_id, Quote.user_id == current_user.id)
    )
    db.commit()
