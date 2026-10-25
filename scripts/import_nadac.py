import csv
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select

from app.db import Base, SessionLocal, engine
from app.models import Drug, Price


def main():
    Base.metadata.create_all(engine)
    with (
        open(
            "data/nadac-national-average-drug-acquisition-cost-10-21-2026.csv",
            newline="",
            encoding="utf-8",
        ) as file,
        SessionLocal() as session,
    ):
        reader = csv.DictReader(file)
        # Load existing drugs into current_drugs
        drugs = session.scalars(select(Drug)).all()
        current_drugs = {drug.ndc: drug for drug in drugs}

        # Load existing price pairs into existing_prices
        rows = session.execute(
            select(Drug.ndc, Price.effective_date).join(Price, Drug.id == Price.drug_id)
        ).all()
        existing_prices = {(row.ndc, row.effective_date) for row in rows}
        new_drugs = 0
        new_prices = 0
        for row in reader:
            ndc = parse_row(row)
            if ndc["ndc"] not in current_drugs:
                new_drug = Drug(
                    ndc=ndc["ndc"],
                    description=ndc["description"],
                    pricing_unit=ndc["pricing_unit"],
                    is_otc=ndc["is_otc"],
                    last_seen=ndc["as_of_date"],
                )
                session.add(new_drug)
                current_drugs[new_drug.ndc] = new_drug
                new_drugs += 1

            if (ndc["ndc"], ndc["effective_date"]) not in existing_prices:
                new_price = Price(
                    drug=current_drugs[ndc["ndc"]],
                    nadac_per_unit=ndc["nadac_per_unit"],
                    effective_date=ndc["effective_date"],
                    explanation_code=ndc["explanation_code"],
                    classification=ndc["classification"],
                )
                session.add(new_price)
                existing_prices.add((ndc["ndc"], ndc["effective_date"]))
                new_prices += 1
        session.commit()
        print(new_drugs)
        print(new_prices)


def parse_row(row):
    return {
        "ndc": row["NDC"],
        "description": row["NDC Description"],
        "pricing_unit": row["Pricing Unit"],
        "is_otc": row["OTC"] == "Y",
        "nadac_per_unit": Decimal(row["NADAC Per Unit"]),
        "effective_date": datetime.strptime(row["Effective Date"], "%m/%d/%Y").date(),
        "as_of_date": datetime.strptime(row["As of Date"], "%m/%d/%Y").date(),
        "explanation_code": row["Explanation Code"],
        "classification": row["Classification for Rate Setting"],
    }


if __name__ == "__main__":
    main()
