// Token helpers, three functions to save, read, and clear the token

function saveToken(token) {
  localStorage.setItem("token", token);
}
function getToken() {
  return localStorage.getItem("token");
}
function clearToken() {
  localStorage.removeItem("token");
}

async function api(path, options = {}) {
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
    } catch (err) {} // not JSON; errorMessage falls back

    const error = new Error(errorMessage(errorData));
    error.status = statusCode;
    throw error;
  }
  const data = await response.json();
  return data;
}

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
