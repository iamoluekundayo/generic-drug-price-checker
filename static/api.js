"use strict";
// Token helpers, three functions to save, read, and clear the token

/**
 * Save the login token
 * @param {string} token - The JWT returned by the login endpoint.
 */
function saveToken(token) {
  localStorage.setItem("token", token);
}

/**
 * Get the saved login token.
 * @returns {string | null} The token, or null if the user isn't logged in.
 */
function getToken() {
  return localStorage.getItem("token");
}

/**
 * Remove the saved login token (log out).
 */
function clearToken() {
  localStorage.removeItem("token");
}

/**
 * Send a request to the backend and return the parsed JSON response.
 *
 * Adds the login token if there is one, and JSON-encodes the body unless
 * it's URLSearchParams (form data)
 *
 * @param {string} path - The API path, e.g. "/api/search?q=ibuprofen".
 * @param {RequestInit & {body?: object | URLSearchParams}} [options={}] -
 *  Fetch options. `body` can be a plain object (sent as JSON) or
 * URLSearchParams (sent as a form)
 * @returns {Promise<any | null>} The response data, or null for 204 No content.
 * @throws {Error} If the server can't be reached, or responds with an error.
 *
 */
async function api(path, options = {}) {
  // Copy the headers so the caller's options object isn't changed.
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) {
    headers.Authorization = "Bearer " + token;
  }
  let body = options.body;
  if (options.body && !(body instanceof URLSearchParams)) {
    body = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }

  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: headers,
      body: body,
    });
  } catch (err) {
    throw new Error("Couldn't reach the server");
  }

  const statusCode = response.status;

  if (statusCode === 204) {
    return null;
  }

  if (!response.ok) {
    if (statusCode === 401) {
      clearToken();
    }
    let errorData = {};
    try {
      errorData = await response.json();
    } catch {
      // not JSON; errorMessage falls back
    }

    const error = new Error(errorMessage(errorData));
    error.status = statusCode;
    throw error;
  }
  const data = await response.json();
  return data;
}

/**
 * Turn an error response body into a message the user can read.
 *
 * Handles FastAPI's formats: `detail` is a string for HTTPException,
 * a list of `{msg, ...}` objects for validation errors.
 *
 * @param {object} data - The parsed JSON error body (may be empty).
 * @returns {string} A readable error message
 */
function errorMessage(data) {
  if (typeof data.detail === "string") {
    return data.detail;
  }
  if (Array.isArray(data.detail)) {
    return data.detail.map((item) => item.msg).join(", ");
  }
  if (typeof data.error === "string") {
    return data.error;
  }
  return "Something went wrong";
}

async function updateNav() {
  const navLogin = document.getElementById("nav-login");
  const navLogout = document.getElementById("nav-logout");
  const greeting = document.getElementById("greeting");
  const quotes = document.getElementById("search-quotes");

  const token = getToken();
  if (token) {
    try {
      const userInfo = await api("/users/me");
      navLogout.addEventListener("click", () => {
        clearToken();
        window.location.href = "/";
      });
      navLogout.classList.remove("d-none");
      navLogin.classList.add("d-none");
      if (greeting) {
        const firstName = userInfo.first_name;
        greeting.textContent =
          "Hi, " + firstName.charAt(0).toUpperCase() + firstName.slice(1);
      }
      if (quotes) {
        quotes.classList.remove("d-none");
      }
    } catch (err) {}
  }
}
updateNav();
