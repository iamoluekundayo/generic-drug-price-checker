/**
 * quotes.js
 *
 * Renders the signed-in user's saved drug price quotes on quotes.html.
 * Each quote is shown as a card comparing the quotes price with the
 * NADAC (National Average Drug Acquisition Cost) total. Users can edit
 * or delete a card in place, and page through quotes QUOTES_PAGE_SIZE
 * at a time.
 *
 * Depends on globals defined in api.js:
 * - api(path, options)
 * - getToken()
 *
 * Page states:
 * - Loading: status message area shows "loading...", pagination disabled.
 * - Empty: no quotes; "empty" notice shown, pagination hidden.
 * - List: cards for the current page plus range and page text
 * - Error: Message area shows the API error text.
 * - Signed out (no token, or 401): redirect to the login page.
 *
 * Card states:
 * - View: quote details with Edit and Delete buttons.
 * - Edit: form for price, quantity and date with Save and Cancel.
 */
"use strict";

const QUOTES_PAGE_SIZE = 4;
const LOGIN_URL = "/login.html?next=/quotes.html";

// Pagination state, updated from each API response.
let quotesCurrentPage = 1;
let quotesTotalPages = 1;

const quotesEmpty = document.getElementById("quotes-empty");
const quotesContainer = document.getElementById("quotes-container");
const quotesRangeText = document.getElementById("quotes-range-text");
const quotesPreviousButton = document.getElementById("quotes-previous-button");
const quotesPageText = document.getElementById("quotes-page-text");
const quotesNextButton = document.getElementById("quotes-next-button");
const quotesStatus = document.getElementById("quotes-status");
const quotesError = document.getElementById("quotes-error");

/* ---------- Formatting helpers ---------- */

/**
 * Formats a date as e.g. "Nov 16, 2026".
 * Uses UTC so a date-only value like "2026-11-16" is not shifted
 * to the previous day in the time zones behind UTC.
 */
function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Formats the absolute value of a number with a fixed number of decimals
 * and thousands separators. The sign is dropped on purpose; callers
 * describe direction in words ("above" / "below").
 */
function formatAmount(num, decimals) {
  return Math.abs(Number(num)).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Formats a number as dollars, e.g. 1234.5 -> "$1,234.50". */
function formatMoney(num) {
  return `$${formatAmount(num, 2)}`;
}
/* ---------- DOM helpers ---------- */

/**
 * Creates an element in one call.
 * @param {object} options
 * @param {string} [options.tag="div"] Tag name.
 * @param {string[]} [options.classes] CSS classes to add.
 * @param {string} [options.text] Text content (skipped if blank).
 * @param {object} [options.attrs] Properties copied onto the element,
 *                                 e.g. {type: "button", htmlFor: "x"}.
 * @returns {HTMLElement}
 */
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

/**
 * Creates a Bootstrap button. type ="button" stop it from
 * submitting a form it is ever placed inside one.
 */
function makeButton(text, classes) {
  return makeElement({
    tag: "button",
    classes: ["btn", ...classes],
    text,
    attrs: { type: "button" },
  });
}

/**
 *
 * Creates a required input and a label linked to it by id.
 * @returns {{label: HTMLLabelElement, input: HTMLInputElement}}
 */
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

/* ---------- Page messages and navigation ---------- */

/** Sends the user to log in. replace() keeps this page out of the history. */
function redirectToLogin() {
  window.location.replace(LOGIN_URL);
}

/** Shows text in the status message area. */
function showStatus(text) {
  quotesStatus.textContent = text;
  quotesStatus.classList.remove("d-none");
}

/** Hides the status message area. */
function hideStatus() {
  quotesStatus.classList.add("d-none");
}

/** Shows text in the error message area. */
function showErrorMessage(text) {
  quotesError.textContent = text;
  quotesError.classList.remove("d-none");
}

/** Hides the error message area. */
function hideErrorMessage() {
  quotesError.classList.add("d-none");
}

/**
 *
 * handles API errors that mean the same things for every quote action.
 *  401: session expired -> redirect to login.
 * 404: quote was already deleted (e.g. in another tab) -> reload list.
 * @returns {boolean} true if handled, so the caller should stop.
 */
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

/**
 *
 * Fetches one page of quotes.
 * @returns {Promise<{items: object[], page: number, page_size: number, total: num}}
 */
function fetchQuotesPage(page) {
  const params = new URLSearchParams({ page, page_size: QUOTES_PAGE_SIZE });
  return api(`/quotes?${params}`);
}

/**
 * Asks for confirmation, then deletes a quote and reloads the list.
 * The button stays disabled during the request to prevent double clicks
 */
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
    showErrorMessage(err.message);
    return;
  }
  loadQuotes();
}

/**
 * Saves edited fields for a quote, then reloads the list.
 * @returns {Promise<string|null>} An error message to show in the edit
 *  form, or null on success (or when the error was already handled).
 */
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

/* ---------- Quote card ---------- */
/** Creates the card title (drug description). Used in both card states. */
function createTitle(quote) {
  return makeElement({
    tag: "p",
    classes: ["card-title", "fw-bold"],
    text: quote.ndc_description,
  });
}

/** Creates a half-width tile showing a label above a dollar amount. */
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

/**
 * Describes how the quote's price compares with NADAC,
 * e.g. "$12.50 (8.00%) above NADAC".
 * @returns {{text: string, className: string}} Text plus a color class:
 *  grey when equal, warning when above, success when below.
 */
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

/**
 * Builds the card's view state: details, price tiles, difference,
 * and Edit / Delete buttons.
 * @param {object} quote
 * @param {{onEdit: Function, onDelete: (button: HTMLButtonElement) => void}} handlers
 */
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
  // Pass the button so deleteQuote can disable it during the request.
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

/**
 * Builds the card's edit state (hidden at first): inputs for price,
 * quantity and date, an inline error message, and Save / Cancel.
 * @param {object} quote
 * @param {{onSave: (fields: object) => Promise<string|null>, onCancel: Function}} handlers
 *      onSave resolves to an error message, or null on success.
 */
function buildEditBody(quote, { onSave, onCancel }) {
  const body = makeElement({ classes: ["card-body", "d-none"] });
  const idPrefix = `quote-${quote.id}`;

  const price = makeField({
    id: `${idPrefix}-price`,
    label: "Quoted price ($)",
    attrs: {
      type: "number",
      min: "0",
      step: "0.01",
      inputMode: "decimal",
      value: quote.quoted_price,
    },
  });

  const quantity = makeField({
    id: `${idPrefix}-quantity`,
    label: `Quantity (${quote.pricing_unit})`,
    attrs: {
      type: "number",
      min: "0.001",
      step: "0.001",
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
      max: localToday(),
    },
  });

  const message = makeElement({ tag: "p", classes: ["small", "text-danger"] });

  const saveButton = makeButton("Save", ["btn-primary"]);
  const cancelButton = makeButton("Cancel", ["btn-outline-secondary"]);
  const inputs = [price.input, quantity.input, date.input];

  saveButton.addEventListener("click", async () => {
    message.textContent = "";

    // The inputs aren't in a form <form>, so run the browser's
    // built-in validation by hand and show the first problem.
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

    // On success the list reloads and replaces this card,
    // so the button only needs resetting on failure.
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

/**
 * Creates a grid column holding one quote card. The card contains both
 * the view and edit bodies; edit swaps which one is visible.
 */
function createQuoteCard(quote) {
  const column = makeElement({ classes: ["col"] });
  const card = makeElement({ classes: ["card", "h-100"] });
  column.append(card);

  // editBody is declared below, but onEdit only runs on click,
  // after both bodies exist.
  const viewBody = buildViewBody(quote, {
    onEdit: () => {
      viewBody.classList.add("d-none");
      editBody.classList.remove("d-none");
    },
    onDelete: (button) => deleteQuote(quote, button),
  });

  const editBody = buildEditBody(quote, {
    onSave: (fields) => saveQuote(quote, fields),
    // Reloading rebuilds the card, which resets any unsaved edits.
    onCancel: () => loadQuotes(),
  });

  card.append(viewBody, editBody);
  return column;
}

/* ---------- List and pagination ---------- */

/**
 * Replaces the cards on the page and toggles between the
 * list view and the empty notice.
 */
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

/** Updates "Showing X-Y of Z quotes", "Page N of M", and the buttons. */
function renderPagination({ page, page_size, total, items }) {
  const firstShown = (page - 1) * page_size + 1;
  const lastShown = firstShown + items.length - 1;

  quotesRangeText.textContent = `Showing ${firstShown}-${lastShown} of ${total} quotes`;
  quotesPageText.textContent = `Page ${page} of ${quotesTotalPages}`;
  updatePaginationButtons();
}

/** Disables Previous on the first page and Next on the last. */
function updatePaginationButtons() {
  quotesPreviousButton.disabled = quotesCurrentPage <= 1;
  quotesNextButton.disabled = quotesCurrentPage >= quotesTotalPages;
}

/**
 * Loads and renders the current page of quotes. Called on page load,
 * on Previous / Next, and after every save, delete, or cancel */
async function loadQuotes() {
  if (!getToken()) {
    redirectToLogin();
    return;
  }
  hideErrorMessage();

  // Loading state: block page changes until the request finishes.
  quotesPreviousButton.disabled = true;
  quotesNextButton.disabled = true;
  showStatus("Loading");
  let response;
  try {
    response = await fetchQuotesPage(quotesCurrentPage);
  } catch (err) {
    // Only 401 is checked here, not handleCommonApiErrors():
    // its 404 branch calls loadQuotes() and could loop forever.
    if (err.status === 401) {
      redirectToLogin();
      return;
    }
    hideStatus();
    showErrorMessage(err.message);
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

  // Trust the server's page number, and always have at least one page.
  quotesCurrentPage = response.page;
  quotesTotalPages = Math.max(
    Math.ceil(response.total / response.page_size),
    1,
  );

  hideStatus();
  hideErrorMessage();
  renderQuotes(response.items, response.total);
  renderPagination(response);
}

/* ---------- Event listeners and initial load ---------- */
quotesPreviousButton.addEventListener("click", () => {
  quotesCurrentPage--;
  loadQuotes();
});

quotesNextButton.addEventListener("click", () => {
  quotesCurrentPage++;
  loadQuotes();
});

loadQuotes();
