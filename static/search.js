const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const searchResult = document.getElementById("search-result");
const searchMessage = document.getElementById("search-message");
const searchResultList = document.getElementById("search-result-list");
const searchPrevious = document.getElementById("search-previous");
const searchNext = document.getElementById("search-next");

let currentPage;
let maxPage;
let matches;
let searchText;
let params;

async function getDrugs({ pageNum = currentPage } = {}) {
  params = new URLSearchParams({
    q: searchText,
    page: pageNum,
    page_size: 20,
  });
  try {
    return await api("/drugs?" + params);
  } catch (err) {
    searchMessage.textContent = err.message;
  }
}

function displayDrug() {
  searchResultList.replaceChildren();
  searchMessage.classList.add("d-none");
  for (let drug of matches) {
    const item = document.createElement("button");
    item.className = "list-group-item list-group-item-action";
    item.textContent = `${drug.ndc_description} 
          ${drug.pricing_unit} 
          $${drug.nadac_per_unit} 
          ${drug.last_seen_date}`;
    searchResultList.append(item);
  }
}

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  currentPage = 1;
  searchPrevious.classList.add("disabled");
  searchText = searchInput.value.trim();

  if (searchText.length < 2) {
    searchMessage.classList.remove("d-none");
    searchResult.classList.remove("d-none");
    searchMessage.textContent = "Drug name must be at least 2 characters";
  } else {
    searchMessage.classList.remove("d-none");
    searchResult.classList.remove("d-none");
    searchMessage.textContent = "loading...";
    matches = await getDrugs();
    displayDrug();
  }
});

// previous button
searchPrevious.addEventListener("click", async () => {
  currentPage--;
  if (currentPage <= 1) {
    searchPrevious.classList.add("disabled");
  }
  if (maxPage !== undefined && currentPage < maxPage) {
    searchNext.classList.remove("disabled");
  }
  matches = await getDrugs();
  displayDrug();
});

// next button
searchNext.addEventListener("click", async () => {
  currentPage++;
  const nextPage = await getDrugs({ pageNum: currentPage + 1 });
  console.log("nextPage");
  console.log(nextPage.length);
  console.log(nextPage);
  if (nextPage.length == 0) {
    searchNext.classList.add("disabled");
    maxPage = currentPage;
  }
  if (currentPage >= 2) {
    searchPrevious.classList.remove("disabled");
  }
  matches = await getDrugs({ pageNum: currentPage });
  displayDrug();
});

searchInput.addEventListener("input", () => {
  searchMessage.classList.add("d-none");
});

// function showSuggestions(matches) {
//   const item = document.createElement("button");
//   item.className = "list-group-item list-group-item-action";
//   item.textContent = ndc_description;
// }
