"use strict";

// ========================================
// E-PHARMA LOGIN SYSTEM (ADMIN & CASHIER)
// File: script.js
// ========================================

const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const message = document.getElementById("message");
const forgotPassword = document.getElementById("forgotPassword");

const roleTabAdmin = document.getElementById("roleTabAdmin");
const roleTabCashier = document.getElementById("roleTabCashier");
const loginBtnLabel = document.getElementById("loginBtnLabel");
const demoRoleHint = document.getElementById("demoRoleHint");
const fillAdminDemo = document.getElementById("fillAdminDemo");
const fillCashierDemo = document.getElementById("fillCashierDemo");

const ACCOUNTS = {
    admin: {
        username: "admin",
        password: "Admin123!",
        role: "admin",
        label: "Admin"
    },
    cashier: {
        username: "cashier",
        password: "Cashier123!",
        role: "cashier",
        label: "Cashier"
    }
};

let selectedRole = "admin";

function selectRole(role) {
    selectedRole = role === "cashier" ? "cashier" : "admin";

    if (roleTabAdmin) {
        const isAdmin = selectedRole === "admin";
        roleTabAdmin.classList.toggle("active", isAdmin);
        roleTabAdmin.setAttribute("aria-selected", String(isAdmin));
    }
    if (roleTabCashier) {
        const isCashier = selectedRole === "cashier";
        roleTabCashier.classList.toggle("active", isCashier);
        roleTabCashier.setAttribute("aria-selected", String(isCashier));
    }

    if (usernameInput) {
        usernameInput.placeholder = selectedRole === "cashier"
            ? "Enter cashier username"
            : "Enter admin username";
    }
    if (loginBtnLabel) {
        loginBtnLabel.textContent = selectedRole === "cashier"
            ? "Login to Cashier POS"
            : "Login as Admin";
    }
    if (demoRoleHint) {
        demoRoleHint.textContent = selectedRole === "cashier"
            ? "Cashier: cashier / Cashier123!"
            : "Admin: admin / Admin123!";
    }
}

if (roleTabAdmin) {
    roleTabAdmin.addEventListener("click", function () {
        selectRole("admin");
        clearMessage();
    });
}

if (roleTabCashier) {
    roleTabCashier.addEventListener("click", function () {
        selectRole("cashier");
        clearMessage();
    });
}

if (fillAdminDemo) {
    fillAdminDemo.addEventListener("click", function () {
        selectRole("admin");
        usernameInput.value = ACCOUNTS.admin.username;
        passwordInput.value = ACCOUNTS.admin.password;
        clearMessage();
        usernameInput.focus();
    });
}

if (fillCashierDemo) {
    fillCashierDemo.addEventListener("click", function () {
        selectRole("cashier");
        usernameInput.value = ACCOUNTS.cashier.username;
        passwordInput.value = ACCOUNTS.cashier.password;
        clearMessage();
        usernameInput.focus();
    });
}

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
// LOGIN VALIDATION (ADMIN & CASHIER)
// ========================================

loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (username === "" || password.trim() === "") {
        showMessage(
            "Please enter your username and password.",
            "error"
        );
        return;
    }

    const matchedAccount = Object.values(ACCOUNTS).find(
        account => account.username === username && account.password === password
    );

    if (matchedAccount) {
        selectRole(matchedAccount.role);

        if (window.EPharmaBranding && typeof window.EPharmaBranding.setActiveSession === "function") {
            window.EPharmaBranding.setActiveSession({
                role: matchedAccount.role,
                username: matchedAccount.username
            });
        } else {
            try {
                const sessionPayload = JSON.stringify({
                    role: matchedAccount.role,
                    username: matchedAccount.username
                });
                sessionStorage.setItem("epharmaSession", sessionPayload);
                localStorage.setItem("epharmaSession", sessionPayload);
            } catch {
                // Ignore storage errors.
            }
        }

        showMessage(
            matchedAccount.role === "cashier"
                ? "Login successful! Opening Cashier POS..."
                : "Login successful! Opening Admin Dashboard...",
            "success"
        );

        window.location.href = matchedAccount.role === "cashier"
            ? "dashboard.html#sales"
            : "dashboard.html";
    } else {
        showMessage(
            "Invalid username or password. Use Admin (admin / Admin123!) or Cashier (cashier / Cashier123!).",
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
        "Demo accounts: Admin (admin / Admin123!) or Cashier (cashier / Cashier123!).",
        "error"
    );
});

// ========================================
// CLEAR ERROR WHEN USER TYPES
// ========================================

usernameInput.addEventListener("input", clearMessage);
passwordInput.addEventListener("input", clearMessage);
