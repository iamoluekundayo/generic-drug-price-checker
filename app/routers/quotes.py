"""Routes for saving, listing, updating and deleting the logged-in user's quotes.

Every route requires a valid token, and each user can only reach their own quotes.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased, selectinload

from app.db import get_db
from app.models import Drug, Price, Quote, User
from app.pricing import get_compare_numbers, get_latest_price
from app.schemas import QuoteCreate, QuotePage, QuoteResult, QuoteUpdate
from app.security import get_current_user

router = APIRouter(prefix="/quotes", tags=["quotes"])


def get_own_quote(db: Session, quote_id: int, user_id: int) -> Quote:
    """Return the quote if it exists and belongs to the user, otherwise raise 404.

    Another user's quote gets the same 404 as a missing one, so the API never
    reveals which quotes ids exists.
    """
    quote = db.scalars(
        select(Quote).where(Quote.id == quote_id, Quote.user_id == user_id)
    ).first()
    if quote is None:
        raise HTTPException(status_code=404, detail="Quote not found")
    return quote


def to_quote_result(
    db: Session, quote: Quote, price: Price | None = None
) -> QuoteResult:
    """Build the API response for saved quotes.

    Users the NADAC price on or before the quote's date. Pass ``price`` when it
    has already been loaded (as Get /quotes does) to skip the lookup.

    Raises RuntimeError if no price exists. POST and PATCH already reject dates
    without a price, so reaching that means the stored data is broken.
    """
    # The quote decides the drug, and the drug decides the price.
    drug = quote.drug
    if price is None:
        price = get_latest_price(db, drug.id, quote.quote_date)
    if price is None:
        raise RuntimeError(
            f"Quote {quote.id}: no NADAC price for drug {drug.id} "
            f"on or before {quote.quote_date}"
        )
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
        quote_date=quote.quote_date,
    )


@router.post("", response_model=QuoteResult, status_code=201)
def create_quotes(
    body: QuoteCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Save a quote for the logged-in user and return it with it comparison numbers.

    Returns 404 if the drug doesn't exist, and 422 if it has no price on or
    before the quote date.
    """
    drug = db.get(Drug, body.drug_id)
    if drug is None:
        raise HTTPException(status_code=404, detail="Drug not found")
    # Check the price before saving, so a quote that can't be displayed is never stored.
    price = get_latest_price(db, drug.id, body.quote_date)
    if price is None:
        raise HTTPException(
            status_code=422, detail=f"No NADAC price on or before {body.quote_date}"
        )
    quote = Quote(
        # The owner comes from the token, never from the request body.
        user_id=current_user.id,
        drug_id=drug.id,
        quantity=body.quantity,
        quoted_price=body.quoted_price,
        quote_date=body.quote_date,
    )
    db.add(quote)
    db.commit()
    # Load the values the database filled in, such as id and created_at.
    db.refresh(quote)

    return to_quote_result(db, quote)


@router.get("", response_model=QuotePage)
def get_quotes(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> QuotePage:
    """Return one page of the logged-in user's quotes, newest first."""
    total = db.scalar(
        select(func.count()).select_from(Quote).where(Quote.user_id == current_user.id)
    )
    # Correlated subquery: for each quote row, the id of its drug's newest
    # price on or before that quote's date.
    p = aliased(Price)
    price_id = (
        select(p.id)
        .where(p.drug_id == Quote.drug_id, p.effective_date <= Quote.quote_date)
        .order_by(p.effective_date.desc())
        .limit(1)
        .correlate(Quote)
        .scalar_subquery()
    )
    # Load each quote with it price in one query, and all their drugs in one more,
    # instead of one price query and one drug query per quote.
    # outerjoin keeps a quote even if no price matches; to_quote_result then
    # looks it up again and raises if it's still missing.
    rows = db.execute(
        select(Quote, Price)
        .select_from(Quote)
        .outerjoin(Price, Price.id == price_id)
        .where(Quote.user_id == current_user.id)
        # id breaks ties between quotes saved in the same second.
        .order_by(Quote.created_at.desc(), Quote.id.desc())
        .options(selectinload(Quote.drug))
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).all()
    quotes_list = [to_quote_result(db, quote, price) for quote, price in rows]
    return QuotePage(items=quotes_list, total=total, page=page, page_size=page_size)


@router.get("/{quote_id}", response_model=QuoteResult)
def get_quote(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    quote_id: int,
):
    """Return one of the logged-in user's quotes. Returns 404 if it isn't theirs."""
    quote = get_own_quote(db, quote_id, current_user.id)
    return to_quote_result(db, quote)


@router.patch("/{quote_id}", response_model=QuoteResult)
def update_quote(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    quote_id: int,
    updates: QuoteUpdate,
):
    """Change the quantity, quoted price or date of one of the user's quotes.

    Only the fields sent are changed. Returns 422 if a new date has no price."""
    quote = get_own_quote(db, quote_id, current_user.id)
    price = None
    if updates.quantity is not None:
        quote.quantity = updates.quantity
    if updates.quoted_price is not None:
        quote.quoted_price = updates.quoted_price
    if updates.quote_date is not None:
        # Same check as POST, before committing, so a quote can't be moved
        # to a date with no price.
        price = get_latest_price(db, quote.drug_id, updates.quote_date)
        if price is None:
            raise HTTPException(
                status_code=422,
                detail=f"No NADAC price on or before {updates.quote_date}",
            )
        quote.quote_date = updates.quote_date
    db.commit()
    return to_quote_result(
        db,
        quote,
    )


@router.delete("/{quote_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quote(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    quote_id: int,
):
    """Delete one of the user's quotes. Returns 204 with no body, or 404 if it isn't theirs."""
    quote = get_own_quote(db, quote_id, current_user.id)
    db.delete(quote)
    db.commit()
