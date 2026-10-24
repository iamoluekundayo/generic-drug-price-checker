from datetime import date
from decimal import Decimal

from sqlalchemy import ForeignKey, UniqueConstraint, select
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, SessionLocal, engine


# Create models, one class per table
# SQLAlchemy records it in Base.metadata
class Drug(Base):
    __tablename__ = "drugs"
    id: Mapped[int] = mapped_column(primary_key=True)
    ndc: Mapped[str] = mapped_column(unique=True, index=True)
    description: Mapped[str]
    pricing_unit: Mapped[str]
    prices: Mapped[list["Price"]] = relationship(back_populates="drug")
    is_otc: Mapped[bool]
    last_seen: Mapped[date]

    def __repr__(self):
        return f"<Drug id={self.id}, ndc={self.ndc}, description={self.description}, pricing_unit={self.pricing_unit}, prices={self.prices}, is_otc={self.is_otc} last_seen={self.last_seen}"


class Price(Base):
    __tablename__ = "prices"
    id: Mapped[int] = mapped_column(primary_key=True)
    drug_id: Mapped[int] = mapped_column(
        ForeignKey("drugs.id")
    )  # ForeignKey constraint
    nadac_per_unit: Mapped[Decimal]
    effective_date: Mapped[date]
    explanation_code: Mapped[str]
    classification: Mapped[str]
    drug: Mapped["Drug"] = relationship(back_populates="prices")

    # using (NDC, effective date) as price's identify
    __table_args__ = (UniqueConstraint("drug_id", "effective_date"),)


# Denormalization
# class LatestPrice(Base):
#     __tablename__ = "latest_prices"
#     id: Mapped[int] = mapped_column(primary_key=True)
#     drug_id: Mapped[int] = mapped_column(ForeignKey("drugs.id"))
#     effective_date: Mapped[date]


with SessionLocal() as db:
    print(db.scalars(select(Drug)).first())
