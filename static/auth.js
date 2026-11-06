//ready: , sending: , error: , success:

"use strict";

async function login(email, password) {
  return await api("/auth/login", {
    method: "POST",
    body: new URLSearchParams({
      username: email,
      password: password,
    }),
  });
}

// login
const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");
const loginSubmit = document.getElementById("login-submit");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.classList.add("d-none");
  loginSubmit.disabled = true;
  loginSubmit.textContent = "Logging in ...";

  let token;
  try {
    token = await login(loginEmail.value, loginPassword.value);
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove("d-none");
    return;
  } finally {
    loginSubmit.disabled = false;
    loginSubmit.textContent = "Log in";
  }

  saveToken(token.access_token);

  window.location.href = "/";
});

// register
const registerForm = document.getElementById("register-form");
const registerFirstName = document.getElementById("register-first-name");
const registerLastName = document.getElementById("register-last-name");
const registerEmail = document.getElementById("register-email");
const registerPassword = document.getElementById("register-password");
const registerError = document.getElementById("register-error");
const registerSubmit = document.getElementById("register-submit");

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  registerError.classList.add("d-none");
  registerError.classList.add("alert-danger");
  registerError.classList.remove("alert-info");
  registerSubmit.disabled = true;
  registerSubmit.textContent = "Registering ...";

  let userResult;
  try {
    userResult = await api("/auth/register", {
      method: "POST",
      body: {
        first_name: registerFirstName.value,
        last_name: registerLastName.value,
        email: registerEmail.value,
        password: registerPassword.value,
      },
    });
  } catch (err) {
    registerError.classList.remove("d-none");
    registerError.textContent = err.message;
    registerSubmit.disabled = false;
    registerSubmit.textContent = "Register";
    return;
  }

  let token;
  try {
    token = await login(userResult.email, registerPassword.value);
  } catch (err) {
    registerError.classList.remove("d-none");
    registerError.classList.remove("alert-danger");
    registerError.classList.add("alert-info");
    registerError.textContent =
      "Your account was created, but we couldn't log you in automatically. Please log in above";
    return;
  } finally {
    registerSubmit.disabled = false;
    registerSubmit.textContent = "Register";
  }

  saveToken(token.access_token);
  window.location.href = "/";
});
