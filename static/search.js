const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const searchResult = document.getElementById("search-result");
const searchMessage = document.getElementById("search-message");
const searchResultList = document.getElementById("search-result-list");
const searchPrevious = document.getElementById("search-previous");
const searchNext = document.getElementById("search-next");

const PAGE_SIZE = 20;
let searchText = "";
let currentPage = 1;

async function loadPage() {
  searchPrevious.disabled = true;
  searchNext.disabled = true;
  searchMessage.classList.remove("d-none");
  searchMessage.textContent = "Loading...";
  const params = new URLSearchParams({
    q: searchText,
    page: currentPage,
    page_size: PAGE_SIZE,
  });

  let drugs;
  try {
    drugs = await api("/drugs?" + params);
    searchMessage.classList.add("d-none");
    renderDrugs(drugs);
  } catch (err) {
    searchMessage.textContent = err.message;
    return;
  }
  if (currentPage > 1) {
    searchPrevious.disabled = false;
  }
  if (drugs.length === PAGE_SIZE) {
    searchNext.disabled = false;
  }
}

function renderDrugs(drugs) {
  if (drugs.length == 0) {
    searchMessage.classList.remove("d-none");
    searchMessage.textContent = "No drugs match";
  }
  searchResultList.replaceChildren();
  for (const drug of drugs) {
    const item = document.createElement("button");
    item.className = "list-group-item list-group-item-action";

    const name = document.createElement("div");
    name.textContent = drug.ndc_description;

    const details = document.createElement("small");
    details.className = "text-muted";
    details.textContent = ` NDC ${drug.ndc} · $${drug.nadac_per_unit} per ${drug.pricing_unit} · as of ${drug.effective_date}`;
    item.append(name, details);
    searchResultList.append(item);
  }
}

searchForm.addEventListener("submit", (event) => {
  searchResultList.replaceChildren();
  currentPage = 1;
  event.preventDefault();
  uncheckedSearchText = searchInput.value.trim();
  if (uncheckedSearchText.length < 2) {
    searchMessage.classList.remove("d-none");
    searchResult.classList.remove("d-none");
    searchMessage.textContent = "Drug name must be at least 2 characters";
    return;
  }
  searchText = uncheckedSearchText;
  searchResult.classList.remove("d-none");
  loadPage();
});

// previous button
searchPrevious.addEventListener("click", () => {
  currentPage--;
  loadPage();
});

// next button
searchNext.addEventListener("click", () => {
  currentPage++;
  loadPage();
});

searchInput.addEventListener("input", () => {
  searchMessage.classList.add("d-none");
});

// function showSuggestions(matches) {
//   const item = document.createElement("button");
//   item.className = "list-group-item list-group-item-action";
//   item.textContent = ndc_description;
// }
