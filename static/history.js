"use script";

// states
// drug is selected from home page's search result
// new drug is selected

const historySection = document.getElementById("history");
const historyMessage = document.getElementById("history-message");
const historyCanvas = document.getElementById("history-canvas");

document.addEventListener("drug-selected", async (event) => {
  history.classList.remove("d-none");
  const drug = event.detail;
  historyMessage.textContent = "Loading...";
  let priceResult;
  try {
    priceResult = await api(`/drugs/${drug.id}/prices`);
  } catch (err) {
    historyMessage.textContent = err.message;
  }
  const chronologicalPrices = priceResult.toReversed();
  const dates = chronologicalPrices.map((p) => p.effective_date);
  const prices = chronologicalPrices.map((p) => Number(p.nadac_per_unit));

  historyCanvas.destroy();

  const chart = new Chart(historyCanvas, {
    type: "line",
    data: {
      labels: dates,
      datasets: [{ label: "NADAC per unit ($) ", data: prices }],
    },
  });
});
