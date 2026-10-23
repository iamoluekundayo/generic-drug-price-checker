from datetime import date

from sqlalchemy import ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


# Create models, one class per table
# SQLAlchemy records it in Base.metadata
class Drug(Base):
    __tablename__ = "drugs"
    id: Mapped[int] = mapped_column(primary_key=True)
    ndc: Mapped[str] = mapped_column(unique=True, index=True)
    description: Mapped[str]
    pricing_unit: Mapped[str]
    prices: Mapped[list["Price"]] = relationship(back_populates="drug")


class Price(Base):
    __tablename__ = "prices"
    id: Mapped[int] = mapped_column(primary_key=True)
    drug_id: Mapped[int] = mapped_column(
        ForeignKey("drugs.id")
    )  # ForeignKey constraint
    nadac_per_unit: Mapped[float]
    effective_date: Mapped[date]
    drug: Mapped["Drug"] = relationship(back_populates="prices")

    __table_args__ = (
        UniqueConstraint("drug_id", "effective_date"),
        Index("ix_prices_drug_date", "drug_id", "effective_date"),
    )
