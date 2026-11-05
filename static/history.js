// states
// hidden (nothing selected yet)
// loading (the message shows)
// error (the message shows the error)
// chart shown (chart and name)

"use strict";

const historySection = document.getElementById("history-section");
const historyDrugName = document.getElementById("history-drug-name");
const historyMessage = document.getElementById("history-message");
const historyCanvas = document.getElementById("history-canvas");

let historyChart = null;

document.addEventListener("drug-selected", async (event) => {
  historySection.classList.remove("d-none");
  const drug = event.detail;
  if (historyChart) {
    historyChart.destroy();
    historyChart = null;
  }
  historyDrugName.textContent = drug.ndc_description;
  historyMessage.textContent = "Loading...";

  let priceResult;
  try {
    priceResult = await api(`/drugs/${drug.id}/prices`);
  } catch (err) {
    historyMessage.textContent = err.message;
    return;
  }
  historyMessage.textContent = "";
  const chronologicalPrices = priceResult.toReversed();
  const dates = chronologicalPrices.map((p) => p.effective_date);
  const prices = chronologicalPrices.map((p) => Number(p.nadac_per_unit));

  historyChart = new Chart(historyCanvas, {
    type: "line",
    data: {
      labels: dates,
      datasets: [{ label: "NADAC per unit ($)", data: prices }],
    },
  });
});
