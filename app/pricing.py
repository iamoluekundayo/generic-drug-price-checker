from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import Subquery, func, select, tuple_
from sqlalchemy.orm import Session

from app.models import Price


def get_compare_numbers(
    nadac_per_unit: Decimal, quantity: Decimal, quoted_price: Decimal
):
    nadac_total = nadac_per_unit * quantity
    difference = quoted_price - nadac_total
    if nadac_total == 0:
        markup_percent = None
    else:
        markup_percent = ((difference / nadac_total) * 100).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    return {
        "nadac_total": nadac_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        "difference": difference.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        "markup_percent": markup_percent,
    }


def latest_prices_subquery() -> Subquery:
    latest_dates = select(Price.drug_id, func.max(Price.effective_date)).group_by(
        Price.drug_id
    )
    return (
        select(Price.drug_id, Price.nadac_per_unit, Price.effective_date)
        .where(tuple_(Price.drug_id, Price.effective_date).in_(latest_dates))
        .subquery()
    )


def get_latest_price(db: Session, drug_id: int) -> Price | None:
    return db.scalars(
        select(Price)
        .where(Price.drug_id == drug_id)
        .order_by(Price.effective_date.desc())
        .limit(1)
    ).first()


# 1) localstore
# 2) Chart
# how does one page work compared to several pages?
