"use strict";

// ========================================
// E-PHARMA LOGIN SYSTEM
// File: script.js
// ========================================

// GET HTML ELEMENTS
const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const message = document.getElementById("message");
const forgotPassword = document.getElementById("forgotPassword");

// ========================================
// SHOW / HIDE PASSWORD
// ========================================

togglePassword.addEventListener("click", function () {
    const isHidden = passwordInput.type === "password";

    passwordInput.type = isHidden ? "text" : "password";

    togglePassword.textContent = isHidden ? "Hide" : "Show";

    togglePassword.setAttribute(
        "aria-label",
        isHidden ? "Hide password" : "Show password"
    );
});

// ========================================
// DISPLAY MESSAGE
// ========================================

function showMessage(text, type) {
    message.textContent = text;
    message.className = "message " + type;
}

function clearMessage() {
    message.textContent = "";
    message.className = "message";
}

// ========================================
// LOGIN VALIDATION
// DEMO LOGIN ONLY
// ========================================

loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    // CHECK EMPTY FIELDS
    if (username === "" || password.trim() === "") {
        showMessage(
            "Please enter your username and password.",
            "error"
        );
        return;
    }

    // DEMO CREDENTIALS
    // Replace with backend authentication before production.
    const validUsername = "admin";
    const validPassword = "Admin123!";

    // CHECK USERNAME AND PASSWORD
    if (
        username === validUsername &&
        password === validPassword
    ) {
        showMessage("Login successful! Opening dashboard...", "success");

        // REDIRECT TO DASHBOARD
        window.location.href = "dashboard.html";

    } else {
        showMessage(
            "Invalid username or password. Please try again.",
            "error"
        );
    }
});

// ========================================
// FORGOT PASSWORD
// ========================================

forgotPassword.addEventListener("click", function (event) {
    event.preventDefault();

    showMessage(
        "Please contact your system administrator to reset your password.",
        "error"
    );
});

// ========================================
// CLEAR ERROR WHEN USER TYPES
// ========================================

usernameInput.addEventListener("input", clearMessage);
passwordInput.addEventListener("input", clearMessage);

// ========================================
// PREVENT FORM FROM RELOADING UNEXPECTEDLY
// Native HTML required validation is enabled.
// ========================================