// states
// hidden (no drug selected, the form is empty)
// ready (show drug)
// sending (loading ...)
// result (show computed result)
// new drug selected (clear and hide result)

const compareSection = document.getElementById("compare-section");
const compareDrugName = document.getElementById("compare-drug-name");
const compareResultDisplay = document.getElementById("compare-result-display");
const compareFormQuantity = document.getElementById("compare-form-quantity");
const compareFormQuotedPrice = document.getElementById(
  "compare-form-quoted-price",
);
const compareFormSubmit = document.getElementById("compare-form-submit");
const compareMessage = document.getElementById("compare-message");

document.addEventListener("drug-selected", (event) => {
  drug = event.detail;
  compareMessage.textContent = "";
  compareResultDisplay.replaceChildren();
  compareSection.classList.remove("d-none");
  compareDrugName.textContent = drug.ndc_description;

  const compareResult = compareFormSubmit.addEventListener(
    "submit",
    async () => {
      quantity = compareFormQuantity.value;
      quotedPrice = compareFormQuotedPrice.value;
      if (quantity <= 0) {
        compareMessage.textContent = "Quantity should be greater than 0";
        return;
      }
      if (quotedPrice < 0) {
        compareMessage.textContent = "Quoted price should be at least 0";
        return;
      }

      const compareResult = await api("/compare", {
        method: "POST",
        body: {
          drug_id: drug.id,
          quantity: quantity,
          quoted_price: quotedPrice,
        },
      });

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
    },
  );
});
