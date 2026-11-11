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

function createItem({ element = "", classes = [""], text = "" } = {}) {
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
  const card = createItem({ element: "div", classes: ["card"] });

  const cardBody = createItem({ element: "div", classes: ["card-body"] });
  card.append(cardBody);
  const drugName = createItem({
    element: "p",
    classes: ["card-title", "fw-bold"],
    text: quote.ndc_description,
  });

  const quoteDate = createItem({
    element: "p",
    classes: ["small", "text-body-secondary"],
    text: `Quoted ${formatDate(quote.quote_date)} · ${quote.quantity} ${quote.pricing_unit}`,
  });

  const tileContainer = createItem({ element: "div", classes: ["row", "g-2"] });

  const quotedPriceContainer = createItem({
    element: "div",
    classes: ["col-6", "bg-body-tertiary", "rounded", "p-3"],
  });
  tileContainer.append(quotedPriceContainer);

  const quotePriceTitle = createItem({
    element: "p",
    classes: [],
    text: "Quoted price",
  });
  const quotedPrice = createItem({
    element: "p",
    classes: ["fs-3", "fw-bold"],
    text: `$${quote.quoted_price}`,
  });

  quotedPriceContainer.append(quotePriceTitle, quotedPrice);

  const nadacTotalContainer = createItem({
    element: "div",
    classes: ["col-6", "bg-body-tertiary", "rounded", "p-3"],
  });
  tileContainer.append(nadacTotalContainer);

  // createItem({ element: "", classes: [] });
  // createItem({ element: "", classes: [], text: "" });
  const nadacTotalTitle = createItem({
    element: "p",
    classes: [],
    text: "NADAC total",
  });
  const nadacTotal = createItem({
    element: "p",
    classes: ["fs-3", "fw-bold"],
    text: `$${quote.nadac_total}`,
  });
  nadacTotalContainer.append(nadacTotalTitle, nadacTotal);

  cardBody.append(drugName, quoteDate, tileContainer);
  quotesContainer.append(card);
}

function renderQuotes(quotes) {
  if (quotes.length == 0) {
    quotesEmpty.classList.remove("d-none");
  } else {
    quotesContainer.replaceChildren();
    quotesError.textContent = "loading...";
    for (const quote of quotes) {
      createCard(quote);
    }
    quotesError.classList.add("d-none");
  }
}

async function loadQuotes() {
  if (!getToken()) {
    window.location.replace("/login.html?next=/quotes.html");
  } else {
    try {
      const quotes = await api("/quotes");
      renderQuotes(quotes);
    } catch (err) {
      if (err.status === 401) {
        window.location.replace("/login.html?next=/quotes.html");
      }
      quotesError.textContent = err.message;
    }
  }
}
loadQuotes();
