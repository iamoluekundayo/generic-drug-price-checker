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

const quotesEmpty = document.getElementById("quotes-empty");
const quotesContainer = document.getElementById("quotes-container");
const quotesError = document.getElementById("quotes-error");

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatNum(num, decimal) {
  const parsed = Number(num);
  if (num === null || num === "" || Number.isNaN(parsed)) {
    return "0.00";
  }
  return Math.abs(Number(num)).toLocaleString("en-US", {
    minimumFractionDigits: decimal,
    maximumFractionDigits: decimal,
  });
}

function createItem({ element = "div", classes = [], text = "" } = {}) {
  const item = document.createElement(element);
  if (classes.length !== 0) {
    item.classList.add(...classes);
  }

  if (text.trim().length !== 0) {
    item.textContent = text;
  }
  return item;
}

function createCard(quote) {
  const card = createItem({ element: "div", classes: ["card", "h-100"] });

  const cardWrapper = createItem({ element: "div", classes: ["col"] });
  card.append(cardWrapper);
  const cardBody = createItem({
    element: "div",
    classes: ["card-body", "col"],
  });
  cardWrapper.append(cardBody);
  const drugName = createItem({
    element: "p",
    classes: ["card-title", "fw-bold"],
    text: quote.ndc_description,
  });

  const quoteDate = createItem({
    element: "p",
    classes: ["small", "text-body-secondary"],
    text: `Quoted ${formatDate(quote.quote_date)} · ${Number(quote.quantity)} ${quote.pricing_unit}`,
  });

  const tileContainer = createItem({ element: "div", classes: ["row", "g-2"] });

  const quotedPriceContainer = createItem({
    element: "div",
    classes: ["col-6"],
  });
  tileContainer.append(quotedPriceContainer);

  const quotePriceBg = createItem({
    element: "div",
    classes: ["bg-body-tertiary", "rounded", "p-3"],
  });
  quotedPriceContainer.append(quotePriceBg);

  const quotePriceTitle = createItem({
    element: "p",
    classes: ["mb-0"],
    text: "Quoted price",
  });

  const quotedPrice = createItem({
    element: "p",
    classes: ["fs-3", "fw-bold", "mb-0"],
    text: `$${quote.quoted_price}`,
  });

  quotePriceBg.append(quotePriceTitle, quotedPrice);

  const nadacTotalContainer = createItem({
    element: "div",
    classes: ["col-6"],
  });
  tileContainer.append(nadacTotalContainer);

  const nadacTotalBg = createItem({
    element: "div",
    classes: ["bg-body-tertiary", "rounded", "p-3"],
  });
  nadacTotalContainer.append(nadacTotalBg);

  const nadacTotalTitle = createItem({
    element: "p",
    classes: ["mb-0"],
    text: "NADAC total",
  });
  const nadacTotal = createItem({
    element: "p",
    classes: ["fs-3", "fw-bold", "mb-0"],
    text: `$${quote.nadac_total}`,
  });
  nadacTotalBg.append(nadacTotalTitle, nadacTotal);

  let markupPercent;
  if (quote.markup_percent === null) {
    markupPercent = "not available";
  } else {
    markupPercent = `${formatNum(quote.markup_percent, 2)}%`;
  }

  const difference = createItem({
    element: "p",
    classes: ["fw-bold", "text-warning-emphasis"],
    text: `${Number(quote.difference) >= 0 ? "+" : "-"}$${formatNum(quote.difference, 2)} ${markupPercent} ${Number(quote.difference) >= 0 ? "above" : "below "} NADAC`,
  });

  const divider = createItem({ element: "hr", classes: [] });

  const cardButtons = createItem({
    element: "div",
    classes: ["d-flex", "gap-2"],
  });

  const editButton = createItem({
    element: "button",
    classes: ["btn", "btn-outline-secondary"],
    text: "Edit",
  });

  const deleteButton = createItem({
    element: "button",
    classes: ["btn", "btn-outline-danger"],
    text: "Delete",
  });

  cardButtons.append(editButton, deleteButton);
  cardBody.append(
    drugName,
    quoteDate,
    tileContainer,
    difference,
    divider,
    cardButtons,
  );
  return card;
}

function renderQuotes(quotes) {
  if (quotes.length == 0) {
    quotesEmpty.classList.remove("d-none");
  } else {
    quotesContainer.replaceChildren();
    for (const quote of quotes) {
      quotesContainer.append(createCard(quote));
    }
    quotesError.classList.add("d-none");
  }
}

async function loadQuotes() {
  if (!getToken()) {
    window.location.replace("/login.html?next=/quotes.html");
  } else {
    try {
      quotesError.textContent = "loading...";
      const quotes = await api("/quotes");
      renderQuotes(quotes);
    } catch (err) {
      if (err.status === 401) {
        window.location.replace("/login.html?next=/quotes.html");
        return;
      }
      quotesError.textContent = err.message;
      quotesError.classList.remove("d-none");
    }
  }
}
loadQuotes();
