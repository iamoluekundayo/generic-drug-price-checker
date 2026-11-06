// states
// hidden (no drug selected, the form is empty)
// ready (show drug)
// sending (loading ...)
// result (show computed result)
// new drug selected (clear and hide result)

"use strict";

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
  compareDrugName.textContent = compareDrug.ndc_description;
  compareFormUnit.textContent = compareDrug.pricing_unit;
  compareResultDisplay.replaceChildren();
  compareMessage.textContent = "";
  compareSection.classList.remove("d-none");
});

compareForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  compareMessage.textContent = "";
  compareResultDisplay.replaceChildren();
  const quantity = compareFormQuantity.value;
  const quotedPrice = compareFormQuotedPrice.value;
  if (Number(quantity) <= 0) {
    compareMessage.textContent = "Quantity should be greater than 0";
    return;
  }
  if (Number(quotedPrice) < 0) {
    compareMessage.textContent = "Quoted price should be at least 0";
    return;
  }

  let compareResult;
  compareMessage.textContent = "Loading...";
  try {
    compareFormSubmit.disabled = true;
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
    return;
  } finally {
    compareFormSubmit.disabled = false;
  }

  compareMessage.textContent = "";

  const nadacPrice = document.createElement("p");
  nadacPrice.textContent = `NADAC price: $${compareResult.nadac_per_unit} per ${compareDrug.pricing_unit}`;
  const nadacTotal = document.createElement("p");
  nadacTotal.textContent = `NADAC total: $${compareResult.nadac_total}`;
  const effectiveDate = document.createElement("p");
  effectiveDate.textContent = `Effective date: ${compareResult.effective_date}`;
  const difference = document.createElement("p");

  let markupPercent;
  if (compareResult.markup_percent === null) {
    markupPercent = "not available";
  } else {
    markupPercent = `${Math.abs(Number(compareResult.markup_percent)).toFixed(2)}%`;
  }
  difference.textContent = `Difference: $${Math.abs(Number(compareResult.difference)).toFixed(2)} (${markupPercent}) ${Number(compareResult.difference) >= 0 ? "above" : "below"} what pharmacies pay`;
  compareResultDisplay.append(
    nadacPrice,
    nadacTotal,
    effectiveDate,
    difference,
  );
});
