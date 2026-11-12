/*
states
no token: send the user to /login.html
loading
error, including a 401 if the token expired, which means sending them to login
empty: quotes-empty message
list: a page of quotes, with Previous and Next,
editing one quote, then saving the edit, with a possible error
deleting one quote
*/

"use strict";
const QUOTES_PAGE_SIZE = 3;
let quotesCurrentPage = 1;

const quotesEmpty = document.getElementById("quotes-empty");
const quotesContainer = document.getElementById("quotes-container");
const quotesRangeText = document.getElementById("quotes-range-text");
const quotesPreviousButton = document.getElementById("quotes-previous-button");
const quotesPageText = document.getElementById("quotes-page-text");
const quotesNextButton = document.getElementById("quotes-next-button");
const quotesError = document.getElementById("quotes-error");

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatAmount(num, decimal) {
  return Math.abs(Number(num)).toLocaleString("en-US", {
    minimumFractionDigits: decimal,
    maximumFractionDigits: decimal,
  });
}

function makeElement({ tag = "div", classes = [], text = "" } = {}) {
  const item = document.createElement(tag);
  if (classes.length !== 0) {
    item.classList.add(...classes);
  }

  if (text && String(text).trim().length !== 0) {
    item.textContent = text;
  }
  return item;
}

function createQuoteCard(quote) {
  const cardColumn = makeElement({ tag: "div", classes: ["col"] });
  const card = makeElement({ tag: "div", classes: ["card", "h-100"] });

  cardColumn.append(card);
  const cardBody = makeElement({
    tag: "div",
    classes: ["card-body"],
  });
  card.append(cardBody);
  const drugTitle = makeElement({
    tag: "p",
    classes: ["card-title", "fw-bold"],
    text: quote.ndc_description,
  });

  const quoteDetailsText = makeElement({
    tag: "p",
    classes: ["small", "text-body-secondary"],
    text: `Quoted ${formatDate(quote.quote_date)} · ${Number(quote.quantity)} ${quote.pricing_unit}`,
  });

  const priceTilesRow = makeElement({ tag: "div", classes: ["row", "g-2"] });

  const quotedPriceColumn = makeElement({
    tag: "div",
    classes: ["col-6"],
  });
  priceTilesRow.append(quotedPriceColumn);

  const quotedPriceTitle = makeElement({
    tag: "div",
    classes: ["bg-body-tertiary", "rounded", "p-3"],
  });
  quotedPriceColumn.append(quotedPriceTitle);

  const quotedPriceLabel = makeElement({
    tag: "p",
    classes: ["mb-0", "small", "text-body-secondary"],
    text: "Quoted price",
  });

  const quotedPriceValue = makeElement({
    tag: "p",
    classes: ["fs-4", "fw-bold", "text-nowrap", "mb-0"],
    text: `$${formatAmount(quote.quoted_price, 2)}`,
  });

  quotedPriceTitle.append(quotedPriceLabel, quotedPriceValue);

  const nadacTotalColumn = makeElement({
    tag: "div",
    classes: ["col-6"],
  });
  priceTilesRow.append(nadacTotalColumn);

  const nadacTotalTile = makeElement({
    tag: "div",
    classes: ["bg-body-tertiary", "rounded", "p-3"],
  });
  nadacTotalColumn.append(nadacTotalTile);

  const nadacTotalLabel = makeElement({
    tag: "p",
    classes: ["mb-0", "small", "text-body-secondary"],
    text: "NADAC total",
  });
  const nadacTotalValue = makeElement({
    tag: "p",
    classes: ["fs-4", "fw-bold", "text-nowrap", "mb-0"],
    text: `$${formatAmount(quote.nadac_total, 2)}`,
  });
  nadacTotalTile.append(nadacTotalLabel, nadacTotalValue);

  let markupPercentText;
  if (quote.markup_percent === null) {
    markupPercentText = "not available";
  } else {
    markupPercentText = `${formatAmount(quote.markup_percent, 2)}%`;
  }

  const differenceFromNadac = Number(quote.difference);

  const differenceSummary =
    differenceFromNadac !== 0
      ? `$${formatAmount(differenceFromNadac, 2)} (${markupPercentText}) ${differenceFromNadac > 0 ? "above" : "below"} NADAC`
      : "Same as NADAC";

  const differenceText = makeElement({
    tag: "p",
    classes: ["fw-bold"],
    text: differenceSummary,
  });
  if (differenceFromNadac > 0) {
    differenceText.classList.add("text-warning-emphasis");
  } else if (differenceFromNadac < 0) {
    differenceText.classList.add("text-success-emphasis");
  } else {
    differenceText.classList.add("text-body-secondary");
  }

  const divider = makeElement({ tag: "hr", classes: [] });

  const cardButtons = makeElement({
    tag: "div",
    classes: ["d-flex", "gap-2"],
  });

  const editButton = makeElement({
    tag: "button",
    classes: ["btn", "btn-outline-secondary"],
    text: "Edit",
  });

  editButton.addEventListener("click", () => {
    cardBody.classList.add("d-none");
    editCardBody.classList.remove("d-none");
  });

  const deleteButton = makeElement({
    tag: "button",
    classes: ["btn", "btn-outline-danger"],
    text: "Delete",
  });

  deleteButton.addEventListener("click", async () => {
    if (!confirm("Delete this quote?")) {
      return;
    }

    try {
      deleteButton.disabled = true;
      await api(`/quotes/${quote.id}`, { method: "DELETE" });
      loadQuotes();
    } catch (err) {
      if (err.status === 404) {
        loadQuotes();
        return;
      } else if (err.status === 401) {
        window.location.replace("/login.html?next=/quotes.html");
        return;
      }
      deleteButton.disabled = false;
      quotesError.textContent = err.message;
      quotesError.classList.remove("d-none");
    }
  });

  cardButtons.append(editButton, deleteButton);
  cardBody.append(
    drugTitle,
    quoteDetailsText,
    priceTilesRow,
    differenceText,
    divider,
    cardButtons,
  );

  const editCardBody = makeElement({
    tag: "div",
    classes: ["card-body", "d-none"],
  });
  card.append(editCardBody);
  const editDrugTitle = makeElement({
    tag: "p",
    classes: ["card-title", "fw-bold"],
    text: quote.ndc_description,
  });
  const editModeLabel = makeElement({
    tag: "p",
    classes: ["small", "text-body-secondary"],
    text: "Editing quote",
  });

  const quotePriceLabel = makeElement({
    tag: "label",
    classes: ["small", "text-body-secondary"],
    text: "Quote Price($)",
  });

  const quotePriceInput = makeElement({
    tag: "input",
    classes: ["form-control"],
  });
  quotePriceInput.type = "number";
  quotePriceInput.min = "0.001";
  quotePriceInput.step = "0.001";
  quotePriceInput.inputMode = "decimal";
  quotePriceInput.value = quote.quoted_price;

  const quantityLabel = makeElement({
    tag: "label",
    classes: ["small", "text-body-secondary"],
    text: `Quantity (${quote.pricing_unit})`,
  });

  const quantityInput = makeElement({
    tag: "input",
    classes: ["form-control"],
  });
  quantityInput.type = "number";
  quantityInput.min = "0";
  quantityInput.step = "0.01";
  quantityInput.inputMode = "decimal";
  quantityInput.value = Number(quote.quantity);

  const quoteDateLabel = makeElement({
    tag: "label",
    classes: ["small", "text-body-secondary"],
    text: `Quote Date (${quote.pricing_unit})`,
  });

  const quoteDateInput = makeElement({
    tag: "input",
    classes: ["form-control"],
  });

  quoteDateInput.type = "date";
  quoteDateInput.value = quote.quote_date;

  const editButtons = makeElement({
    tag: "div",
    classes: ["d-flex", "gap-2"],
  });

  const messageBox = makeElement({
    tag: "p",
    classes: [],
    text: "",
  });

  const saveButton = makeElement({
    tag: "button",
    classes: ["btn", "btn-primary"],
    text: "Save",
  });

  saveButton.addEventListener("click", async () => {
    saveButton.disabled = true;
    saveButton.textContent = "Saving";
    try {
      await api(`/quotes/${quote.id}`, {
        method: "PATCH",
        body: {
          quantity: quantityInput.value,
          quoted_price: quotePriceInput.value,
          quote_date: quoteDateInput.value,
        },
      });
    } catch (err) {
      if (err.status === 404) {
        loadQuotes();
        return;
      } else if (err.status === 401) {
        window.location.replace("/login.html?next=/quotes.html");
        return;
      }
      saveButton.disabled = false;
      saveButton.textContent = "Save";
      messageBox.textContent = err.message;
      return;
    }
    loadQuotes();
  });

  const cancelButton = makeElement({
    tag: "button",
    classes: ["btn", "btn-outline-secondary"],
    text: "Cancel",
  });

  cancelButton.addEventListener("click", () => {
    loadQuotes();
  });

  editButtons.append(saveButton, cancelButton);

  editCardBody.append(
    editDrugTitle,
    editModeLabel,
    quotePriceLabel,
    quotePriceInput,
    quantityLabel,
    quantityInput,
    quoteDateLabel,
    quoteDateInput,
    messageBox,
    editButtons,
  );

  return cardColumn;
}

function renderQuotes(quotes, totalQuotes) {
  if (totalQuotes === 0) {
    quotesContainer.replaceChildren();
    quotesPreviousButton.classList.add("d-none");
    quotesNextButton.classList.add("d-none");
    quotesRangeText.classList.add("d-none");
    quotesPageText.classList.add("d-none");
    quotesError.classList.add("d-none");
    quotesEmpty.classList.remove("d-none");
  } else {
    quotesContainer.replaceChildren();
    quotesPreviousButton.classList.remove("d-none");
    quotesNextButton.classList.remove("d-none");
    quotesRangeText.classList.remove("d-none");
    quotesPageText.classList.remove("d-none");
    quotesEmpty.classList.add("d-none");
    for (const quote of quotes) {
      quotesContainer.append(createQuoteCard(quote));
    }
    quotesError.classList.add("d-none");
  }
}

async function loadQuotes() {
  quotesPreviousButton.disabled = true;
  quotesNextButton.disabled = true;
  const params = new URLSearchParams({
    page: quotesCurrentPage,
    page_size: QUOTES_PAGE_SIZE,
  });
  if (!getToken()) {
    window.location.replace("/login.html?next=/quotes.html");
  } else {
    quotesError.classList.remove("d-none");
    let quotesResponse;
    try {
      quotesError.textContent = "loading...";
      quotesResponse = await api("/quotes?" + params);
    } catch (err) {
      if (err.status === 401) {
        window.location.replace("/login.html?next=/quotes.html");
        return;
      }
      quotesError.textContent = err.message;
      quotesError.classList.remove("d-none");
      return;
    }

    if (
      quotesResponse.items.length === 0 &&
      quotesResponse.total > 0 &&
      quotesCurrentPage > 1
    ) {
      quotesCurrentPage--;
      loadQuotes();
      return;
    }

    const firstShown = (quotesCurrentPage - 1) * QUOTES_PAGE_SIZE + 1;
    const lastShown = firstShown + (quotesResponse.items.length - 1);
    const totalQuotes = quotesResponse.total;
    const quotes = quotesResponse.items;
    const totalPages = Math.ceil(totalQuotes / quotesResponse.page_size);
    quotesRangeText.textContent = `Showing ${firstShown}-${lastShown} of ${totalQuotes} quotes`;
    quotesPageText.textContent = `Page ${quotesResponse.page} of ${Math.max(totalPages, 1)}`;

    renderQuotes(quotes, totalQuotes);

    if (quotesCurrentPage > 1) {
      quotesPreviousButton.disabled = false;
    }
    if (quotesResponse.page < totalPages) {
      quotesNextButton.disabled = false;
    }
  }
}
loadQuotes();

// previous button
quotesPreviousButton.addEventListener("click", () => {
  quotesCurrentPage--;
  loadQuotes();
});

// next button
quotesNextButton.addEventListener("click", () => {
  quotesCurrentPage++;
  loadQuotes();
});
