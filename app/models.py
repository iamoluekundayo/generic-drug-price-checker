"""Database models for the NADAC price data.

``Drug`` holds facts about a product that do not change with price.
``Price`` holds one row each time that product's price changes.

"""

from datetime import date
from decimal import Decimal

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


# One class per table. Defining a class registers its table in Base.metadata,
# which is what Base.metadata.create_all(() reads.
class Drug(Base):
    """A product identified by its NDC (National Drug Code).

    Oe row per HDC, however many weekly price lists it appears in
    """

    __tablename__ = "drugs"
    id: Mapped[int] = mapped_column(primary_key=True)
    ndc: Mapped[str] = mapped_column(unique=True, index=True)
    ndc_description: Mapped[str]
    pricing_unit: Mapped[str]
    prices: Mapped[list["Price"]] = relationship(back_populates="drug")
    is_otc: Mapped[bool]
    last_seen_date: Mapped[date]

    def __repr__(self):
        return f"Drug id={self.id}, ndc={self.ndc}, description={self.ndc_description}, pricing_unit={self.pricing_unit}, is_otc={self.is_otc}, last_seen={self.last_seen_date}"


class Price(Base):
    """The NADAC price of one drug from one effective date onward.

    NADAC is what pharmacies pay to acquire a drug, not the retail price.
    """

    __tablename__ = "prices"
    id: Mapped[int] = mapped_column(primary_key=True)
    drug_id: Mapped[int] = mapped_column(
        ForeignKey("drugs.id")
    )  # ForeignKey constraint
    nadac_per_unit: Mapped[Decimal]
    effective_date: Mapped[date]
    # CMS explanation codes for why the rate is what it is. May hold several,
    # such as "1, 5", so it kept as text.
    explanation_code: Mapped[str]
    # G (generic), B (brand), B-ANDA or B-BIO
    classification: Mapped[str]

    # Python-side shortcut to the owning drug; not a database column
    drug: Mapped["Drug"] = relationship(back_populates="prices")

    # using (NDC, effective date) as price's identify
    __table_args__ = (
        UniqueConstraint(
            "drug_id", "effective_date", name="uq_prices_drug_id_effective_date"
        ),
    )


# Denormalization
# class LatestPrice(Base):
#     __tablename__ = "latest_prices"
#     id: Mapped[int] = mapped_column(primary_key=True)
#     drug_id: Mapped[int] = mapped_column(ForeignKey("drugs.id"))
#     effective_date: Mapped[date]
