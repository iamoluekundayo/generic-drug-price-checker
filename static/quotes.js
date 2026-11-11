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
const quotesList = document.getElementById("quotes-list");
const quotesError = document.getElementById("quotes-error");

function renderQuotes(quotes) {
  if (quotes.length == 0) {
    quotesEmpty.classList.remove("d-none");
  } else {
    for (const quote of quotes) {
      const item = document.createElement("li");
      item.textContent = quote.ndc_description;

      quotesList.append(item);
    }
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
