"""
Load a NADAC weekly price file into the database.

The CSV has one row per NDC per weekly list, so a years's file has over a million rows. A price, however, changes only about once a month. The script therefore stores:

* one ``Drug`` per NDC, and
* one ``Price`` per (NDC, effective date), skipping the weekly repeats

The import is idempotent: running it again on the same file adds nothing.
"""

import csv
import os
import sys
from datetime import datetime
from decimal import Decimal
from pathlib import Path

import httpx
from sqlalchemy import select

from app.db import Base, SessionLocal, engine
from app.models import Drug, Price


def download_csv(url, dest):
    """Download a file from ``url`` and save it to ``dest``.

    The file is streamed to ``<dest>.part`` first and renamed to ``dest`` only
    after the whole download succeeds, so ``dest`` is never left half-written.
    An existing ``dest`` is replaced.

    On a network error or an error status (4xx/5xx), the partial file is
    removed and the script exits with a message.
    """
    part_path = f"{dest}.part"
    try:
        with httpx.stream("GET", url, timeout=30, follow_redirects=True) as response:
            response.raise_for_status()
            with open(part_path, "wb") as file:
                file.writelines(response.iter_bytes())
        # Atomic rename: dest is either the old file or the complete new one, never partial.
        os.replace(part_path, dest)
    except httpx.HTTPError as error:
        Path(part_path).unlink(missing_ok=True)
        sys.exit(f"Download failed: {error}")


def main():
    """Read the CSV and insert any drugs and prices not already stored.

    Steps:
        1. Download data via httpx and store into CSV
        2. Create the tables if they do not exist yet.
        3. Load the NDCs and (NDC, effective date) pairs already in the database, so each CSV row can be checked without a query.
        4. Walk the CSV once, adding new drugs and new prices.
        5. Commit everything in a single transaction and print the counts.
    """

    final_path = "data/nadac.csv"
    if len(sys.argv) != 2:
        sys.exit("Usage: python -m scripts.import_nadac <csv_url")
    download_csv(sys.argv[1], final_path)

    # create_all only adds missing tables
    Base.metadata.create_all(engine)

    with (
        open(
            final_path,
            newline="",
            encoding="utf-8",
        ) as csv_file,
        SessionLocal() as session,
    ):
        # DictReader streams one row at a time, so the whole file is never
        # held in memory.
        reader = csv.DictReader(csv_file)

        # Look drugs up by NDC in memory instead of querying once per row.
        existing_drugs = session.scalars(select(Drug)).all()
        drug_by_ndc = {drug.ndc: drug for drug in existing_drugs}

        # A price is identified by (NDC, effective date)
        price_rows = session.execute(
            select(Drug.ndc, Price.effective_date).join(Price, Drug.id == Price.drug_id)
        ).all()
        existing_price_keys = {(row.ndc, row.effective_date) for row in price_rows}
        new_drug_count = 0
        new_price_count = 0
        for csv_row in reader:
            parsed = parse_row(csv_row)
            if parsed["ndc"] not in drug_by_ndc:
                drug = Drug(
                    ndc=parsed["ndc"],
                    ndc_description=parsed["ndc_description"],
                    pricing_unit=parsed["pricing_unit"],
                    is_otc=parsed["is_otc"],
                    last_seen_date=parsed["as_of_date"],
                )
                session.add(drug)
                drug_by_ndc[drug.ndc] = drug
                new_drug_count += 1
            drug = drug_by_ndc[parsed["ndc"]]
            drug.last_seen_date = max(parsed["as_of_date"], drug.last_seen_date)

            # The same price appears in every weekly list until it changes;
            # only the first occurrence of each (NDC, effective date) is kept.
            if (parsed["ndc"], parsed["effective_date"]) not in existing_price_keys:
                price = Price(
                    drug=drug_by_ndc[parsed["ndc"]],
                    nadac_per_unit=parsed["nadac_per_unit"],
                    effective_date=parsed["effective_date"],
                    explanation_code=parsed["explanation_code"],
                    classification=parsed["classification"],
                )
                session.add(price)
                existing_price_keys.add((parsed["ndc"], parsed["effective_date"]))
                new_price_count += 1

        # One commit: if anything fails, the whole import is rolled back
        session.commit()
        print(new_drug_count)
        print(new_price_count)


def parse_row(row):
    """Convert one raw CSV row into typed values.

    Args:
        row: A dictionary from ``csv.DictReader``, keyed by the CSV headers.

    Returns:
        A dictionary with the NDC and descriptive text unchanged, the OTC flag
        as a bool, the price as a ``Decimal`` (exact, unlike float), and both
        dates as ``date`` objects.

    """
    return {
        "ndc": row["NDC"],
        "ndc_description": row["NDC Description"],
        "pricing_unit": row["Pricing Unit"],
        "is_otc": row["OTC"] == "Y",
        "nadac_per_unit": Decimal(row["NADAC Per Unit"]),
        "effective_date": datetime.strptime(row["Effective Date"], "%m/%d/%Y").date(),
        "as_of_date": datetime.strptime(row["As of Date"], "%m/%d/%Y").date(),
        "explanation_code": row["Explanation Code"],
        "classification": row["Classification for Rate Setting"],
    }


# TODO: Clean missing or dirty values
# TODO: Set last_seen on each import
if __name__ == "__main__":
    main()
