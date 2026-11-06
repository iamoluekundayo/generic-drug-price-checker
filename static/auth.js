"use strict";

//ready: , sending: , error: , success:

// login
const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");
const loginSubmit = document.getElementById("login-submit");

let token;

async function login() {
  return await api("auth/login", {
    method: "POST",
    body: new URLSearchParams({
      username: registerEmail.value,
      password: registerPassword.value,
    }),
  });
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginSubmit.disabled = true;
  loginSubmit.textContent = "Logging in ...";

  try {
    token = login();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove("d-none");
    return;
  } finally {
    loginSubmit.disabled = false;
    loginSubmit.textContent = "Log in";
  }

  saveToken(token);

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
  registerSubmit.disabled = true;
  registerSubmit.textContent = "Registering ...";

  try {
    token = await api("auth/login", {
      method: "POST",
      body: {
        first_name: registerFirstName.value,
        last_name: registerLastName.value,
        email: registerEmail.value,
        password: registerPassword.value,
      },
    });
  } catch (err) {
    registerError.textContent = err.message;
    return;
  }

  let token;
  try {
    token = login();
  } catch (err) {
    registerError.textContent = err.message;
  } finally {
    registerSubmit.disabled = false;
    registerSubmit.textContent = "Register";
  }

  saveToken(token);
  window.location.href = "/";
});
