"use strict";

const QUOTES_PAGE_SIZE = 3;
const LOGIN_URL = "/login.html?next=/quotes.html";

let quotesCurrentPage = 1;
let quotesTotalPages = 1;

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

function formatAmount(num, decimals) {
  return Math.abs(Number(num)).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatMoney(num) {
  return `$${formatAmount(num, 2)}`;
}

function makeElement({
  tag = "div",
  classes = [],
  text = "",
  attrs = {},
} = {}) {
  const el = document.createElement(tag);
  if (classes.length !== 0) {
    el.classList.add(...classes);
  }
  if (text && String(text).trim().length !== 0) {
    el.textContent = text;
  }
  Object.assign(el, attrs);
  return el;
}

function makeButton(text, classes) {
  return makeElement({
    tag: "button",
    classes: ["btn", ...classes],
    text,
    attrs: { type: "button" },
  });
}

function makeField({ id, label, attrs }) {
  return {
    label: makeElement({
      tag: "label",
      classes: ["small", "text-body-secondary"],
      text: label,
      attrs: { htmlFor: id },
    }),
    input: makeElement({
      tag: "input",
      classes: ["form-control"],
      attrs: { id, required: true, ...attrs },
    }),
  };
}

function redirectToLogin() {
  window.location.replace(LOGIN_URL);
}

function showPageMessage(text) {
  quotesError.textContent = text;
  quotesError.classList.remove("d-none");
}

function hidePageMessage() {
  quotesError.classList.add("d-none");
}

// Handles errors that mean the same thing everywhere.
// Returns true if handled, so the caller should stop.
function handleCommonApiErrors(err) {
  if (err.status === 401) {
    redirectToLogin();
    return true;
  }
  if (err.status === 404) {
    // The quote no longer exists, so refresh the list.
    loadQuotes();
    return true;
  }
  return false;
}

function fetchQuotesPage(page) {
  const params = new URLSearchParams({ page, page_size: QUOTES_PAGE_SIZE });
  return api(`/quotes?${params}`);
}

async function deleteQuote(quote, button) {
  if (!confirm("Delete this quote?")) {
    return;
  }

  button.disabled = true;
  try {
    await api(`/quotes/${quote.id}`, { method: "DELETE" });
  } catch (err) {
    if (handleCommonApiErrors(err)) return;
    button.disabled = false;
    showPageMessage(err.message);
    return;
  }
  loadQuotes();
}

async function saveQuote(quote, fields) {
  try {
    await api(`/quotes/${quote.id}`, { method: "PATCH", body: fields });
  } catch (err) {
    if (handleCommonApiErrors(err)) return null;
    return err.message;
  }
  loadQuotes();
  return null;
}

function createTitle(quote) {
  return makeElement({
    tag: "p",
    classes: ["card-title", "fw-bold"],
    text: quote.ndc_description,
  });
}

function createPriceTile(label, amount) {
  const column = makeElement({ classes: ["col-6"] });
  const tile = makeElement({ classes: ["bg-body-tertiary", "rounded", "p-3"] });
  tile.append(
    makeElement({
      tag: "p",
      classes: ["mb-0", "small", "text-body-secondary"],
      text: label,
    }),
    makeElement({
      tag: "p",
      classes: ["fs-4", "fw-bold", "text-nowrap", "mb-0"],
      text: formatMoney(amount),
    }),
  );
  column.append(tile);
  return column;
}

function describeDifference(quote) {
  const difference = Number(quote.difference);
  if (difference === 0) {
    return { text: "Same as NADAC", className: "text-body-secondary" };
  }

  const percent =
    quote.markup_percent === null
      ? "not available"
      : `${formatAmount(quote.markup_percent, 2)}%`;
  const direction = difference > 0 ? "above" : "below";

  return {
    text: `${formatMoney(difference)} (${percent}) ${direction} NADAC`,
    className:
      difference > 0 ? "text-warning-emphasis" : "text-success-emphasis",
  };
}

function buildViewBody(quote, { onEdit, onDelete }) {
  const body = makeElement({ classes: ["card-body"] });

  const details = makeElement({
    tag: "p",
    classes: ["small", "text-body-secondary"],
    text: `Quoted ${formatDate(quote.quote_date)} · ${Number(quote.quantity)} ${quote.pricing_unit}`,
  });

  const priceRow = makeElement({ classes: ["row", "g-2"] });
  priceRow.append(
    createPriceTile("Quoted price", quote.quoted_price),
    createPriceTile("NADAC total", quote.nadac_total),
  );

  const { text, className } = describeDifference(quote);
  const difference = makeElement({
    tag: "p",
    classes: ["fw-bold", className],
    text,
  });

  const editButton = makeButton("Edit", ["btn-outline-secondary"]);
  editButton.addEventListener("click", onEdit);

  const deleteButton = makeButton("Delete", ["btn-outline-danger"]);
  deleteButton.addEventListener("click", () => onDelete(deleteButton));

  const buttons = makeElement({ classes: ["d-flex", "gap-2"] });
  buttons.append(editButton, deleteButton);

  body.append(
    createTitle(quote),
    details,
    priceRow,
    difference,
    makeElement({ tag: "hr" }),
    buttons,
  );
  return body;
}

function buildEditBody(quote, { onSave, onCancel }) {
  const body = makeElement({ classes: ["card-body", "d-none"] });
  const idPrefix = `quote-${quote.id}`;

  const price = makeField({
    id: `${idPrefix}-price`,
    label: "Quoted price ($)",
    attrs: {
      type: "number",
      min: "0.001",
      step: "0.001",
      inputMode: "decimal",
      value: quote.quoted_price,
    },
  });

  const quantity = makeField({
    id: `${idPrefix}-quantity`,
    label: `Quantity (${quote.pricing_unit})`,
    attrs: {
      type: "number",
      min: "0",
      step: "0.01",
      inputMode: "decimal",
      value: Number(quote.quantity),
    },
  });

  const date = makeField({
    id: `${idPrefix}-date`,
    label: "Quote date",
    attrs: {
      type: "date",
      value: String(quote.quote_date).slice(0, 10),
    },
  });

  const message = makeElement({ tag: "p", classes: ["small", "text-danger"] });

  const saveButton = makeButton("Save", ["btn-primary"]);
  const cancelButton = makeButton("Cancel", ["btn-outline-secondary"]);
  const inputs = [price.input, quantity.input, date.input];

  saveButton.addEventListener("click", async () => {
    message.textContent = "";

    const invalid = inputs.find((input) => !input.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      invalid.focus();
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving";

    const error = await onSave({
      quantity: quantity.input.value,
      quoted_price: price.input.value,
      quote_date: date.input.value,
    });

    if (error) {
      saveButton.disabled = false;
      saveButton.textContent = "Save";
      message.textContent = error;
    }
  });

  cancelButton.addEventListener("click", onCancel);

  const buttons = makeElement({ classes: ["d-flex", "gap-2"] });
  buttons.append(saveButton, cancelButton);

  body.append(
    createTitle(quote),
    makeElement({
      tag: "p",
      classes: ["small", "text-body-secondary"],
      text: "Editing quote",
    }),
    price.label,
    price.input,
    quantity.label,
    quantity.input,
    date.label,
    date.input,
    message,
    buttons,
  );
  return body;
}

function createQuoteCard(quote) {
  const column = makeElement({ classes: ["col"] });
  const card = makeElement({ classes: ["card", "h-100"] });
  column.append(card);

  const viewBody = buildViewBody(quote, {
    onEdit: () => {
      viewBody.classList.add("d-none");
      editBody.classList.remove("d-none");
    },
    onDelete: (button) => deleteQuote(quote, button),
  });

  const editBody = buildEditBody(quote, {
    onSave: (fields) => saveQuote(quote, fields),
    onCancel: () => loadQuotes(),
  });

  card.append(viewBody, editBody);
  return column;
}

function renderQuotes(quotes, totalQuotes) {
  const hasQuotes = totalQuotes > 0;

  quotesContainer.replaceChildren(...quotes.map(createQuoteCard));

  for (const el of [
    quotesPreviousButton,
    quotesNextButton,
    quotesRangeText,
    quotesPageText,
  ]) {
    el.classList.toggle("d-none", !hasQuotes);
  }
  quotesEmpty.classList.toggle("d-none", hasQuotes);
}

function renderPagination({ page, page_size, total, items }) {
  const firstShown = (page - 1) * page_size + 1;
  const lastShown = firstShown + items.length - 1;

  quotesRangeText.textContent = `Showing ${firstShown}-${lastShown} of ${total} quotes`;
  quotesPageText.textContent = `Page ${page} of ${quotesTotalPages}`;
  updatePaginationButtons();
}

function updatePaginationButtons() {
  quotesPreviousButton.disabled = quotesCurrentPage <= 1;
  quotesNextButton.disabled = quotesCurrentPage >= quotesTotalPages;
}

async function loadQuotes() {
  if (!getToken()) {
    redirectToLogin();
    return;
  }

  quotesPreviousButton.disabled = true;
  quotesNextButton.disabled = true;
  showPageMessage("loading...");

  let response;
  try {
    response = await fetchQuotesPage(quotesCurrentPage);
  } catch (err) {
    if (err.status === 401) {
      redirectToLogin();
      return;
    }
    showPageMessage(err.message);
    updatePaginationButtons();
    return;
  }

  if (
    response.items.length === 0 &&
    response.total > 0 &&
    quotesCurrentPage > 1
  ) {
    quotesCurrentPage--;
    loadQuotes();
    return;
  }

  quotesCurrentPage = response.page;
  quotesTotalPages = Math.max(
    Math.ceil(response.total / response.page_size),
    1,
  );

  hidePageMessage();
  renderQuotes(response.items, response.total);
  renderPagination(response);
}

quotesPreviousButton.addEventListener("click", () => {
  quotesCurrentPage--;
  loadQuotes();
});

quotesNextButton.addEventListener("click", () => {
  quotesCurrentPage++;
  loadQuotes();
});

loadQuotes();
