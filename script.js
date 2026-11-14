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
            ? "Login as Cashier"
            : "Login as Admin";
    }
    if (demoRoleHint) {
        demoRoleHint.textContent = selectedRole === "cashier"
            ? "Sign in with your cashier account."
            : "Sign in with your administrator account.";
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

function completeLogin(user) {
    selectRole(user.role);

    if (window.EPharmaBranding && typeof window.EPharmaBranding.setActiveSession === "function") {
        window.EPharmaBranding.setActiveSession({
            user_id: user.user_id,
            username: user.username,
            fullName: user.fullName || user.full_name || user.username,
            email: user.email || "",
            role: user.role
        });
    } else {
        try {
            const payload = JSON.stringify({
                user_id: user.user_id,
                username: user.username,
                fullName: user.fullName || user.username,
                email: user.email || "",
                role: user.role
            });
            sessionStorage.setItem("epharmaSession", payload);
            localStorage.setItem("epharmaSession", payload);
        } catch {
            // Ignore storage errors.
        }
    }

    try {
        const rawLogs = localStorage.getItem("epharmaDemoLogs");
        const logs = rawLogs ? JSON.parse(rawLogs) : [];
        if (Array.isArray(logs)) {
            const nextId = logs.reduce((m, item) => Math.max(m, Number(item.log_id || 0)), 0) + 1;
            logs.unshift({
                log_id: nextId,
                username: user.username,
                actor_name: user.fullName || user.full_name || user.username,
                role: user.role === "cashier" ? "cashier" : "admin",
                module: "Auth",
                action: "Logged In",
                details: `${user.role === "cashier" ? "Cashier" : "Admin"} session started`,
                created_at: new Date().toISOString()
            });
            localStorage.setItem("epharmaDemoLogs", JSON.stringify(logs.slice(0, 200)));
        }
    } catch {
        // Ignore storage errors.
    }

    showMessage(
        user.role === "cashier"
            ? "Login successful! Opening Cashier Workspace..."
            : "Login successful! Opening Admin Dashboard...",
        "success"
    );

    window.location.href = "dashboard.html";
}

// ========================================
// LOGIN VALIDATION (MYSQL + PREVIEW FALLBACK)
// ========================================

loginForm.addEventListener("submit", async function (event) {
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

    const submitBtn = document.getElementById("loginSubmitBtn");
    if (submitBtn) submitBtn.disabled = true;

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const payload = await response.json().catch(() => ({}));

        if (response.status === 503 || payload.dbUnavailable) {
            showMessage(payload.message || "Database unavailable. Contact your administrator.", "error");
            return;
        }

        if (!response.ok) {
            showMessage(
                payload.message || "Invalid username or password.",
                "error"
            );
            return;
        }

        if (payload && payload.user) {
            completeLogin(payload.user);
            return;
        }
    } catch (error) {
        showMessage("Unable to sign in. Check that the server and MySQL database are running.", "error");
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
});

// ========================================
// FORGOT PASSWORD
// ========================================

forgotPassword.addEventListener("click", function (event) {
    event.preventDefault();

    showMessage(
        "Contact your administrator to reset your password.",
        "error"
    );
});

// ========================================
// CLEAR ERROR WHEN USER TYPES
// ========================================

usernameInput.addEventListener("input", clearMessage);
passwordInput.addEventListener("input", clearMessage);
