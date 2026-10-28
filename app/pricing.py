from decimal import ROUND_HALF_UP, Decimal


def get_compare_numbers(
    nadac_per_unit: Decimal, quantity: Decimal, quoted_price: Decimal
):
    nadac_total = nadac_per_unit * quantity
    difference = quoted_price - nadac_total
    if nadac_total == 0:
        markup_percent = None
    else:
        markup_percent = (difference / nadac_total) * 100
    return {
        "nadac_total": nadac_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        "difference": difference.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        "markup_percent": markup_percent.quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        ),
    }
