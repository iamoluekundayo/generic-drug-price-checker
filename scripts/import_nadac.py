import csv
from datetime import datetime
from decimal import Decimal


def main():
    with open(
        "data/nadac-national-average-drug-acquisition-cost-10-21-2026.csv",
        newline="",
        encoding="utf-8",
    ) as file:
        reader = csv.DictReader(file)
        for index, row in enumerate(reader):
            print(parse_row(row))
            if index == 3:
                break


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
