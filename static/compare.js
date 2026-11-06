// states
// hidden (no drug selected, the form is empty)
// ready (show drug)
// sending (loading ...)
// result (show computed result)
// new drug selected (clear and hide result)

"use script";

const compareSection = document.getElementById("compare-section");
const compareForm = document.getElementById("compare-form");
const compareDrugName = document.getElementById("compare-drug-name");
const compareResultDisplay = document.getElementById("compare-result-display");
const compareFormQuantity = document.getElementById("compare-form-quantity");
const compareFormUnit = document.getElementById("compare-form-unit");
const compareFormQuotedPrice = document.getElementById(
  "compare-form-quoted-price",
);
const compareFormSubmit = document.getElementById("compare-form-submit");
const compareMessage = document.getElementById("compare-message");

let compareDrug = null;

document.addEventListener("drug-selected", (event) => {
  compareDrug = event.detail;
  compareMessage.textContent = "";
  compareResultDisplay.replaceChildren();
  compareDrugName.textContent = compareDrug.ndc_description;
  compareFormUnit.textContent = compareDrug.pricing_unit;
  compareSection.classList.remove("d-none");

  compareForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const quantity = compareFormQuantity.value;
    const quotedPrice = compareFormQuotedPrice.value;
    if (quantity <= 0) {
      compareMessage.textContent = "Quantity should be greater than 0";
      return;
    }
    if (quotedPrice < 0) {
      compareMessage.textContent = "Quoted price should be at least 0";
      return;
    }

    let compareResult;
    try {
      compareResult = await api("/compare", {
        method: "POST",
        body: {
          drug_id: compareDrug.id,
          quantity: quantity,
          quoted_price: quotedPrice,
        },
      });
    } catch (err) {
      compareMessage.textContent = err.message;
    }

    const nadacPrice = document.createElement("p");
    nadacPrice.textContent = `Nadac price: ${compareResult.nadac_per_unit}`;
    const nadacTotal = document.createElement("p");
    nadacTotal.textContent = `Nadac total: ${compareResult.nadac_total}`;
    const effectiveDate = document.createElement("p");
    effectiveDate.textContent = `Effective date: ${compareResult.effective_date}`;
    const difference = document.createElement("p");
    difference.textContent = `Difference: ${compareResult.difference}`;
    const markupPercent = document.createElement("p");
    markupPercent.textContent = `Difference: ${compareResult.markup_percent}`;

    compareResultDisplay.append(
      nadacPrice,
      nadacTotal,
      effectiveDate,
      difference,
      markupPercent,
    );
  });
});
