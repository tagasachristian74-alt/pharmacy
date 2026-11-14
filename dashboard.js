
"use strict";

/* =========================================
   E-PHARMA DASHBOARD.JS
   Fixed Sidebar + Dynamic Navigation
   Inventory Demo Functions
========================================= */

// =========================================
// 1. GET MAIN HTML ELEMENTS
// =========================================

const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menuToggle");
const logoutButton = document.getElementById("logoutButton");
const notificationButton = document.getElementById("notificationButton");
const globalSearch = document.getElementById("globalSearch");
const pageContent = document.getElementById("pageContent");

if (!pageContent) {
    console.error("ERROR: Hindi makita ang #pageContent sa dashboard.html.");
}

// I-save ang original dashboard bago magpalit ng page.
const dashboardHomeContent = pageContent
    ? pageContent.innerHTML
    : "";

const navLinks = document.querySelectorAll(".nav-link");

let isDemoDatabaseMode = false;
let pendingSaleMedicineId = null;

const DEMO_LOGS_KEY = "epharmaDemoLogs";

const ROLE_ALLOWED_PAGES = {
    admin: [
        "dashboard",
        "inventory",
        "sales",
        "purchase",
        "suppliers",
        "expiration",
        "cashiers",
        "logs",
        "settings",
        "account"
    ],
    cashier: [
        "dashboard",
        "inventory",
        "sales",
        "expiration",
        "account"
    ]
};

function getCurrentSession() {
    if (window.EPharmaBranding && typeof window.EPharmaBranding.getActiveSession === "function") {
        return window.EPharmaBranding.getActiveSession();
    }
    try {
        const raw = sessionStorage.getItem("epharmaSession") || localStorage.getItem("epharmaSession");
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && (parsed.role === "cashier" || parsed.role === "admin")) {
                return parsed;
            }
        }
    } catch {
        // Ignore storage errors.
    }
    return { user_id: 1, role: "admin", username: "admin", fullName: "Administrator", email: "admin@example.com" };
}

function getCurrentRole() {
    return getCurrentSession().role === "cashier" ? "cashier" : "admin";
}

function isCashierRole() {
    return getCurrentRole() === "cashier";
}

function getCurrentUsername() {
    return String(getCurrentSession().username || (isCashierRole() ? "cashier" : "admin"));
}

function getCurrentDisplayName() {
    const session = getCurrentSession();
    if (session.fullName) return session.fullName;
    const branding = window.EPharmaBranding;
    const settings = branding ? branding.getCachedSettings() : {};
    if (isCashierRole()) {
        return settings.cashierName || "Cashier";
    }
    return settings.adminName || "Administrator";
}

function canAccessPage(pageName) {
    const allowed = ROLE_ALLOWED_PAGES[getCurrentRole()] || ROLE_ALLOWED_PAGES.admin;
    return allowed.includes(pageName);
}

function applyRoleAccessControl() {
    const role = getCurrentRole();
    const menuLabel = document.getElementById("sidebarMenuLabel");
    if (menuLabel) {
        menuLabel.textContent = role === "cashier" ? "CASHIER WORKSPACE" : "ADMIN MENU";
    }

    const navSalesLabel = document.getElementById("navSalesLabel");
    if (navSalesLabel) {
        navSalesLabel.textContent = role === "cashier" ? "POS & My Sales" : "Sales Reports";
    }

    navLinks.forEach(function (link) {
        const rolesAttr = (link.dataset.roles || "admin").split(",").map(s => s.trim());
        const allowed = rolesAttr.includes(role);
        link.hidden = !allowed;
        if (!allowed) {
            link.setAttribute("aria-hidden", "true");
            link.tabIndex = -1;
        } else {
            link.removeAttribute("aria-hidden");
            link.removeAttribute("tabindex");
        }
    });

    if (window.EPharmaBranding && typeof window.EPharmaBranding.applyBranding === "function") {
        window.EPharmaBranding.applyBranding();
    }
}

function normalizeDiscountPercent(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return 0;
    if (numeric > 100) return 100;
    return Math.round(numeric * 100) / 100;
}

function calculateDiscountedPrice(unitPrice, discountPercent) {
    const base = Number(unitPrice);
    if (!Number.isFinite(base) || base <= 0) return 0;
    const discount = normalizeDiscountPercent(discountPercent);
    return Math.max(0, Math.round(base * (1 - discount / 100) * 100) / 100);
}

function isServerDbUnavailable(response, payload) {
    if ((response && response.status === 503) || Boolean(payload && payload.dbUnavailable)) {
        throw new Error("Database unavailable. No changes were saved; reconnect MySQL and try again.");
    }
    return false;
}

let activityLogs = (function loadInitialLogs() {
    try {
        const raw = localStorage.getItem(DEMO_LOGS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch {
        // Ignore storage errors.
    }
    const now = Date.now();
    return [
        {
            log_id: 4,
            username: "cashier",
            actor_name: "Cashier 1 (Alex Reyes)",
            role: "cashier",
            module: "Sales",
            action: "Completed Sale",
            details: "Receipt EP-0006: Vitamin C 500mg x5 (₱16.00)",
            created_at: new Date(now - 3600000).toISOString()
        },
        {
            log_id: 3,
            username: "cashier2",
            actor_name: "Cashier 2 (Maria Santos)",
            role: "cashier",
            module: "Sales",
            action: "Completed Sale",
            details: "Receipt EP-0005: Amoxicillin 500mg x4 (₱32.00)",
            created_at: new Date(now - 7200000).toISOString()
        },
        {
            log_id: 2,
            username: "admin",
            actor_name: "Administrator",
            role: "admin",
            module: "Inventory",
            action: "Updated Medicine",
            details: "Set 20% discount on Vitamin C 500mg",
            created_at: new Date(now - 86400000).toISOString()
        },
        {
            log_id: 1,
            username: "admin",
            actor_name: "Administrator",
            role: "admin",
            module: "Auth",
            action: "Logged In",
            details: "Admin session started",
            created_at: new Date(now - 2 * 86400000).toISOString()
        }
    ];
})();

function saveDemoLogs() {
    try {
        localStorage.setItem(DEMO_LOGS_KEY, JSON.stringify(activityLogs.slice(0, 200)));
    } catch {
        // Ignore storage errors.
    }
}

function recordLocalActivity(module, action, details) {
    const nextId = activityLogs.reduce((m, item) => Math.max(m, Number(item.log_id || 0)), 0) + 1;
    activityLogs.unshift({
        log_id: nextId,
        username: getCurrentUsername(),
        actor_name: getCurrentDisplayName(),
        role: getCurrentRole(),
        module,
        action,
        details: details || "",
        created_at: new Date().toISOString()
    });
    saveDemoLogs();
    if (document.getElementById("activityLogsBody")) {
        renderActivityLogs();
    }
}


// =========================================
// 2. DASHBOARD DATE
// =========================================

function updateDate() {
    const dateElement = document.getElementById("currentDate");

    if (!dateElement) return;

    dateElement.textContent = new Date().toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}


// =========================================
// 3. MOBILE SIDEBAR
// =========================================

if (menuToggle && sidebar) {
    menuToggle.addEventListener("click", function () {
        const isOpen = sidebar.classList.toggle("open");

        menuToggle.setAttribute("aria-expanded", String(isOpen));
    });
}

document.addEventListener("click", function (event) {
    if (!sidebar || !menuToggle) return;

    if (
        window.innerWidth <= 700 &&
        sidebar.classList.contains("open") &&
        !sidebar.contains(event.target) &&
        !menuToggle.contains(event.target)
    ) {
        sidebar.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
    }
});


// =========================================
// 4. LIVE SALES OVERVIEW CHART (CONNECTED TO ALL DATA)
// =========================================

function formatCompactPeso(amount) {
    const val = Number(amount || 0);
    if (val >= 1000000) return "₱" + (val / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (val >= 1000) return "₱" + (val / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return "₱" + Math.round(val);
}

function getNiceChartCeiling(maxValue) {
    if (!Number.isFinite(maxValue) || maxValue <= 0) return 1000;
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue)));
    const normalized = maxValue / magnitude;
    let step = 10;
    if (normalized <= 1) step = 1;
    else if (normalized <= 2) step = 2;
    else if (normalized <= 4) step = 4;
    else if (normalized <= 5) step = 5;
    else if (normalized <= 8) step = 8;
    const ceiling = Math.ceil(step * magnitude / 4) * 4;
    return Math.max(40, ceiling);
}

function buildSalesOverviewData(period) {
    const now = new Date();
    const records = typeof salesRecords !== "undefined" ? salesRecords.filter(s => s.status !== "VOIDED") : [];
    const buckets = [];

    if (period === "today") {
        const ranges = [
            { label: "00–04", start: 0, end: 3 },
            { label: "04–08", start: 4, end: 7 },
            { label: "08–12", start: 8, end: 11 },
            { label: "12–16", start: 12, end: 15 },
            { label: "16–20", start: 16, end: 19 },
            { label: "20–24", start: 20, end: 23 }
        ];
        ranges.forEach(r => buckets.push({ label: r.label, total: 0, count: 0, start: r.start, end: r.end }));

        records.forEach(sale => {
            const d = new Date(sale.timestamp);
            if (
                d.getFullYear() === now.getFullYear() &&
                d.getMonth() === now.getMonth() &&
                d.getDate() === now.getDate()
            ) {
                const hr = d.getHours();
                const bucket = buckets.find(b => hr >= b.start && hr <= b.end);
                if (bucket) {
                    bucket.total += Number(sale.total || 0);
                    bucket.count += 1;
                }
            }
        });
    } else if (period === "week") {
        for (let offset = 6; offset >= 0; offset--) {
            const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
            const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
            const label = day.toLocaleDateString("en-PH", { weekday: "short" });
            buckets.push({ key, label, total: 0, count: 0 });
        }

        records.forEach(sale => {
            const d = new Date(sale.timestamp);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const bucket = buckets.find(b => b.key === key);
            if (bucket) {
                bucket.total += Number(sale.total || 0);
                bucket.count += 1;
            }
        });
    } else if (period === "year") {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        monthNames.forEach((m, idx) => buckets.push({ month: idx, label: m, total: 0, count: 0 }));

        records.forEach(sale => {
            const d = new Date(sale.timestamp);
            if (d.getFullYear() === now.getFullYear()) {
                const bucket = buckets[d.getMonth()];
                if (bucket) {
                    bucket.total += Number(sale.total || 0);
                    bucket.count += 1;
                }
            }
        });
    } else {
        // Default: "month" (6 day-ranges across current month)
        const monthDefs = [
            { label: "1–5", min: 1, max: 5 },
            { label: "6–10", min: 6, max: 10 },
            { label: "11–15", min: 11, max: 15 },
            { label: "16–20", min: 16, max: 20 },
            { label: "21–25", min: 21, max: 25 },
            { label: "26–End", min: 26, max: 31 }
        ];
        monthDefs.forEach(def => buckets.push({ ...def, total: 0, count: 0 }));

        records.forEach(sale => {
            const d = new Date(sale.timestamp);
            if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
                const dayNum = d.getDate();
                const bucket = buckets.find(b => dayNum >= b.min && dayNum <= b.max);
                if (bucket) {
                    bucket.total += Number(sale.total || 0);
                    bucket.count += 1;
                }
            }
        });
    }

    const totalRevenue = buckets.reduce((sum, b) => sum + b.total, 0);
    const totalCount = buckets.reduce((sum, b) => sum + b.count, 0);
    const maxBucket = Math.max(0, ...buckets.map(b => b.total));
    const ceiling = getNiceChartCeiling(maxBucket);

    return {
        buckets,
        totalRevenue,
        totalCount,
        avgSale: totalCount > 0 ? totalRevenue / totalCount : 0,
        ceiling
    };
}

function renderSalesOverviewChart() {
    const periodEl = document.getElementById("salesPeriod");
    const gridEl = document.getElementById("chartGridLabels");
    const barAreaEl = document.getElementById("chartBarArea");
    const chartTotalEl = document.getElementById("chartTotal");
    const chartMetaEl = document.getElementById("chartMetaSummary");

    if (!barAreaEl || !gridEl) return;

    const period = periodEl ? periodEl.value : "month";
    const data = buildSalesOverviewData(period);

    if (chartTotalEl) {
        chartTotalEl.textContent = "₱" + data.totalRevenue.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
    if (chartMetaEl) {
        chartMetaEl.textContent = `${data.totalCount} transaction${data.totalCount === 1 ? "" : "s"} · Avg ₱${data.avgSale.toFixed(2)}`;
    }

    const ticks = [
        data.ceiling,
        data.ceiling * 0.75,
        data.ceiling * 0.5,
        data.ceiling * 0.25,
        0
    ];
    gridEl.innerHTML = ticks
        .map(val => `<span>${formatCompactPeso(val)}</span>`)
        .join("");

    barAreaEl.innerHTML = data.buckets.map(bucket => {
        const pct = data.ceiling > 0 && bucket.total > 0
            ? Math.max(8, Math.min(100, Math.round((bucket.total / data.ceiling) * 100)))
            : 3;
        const emptyClass = bucket.total <= 0 ? " is-empty" : "";
        const valText = bucket.total > 0 ? formatCompactPeso(bucket.total) : "";
        const tooltip = `${bucket.label}: ₱${bucket.total.toFixed(2)} (${bucket.count} sale${bucket.count === 1 ? "" : "s"})`;

        return `
            <div class="bar-column" title="${escapeSupplierText(tooltip)}">
                ${valText ? `<span class="bar-value">${valText}</span>` : ""}
                <div class="bar${emptyClass}" style="height:${pct}%"></div>
                <small>${escapeSupplierText(bucket.label)}</small>
            </div>
        `;
    }).join("");
}

function applyDashboardRoleView() {
    const cashierMode = isCashierRole();
    const subtitleEl = document.getElementById("dashboardSubtitle");
    const medCardTitle = document.getElementById("medCardTitle");
    const medCardNote = document.getElementById("medCardNote");
    const salesCardTitle = document.getElementById("salesCardTitle");
    const salesCardIcon = document.getElementById("salesCardIcon");
    const salesCardNote = document.getElementById("salesCardNote");
    const salesOverviewPanel = document.getElementById("salesOverviewPanel");
    const cashierShiftPanel = document.getElementById("cashierShiftPanel");
    const manageReordersLink = document.getElementById("manageReordersLink");
    const recentSalesHeading = document.getElementById("recentSalesHeading");
    const recentSalesSubheading = document.getElementById("recentSalesSubheading");
    const recentSalesViewAll = document.getElementById("recentSalesViewAll");

    if (subtitleEl) {
        subtitleEl.textContent = cashierMode
            ? `Welcome, ${getCurrentDisplayName()}! View operational stock alerts and your shift transactions.`
            : "Welcome back! Monitor live sales analytics, inventory health, and pharmacy operations.";
    }
    if (medCardTitle) medCardTitle.textContent = cashierMode ? "In-Stock Medicines" : "Total Medicines";
    if (medCardNote) medCardNote.textContent = cashierMode ? "Ready to dispense at POS" : "Medicines in inventory";
    if (salesCardTitle) salesCardTitle.textContent = cashierMode ? "My Transactions Today" : "Total Sales";
    if (salesCardIcon) salesCardIcon.textContent = cashierMode ? "▣" : "₱";
    if (salesCardNote) salesCardNote.textContent = cashierMode ? "Receipts completed by you today" : "Cumulative sales revenue";
    if (salesOverviewPanel) salesOverviewPanel.hidden = cashierMode;
    if (cashierShiftPanel) cashierShiftPanel.hidden = !cashierMode;
    if (manageReordersLink) manageReordersLink.hidden = cashierMode;
    if (recentSalesHeading) recentSalesHeading.textContent = cashierMode ? "My Recent Transactions" : "Recent Sales";
    if (recentSalesSubheading) {
        recentSalesSubheading.textContent = cashierMode
            ? "Receipts processed under your cashier account"
            : "Latest pharmacy transactions across all cashiers";
    }
    if (recentSalesViewAll) {
        recentSalesViewAll.textContent = cashierMode ? "My History →" : "View All →";
    }
}

function initializeDashboard() {
    updateDate();
    applyDashboardRoleView();

    const salesPeriod = document.getElementById("salesPeriod");
    if (salesPeriod && salesPeriod.dataset.initialized !== "true") {
        salesPeriod.dataset.initialized = "true";
        salesPeriod.addEventListener("change", renderSalesOverviewChart);
    }

    renderSalesOverviewChart();
}


// =========================================
// 5. SEARCH DASHBOARD TABLES
// =========================================

function searchDashboardTables(query) {
    const tableIds = ["lowStockTable", "recentSalesTable"];

    tableIds.forEach(function (tableId) {
        const table = document.getElementById(tableId);

        if (!table) return;

        table.querySelectorAll("tbody tr").forEach(function (row) {
            row.hidden = !row.textContent.toLowerCase().includes(query);
        });
    });
}

if (globalSearch) {
    globalSearch.addEventListener("input", function () {
        const query = globalSearch.value.trim().toLowerCase();

        searchDashboardTables(query);

        const inventorySearch = document.getElementById("invSearch");
        if (inventorySearch) {
            inventorySearch.value = globalSearch.value;
            renderInventory();
        }

        const salesSearch = document.getElementById("salesSearch");
        if (salesSearch) {
            salesSearch.value = globalSearch.value;
            renderSalesRecords();
        }

        const supplierSearch = document.getElementById("supplierSearch");
        if (supplierSearch) {
            supplierSearch.value = globalSearch.value;
            renderSuppliers();
        }

        const expirationSearch = document.getElementById("expirationSearch");
        if (expirationSearch) {
            expirationSearch.value = globalSearch.value;
            renderExpirationMedicines();
        }

        const cashierSearch = document.getElementById("cashierSearch");
        if (cashierSearch) {
            cashierSearch.value = globalSearch.value;
            renderCashiers();
        }

        const logsSearch = document.getElementById("logsSearch");
        if (logsSearch) {
            logsSearch.value = globalSearch.value;
            renderActivityLogs();
        }
    });
}


// =========================================
// 7. LOGOUT / SWITCH ACCOUNT
// =========================================

if (logoutButton) {
    logoutButton.addEventListener("click", async function () {
        const roleLabel = isCashierRole() ? "Cashier" : "Admin";
        const confirmed = confirm(
            `Log out from ${roleLabel} session and return to login?`
        );

        if (confirmed) {
            await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
            recordLocalActivity("Auth", "Logged Out", `${getCurrentDisplayName()} (${getCurrentUsername()}) signed out`);
            if (window.EPharmaBranding && typeof window.EPharmaBranding.clearActiveSession === "function") {
                window.EPharmaBranding.clearActiveSession();
            }
            window.location.href = "index.html";
        }
    });
}


// =========================================
// 8. PAGE TEMPLATES
// IMPORTANT: HTML MUST USE BACKTICKS
// =========================================

const pageTemplates = {

    inventory: `
        <section class="page-heading">
            <div>
                <p class="breadcrumb">Main Menu / Inventory</p>
                <h1>Medicine Inventory</h1>
                <p class="subtitle">
                    Manage medicine stock, pricing, discounts, and reorder thresholds.
                </p>
            </div>
        </section>

        <div class="role-notice-banner" id="cashierInventoryNotice" hidden>
            <span>Cashier View: You can search stock levels, check discounts, and click <strong>Sell</strong> to open a medicine in POS.</span>
        </div>

        <section class="inventory-summary">

            <article class="inventory-summary-card">
                <p>Total Medicine Products</p>
                <h3 id="invTotal">0</h3>
            </article>

            <article class="inventory-summary-card">
                <p>Low Stock Products</p>
                <h3 id="invLowStock">0</h3>
            </article>

            <article class="inventory-summary-card">
                <p>Total Units in Stock</p>
                <h3 id="invTotalUnits">0</h3>
            </article>

            <article class="inventory-summary-card">
                <p>Discounted Items</p>
                <h3 id="invDiscounted">0</h3>
            </article>

        </section>

        <section class="panel">

            <div class="inventory-toolbar">

                <input
                    type="search"
                    class="inventory-search"
                    id="invSearch"
                    placeholder="Search medicine or category..."
                    aria-label="Search inventory">

                <div class="inventory-actions">

                    <select class="inventory-filter" id="invFilter">
                        <option value="all">All Stock Status</option>
                        <option value="low">Low Stock</option>
                        <option value="in">In Stock</option>
                        <option value="out">Out of Stock</option>
                        <option value="discounted">With Discount</option>
                    </select>

                    <button type="button"
                            class="inventory-button"
                            id="addMedicineBtn">
                        + Add Medicine
                    </button>

                </div>

            </div>

            <div class="table-wrapper">
                <table class="inventory-table" id="inventoryTable">
                    <thead>
                        <tr>
                            <th>Medicine Name</th>
                            <th>Category</th>
                            <th>Unit Price</th>
                            <th>Discount</th>
                            <th>Final Price</th>
                            <th>Quantity</th>
                            <th>Reorder Level</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>

                    <tbody id="inventoryBody"></tbody>
                </table>
            </div>

            <p class="inventory-message"
               id="inventoryMessage"
               role="status"></p>

        </section>

        <section class="panel"
                 id="medicineFormPanel"
                 hidden>

            <div class="panel-heading">
                <div>
                    <h3 id="medicineFormTitle">Add New Medicine</h3>
                    <p>Enter medicine pricing, stock level, and optional discount.</p>
                </div>
            </div>

            <form class="inventory-form" id="medicineForm">

                <input type="hidden" id="medicineId">

                <div class="form-field">
                    <label for="medicineName">Medicine Name *</label>
                    <input id="medicineName"
                           placeholder="e.g., Paracetamol 500mg"
                           required
                           maxlength="120">
                </div>

                <div class="form-field">
                    <label for="medicineCategory">Category / Type *</label>
                    <select id="medicineCategory" required>
                        <option value="">Select category</option>
                        <option value="Pain Reliever">Pain Reliever</option>
                        <option value="Antibiotic">Antibiotic</option>
                        <option value="Antihistamine">Antihistamine</option>
                        <option value="Vitamins">Vitamins</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Other">Other</option>
                    </select>
                </div>

                <div class="form-field">
                    <label for="medicinePrice">Unit Price (₱) *</label>
                    <input type="number"
                           id="medicinePrice"
                           min="0.01"
                           step="0.01"
                           placeholder="0.00"
                           required>
                </div>

                <div class="form-field">
                    <label for="medicineDiscount">Discount (%)</label>
                    <input type="number"
                           id="medicineDiscount"
                           min="0"
                           max="100"
                           step="0.01"
                           value="0">
                    <div class="discount-presets" id="medicineDiscountPresets">
                        <button type="button" class="discount-chip" data-discount="0">0%</button>
                        <button type="button" class="discount-chip" data-discount="5">5%</button>
                        <button type="button" class="discount-chip" data-discount="10">10%</button>
                        </div>
                </div>

                <div class="form-field">
                    <label for="medicineQuantity">Quantity *</label>
                    <input type="number"
                           id="medicineQuantity"
                           min="0"
                           step="1"
                           placeholder="0"
                           required>
                </div>

                <div class="form-field">
                    <label for="medicineReorder">Reorder Level *</label>
                    <input type="number"
                           id="medicineReorder"
                           min="0"
                           step="1"
                           placeholder="10"
                           required>
                </div>

                <div class="form-field">
                    <label for="medicineBatch">Batch Number</label>
                    <input id="medicineBatch" maxlength="80" placeholder="e.g., BATCH-001">
                </div>
                <div class="form-field">
                    <label for="medicineExpiry">Expiration Date</label>
                    <input type="date" id="medicineExpiry">
                </div>
                <div class="form-field">
                    <label for="medicineShelf">Shelf Location</label>
                    <input id="medicineShelf" maxlength="100" placeholder="e.g., Shelf A-2">
                </div>

                <div class="form-field">
                    <label><input type="checkbox" id="medicineRx"> Prescription required (Rx)</label>
                </div>
                <div class="form-field form-full">
                    <div class="price-preview-banner" id="medicinePricePreviewBanner">
                        <span>Final Selling Price Preview</span>
                        <strong id="medicineFinalPricePreview">₱0.00</strong>
                    </div>
                </div>

                <div class="form-buttons">

                    <button type="button"
                            class="inventory-button secondary"
                            id="cancelMedicineBtn">
                        Cancel
                    </button>

                    <button type="submit" class="inventory-button">
                        Save Medicine
                    </button>

                </div>

            </form>
        </section>
    `,


sales: `
    <section class="page-heading">
        <div>
            <p class="breadcrumb" id="salesBreadcrumb">Point of Sale / Sales</p>
            <h1 id="salesPageTitle">Sales & Point of Sale</h1>
            <p class="subtitle" id="salesPageSubtitle">Process customer purchases, apply discounts, calculate change, and view receipts.</p>
        </div>
        <div class="sales-report-controls">
            <button type="button" class="inventory-button secondary" id="toggleAdminPosBtn" hidden>
                + Optional POS Checkout
            </button>
            <button type="button" class="inventory-button" id="exportSalesCsvBtn" hidden>
                ↓ Export Report (CSV)
            </button>
        </div>
    </section>

    <section class="inventory-summary">
        <article class="inventory-summary-card">
            <p id="salesSummaryCard1Label">Today's Sales</p>
            <h3 id="salesTodayTotal">₱0.00</h3>
        </article>
        <article class="inventory-summary-card">
            <p id="salesSummaryCard2Label">Transactions</p>
            <h3 id="salesTransactionCount">0</h3>
        </article>
        <article class="inventory-summary-card">
            <p id="salesSummaryCard3Label">Units Sold</p>
            <h3 id="salesItemsSold">0</h3>
        </article>
    </section>

    <section class="panel" id="posCheckoutSection">
        <div class="panel-heading">
            <div>
                <h3>POS Checkout</h3>
                <p id="posCheckoutSubtitle">Select a medicine, confirm discount, and enter payment details.</p>
            </div>
        </div>

        <form id="salesForm" class="inventory-form">
            <div class="form-field form-full">
                <label for="salesMedicine">Medicine *</label>
                <select id="salesMedicine" required>
                    <option value="">Select medicine</option>
                </select>
            </div>

            <div class="form-field form-full" id="rxVerificationField" hidden>
                <label><input type="checkbox" id="salesRxVerified"> Prescription verified</label>
            </div>
            <div class="form-field">
                <label for="salesQuantity">Quantity *</label>
                <input type="number" id="salesQuantity"
                       min="1" step="1" value="1" required>
                <small id="salesStockInfo"></small>
            </div>

            <div class="form-field">
                <label for="salesOriginalPrice">Original Unit Price</label>
                <input type="text" id="salesOriginalPrice"
                       value="₱0.00" readonly>
            </div>

            <div class="form-field">
                <label for="salesDiscount">Discount (%)</label>
                <input type="number" id="salesDiscount"
                       min="0" max="100" step="0.01" value="0">
                <div class="discount-presets" id="salesDiscountPresets">
                    <button type="button" class="discount-chip" data-discount="inventory">Inventory Default</button>
                    <button type="button" class="discount-chip" data-discount="0">0%</button>
                </div>
            </div>

            <div class="form-field">
                <label for="salesCustomerType">Customer Discount Type</label>
                <select id="salesCustomerType">
                    <option value="regular">Regular</option>
                    <option value="senior">Senior Citizen (20% + VAT Exempt)</option>
                    <option value="pwd">PWD (20% + VAT Exempt)</option>
                </select>
            </div>
            <div class="form-field" id="salesCustomerNameField" hidden>
                <label for="salesCustomerName">Customer Name *</label>
                <input id="salesCustomerName" maxlength="120" autocomplete="off">
            </div>
            <div class="form-field" id="salesCustomerIdField" hidden>
                <label for="salesCustomerId">OSCA / PWD ID Number *</label>
                <input id="salesCustomerId" maxlength="100" autocomplete="off">
            </div>
            <div class="form-field">
                <label for="salesUnitPrice">Final Unit Price</label>
                <input type="text" id="salesUnitPrice"
                       value="₱0.00" readonly>
            </div>

            <div class="form-field">
                <label for="salesCashReceived">Cash Tendered (₱)</label>
                <input type="number" id="salesCashReceived"
                       min="0" step="0.01" placeholder="Optional cash amount">
            </div>

            <div class="form-field">
                <label for="salesChange">Change</label>
                <input type="text" id="salesChange"
                       value="₱0.00" readonly>
            </div>

            <div class="form-field form-full sales-highlight-total">
                <label for="salesTotal">Total Amount Due</label>
                <input type="text" id="salesTotal"
                       value="₱0.00" readonly>
            </div>

            <div class="form-buttons">
                <button type="reset"
                        class="inventory-button secondary"
                        id="clearSaleBtn">
                    Clear
                </button>
                <button type="submit" class="inventory-button">
                    Complete Sale
                </button>
            </div>
        </form>

        <p id="salesMessage" class="inventory-message" role="status"></p>

        <div class="pos-receipt-card" id="posReceiptCard" hidden>
            <div class="pos-receipt-header">
                <div class="pos-receipt-brand">
                    <img id="receiptPharmacyLogo" src="assets/default-logo.svg" alt="Pharmacy Logo">
                    <div>
                        <strong id="receiptPharmacyName">E-Pharma</strong>
                        <small id="receiptPharmacyAddress">Philippines</small>
                    </div>
                </div>
                <button type="button" class="inventory-button secondary" id="printReceiptBtn">
                    Print Receipt
                </button>
            </div>
            <div class="pos-receipt-grid" id="posReceiptDetails"></div>
        </div>
    </section>

    <section class="panel">
        <div class="panel-heading">
            <div>
                <h3 id="salesRecordsHeading">Sales Records</h3>
                <p id="salesRecordsSubheading">Recent pharmacy transactions with applied discounts and cashier details.</p>
            </div>
        </div>

        <div class="inventory-toolbar">
            <input type="search" id="salesSearch"
                   class="inventory-search"
                   placeholder="Search receipt or medicine..."
                   aria-label="Search sales records">

            <div class="inventory-actions">
                <select class="inventory-filter" id="salesDateFilter">
                    <option value="all">All Dates</option>
                    <option value="today">Today</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">This Month</option>
                </select>

                <select class="inventory-filter" id="salesCashierFilter" hidden>
                    <option value="all">All Cashiers</option>
                </select>
            </div>
        </div>

        <div class="table-wrapper">
            <table class="inventory-table">
                <thead>
                    <tr>
                        <th>Receipt No.</th>
                        <th>Date & Time</th>
                        <th>Cashier</th>
                        <th>Medicine</th>
                        <th>Quantity</th>
                        <th>Unit Price</th>
                        <th>Discount</th>
                        <th>Total</th>
                        <th>Status / Action</th>
                    </tr>
                </thead>
                <tbody id="salesRecordsBody"></tbody>
            </table>
        </div>
    </section>
`,


  
purchase: `
    <section class="page-heading">
        <div>
            <p class="breadcrumb">Main Menu / Purchase</p>
            <h1>Purchase Management</h1>
            <p class="subtitle">Record medicine purchases and supplier costs.</p>
        </div>
    </section>

    <section class="inventory-summary">
        <article class="inventory-summary-card">
            <p>Total Purchase Records</p>
            <h3 id="purchaseCount">0</h3>
        </article>
        <article class="inventory-summary-card">
            <p>Total Purchase Cost</p>
            <h3 id="purchaseTotalCost">₱0.00</h3>
        </article>
        <article class="inventory-summary-card">
            <p>Units Purchased</p>
            <h3 id="purchaseUnits">0</h3>
        </article>
    </section>

    <section class="panel">
        <div class="panel-heading">
            <div>
                <h3>Record New Purchase</h3>
                <p>Enter the medicine and supplier details.</p>
            </div>
        </div>

        <form id="purchaseForm" class="inventory-form">

            <div class="form-field form-full">
                <label for="purchaseMedicine">Medicine *</label>
                <select id="purchaseMedicine" required>
                    <option value="">Select medicine</option>
                </select>
            </div>

            <div class="form-field">
                <label for="purchaseSupplier">Supplier Name *</label>
                <input id="purchaseSupplier"
                       required maxlength="120"
                       placeholder="Enter supplier name">
            </div>

            <div class="form-field">
                <label for="purchaseQuantity">Quantity *</label>
                <input type="number" id="purchaseQuantity"
                       min="1" step="1" required value="1">
            </div>

            <div class="form-field">
                <label for="purchaseUnitCost">Unit Cost (₱) *</label>
                <input type="number" id="purchaseUnitCost"
                       min="0.01" step="0.01" required>
            </div>

            <div class="form-field">
                <label for="purchaseTotal">Total Cost</label>
                <input type="text" id="purchaseTotal"
                       value="₱0.00" readonly>
            </div>

            <div class="form-buttons">
                <button type="reset"
                        class="inventory-button secondary">
                    Clear
                </button>
                <button type="submit" class="inventory-button">
                    Save Purchase
                </button>
            </div>
        </form>

        <p id="purchaseMessage"
           class="inventory-message"
           role="status"></p>
    </section>

    <section class="panel">
        <div class="panel-heading">
            <div>
                <h3>Purchase History</h3>
                <p>Previously recorded purchases.</p>
            </div>
        </div>

        <div class="inventory-toolbar">
            <input type="search"
                   id="purchaseSearch"
                   class="inventory-search"
                   placeholder="Search medicine or supplier...">
        </div>

        <div class="table-wrapper">
            <table class="inventory-table">
                <thead>
                    <tr>
                        <th>Purchase No.</th>
                        <th>Date</th>
                        <th>Medicine</th>
                        <th>Supplier</th>
                        <th>Quantity</th>
                        <th>Unit Cost</th>
                        <th>Total Cost</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="purchaseRecordsBody"></tbody>
            </table>
        </div>
    </section>
`,


suppliers: `
    <section class="page-heading">
        <div>
            <p class="breadcrumb">Main Menu / Suppliers</p>
            <h1>Suppliers Management</h1>
            <p class="subtitle">Manage your pharmacy suppliers and contact information.</p>
        </div>
        <button class="primary-btn" id="addSupplierBtn">+ Add Supplier</button>
    </section>

    <section class="stats-grid">
        <div class="stat-card">
            <div class="stat-info">
                <p>Total Suppliers</p>
                <h2 id="supplierCount">0</h2>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-info">
                <p>Active Suppliers</p>
                <h2 id="activeSupplierCount">0</h2>
            </div>
        </div>
    </section>

    <section class="panel">
        <div class="panel-header">
            <h2>Supplier List</h2>
            <input
                type="text"
                id="supplierSearch"
                placeholder="Search supplier..."
            >
        </div>

        <div id="supplierMessage"></div>

        <form id="supplierForm" style="display:none; margin-bottom:20px;">
            <input type="hidden" id="supplierId">

            <div class="form-grid">
                <div class="form-group">
                    <label for="supplierName">Supplier Name</label>
                    <input type="text" id="supplierName" required>
                </div>

                <div class="form-group">
                    <label for="supplierContact">Contact Person</label>
                    <input type="text" id="supplierContact" required>
                </div>

                <div class="form-group">
                    <label for="supplierPhone">Phone Number</label>
                    <input type="tel" id="supplierPhone" required>
                </div>

                <div class="form-group">
                    <label for="supplierEmail">Email</label>
                    <input type="email" id="supplierEmail">
                </div>

                <div class="form-group">
                    <label for="supplierAddress">Address</label>
                    <input type="text" id="supplierAddress" required>
                </div>

                <div class="form-group">
                    <label for="supplierStatus">Status</label>
                    <select id="supplierStatus">
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                    </select>
                </div>
            </div>

            <button type="submit" class="primary-btn">Save Supplier</button>
            <button type="button" class="secondary-btn" id="cancelSupplierBtn">Cancel</button>
        </form>

        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Supplier ID</th>
                        <th>Supplier Name</th>
                        <th>Contact Person</th>
                        <th>Phone</th>
                        <th>Email</th>
                        <th>Address</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="suppliersBody"></tbody>
            </table>
        </div>
    </section>
`,

    
expiration: `
    <section class="page-heading">
        <div>
            <p class="breadcrumb">Main Menu / Expiration</p>
            <h1>Expiration Monitoring</h1>
            <p class="subtitle">Monitor expired and soon-to-expire medicine batches.</p>
        </div>
    </section>

    <section class="stats-grid">
        <div class="stat-card">
            <div class="stat-info">
                <p>Total Batches</p>
                <h2 id="expTotalBatches">0</h2>
            </div>
        </div>

        <div class="stat-card">
            <div class="stat-info">
                <p>Expiring Soon</p>
                <h2 id="expSoonCount">0</h2>
            </div>
        </div>

        <div class="stat-card">
            <div class="stat-info">
                <p>Expired Medicines</p>
                <h2 id="expExpiredCount">0</h2>
            </div>
        </div>
    </section>

    <section class="panel">
        <div class="panel-header">
            <h2>Medicine Expiration List</h2>

            <input
                type="text"
                id="expirationSearch"
                placeholder="Search medicine, batch, or shelf..."
                aria-label="Search medicines, batches, or shelves"
            >
        </div>

        <div class="filter-row">
            <label for="expirationFilter">Filter status:</label>
            <select id="expirationFilter">
                <option value="All">All Medicines</option>
                <option value="Expired">Expired</option>
                <option value="Expiring Soon">Expiring Soon</option>
                <option value="Safe">Safe</option>
            </select>
            <label for="expirationBefore">Expires on or before:</label>
            <input type="date" id="expirationBefore">
        </div>

        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Medicine</th>
                        <th>Batch Number</th>
                        <th>Shelf</th>
                        <th>Quantity</th>
                        <th>Expiration Date</th>
                        <th>Days Remaining</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody id="expirationBody"></tbody>
            </table>
        </div>
    </section>
`,


  
settings: `
    <section class="page-heading">
        <div>
            <p class="breadcrumb">Main Menu / Settings</p>
            <h1>Settings</h1>
            <p class="subtitle">Manage your pharmacy branding, staff profiles, and system preferences.</p>
        </div>
    </section>

    <section class="settings-layout">
        <div class="panel settings-panel">
            <div class="settings-heading">
                <div class="settings-icon">🏥</div>
                <div>
                    <h2>Pharmacy Information</h2>
                    <p>Update your pharmacy logo, editable name, contact details, and specific address.</p>
                </div>
            </div>

            <form id="pharmacySettingsForm">
                <div class="pharmacy-brand-editor">
                    <div class="pharmacy-logo-frame" id="settingLogoFrame">
                        <img id="settingPharmacyLogoPreview"
                             src="assets/default-logo.svg"
                             alt="Pharmacy Logo Preview">
                    </div>

                    <div class="pharmacy-brand-preview-text">
                        <span class="preview-badge">WEBSITE BRAND PREVIEW</span>
                        <strong id="settingBrandNamePreview">E-Pharma</strong>
                        <small id="settingBrandAddressPreview">Philippines</small>
                    </div>

                    <div class="pharmacy-logo-actions">
                        <div class="pharmacy-logo-buttons">
                            <label for="settingPharmacyLogoInput" class="primary-btn logo-upload-label">
                                Upload Logo
                            </label>
                            <input id="settingPharmacyLogoInput"
                                   type="file"
                                   accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                                   hidden>
                            <button type="button"
                                    id="resetPharmacyLogoBtn"
                                    class="secondary-btn">
                                Reset Logo
                            </button>
                        </div>
                        <small class="logo-hint">PNG, JPG, WebP, GIF, or SVG (max 5 MB)</small>
                    </div>
                </div>

                <div class="settings-form-grid">
                    <div class="form-group">
                        <label for="settingPharmacyName">Pharmacy Name *</label>
                        <input id="settingPharmacyName"
                               type="text"
                               value="E-Pharma"
                               maxlength="120"
                               placeholder="Enter pharmacy name"
                               required>
                    </div>

                    <div class="form-group">
                        <label for="settingPharmacyEmail">Email Address</label>
                        <input id="settingPharmacyEmail"
                               type="email"
                               value="epharma@example.com"
                               maxlength="150"
                               placeholder="e.g., pharmacy@example.com">
                    </div>

                    <div class="form-group">
                        <label for="settingPharmacyPhone">Contact Number</label>
                        <input id="settingPharmacyPhone"
                               type="tel"
                               value="09123456789"
                               maxlength="40"
                               placeholder="e.g., 09123456789">
                    </div>
                </div>

                <div class="settings-subsection">
                    <div class="settings-subsection-header">
                        <h3>Specific Address Details</h3>
                        <p>Provide complete street, barangay, city, province, and landmark details.</p>
                    </div>

                    <div class="settings-form-grid">
                        <div class="form-group">
                            <label for="settingPharmacyStreet">Street / House No. / Bldg. / Unit</label>
                            <input id="settingPharmacyStreet"
                                   type="text"
                                   maxlength="200"
                                   placeholder="e.g., Unit 2B, 145 Emilio Aguinaldo Hwy">
                        </div>

                        <div class="form-group">
                            <label for="settingPharmacyBarangay">Barangay / District / Subdivision</label>
                            <input id="settingPharmacyBarangay"
                                   type="text"
                                   maxlength="120"
                                   placeholder="e.g., Brgy. Zone I-A">
                        </div>

                        <div class="form-group">
                            <label for="settingPharmacyCity">City / Municipality</label>
                            <input id="settingPharmacyCity"
                                   type="text"
                                   maxlength="120"
                                   placeholder="e.g., Dasmariñas City">
                        </div>

                        <div class="form-group">
                            <label for="settingPharmacyProvince">Province / Region</label>
                            <input id="settingPharmacyProvince"
                                   type="text"
                                   maxlength="120"
                                   placeholder="e.g., Cavite">
                        </div>

                        <div class="form-group">
                            <label for="settingPharmacyPostalCode">Postal / ZIP Code</label>
                            <input id="settingPharmacyPostalCode"
                                   type="text"
                                   maxlength="20"
                                   placeholder="e.g., 4114">
                        </div>

                        <div class="form-group">
                            <label for="settingPharmacyCountry">Country</label>
                            <input id="settingPharmacyCountry"
                                   type="text"
                                   value="Philippines"
                                   maxlength="100"
                                   placeholder="e.g., Philippines">
                        </div>

                        <div class="form-group form-group-full">
                            <label for="settingPharmacyLandmark">Landmark / Additional Address Details</label>
                            <input id="settingPharmacyLandmark"
                                   type="text"
                                   maxlength="200"
                                   placeholder="e.g., Across City Hall, beside Public Market">
                        </div>
                    </div>

                    <div class="address-preview-box">
                        <span class="address-preview-label">Formatted Full Address</span>
                        <p id="settingPharmacyFullAddressPreview">Philippines</p>
                    </div>
                </div>

                <div class="settings-actions-row">
                    <button type="submit" class="primary-btn">
                        Save Pharmacy Information
                    </button>
                    <span id="pharmacySettingsStatus"
                          class="settings-inline-status"
                          role="status"
                          aria-live="polite"></span>
                </div>
            </form>
        </div>

        <div class="panel settings-panel">
            <div class="settings-heading">
                <div class="settings-icon">⚙️</div>
                <div>
                    <h2>System Preferences</h2>
                    <p>Choose how dates and stock alerts are displayed.</p>
                </div>
            </div>

            <form id="systemSettingsForm">
                <div class="settings-form-grid">
                    <div class="form-group">
                        <label for="settingDateFormat">Date Format</label>
                        <select id="settingDateFormat">
                            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="settingLowStock">Low Stock Alert Level</label>
                        <input id="settingLowStock" type="number"
                            min="1" value="10" required>
                    </div>
                </div>

                <button type="submit" class="primary-btn">
                    Save System Preferences
                </button>
            </form>
        </div>

        <div id="settingsMessage" role="status"></div>
    </section>
`,

cashiers: `
    <section class="page-heading">
        <div>
            <p class="breadcrumb">Administration / Cashiers</p>
            <h1>Cashier Management</h1>
            <p class="subtitle">Create, edit, activate, or deactivate cashier POS accounts.</p>
        </div>
        <button type="button" class="inventory-button" id="addCashierBtn">+ Add Cashier</button>
    </section>

    <section class="inventory-summary">
        <article class="inventory-summary-card">
            <p>Total Accounts</p>
            <h3 id="cashierTotalCount">0</h3>
        </article>
        <article class="inventory-summary-card">
            <p>Active Cashiers</p>
            <h3 id="cashierActiveCount">0</h3>
        </article>
        <article class="inventory-summary-card">
            <p>Inactive Cashiers</p>
            <h3 id="cashierInactiveCount">0</h3>
        </article>
    </section>

    <section class="panel" id="cashierFormPanel" hidden>
        <div class="panel-heading">
            <div>
                <h3 id="cashierFormTitle">Add New Cashier Account</h3>
                <p>Set account credentials, display name, and status.</p>
            </div>
        </div>

        <form id="cashierForm" class="inventory-form">
            <input type="hidden" id="cashierUserId">

            <div class="form-field">
                <label for="cashierFullName">Full Name *</label>
                <input id="cashierFullName" maxlength="120" placeholder="e.g., Maria Santos" required>
            </div>

            <div class="form-field">
                <label for="cashierUsername">Username *</label>
                <input id="cashierUsername" maxlength="50" placeholder="e.g., maria" required>
            </div>

            <div class="form-field">
                <label for="cashierEmail">Email Address</label>
                <input id="cashierEmail" type="email" maxlength="150" placeholder="e.g., maria@example.com">
            </div>

            <div class="form-field">
                <label for="cashierStatus">Status</label>
                <select id="cashierStatus">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                </select>
            </div>

            <div class="form-field form-full">
                <label for="cashierPassword" id="cashierPasswordLabel">Password * (min 12 characters)</label>
                <input id="cashierPassword" type="password" minlength="12" placeholder="Enter password">
            </div>

            <div class="form-buttons">
                <button type="button" class="inventory-button secondary" id="cancelCashierBtn">Cancel</button>
                <button type="submit" class="inventory-button">Save Cashier</button>
            </div>
        </form>
    </section>

    <section class="panel">
        <div class="inventory-toolbar">
            <input type="search" id="cashierSearch" class="inventory-search" placeholder="Search cashier name or username...">
        </div>

        <div class="table-wrapper">
            <table class="inventory-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Full Name</th>
                        <th>Username</th>
                        <th>Role</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Presence</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="cashiersBody"></tbody>
            </table>
        </div>

        <p id="cashiersMessage" class="inventory-message" role="status"></p>
    </section>
`,

logs: `
    <section class="page-heading">
        <div>
            <p class="breadcrumb">Administration / Activity Logs</p>
            <h1>Activity Logs</h1>
            <p class="subtitle">Audit trail of logins, sales, inventory edits, purchases, and account updates.</p>
        </div>
    </section>

    <section class="inventory-summary">
        <article class="inventory-summary-card">
            <p>Recorded Events</p>
            <h3 id="logTotalCount">0</h3>
        </article>
        <article class="inventory-summary-card">
            <p>Admin Events</p>
            <h3 id="logAdminCount">0</h3>
        </article>
        <article class="inventory-summary-card">
            <p>Cashier Events</p>
            <h3 id="logCashierCount">0</h3>
        </article>
    </section>

    <section class="panel">
        <div class="inventory-toolbar">
            <input type="search" id="logsSearch" class="inventory-search" placeholder="Search user, action, or details...">

            <div class="inventory-actions">
                <select class="inventory-filter" id="logsRoleFilter">
                    <option value="all">All Roles</option>
                    <option value="admin">Admin Only</option>
                    <option value="cashier">Cashier Only</option>
                </select>

                <select class="inventory-filter" id="logsModuleFilter">
                    <option value="all">All Modules</option>
                    <option value="Auth">Auth</option>
                    <option value="Sales">Sales</option>
                    <option value="Inventory">Inventory</option>
                    <option value="Purchase">Purchase</option>
                    <option value="Suppliers">Suppliers</option>
                    <option value="Cashiers">Cashiers</option>
                    <option value="Account">Account</option>
                    <option value="Settings">Settings</option>
                </select>
            </div>
        </div>

        <div class="table-wrapper">
            <table class="inventory-table">
                <thead>
                    <tr>
                        <th>Timestamp</th>
                        <th>User</th>
                        <th>Role</th>
                        <th>Module</th>
                        <th>Action</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody id="activityLogsBody"></tbody>
            </table>
        </div>
    </section>
`,

account: `
    <section class="page-heading">
        <div>
            <p class="breadcrumb">Account / My Account</p>
            <h1>My Account</h1>
            <p class="subtitle">Update your personal profile details and account password.</p>
        </div>
    </section>

    <section class="account-grid">
        <article class="panel">
            <div class="panel-heading">
                <div>
                    <h3>Profile Information</h3>
                    <p>Manage your display name and contact email.</p>
                </div>
                <span class="role-badge role-badge--admin" id="accountRoleBadge">Admin</span>
            </div>

            <form id="accountProfileForm" class="inventory-form">
                <div class="form-field form-full">
                    <label for="accountUsername">Username</label>
                    <input id="accountUsername" type="text" readonly>
                </div>

                <div class="form-field form-full">
                    <label for="accountFullName">Full Name *</label>
                    <input id="accountFullName" type="text" maxlength="120" required>
                </div>

                <div class="form-field form-full">
                    <label for="accountEmail">Email Address</label>
                    <input id="accountEmail" type="email" maxlength="150" placeholder="you@example.com">
                </div>

                <div class="form-buttons">
                    <button type="submit" class="inventory-button">Save Profile</button>
                </div>
            </form>

            <p id="accountProfileMessage" class="inventory-message" role="status"></p>
        </article>

        <article class="panel">
            <div class="panel-heading">
                <div>
                    <h3>Change Password</h3>
                    <p>Use a strong password with at least 12 characters.</p>
                </div>
            </div>

            <form id="accountPasswordForm" class="inventory-form">
                <div class="form-field form-full">
                    <label for="accountCurrentPassword">Current Password *</label>
                    <input id="accountCurrentPassword" type="password" required>
                </div>

                <div class="form-field form-full">
                    <label for="accountNewPassword">New Password *</label>
                    <input id="accountNewPassword" type="password" minlength="12" required>
                </div>

                <div class="form-field form-full">
                    <label for="accountConfirmPassword">Confirm New Password *</label>
                    <input id="accountConfirmPassword" type="password" minlength="12" required>
                </div>

                <div class="form-buttons">
                    <button type="submit" class="inventory-button">Update Password</button>
                </div>
            </form>

            <p id="accountPasswordMessage" class="inventory-message" role="status"></p>
        </article>
    </section>
`,

};


// =========================================
// 9. NAVIGATION FUNCTION
// Sidebar and topbar stay in place.
// =========================================

function showPage(pageName) {

    if (!pageContent) return;

    if (!canAccessPage(pageName)) {
        pageName = "dashboard";
    }

    if (pageName === "dashboard") {

        // Restore the original complete dashboard.
        pageContent.innerHTML = dashboardHomeContent;

    } else if (pageTemplates[pageName]) {

        // Change only the main content.
        pageContent.innerHTML = pageTemplates[pageName];

    } else {
        console.error("Page template not found:", pageName);
        return;
    }

    // Update active navigation.
    navLinks.forEach(function (link) {
        const isActive = link.dataset.page === pageName;

        link.classList.toggle("active", isActive);

        if (isActive) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    });

    if (window.location.hash !== "#" + pageName && window.history && typeof window.history.replaceState === "function") {
        try {
            window.history.replaceState(null, "", "#" + pageName);
        } catch {
            // Ignore hash update errors in restricted environments.
        }
    }

    // Initialize the selected page.
    if (pageName === "dashboard") {
        initializeDashboard();
        refreshDashboardStats();
    }

    if (pageName === "inventory") {
        initializeInventoryPage();
    }

    if (pageName === "sales") {
        initializeSalesPage();
    }
    if (pageName === "purchase") {
        initializePurchasePage();
    }
    if (pageName === "suppliers") {
        initializeSuppliersPage();
    }
    if (pageName === "expiration") {
        initializeExpirationPage();
    }
    if (pageName === "cashiers") {
        initializeCashiersPage();
    }
    if (pageName === "logs") {
        initializeActivityLogsPage();
    }
    if (pageName === "settings") {
        initializeSettingsPage();
    }
    if (pageName === "account") {
        initializeAccountPage();
    }

    // Close mobile sidebar after selecting a page.
    if (sidebar) {
        sidebar.classList.remove("open");
    }

    if (menuToggle) {
        menuToggle.setAttribute("aria-expanded", "false");
    }

    window.scrollTo({ top: 0, behavior: "auto" });
}


// =========================================
// 10. NAVIGATION CLICK EVENTS
// =========================================

navLinks.forEach(function (link) {
    link.addEventListener("click", function (event) {
        event.preventDefault();
        showPage(link.dataset.page);
    });
});

// Also handle View All and Manage Reorders links.
document.addEventListener("click", function (event) {
    const link = event.target.closest("a[data-page]");

    if (!link || link.classList.contains("nav-link")) return;

    event.preventDefault();
    showPage(link.dataset.page);
});


// =========================================
// 11. INVENTORY SAMPLE DATA (DEMO FALLBACK)
// =========================================

let pendingPurchaseMedicineId = null;

let inventoryMedicines = [];

let nextMedicineId = 6;


// =========================================
// 12. MEDICINE STATUS
// =========================================

function getMedicineStatus(medicine) {
    if (medicine.quantity === 0) return "out";

    if (medicine.quantity <= medicine.reorderLevel) return "low";

    return "in";
}


// =========================================
// 13. RENDER INVENTORY TABLE
// =========================================

function renderInventory() {
    const tbody = document.getElementById("inventoryBody");

    if (!tbody) return;

    const searchInput = document.getElementById("invSearch");
    const filterInput = document.getElementById("invFilter");

    if (!searchInput || !filterInput) return;

    const cashierMode = isCashierRole();
    const query = searchInput.value.trim().toLowerCase();
    const filter = filterInput.value;

    const addBtn = document.getElementById("addMedicineBtn");
    const cashierNotice = document.getElementById("cashierInventoryNotice");
    if (addBtn) addBtn.hidden = cashierMode;
    if (cashierNotice) cashierNotice.hidden = !cashierMode;

    const filteredMedicines = inventoryMedicines.filter(function (medicine) {
        const matchesSearch =
            medicine.name.toLowerCase().includes(query) ||
            medicine.category.toLowerCase().includes(query);

        const status = getMedicineStatus(medicine);
        const discount = normalizeDiscountPercent(medicine.discount);

        const matchesFilter =
            filter === "all" ||
            (filter === "discounted" ? discount > 0 : filter === status);

        return matchesSearch && matchesFilter;
    });

    document.getElementById("invTotal").textContent =
        inventoryMedicines.length;

    document.getElementById("invLowStock").textContent =
        inventoryMedicines.filter(function (medicine) {
            return getMedicineStatus(medicine) === "low";
        }).length;

    document.getElementById("invTotalUnits").textContent =
        inventoryMedicines.reduce(function (sum, medicine) {
            return sum + medicine.quantity;
        }, 0);

    const invDiscountedEl = document.getElementById("invDiscounted");
    if (invDiscountedEl) {
        invDiscountedEl.textContent = inventoryMedicines.filter(function (medicine) {
            return normalizeDiscountPercent(medicine.discount) > 0;
        }).length;
    }

    tbody.innerHTML = "";

    if (filteredMedicines.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 9;
        cell.className = "inventory-empty";
        cell.textContent = "No medicines found.";

        row.appendChild(cell);
        tbody.appendChild(row);

        return;
    }

    filteredMedicines.forEach(function (medicine) {
        const status = getMedicineStatus(medicine);
        const discount = normalizeDiscountPercent(medicine.discount);
        const finalPrice = calculateDiscountedPrice(medicine.price, discount);

        const statusLabels = {
            low: "Low Stock",
            in: "In Stock",
            out: "Out of Stock"
        };

        const statusClasses = {
            low: "warning",
            in: "success",
            out: "danger"
        };

        const row = document.createElement("tr");

        const nameCell = document.createElement("td");
        const nameStrong = document.createElement("strong");
        nameStrong.textContent = medicine.name;
        nameCell.appendChild(nameStrong);
        if (medicine.requiresPrescription) {
            const rx = document.createElement("span");
            rx.className = "badge warning";
            rx.textContent = "Rx";
            nameCell.appendChild(rx);
        }
        row.appendChild(nameCell);

        const categoryCell = document.createElement("td");
        categoryCell.textContent = medicine.category || "-";
        row.appendChild(categoryCell);

        const priceCell = document.createElement("td");
        if (discount > 0) {
            const strikeSpan = document.createElement("span");
            strikeSpan.className = "price-strike";
            strikeSpan.textContent = "₱" + medicine.price.toFixed(2);
            priceCell.appendChild(strikeSpan);
        } else {
            priceCell.textContent = "₱" + medicine.price.toFixed(2);
        }
        row.appendChild(priceCell);

        const discountCell = document.createElement("td");
        const discountBadge = document.createElement("span");
        if (discount > 0) {
            discountBadge.className = "badge discount";
            discountBadge.textContent = discount + "% OFF";
        } else {
            discountBadge.className = "badge neutral";
            discountBadge.textContent = "None";
        }
        discountCell.appendChild(discountBadge);
        row.appendChild(discountCell);

        const finalPriceCell = document.createElement("td");
        if (discount > 0) {
            const finalSpan = document.createElement("span");
            finalSpan.className = "price-final";
            finalSpan.textContent = "₱" + finalPrice.toFixed(2);
            finalPriceCell.appendChild(finalSpan);
        } else {
            finalPriceCell.textContent = "₱" + finalPrice.toFixed(2);
        }
        row.appendChild(finalPriceCell);

        const qtyCell = document.createElement("td");
        qtyCell.textContent = String(medicine.quantity);
        row.appendChild(qtyCell);

        const reorderCell = document.createElement("td");
        reorderCell.textContent = String(medicine.reorderLevel);
        row.appendChild(reorderCell);

        // Stock status.
        const statusCell = document.createElement("td");
        const badge = document.createElement("span");

        badge.className = "badge " + statusClasses[status];
        badge.textContent = statusLabels[status];

        statusCell.appendChild(badge);
        row.appendChild(statusCell);

        // Action buttons (Admin vs Cashier).
        const actionsCell = document.createElement("td");
        const actions = document.createElement("div");

        actions.className = "action-buttons";

        if (cashierMode) {
            const sellButton = document.createElement("button");
            sellButton.type = "button";
            sellButton.className = "sell-quick-button";
            sellButton.textContent = status === "out" ? "Out of Stock" : "Sell";
            sellButton.disabled = status === "out";

            sellButton.addEventListener("click", function () {
                pendingSaleMedicineId = medicine.id;
                showPage("sales");
            });

            actions.appendChild(sellButton);
        } else {
            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.textContent = "Edit";

            editButton.addEventListener("click", function () {
                openMedicineForm(medicine.id);
            });

            const reorderButton = document.createElement("button");
            reorderButton.type = "button";
            reorderButton.textContent = "Reorder";
            reorderButton.disabled = status === "in";

            reorderButton.addEventListener("click", function () {
                pendingPurchaseMedicineId = medicine.id;
                showPage("purchase");
            });

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.textContent = "Delete";
            deleteButton.className = "delete-button";

            deleteButton.addEventListener("click", function () {
                deleteMedicine(medicine.id);
            });

            actions.append(editButton, reorderButton, deleteButton);
        }

        actionsCell.appendChild(actions);
        row.appendChild(actionsCell);

        tbody.appendChild(row);
    });
}


// =========================================
// 14. ADD / EDIT MEDICINE FORM
// =========================================

function updateMedicineFormPricePreview() {
    const priceInput = document.getElementById("medicinePrice");
    const discountInput = document.getElementById("medicineDiscount");
    const previewEl = document.getElementById("medicineFinalPricePreview");
    if (!previewEl) return;

    const basePrice = Number(priceInput ? priceInput.value : 0);
    const discount = normalizeDiscountPercent(discountInput ? discountInput.value : 0);

    if (!Number.isFinite(basePrice) || basePrice <= 0) {
        previewEl.textContent = "₱0.00";
        return;
    }

    const finalPrice = calculateDiscountedPrice(basePrice, discount);
    const savings = Math.max(0, basePrice - finalPrice);

    previewEl.textContent = discount > 0
        ? `₱${finalPrice.toFixed(2)} (${discount}% off · Save ₱${savings.toFixed(2)})`
        : `₱${finalPrice.toFixed(2)}`;

    document.querySelectorAll("#medicineDiscountPresets .discount-chip").forEach(chip => {
        chip.classList.toggle("active", Number(chip.dataset.discount) === discount);
    });
}

function openMedicineForm(medicineId = null) {
    if (isCashierRole()) {
        showInventoryMessage("Only Admin can add or edit medicines.", true);
        return;
    }

    const form = document.getElementById("medicineForm");
    const panel = document.getElementById("medicineFormPanel");

    if (!form || !panel) return;

    form.reset();

    document.getElementById("medicineId").value = "";
    const discountField = document.getElementById("medicineDiscount");
    if (discountField) discountField.value = "0";

    if (medicineId !== null) {
        const medicine = inventoryMedicines.find(function (item) {
            return item.id === medicineId;
        });

        if (!medicine) return;

        document.getElementById("medicineId").value = medicine.id;
        document.getElementById("medicineName").value = medicine.name;
        document.getElementById("medicineCategory").value = medicine.category;
        document.getElementById("medicinePrice").value = medicine.price;
        if (discountField) {
            discountField.value = normalizeDiscountPercent(medicine.discount);
        }
        document.getElementById("medicineQuantity").value = medicine.quantity;
        document.getElementById("medicineReorder").value = medicine.reorderLevel;
        document.getElementById("medicineBatch").value = medicine.batch || "";
        document.getElementById("medicineExpiry").value = medicine.expiry || "";
        document.getElementById("medicineShelf").value = medicine.shelf || "";
        document.getElementById("medicineRx").checked = Boolean(medicine.requiresPrescription);

        document.getElementById("medicineFormTitle").textContent =
            "Edit Medicine";

    } else {
        document.getElementById("medicineFormTitle").textContent =
            "Add New Medicine";
    }

    updateMedicineFormPricePreview();
    panel.hidden = false;

    panel.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    document.getElementById("medicineName").focus();
}


// =========================================
// 15. DELETE MEDICINE
// =========================================


async function deleteMedicine(id) {
    if (isCashierRole()) {
        showInventoryMessage("Only Admin can delete medicines.", true);
        return;
    }

    const medicine = inventoryMedicines.find(function (item) {
        return item.id === Number(id);
    });

    if (!medicine) {
        alert("Medicine not found.");
        return;
    }

    const confirmed = confirm(
        `Are you sure you want to delete ${medicine.name}?`
    );

    if (!confirmed) return;

    try {
        const response = await fetch(
            `/api/medicines/${encodeURIComponent(id)}`,
            {
                method: "DELETE"
            }
        );

        const result = await response.json().catch(() => ({}));

        if (isServerDbUnavailable(response, result)) {
            isDemoDatabaseMode = true;
            inventoryMedicines = inventoryMedicines.filter(item => item.id !== Number(id));
            recordLocalActivity("Inventory", "Deleted Medicine", `Removed ${medicine.name}`);
            renderInventory();
            refreshDashboardStats();
            showInventoryMessage(`${medicine.name} removed (Demo preview mode).`);
            return;
        }

        if (!response.ok) {
            throw new Error(
                result.message || "Unable to delete medicine."
            );
        }

        await loadMedicinesFromDatabase();

        showInventoryMessage(
            result.message || "Medicine deleted successfully."
        );
    } catch (error) {
        console.error("Delete medicine error:", error);

        showInventoryMessage(
            error.message || "Unable to delete medicine.",
            true
        );
    }
}


// =========================================
// 16. INVENTORY MESSAGE
// =========================================

function showInventoryMessage(text, isError = false) {
    const message = document.getElementById("inventoryMessage");

    if (message) {
        message.textContent = text;
        message.style.color = isError ? "#B91C1C" : "#067D70";
    }
}


// =========================================
// 17. INITIALIZE INVENTORY PAGE
// =========================================


async function initializeInventoryPage() {
    const form = document.getElementById("medicineForm");

    if (!form || form.dataset.initialized === "true") return;

    form.dataset.initialized = "true";

    const addBtn = document.getElementById("addMedicineBtn");
    if (addBtn) {
        addBtn.addEventListener("click", function () {
            openMedicineForm();
        });
    }

    document.getElementById("cancelMedicineBtn")
        .addEventListener("click", function () {
            document.getElementById("medicineFormPanel").hidden = true;
            form.reset();
        });

    document.getElementById("invSearch")
        .addEventListener("input", renderInventory);

    document.getElementById("invFilter")
        .addEventListener("change", renderInventory);

    const priceInput = document.getElementById("medicinePrice");
    const discountInput = document.getElementById("medicineDiscount");
    const discountPresets = document.getElementById("medicineDiscountPresets");

    if (priceInput) priceInput.addEventListener("input", updateMedicineFormPricePreview);
    if (discountInput) discountInput.addEventListener("input", updateMedicineFormPricePreview);
    if (discountPresets && discountInput) {
        discountPresets.addEventListener("click", function (event) {
            const chip = event.target.closest(".discount-chip");
            if (!chip) return;
            discountInput.value = chip.dataset.discount || "0";
            updateMedicineFormPricePreview();
        });
    }

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (isCashierRole()) {
            showInventoryMessage("Only Admin can modify inventory.", true);
            return;
        }

        const idValue = document.getElementById("medicineId").value;
        const name = document.getElementById("medicineName").value.trim();
        const category = document.getElementById("medicineCategory").value;

        const price = Number(
            document.getElementById("medicinePrice").value
        );

        const rawDiscount = document.getElementById("medicineDiscount").value;
        const discountNum = rawDiscount === "" ? 0 : Number(rawDiscount);

        const quantity = Number(
            document.getElementById("medicineQuantity").value
        );

        const reorderLevel = Number(
            document.getElementById("medicineReorder").value
        );

        if (
            !name ||
            !category ||
            !Number.isFinite(price) ||
            price <= 0 ||
            !Number.isFinite(discountNum) ||
            discountNum < 0 ||
            discountNum > 100 ||
            !Number.isInteger(quantity) ||
            quantity < 0 ||
            !Number.isInteger(reorderLevel) ||
            reorderLevel < 0
        ) {
            alert("Please enter valid medicine details (discount must be between 0% and 100%).");
            return;
        }

        const discount = normalizeDiscountPercent(discountNum);

        const duplicate = inventoryMedicines.some(function (medicine) {
            return (
                medicine.name.toLowerCase() === name.toLowerCase() &&
                String(medicine.id) !== idValue
            );
        });

        if (duplicate) {
            alert("This medicine already exists in inventory.");
            return;
        }

        const payload = {
            medicine_name: name,
            category: category,
            price: price,
            discount_percent: discount,
            quantity: quantity,
            reorder_level: reorderLevel,
            batch_number: document.getElementById("medicineBatch").value.trim(),
            expiry_date: document.getElementById("medicineExpiry").value,
            shelf_location: document.getElementById("medicineShelf").value.trim(),
            requires_prescription: document.getElementById("medicineRx").checked
        };

        try {
            const url = idValue
                ? `/api/medicines/${encodeURIComponent(idValue)}`
                : "/api/medicines";

            const response = await fetch(url, {
                method: idValue ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json().catch(() => ({}));

            if (isServerDbUnavailable(response, result)) {
                isDemoDatabaseMode = true;
                if (idValue) {
                    const existing = inventoryMedicines.find(m => m.id === Number(idValue));
                    if (existing) {
                        existing.name = name;
                        existing.category = category;
                        existing.price = price;
                        existing.discount = discount;
                        existing.quantity = quantity;
                        existing.reorderLevel = reorderLevel;
                        existing.batch = payload.batch_number;
                        existing.expiry = payload.expiry_date;
                        existing.shelf = payload.shelf_location;
                    }
                    recordLocalActivity("Inventory", "Updated Medicine", `Updated ${name} (₱${price.toFixed(2)}, ${discount}% off, Qty: ${quantity})`);
                } else {
                    inventoryMedicines.push({
                        id: nextMedicineId++,
                        name,
                        category,
                        price,
                        discount,
                        quantity,
                        reorderLevel,
                        batch: payload.batch_number, expiry: payload.expiry_date, shelf: payload.shelf_location
                    });
                    recordLocalActivity("Inventory", "Added Medicine", `Added ${name} (₱${price.toFixed(2)}, Qty: ${quantity})`);
                }

                document.getElementById("medicineFormPanel").hidden = true;
                form.reset();
                renderInventory();
                refreshDashboardStats();
                showInventoryMessage("Medicine saved in local preview mode (connect MySQL to persist in database).");
                return;
            }

            if (!response.ok) {
                throw new Error(
                    result.message || "Unable to save medicine."
                );
            }

            await loadMedicinesFromDatabase();

            document.getElementById("medicineFormPanel").hidden = true;
            form.reset();

            renderInventory();

            showInventoryMessage(
                result.message || "Medicine saved successfully."
            );
        } catch (error) {
            console.error("Save medicine error:", error);
            showInventoryMessage(
                error.message || "Unable to save medicine.",
                true
            );
        }
    });

    await loadMedicinesFromDatabase();
    renderInventory();
}


/* =========================================
   E-PHARMA SALES MANAGEMENT & REPORTS
========================================= */

function createDemoSalesRecords() {
    const now = new Date();
    function daysAgo(days, hour = 10) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, hour, 15, 0);
        return {
            ts: d.getTime(),
            str: d.toLocaleString("en-PH")
        };
    }

    const s6 = daysAgo(0, Math.max(8, now.getHours() - 1));
    const s5 = daysAgo(0, Math.max(8, now.getHours() - 2));
    const s4 = daysAgo(1, 14);
    const s3 = daysAgo(2, 11);
    const s2 = daysAgo(4, 16);
    const s1 = daysAgo(6, 9);

    return [
        {
            receipt: "EP-0006",
            date: s6.str,
            timestamp: s6.ts,
            cashierUsername: "cashier",
            cashierName: "Cashier 1 (Alex Reyes)",
            medicineName: "Vitamin C 500mg",
            quantity: 5,
            originalPrice: 4.00,
            discount: 20,
            unitPrice: 3.20,
            total: 16.00
        },
        {
            receipt: "EP-0005",
            date: s5.str,
            timestamp: s5.ts,
            cashierUsername: "cashier2",
            cashierName: "Cashier 2 (Maria Santos)",
            medicineName: "Amoxicillin 500mg",
            quantity: 4,
            originalPrice: 8.00,
            discount: 0,
            unitPrice: 8.00,
            total: 32.00
        },
        {
            receipt: "EP-0004",
            date: s4.str,
            timestamp: s4.ts,
            cashierUsername: "cashier",
            cashierName: "Cashier 1 (Alex Reyes)",
            medicineName: "Paracetamol 500mg",
            quantity: 20,
            originalPrice: 5.00,
            discount: 0,
            unitPrice: 5.00,
            total: 100.00
        },
        {
            receipt: "EP-0003",
            date: s3.str,
            timestamp: s3.ts,
            cashierUsername: "cashier2",
            cashierName: "Cashier 2 (Maria Santos)",
            medicineName: "Ibuprofen 400mg",
            quantity: 12,
            originalPrice: 12.00,
            discount: 0,
            unitPrice: 12.00,
            total: 144.00
        },
        {
            receipt: "EP-0002",
            date: s2.str,
            timestamp: s2.ts,
            cashierUsername: "cashier",
            cashierName: "Cashier 1 (Alex Reyes)",
            medicineName: "Cetirizine 10mg",
            quantity: 15,
            originalPrice: 6.50,
            discount: 10,
            unitPrice: 5.85,
            total: 87.75
        },
        {
            receipt: "EP-0001",
            date: s1.str,
            timestamp: s1.ts,
            cashierUsername: "admin",
            cashierName: "Administrator",
            medicineName: "Paracetamol 500mg",
            quantity: 30,
            originalPrice: 5.00,
            discount: 0,
            unitPrice: 5.00,
            total: 150.00
        }
    ];
}

let salesRecords = [];
let nextReceiptNumber = 7;

function showSalesMessage(text, isError = false) {
    const message = document.getElementById("salesMessage");
    if (!message) return;
    message.textContent = text;
    message.style.color = isError ? "#B91C1C" : "#067D70";
}

function renderPosReceipt(receiptInfo) {
    const card = document.getElementById("posReceiptCard");
    const details = document.getElementById("posReceiptDetails");
    if (!card || !details || !receiptInfo) return;

    const branding = window.EPharmaBranding;
    const settings = branding ? branding.getCachedSettings() : {};
    const logoEl = document.getElementById("receiptPharmacyLogo");
    const nameEl = document.getElementById("receiptPharmacyName");
    const addrEl = document.getElementById("receiptPharmacyAddress");

    if (logoEl) {
        logoEl.src = settings.pharmacyLogo || (branding ? branding.DEFAULT_LOGO_PATH : "assets/default-logo.svg");
    }
    if (nameEl) {
        nameEl.textContent = settings.pharmacyName || "E-Pharma";
    }
    if (addrEl) {
        addrEl.textContent = (branding && branding.formatAddress(settings)) || settings.pharmacyAddress || "Philippines";
    }

    const changeRow = receiptInfo.cashTendered !== null
        ? `<div><span>Cash Tendered</span><strong>₱${receiptInfo.cashTendered.toFixed(2)}</strong></div>
           <div><span>Change</span><strong>₱${receiptInfo.changeAmount.toFixed(2)}</strong></div>`
        : "";

    const customerRows = receiptInfo.discountType && receiptInfo.discountType !== "regular"
        ? `<div><span>Customer type</span><strong>${escapeSupplierText(receiptInfo.discountType === "senior" ? "Senior Citizen" : "PWD")}</strong></div>
           <div><span>Customer name</span><strong>${escapeSupplierText(receiptInfo.customerName)}</strong></div>
           <div><span>OSCA / PWD ID</span><strong>${escapeSupplierText(receiptInfo.discountId)}</strong></div>
           <div><span>Discount applied</span><strong>${escapeSupplierText(receiptInfo.appliedDiscount === "statutory" ? "20% statutory + VAT exemption" : "Promotion (better price)")}</strong></div>
           <div><span>VAT-exempt sales</span><strong>₱${Number(receiptInfo.vatExemptSales).toFixed(2)}</strong></div>
           <div><span>Discount amount</span><strong>₱${Number(receiptInfo.discountAmount).toFixed(2)}</strong></div>` : "";
    details.innerHTML = `
        <div><span>Receipt No.</span><strong>${escapeSupplierText(receiptInfo.receipt)}</strong></div>
        <div><span>Date & Time</span><strong>${escapeSupplierText(receiptInfo.date)}</strong></div>
        <div><span>Cashier</span><strong>${escapeSupplierText(receiptInfo.cashierName)}</strong></div>
        <div><span>Medicine</span><strong>${escapeSupplierText(receiptInfo.medicineName)} × ${receiptInfo.quantity}</strong></div>
        <div><span>Unit Price</span><strong>₱${receiptInfo.unitPrice.toFixed(2)}${receiptInfo.discount > 0 ? ` (${receiptInfo.discount}% OFF)` : ""}</strong></div>
        ${customerRows}
        <div><span>Total Paid</span><strong>₱${receiptInfo.total.toFixed(2)}</strong></div>
        ${changeRow}
    `;

    card.hidden = false;
}

function populateSalesCashierFilter() {
    const select = document.getElementById("salesCashierFilter");
    if (!select || isCashierRole()) return;

    const currentVal = select.value || "all";
    const map = new Map();

    salesRecords.forEach(sale => {
        const uname = sale.cashierUsername || "";
        const label = sale.cashierName || uname || "Staff";
        if (uname && !map.has(uname)) {
            map.set(uname, label);
        } else if (!uname && label && !map.has(label)) {
            map.set(label, label);
        }
    });

    select.innerHTML = '<option value="all">All Cashiers</option>';
    map.forEach((label, key) => {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = label;
        select.appendChild(opt);
    });

    if ([...select.options].some(o => o.value === currentVal)) {
        select.value = currentVal;
    }
}

function getFilteredSalesRecords() {
    const cashierMode = isCashierRole();
    const myUsername = getCurrentUsername();
    const search = (document.getElementById("salesSearch")?.value || "").trim().toLowerCase();
    const dateFilter = document.getElementById("salesDateFilter")?.value || "all";
    const cashierFilter = cashierMode
        ? myUsername
        : (document.getElementById("salesCashierFilter")?.value || "all");

    const now = new Date();
    const weekCutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();

    return salesRecords.filter(function (sale) {
        if (!cashierMode && cashierFilter !== "all") {
            const matchKey = (sale.cashierUsername || sale.cashierName || "").toLowerCase();
            if (matchKey !== cashierFilter.toLowerCase()) return false;
        }

        const d = new Date(sale.timestamp);
        if (dateFilter === "today") {
            if (
                d.getFullYear() !== now.getFullYear() ||
                d.getMonth() !== now.getMonth() ||
                d.getDate() !== now.getDate()
            ) {
                return false;
            }
        } else if (dateFilter === "week") {
            if (sale.timestamp < weekCutoff) return false;
        } else if (dateFilter === "month") {
            if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) {
                return false;
            }
        }

        if (search) {
            const hay = `${sale.receipt} ${sale.medicineName} ${sale.cashierName || ""} ${sale.cashierUsername || ""}`.toLowerCase();
            if (!hay.includes(search)) return false;
        }

        return true;
    });
}

function exportSalesReportCsv() {
    if (isCashierRole()) return;
    const rows = getFilteredSalesRecords();
    const headers = ["Receipt No", "Date", "Cashier", "Username", "Medicine", "Quantity", "Unit Price", "Discount %", "Total", "Status", "Void Reason"];
    const csvLines = [headers.join(",")];

    rows.forEach(r => {
        const line = [
            r.receipt,
            r.date,
            r.cashierName || "Admin",
            r.cashierUsername || "",
            r.medicineName,
            r.quantity,
            Number(r.unitPrice).toFixed(2),
            normalizeDiscountPercent(r.discount),
            Number(r.total).toFixed(2),
            r.status || "COMPLETED",
            r.voidReason || ""
        ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(",");
        csvLines.push(line);
    });

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `epharma-sales-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function initializeSalesPage() {
    const form = document.getElementById("salesForm");

    if (!form || form.dataset.initialized === "true") return;

    form.dataset.initialized = "true";

    const cashierMode = isCashierRole();
    const breadcrumbEl = document.getElementById("salesBreadcrumb");
    const titleEl = document.getElementById("salesPageTitle");
    const subtitleEl = document.getElementById("salesPageSubtitle");
    const posSection = document.getElementById("posCheckoutSection");
    const togglePosBtn = document.getElementById("toggleAdminPosBtn");
    const exportCsvBtn = document.getElementById("exportSalesCsvBtn");
    const cashierFilter = document.getElementById("salesCashierFilter");
    const recordsHeading = document.getElementById("salesRecordsHeading");
    const recordsSubheading = document.getElementById("salesRecordsSubheading");
    const card1Label = document.getElementById("salesSummaryCard1Label");
    const card2Label = document.getElementById("salesSummaryCard2Label");
    const card3Label = document.getElementById("salesSummaryCard3Label");

    if (cashierMode) {
        if (breadcrumbEl) breadcrumbEl.textContent = "Point of Sale / POS & My Sales";
        if (titleEl) titleEl.textContent = "POS Checkout & My Receipts";
        if (subtitleEl) subtitleEl.textContent = "Process customer checkout, print receipts, and view your own transaction history.";
        if (posSection) posSection.hidden = false;
        if (togglePosBtn) togglePosBtn.hidden = true;
        if (exportCsvBtn) exportCsvBtn.hidden = true;
        if (cashierFilter) cashierFilter.hidden = true;
        if (recordsHeading) recordsHeading.textContent = "My Transaction History";
        if (recordsSubheading) recordsSubheading.textContent = "Transactions processed under your cashier account.";
        if (card1Label) card1Label.textContent = "My Sales Total";
        if (card2Label) card2Label.textContent = "My Transactions";
        if (card3Label) card3Label.textContent = "Units Dispensed";
    } else {
        if (breadcrumbEl) breadcrumbEl.textContent = "Reports / Sales Reports";
        if (titleEl) titleEl.textContent = "Sales Reports (All Cashiers)";
        if (subtitleEl) subtitleEl.textContent = "Inspect pharmacy sales performance across all cashiers, filter by period, or open optional POS.";
        if (posSection) posSection.hidden = pendingSaleMedicineId === null;
        if (togglePosBtn) {
            togglePosBtn.hidden = false;
            togglePosBtn.textContent = posSection && !posSection.hidden ? "− Hide Optional POS" : "+ Optional POS Checkout";
        }
        if (exportCsvBtn) exportCsvBtn.hidden = false;
        if (cashierFilter) cashierFilter.hidden = false;
        if (recordsHeading) recordsHeading.textContent = "All Cashier Sales Report";
        if (recordsSubheading) recordsSubheading.textContent = "Filter by cashier, date period, receipt, or medicine.";
        if (card1Label) card1Label.textContent = "Report Revenue";
        if (card2Label) card2Label.textContent = "Transactions";
        if (card3Label) card3Label.textContent = "Units Sold";
    }

    if (togglePosBtn && posSection) {
        togglePosBtn.addEventListener("click", function () {
            posSection.hidden = !posSection.hidden;
            togglePosBtn.textContent = posSection.hidden ? "+ Optional POS Checkout" : "− Hide Optional POS";
        });
    }

    if (exportCsvBtn) {
        exportCsvBtn.addEventListener("click", exportSalesReportCsv);
    }

    const medicineSelect = document.getElementById("salesMedicine");
    const quantityInput = document.getElementById("salesQuantity");
    const discountInput = document.getElementById("salesDiscount");
    const discountPresets = document.getElementById("salesDiscountPresets");
    const customerType = document.getElementById("salesCustomerType");
    const customerName = document.getElementById("salesCustomerName");
    const customerId = document.getElementById("salesCustomerId");
    const cashInput = document.getElementById("salesCashReceived");
    const searchInput = document.getElementById("salesSearch");
    const dateFilterSelect = document.getElementById("salesDateFilter");
    const printBtn = document.getElementById("printReceiptBtn");

    // Cashiers cannot edit medicine pricing/discount rules freely — they use Inventory Default, 0%, or Senior/PWD 20%.
    if (discountInput && cashierMode) {
        discountInput.readOnly = true;
        discountInput.title = "Use the inventory discount or 0%; select customer type separately for Senior/PWD.";
    }

    async function loadSalesMedicines() {
        await loadMedicinesFromDatabase();

        const previousValue = medicineSelect.value;
        medicineSelect.innerHTML =
            '<option value="">Select medicine</option>';

        inventoryMedicines.forEach(function (medicine) {
            const option = document.createElement("option");
            const discount = normalizeDiscountPercent(medicine.discount);
            const finalPrice = calculateDiscountedPrice(medicine.price, discount);

            option.value = String(medicine.id);
            option.textContent =
                medicine.name + (medicine.requiresPrescription ? " [Rx]" : "") +
                " — ₱" + finalPrice.toFixed(2) +
                (discount > 0 ? " (" + discount + "% OFF)" : "") +
                " · Stock: " + medicine.quantity;

            medicineSelect.appendChild(option);
        });

        if (pendingSaleMedicineId !== null) {
            medicineSelect.value = String(pendingSaleMedicineId);
            pendingSaleMedicineId = null;
            if (posSection) posSection.hidden = false;
            applyMedicineDefaultDiscount();
            quantityInput.focus();
        } else if (previousValue) {
            medicineSelect.value = previousValue;
        }
    }

    function applyMedicineDefaultDiscount() {
        const medicine = inventoryMedicines.find(
            item => item.id === Number(medicineSelect.value)
        );
        if (discountInput) {
            discountInput.value = medicine
                ? String(normalizeDiscountPercent(medicine.discount))
                : "0";
        }
    }

    function updateSaleTotal() {
        const medicineId = Number(medicineSelect.value);

        const medicine = inventoryMedicines.find(function (item) {
            return item.id === medicineId;
        });

        const rxField = document.getElementById("rxVerificationField");
        const rxCheck = document.getElementById("salesRxVerified");
        if (rxField) rxField.hidden = !medicine?.requiresPrescription;
        if (rxCheck) rxCheck.required = Boolean(medicine?.requiresPrescription);
        const quantity = Number(quantityInput.value);
        const originalPrice = medicine ? medicine.price : 0;
        const discount = medicine
            ? normalizeDiscountPercent(discountInput ? discountInput.value : medicine.discount)
            : 0;
        const customer = customerType?.value || "regular";
        const selectedPromo = customer === "regular" ? discount : normalizeDiscountPercent(medicine?.discount || 0);
        const finalUnitPrice = medicine && Number.isInteger(quantity) && quantity > 0
            ? window.EPharmaPricing.calculate(originalPrice, quantity, selectedPromo, customer).unitPrice
            : 0;
        const needsCustomer = customer !== "regular";
        document.getElementById("salesCustomerNameField").hidden = !needsCustomer;
        document.getElementById("salesCustomerIdField").hidden = !needsCustomer;
        customerName.required = needsCustomer;
        customerId.required = needsCustomer;

        const total =
            medicine && Number.isInteger(quantity) && quantity > 0
                ? Math.round(finalUnitPrice * quantity * 100) / 100
                : 0;

        const origInput = document.getElementById("salesOriginalPrice");
        if (origInput) {
            origInput.value = "₱" + originalPrice.toFixed(2);
        }

        document.getElementById("salesUnitPrice").value =
            "₱" + finalUnitPrice.toFixed(2);

        document.getElementById("salesTotal").value =
            "₱" + total.toFixed(2);

        const cashValue = cashInput && cashInput.value.trim() !== ""
            ? Number(cashInput.value)
            : null;
        const changeInput = document.getElementById("salesChange");
        if (changeInput) {
            if (cashValue !== null && Number.isFinite(cashValue)) {
                const diff = cashValue - total;
                changeInput.value = diff >= 0
                    ? "₱" + diff.toFixed(2)
                    : "Short ₱" + Math.abs(diff).toFixed(2);
            } else {
                changeInput.value = "₱0.00";
            }
        }

        const stockInfo = document.getElementById("salesStockInfo");
        if (stockInfo) {
            stockInfo.textContent = medicine
                ? "Available stock: " + medicine.quantity +
                  (discount > 0 ? " · Discount applied: " + discount + "%" : "")
                : "";
        }

        quantityInput.max = medicine ? String(medicine.quantity) : "";
    }

    medicineSelect.addEventListener("change", function () {
        applyMedicineDefaultDiscount();
        document.getElementById("salesRxVerified").checked = false;
        updateSaleTotal();
    });
    quantityInput.addEventListener("input", updateSaleTotal);
    customerType.addEventListener("change", updateSaleTotal);
    if (discountInput && !cashierMode) discountInput.addEventListener("input", updateSaleTotal);
    if (cashInput) cashInput.addEventListener("input", updateSaleTotal);

    if (discountPresets && discountInput) {
        discountPresets.addEventListener("click", function (event) {
            const chip = event.target.closest(".discount-chip");
            if (!chip) return;
            if (chip.dataset.discount === "inventory") {
                applyMedicineDefaultDiscount();
            } else {
                discountInput.value = chip.dataset.discount || "0";
            }
            updateSaleTotal();
        });
    }

    if (printBtn) {
        printBtn.addEventListener("click", function () {
            document.body.classList.add("printing-receipt");
            try { window.print(); } finally { document.body.classList.remove("printing-receipt"); }
        });
    }

    form.addEventListener("reset", function () {
        setTimeout(function () {
            if (discountInput) discountInput.value = "0";
            updateSaleTotal();
        }, 0);
    });

    if (searchInput) searchInput.addEventListener("input", renderSalesRecords);
    if (dateFilterSelect) dateFilterSelect.addEventListener("change", renderSalesRecords);
    if (cashierFilter) cashierFilter.addEventListener("change", renderSalesRecords);

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const medicineId = Number(medicineSelect.value);
        const quantity = Number(quantityInput.value);
        const discountRaw = discountInput ? discountInput.value : "0";
        const discountNum = discountRaw === "" ? 0 : Number(discountRaw);

        const medicine = inventoryMedicines.find(function (item) {
            return item.id === medicineId;
        });

        if (!medicine) {
            alert("Please select a medicine.");
            return;
        }

        if (!Number.isInteger(quantity) || quantity < 1) {
            alert("Enter a valid quantity.");
            return;
        }

        if (quantity > medicine.quantity) {
            alert(
                "Insufficient stock. Available quantity: " +
                medicine.quantity
            );
            return;
        }

        if (!Number.isFinite(discountNum) || discountNum < 0 || discountNum > 100) {
            alert("Discount must be between 0% and 100%.");
            return;
        }

        const discount = normalizeDiscountPercent(discountNum);
        const type = customerType.value;
        const name = customerName.value.trim();
        const idNumber = customerId.value.trim();
        if (type !== "regular" && (!name || !idNumber)) {
            alert("Customer name and Senior/PWD ID are required."); return;
        }
        const selectedPromo = type === "regular" ? discount : normalizeDiscountPercent(medicine.discount);
        const computed = window.EPharmaPricing.calculate(medicine.price, quantity, selectedPromo, type);
        const finalUnitPrice = computed.unitPrice;
        const total = computed.total;

        const cashValue = cashInput && cashInput.value.trim() !== ""
            ? Number(cashInput.value)
            : null;
        if (cashValue !== null && (!Number.isFinite(cashValue) || cashValue < total)) {
            alert("Cash received is less than the total amount due (₱" + total.toFixed(2) + ").");
            return;
        }

        const cashierName = getCurrentDisplayName();
        const cashierUsername = getCurrentUsername();

        const confirmed = confirm(
            "Complete this sale?\n\n" +
            "Cashier: " + cashierName +
            "\nMedicine: " + medicine.name +
            "\nQuantity: " + quantity +
            (discount > 0 ? "\nDiscount: " + discount + "%" : "") +
            "\nTotal: ₱" + total.toFixed(2)
        );

        if (!confirmed) return;

        const submitButton = form.querySelector(
            'button[type="submit"]'
        );

        if (submitButton) submitButton.disabled = true;

        try {
            const response = await fetch("/api/sales", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    medicine_id: medicine.id,
                    quantity: quantity,
                    discount_percent: discount,
                    cashier_name: cashierName,
                    cashier_username: cashierUsername,
                    prescription_verified: Boolean(document.getElementById("salesRxVerified")?.checked),
                    discount_type: type,
                    customer_name: name,
                    discount_id_number: idNumber,
                    cash_tendered: cashValue
                })
            });

            const result = await response.json().catch(() => ({}));

            if (isServerDbUnavailable(response, result)) {
                isDemoDatabaseMode = true;
                medicine.quantity = Math.max(0, medicine.quantity - quantity);

                const receiptNo = "EP-" + String(nextReceiptNumber++).padStart(4, "0");
                const now = new Date();
                const dateStr = now.toLocaleString("en-PH");

                salesRecords.unshift({
                    receipt: receiptNo,
                    date: dateStr,
                    timestamp: now.getTime(),
                    cashierUsername,
                    cashierName,
                    medicineName: medicine.name,
                    quantity,
                    originalPrice: medicine.price,
                    discount,
                    unitPrice: finalUnitPrice,
                    total
                });

                recordLocalActivity(
                    "Sales",
                    "Completed Sale",
                    `Receipt ${receiptNo}: ${medicine.name} x${quantity} (₱${total.toFixed(2)})`
                );

                renderPosReceipt({
                    receipt: receiptNo,
                    date: dateStr,
                    cashierName,
                    medicineName: medicine.name,
                    quantity,
                    discount,
                    unitPrice: finalUnitPrice,
                    total,
                    cashTendered: cashValue,
                    changeAmount: cashValue !== null ? Math.max(0, cashValue - total) : 0
                });

                await loadSalesMedicines();
                populateSalesCashierFilter();
                renderSalesRecords();
                form.reset();
                updateSaleTotal();

                showSalesMessage(
                    `Sale completed in preview mode! Receipt ${receiptNo}.`
                );

                if (typeof refreshDashboardStats === "function") {
                    refreshDashboardStats();
                }
                return;
            }

            if (!response.ok) {
                throw new Error(
                    result.message || "Unable to complete sale."
                );
            }

            const receiptNo = "EP-" + String(result.sale_id).padStart(4, "0");
            const nowStr = new Date().toLocaleString("en-PH");

            renderPosReceipt({
                receipt: receiptNo,
                date: nowStr,
                cashierName,
                medicineName: medicine.name,
                quantity,
                discount: Number(result.discount_percent ?? discount),
                unitPrice: Number(result.unit_price ?? finalUnitPrice),
                total: Number(result.total_amount ?? total),
                discountType: result.discount_type,
                customerName: result.customer_name,
                discountId: result.discount_id_number,
                appliedDiscount: result.applied_discount,
                vatExemptSales: result.vat_exempt_sales,
                discountAmount: result.discount_amount,
                cashTendered: cashValue,
                changeAmount: cashValue !== null
                    ? Math.max(0, cashValue - Number(result.total_amount ?? total))
                    : 0
            });

            await loadSalesMedicines();
            await loadSalesRecordsFromDatabase();

            form.reset();
            updateSaleTotal();

            showSalesMessage(
                (result.message || "Sale completed.") + " Receipt: " + receiptNo
            );

            if (typeof refreshDashboardStats === "function") {
                refreshDashboardStats();
            }

            if (typeof renderNotifications === "function") {
                renderNotifications();
            }
        } catch (error) {
            console.error("Sale error:", error);
            showSalesMessage(error.message || "Unable to complete sale.", true);
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });

    await loadSalesMedicines();
    await loadSalesRecordsFromDatabase();
    populateSalesCashierFilter();
    updateSaleTotal();

    renderSalesRecords();
}

function renderSalesRecords() {
    const tbody = document.getElementById("salesRecordsBody");

    if (!tbody) return;

    const filteredRecords = getFilteredSalesRecords();
    const completedRecords = filteredRecords.filter(sale => sale.status !== "VOIDED");
    const totalAmount = completedRecords.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const itemsSold = completedRecords.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);

    const totalEl = document.getElementById("salesTodayTotal");
    const countEl = document.getElementById("salesTransactionCount");
    const unitsEl = document.getElementById("salesItemsSold");

    if (totalEl) totalEl.textContent = "₱" + totalAmount.toFixed(2);
    if (countEl) countEl.textContent = String(completedRecords.length);
    if (unitsEl) unitsEl.textContent = String(itemsSold);

    tbody.innerHTML = "";

    if (filteredRecords.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 9;
        cell.className = "inventory-empty";
        cell.textContent = isCashierRole()
            ? "No transactions found for your account."
            : "No sales records match the current report filters.";

        row.appendChild(cell);
        tbody.appendChild(row);
        return;
    }

    filteredRecords.forEach(function (sale) {
        const row = document.createElement("tr");
        const discount = normalizeDiscountPercent(sale.discount);

        const cellsText = [
            sale.receipt,
            sale.date,
            sale.cashierName || "Admin",
            sale.medicineName,
            String(sale.quantity),
            "₱" + Number(sale.unitPrice).toFixed(2)
        ];

        cellsText.forEach(function (value) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        const discountCell = document.createElement("td");
        const discountBadge = document.createElement("span");
        if (discount > 0) {
            discountBadge.className = "badge discount";
            discountBadge.textContent = discount + "% OFF";
        } else {
            discountBadge.className = "badge neutral";
            discountBadge.textContent = "None";
        }
        discountCell.appendChild(discountBadge);
        row.appendChild(discountCell);

        const totalCell = document.createElement("td");
        const totalStrong = document.createElement("strong");
        totalStrong.textContent = "₱" + Number(sale.total).toFixed(2);
        totalCell.appendChild(totalStrong);
        row.appendChild(totalCell);
        const statusCell = document.createElement("td");
        if (sale.status === "VOIDED") {
            statusCell.textContent = "VOIDED" + (sale.voidReason ? " — " + sale.voidReason : "");
        } else if (!isCashierRole()) {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = "Void Sale";
            button.addEventListener("click", async () => {
                const reason = prompt("Reason for voiding this sale:");
                if (reason === null) return;
                if (!reason.trim()) { showSalesMessage("A void reason is required.", true); return; }
                if (!confirm("Void this sale and restore stock?")) return;
                button.disabled = true;
                try {
                    const response = await fetch(`/api/sales/${encodeURIComponent(sale.saleId)}/void`, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ reason: reason.trim() })
                    });
                    const result = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(result.message || "Unable to void sale.");
                    await loadSalesRecordsFromDatabase();
                    await loadMedicinesFromDatabase();
                    showSalesMessage(result.message);
                } catch (error) { showSalesMessage(error.message, true); button.disabled = false; }
            });
            statusCell.appendChild(button);
        } else statusCell.textContent = "Completed";
        row.appendChild(statusCell);
        tbody.appendChild(row);
    });
}

/* =========================================
   E-PHARMA PURCHASE MANAGEMENT
========================================= */


let purchaseRecords = [];
let nextPurchaseNumber = 1;

async function initializePurchasePage() {
    const form = document.getElementById("purchaseForm");

    if (!form || form.dataset.initialized === "true") return;

    form.dataset.initialized = "true";

    const medicineSelect = document.getElementById("purchaseMedicine");
    const quantityInput = document.getElementById("purchaseQuantity");
    const costInput = document.getElementById("purchaseUnitCost");
    const searchInput = document.getElementById("purchaseSearch");
    const message = document.getElementById("purchaseMessage");

    async function loadPurchaseMedicines() {
        await loadMedicinesFromDatabase();

        medicineSelect.innerHTML =
            '<option value="">Select medicine</option>';

        inventoryMedicines.forEach(function (medicine) {
            const option = document.createElement("option");
            option.value = String(medicine.id);
            option.textContent =
                medicine.name + " (Stock: " + medicine.quantity + ")";
            medicineSelect.appendChild(option);
        });

        if (pendingPurchaseMedicineId !== null) {
            medicineSelect.value = String(pendingPurchaseMedicineId);
            pendingPurchaseMedicineId = null;
            const selectedMed = inventoryMedicines.find(
                item => item.id === Number(medicineSelect.value)
            );
            if (selectedMed) {
                costInput.value = selectedMed.price.toFixed(2);
            }
        }
    }

    function updatePurchaseTotal() {
        const quantity = Number(quantityInput.value);
        const cost = Number(costInput.value);

        const total =
            Number.isInteger(quantity) && quantity > 0 &&
            Number.isFinite(cost) && cost > 0
                ? quantity * cost
                : 0;

        document.getElementById("purchaseTotal").value =
            "₱" + total.toFixed(2);
    }

    medicineSelect.addEventListener("change", function () {
        const medicine = inventoryMedicines.find(function (item) {
            return item.id === Number(medicineSelect.value);
        });

        costInput.value = medicine ? medicine.price.toFixed(2) : "";
        updatePurchaseTotal();
    });

    quantityInput.addEventListener("input", updatePurchaseTotal);
    costInput.addEventListener("input", updatePurchaseTotal);

    form.addEventListener("reset", function () {
        setTimeout(updatePurchaseTotal, 0);
    });

    searchInput.addEventListener("input", renderPurchaseRecords);

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const medicineId = Number(medicineSelect.value);
        const medicine = inventoryMedicines.find(function (item) {
            return item.id === medicineId;
        });

        const supplier = document.getElementById("purchaseSupplier")
            .value.trim();

        const quantity = Number(quantityInput.value);
        const unitCost = Number(costInput.value);

        if (!medicine || !supplier) {
            alert("Please select a medicine and enter the supplier name.");
            return;
        }

        if (
            !Number.isInteger(quantity) || quantity < 1 ||
            !Number.isFinite(unitCost) || unitCost <= 0
        ) {
            alert("Please enter a valid quantity and unit cost.");
            return;
        }

        const total = quantity * unitCost;

        if (!confirm(
            "Save this purchase as Pending?\n\n" +
            "Medicine: " + medicine.name +
            "\nSupplier: " + supplier +
            "\nQuantity: " + quantity +
            "\nTotal Cost: ₱" + total.toFixed(2) +
            "\n\nStock will only increase when marked Received."
        )) {
            return;
        }

        try {
            const response = await fetch("/api/purchases", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    medicine_id: medicine.id,
                    supplier_name: supplier,
                    quantity: quantity,
                    unit_cost: unitCost
                })
            });

            const result = await response.json().catch(() => ({}));

            if (isServerDbUnavailable(response, result)) {
                isDemoDatabaseMode = true;
                const purchaseId = nextPurchaseNumber++;
                const purchaseNo = "PUR-" + String(purchaseId).padStart(4, "0");
                purchaseRecords.unshift({
                    purchaseNo,
                    date: new Date().toLocaleString("en-PH"),
                    medicineId: medicine.id,
                    medicineName: medicine.name,
                    supplier,
                    quantity,
                    unitCost,
                    total,
                    status: "Pending"
                });
                recordLocalActivity("Purchase", "Created Purchase", `${purchaseNo}: ${medicine.name} x${quantity} from ${supplier}`);
                form.reset();
                updatePurchaseTotal();
                renderPurchaseRecords();
                if (message) {
                    message.textContent = "Purchase recorded in local preview mode (mark Received to test stock update).";
                }
                return;
            }

            if (!response.ok) {
                throw new Error(result.message || "Unable to save purchase.");
            }

            await loadPurchaseRecordsFromDatabase();
            form.reset();
            await loadPurchaseMedicines();
            updatePurchaseTotal();

            if (message) {
                message.textContent =
                    result.message + " Purchase ID: " + result.purchase_id;
            }
        } catch (error) {
            console.error("Save purchase error:", error);
            if (message) {
                message.textContent = error.message || "Unable to save purchase.";
                message.style.color = "#B91C1C";
            }
        }
    });

    await loadPurchaseMedicines();
    await loadPurchaseRecordsFromDatabase();
    updatePurchaseTotal();
    initializePurchaseReceiveButton();
    renderPurchaseRecords();
}


function renderPurchaseRecords() {
    const tbody = document.getElementById("purchaseRecordsBody");
    if (!tbody) return;

    const search = (
        document.getElementById("purchaseSearch")?.value || ""
    ).trim().toLowerCase();

    const filtered = purchaseRecords.filter(function (record) {
        return (
            record.medicineName.toLowerCase().includes(search) ||
            record.supplier.toLowerCase().includes(search) ||
            record.purchaseNo.toLowerCase().includes(search)
        );
    });

    document.getElementById("purchaseCount").textContent =
        purchaseRecords.length;

    document.getElementById("purchaseTotalCost").textContent =
        "₱" + purchaseRecords.reduce(function (sum, record) {
            return sum + record.total;
        }, 0).toFixed(2);

    document.getElementById("purchaseUnits").textContent =
        purchaseRecords.reduce(function (sum, record) {
            return sum + record.quantity;
        }, 0);

    tbody.innerHTML = "";

    if (filtered.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 9;
        cell.className = "inventory-empty";
        cell.textContent = "No purchase records found.";

        row.appendChild(cell);
        tbody.appendChild(row);
        return;
    }

    filtered.forEach(function (record) {
        const row = document.createElement("tr");

        const values = [
            record.purchaseNo,
            record.date,
            record.medicineName,
            record.supplier,
            String(record.quantity),
            "₱" + Number(record.unitCost).toFixed(2),
            "₱" + Number(record.total).toFixed(2)
        ];

        values.forEach(function (value) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        const statusCell = document.createElement("td");
        const statusBadge = document.createElement("span");
        const statusText = record.status || "Pending";
        statusBadge.className = "badge " + (statusText === "Received" ? "success" : "warning");
        statusBadge.textContent = statusText;
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);

        const actionCell = document.createElement("td");

        if (statusText === "Pending") {
            const receiveButton = document.createElement("button");

            receiveButton.type = "button";
            receiveButton.className = "primary-btn";
            receiveButton.textContent = "Mark as Received";
            receiveButton.dataset.purchaseId =
                record.purchaseNo.replace("PUR-", "");

            actionCell.appendChild(receiveButton);
        } else {
            actionCell.textContent =
                statusText === "Received" ? "Completed" : statusText;
        }

        row.appendChild(actionCell);
        tbody.appendChild(row);
    });
}
let supplierRecords = [];
let nextSupplierId = 3;

async function initializeSuppliersPage() {
    const form = document.getElementById("supplierForm");
    const addButton = document.getElementById("addSupplierBtn");
    const cancelButton = document.getElementById("cancelSupplierBtn");
    const searchInput = document.getElementById("supplierSearch");
    const tbody = document.getElementById("suppliersBody");

    if (!form || !addButton || !cancelButton || !searchInput || !tbody) {
        console.error("Supplier page elements not found.");
        return;
    }

    // Load suppliers from MySQL (or fallback demo data if DB offline)
    await loadSuppliersFromDatabase();

    // Show Add Supplier form
    addButton.onclick = function (event) {
        event.preventDefault();

        const supplierForm = document.getElementById("supplierForm");
        if (!supplierForm) return;

        supplierForm.reset();
        document.getElementById("supplierId").value = "";
        supplierForm.hidden = false;
        supplierForm.removeAttribute("hidden");
        supplierForm.style.display = "block";
        supplierForm.style.visibility = "visible";
    };

    // Hide form
    cancelButton.onclick = function () {
        form.reset();
        form.style.display = "none";
    };

    // Search suppliers
    searchInput.oninput = function () {
        renderSuppliers();
    };

    // Add or update supplier
    form.onsubmit = async function (event) {
        event.preventDefault();

        const id = document.getElementById("supplierId").value;

        const supplier = {
            supplier_name: document.getElementById("supplierName").value.trim(),
            contact_person: document.getElementById("supplierContact").value.trim(),
            phone: document.getElementById("supplierPhone").value.trim(),
            email: document.getElementById("supplierEmail").value.trim(),
            address: document.getElementById("supplierAddress").value.trim(),
            status: document.getElementById("supplierStatus").value
        };

        if (
            !supplier.supplier_name ||
            !supplier.contact_person ||
            !supplier.phone ||
            !supplier.address
        ) {
            showSupplierMessage("Please complete all required fields.", true);
            return;
        }

        try {
            const response = await fetch(
                id ? `/api/suppliers/${id}` : "/api/suppliers",
                {
                    method: id ? "PUT" : "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(supplier)
                }
            );

            const result = await response.json().catch(() => ({}));

            if (isServerDbUnavailable(response, result)) {
                isDemoDatabaseMode = true;
                if (id) {
                    const existing = supplierRecords.find(s => s.id === Number(id));
                    if (existing) {
                        existing.name = supplier.supplier_name;
                        existing.contact = supplier.contact_person;
                        existing.phone = supplier.phone;
                        existing.email = supplier.email;
                        existing.address = supplier.address;
                        existing.status = supplier.status;
                    }
                    recordLocalActivity("Suppliers", "Updated Supplier", `Updated ${supplier.supplier_name}`);
                } else {
                    supplierRecords.unshift({
                        id: nextSupplierId++,
                        name: supplier.supplier_name,
                        contact: supplier.contact_person,
                        phone: supplier.phone,
                        email: supplier.email,
                        address: supplier.address,
                        status: supplier.status
                    });
                    recordLocalActivity("Suppliers", "Added Supplier", `Added ${supplier.supplier_name}`);
                }
                form.reset();
                form.style.display = "none";
                renderSuppliers();
                showSupplierMessage("Supplier saved in local preview mode.");
                return;
            }

            if (!response.ok) {
                throw new Error(result.message || "Failed to save supplier.");
            }

            // Reload saved records before hiding the form
            await loadSuppliersFromDatabase();

            form.reset();
            form.style.display = "none";

            showSupplierMessage(
                id
                    ? "Supplier updated successfully."
                    : "Supplier added successfully."
            );

        } catch (error) {
            console.error("Save supplier error:", error);

            showSupplierMessage(
                error.message || "Unable to save supplier.",
                true
            );
        }
    };

    // Edit or delete supplier
    tbody.onclick = async function (event) {
        const button = event.target.closest("button");
        if (!button) return;

        const id = Number(button.dataset.id);
        const action = button.dataset.action;

        const supplier = supplierRecords.find(
            item => item.id === id
        );

        if (!supplier) return;

        // Edit supplier
        if (action === "edit") {
            document.getElementById("supplierId").value = supplier.id;
            document.getElementById("supplierName").value = supplier.name;
            document.getElementById("supplierContact").value = supplier.contact;
            document.getElementById("supplierPhone").value = supplier.phone;
            document.getElementById("supplierEmail").value = supplier.email;
            document.getElementById("supplierAddress").value = supplier.address;
            document.getElementById("supplierStatus").value = supplier.status;

            form.hidden = false;
            form.style.display = "block";

            document.getElementById("supplierName").focus();
        }

        // Delete supplier
        if (action === "delete") {
            if (!confirm("Are you sure you want to delete this supplier?")) {
                return;
            }

            try {
                const response = await fetch(`/api/suppliers/${id}`, {
                    method: "DELETE"
                });

                const result = await response.json().catch(() => ({}));

                if (isServerDbUnavailable(response, result)) {
                    isDemoDatabaseMode = true;
                    supplierRecords = supplierRecords.filter(item => item.id !== id);
                    recordLocalActivity("Suppliers", "Deleted Supplier", `Removed ${supplier.name}`);
                    renderSuppliers();
                    showSupplierMessage("Supplier removed in local preview mode.");
                    return;
                }

                if (!response.ok) {
                    throw new Error(result.message || "Failed to delete supplier.");
                }

                await loadSuppliersFromDatabase();
                showSupplierMessage("Supplier deleted successfully.");

            } catch (error) {
                console.error("Delete supplier error:", error);

                showSupplierMessage(
                    error.message ||
                    "Unable to delete supplier. It may be linked to existing purchases.",
                    true
                );
            }
        }
    };
}

async function loadSuppliersFromDatabase() {
    try {
        const response = await fetch("/api/suppliers");
        const rows = await response.json().catch(() => ([]));

        if (isServerDbUnavailable(response, rows)) {
            isDemoDatabaseMode = true;
            renderSuppliers();
            return;
        }

        if (!response.ok) {
            throw new Error("Failed to load suppliers.");
        }

        isDemoDatabaseMode = false;
        supplierRecords = rows.map(row => ({
            id: Number(row.supplier_id),
            name: row.supplier_name || "",
            contact: row.contact_person || "",
            phone: row.phone || "",
            email: row.email || "",
            address: row.address || "",
            status: row.status || "Active"
        }));

        nextSupplierId = supplierRecords.reduce(
            (maxId, supplier) => Math.max(maxId, supplier.id),
            0
        ) + 1;

        renderSuppliers();

    } catch (error) {
        console.error("Load suppliers error:", error);
        renderSuppliers();
        showSupplierMessage("Showing local preview suppliers (MySQL not connected).", false);
    }
}

function renderSuppliers() {
    const tableBody = document.getElementById("suppliersBody");
    if (!tableBody) return;

    const search = (
        document.getElementById("supplierSearch")?.value || ""
    ).toLowerCase();

    const filtered = supplierRecords.filter(supplier =>
        supplier.name.toLowerCase().includes(search) ||
        supplier.contact.toLowerCase().includes(search) ||
        supplier.phone.toLowerCase().includes(search)
    );

    const total = document.getElementById("supplierCount");
    const active = document.getElementById("activeSupplierCount");

    if (total) total.textContent = supplierRecords.length;

    if (active) {
        active.textContent = supplierRecords.filter(
            supplier => supplier.status === "Active"
        ).length;
    }

    if (filtered.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8">No suppliers found.</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = filtered.map(supplier => `
        <tr>
            <td>SUP-${String(supplier.id).padStart(3, "0")}</td>
            <td>${escapeSupplierText(supplier.name)}</td>
            <td>${escapeSupplierText(supplier.contact)}</td>
            <td>${escapeSupplierText(supplier.phone)}</td>
            <td>${escapeSupplierText(supplier.email || "-")}</td>
            <td>${escapeSupplierText(supplier.address)}</td>
            <td>
                <span class="status-badge ${
                    supplier.status === "Active" ? "status-in-stock" : "status-out-of-stock"
                }">${supplier.status}</span>
            </td>
            <td>
                <button type="button" class="secondary-btn"
                    data-action="edit" data-id="${supplier.id}">Edit</button>
                <button type="button" class="danger-btn"
                    data-action="delete" data-id="${supplier.id}">Delete</button>
            </td>
        </tr>
    `).join("");
}

function showSupplierMessage(message, isError = false) {
    const box = document.getElementById("supplierMessage");
    if (!box) return;

    box.textContent = message;
    box.style.color = isError ? "red" : "green";
    box.style.marginBottom = "12px";
}
function escapeSupplierText(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

async function initializeExpirationPage() {
    const search = document.getElementById("expirationSearch");
    const filter = document.getElementById("expirationFilter");

    if (!search || !filter) return;

    search.oninput = renderExpirationMedicines;
    filter.onchange = renderExpirationMedicines;
    const before = document.getElementById("expirationBefore");
    if (before) before.onchange = renderExpirationMedicines;

    await loadMedicinesFromDatabase();
    renderExpirationMedicines();
}

function getExpirationStatus(expiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiry = new Date(expiryDate + "T00:00:00");
    const daysRemaining = Math.ceil(
        (expiry.getTime() - today.getTime()) / 86400000
    );

    let status;

    if (daysRemaining < 0) {
        status = "Expired";
    } else if (daysRemaining <= 90) {
        status = "Expiring Soon";
    } else {
        status = "Safe";
    }

    return { daysRemaining, status };
}

function renderExpirationMedicines() {
    const body = document.getElementById("expirationBody");
    if (!body) return;

    const search = (
        document.getElementById("expirationSearch")?.value || ""
    ).toLowerCase();

    const filter = (
        document.getElementById("expirationFilter")?.value || "All"
    );

    const records = inventoryMedicines.filter(medicine => medicine.expiry).map(medicine => ({
        ...medicine,
        ...getExpirationStatus(medicine.expiry)
    }));

    const total = document.getElementById("expTotalBatches");
    const soon = document.getElementById("expSoonCount");
    const expired = document.getElementById("expExpiredCount");

    if (total) total.textContent = records.length;
    if (soon) {
        soon.textContent = records.filter(
            item => item.status === "Expiring Soon"
        ).length;
    }
    if (expired) {
        expired.textContent = records.filter(
            item => item.status === "Expired"
        ).length;
    }

    const filtered = records.filter(item => {
        const matchesSearch =
            item.name.toLowerCase().includes(search) ||
            (item.batch || "").toLowerCase().includes(search) ||
            (item.shelf || "").toLowerCase().includes(search);

        const matchesFilter =
            filter === "All" || item.status === filter;

        const before = document.getElementById("expirationBefore")?.value || "";
        return matchesSearch && matchesFilter && (!before || item.expiry <= before);
    });

    if (filtered.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="7">No medicines with an expiration date found. Add an expiration date in Inventory.</td>
            </tr>
        `;
        return;
    }

    body.innerHTML = filtered.map(item => {
        let badgeClass = "status-in-stock";

        if (item.status === "Expired") {
            badgeClass = "status-out-of-stock";
        } else if (item.status === "Expiring Soon") {
            badgeClass = "status-low-stock";
        }

        let remainingText;

        if (item.daysRemaining < 0) {
            remainingText = `${Math.abs(item.daysRemaining)} days overdue`;
        } else if (item.daysRemaining === 0) {
            remainingText = "Expires today";
        } else {
            remainingText = `${item.daysRemaining} days`;
        }

        return `
            <tr>
                <td>${escapeSupplierText(item.name)}</td>
                <td>${escapeSupplierText(item.batch || "—")}</td>
                <td>${escapeSupplierText(item.shelf || "Not specified")}</td>
                <td>${item.quantity}</td>
                <td>${new Date(item.expiry + "T00:00:00").toLocaleDateString()}</td>
                <td>${remainingText}</td>
                <td>
                    <span class="status-badge ${badgeClass}">
                        ${item.status}
                    </span>
                </td>
            </tr>
        `;
    }).join("");
}

async function initializeSettingsPage() {
    const pharmacyForm = document.getElementById("pharmacySettingsForm");
    const adminForm = document.getElementById("adminSettingsForm");
    const systemForm = document.getElementById("systemSettingsForm");

    if (!pharmacyForm || !systemForm) return;

    const branding = window.EPharmaBranding;
    if (!branding) {
        console.error("EPharmaBranding helper is not loaded.");
        return;
    }

    const logoInput = document.getElementById("settingPharmacyLogoInput");
    const logoPreview = document.getElementById("settingPharmacyLogoPreview");
    const logoFrame = document.getElementById("settingLogoFrame");
    const resetLogoBtn = document.getElementById("resetPharmacyLogoBtn");
    const brandNamePreview = document.getElementById("settingBrandNamePreview");
    const brandAddressPreview = document.getElementById("settingBrandAddressPreview");
    const fullAddressPreview = document.getElementById("settingPharmacyFullAddressPreview");
    const inlineStatus = document.getElementById("pharmacySettingsStatus");

    const nameInput = document.getElementById("settingPharmacyName");
    const emailInput = document.getElementById("settingPharmacyEmail");
    const phoneInput = document.getElementById("settingPharmacyPhone");
    const streetInput = document.getElementById("settingPharmacyStreet");
    const barangayInput = document.getElementById("settingPharmacyBarangay");
    const cityInput = document.getElementById("settingPharmacyCity");
    const provinceInput = document.getElementById("settingPharmacyProvince");
    const postalInput = document.getElementById("settingPharmacyPostalCode");
    const countryInput = document.getElementById("settingPharmacyCountry");
    const landmarkInput = document.getElementById("settingPharmacyLandmark");

    const adminNameInput = document.getElementById("settingAdminName");
    const adminEmailInput = document.getElementById("settingAdminEmail");
    const cashierNameInput = document.getElementById("settingCashierName");
    const dateFormatInput = document.getElementById("settingDateFormat");
    const lowStockInput = document.getElementById("settingLowStock");

    let pendingLogoValue = "";

    function setInlineStatus(text, isError) {
        if (!inlineStatus) return;
        inlineStatus.textContent = text;
        inlineStatus.style.color = isError ? "#b91c1c" : "#0f766e";
    }

    function updateLogoPreviewUI(logoValue) {
        const hasCustom = Boolean(logoValue);
        if (logoPreview) {
            logoPreview.src = logoValue || branding.DEFAULT_LOGO_PATH;
            logoPreview.alt = `${(nameInput?.value || "").trim() || "Pharmacy"} Logo Preview`;
        }
        if (logoFrame) {
            logoFrame.classList.toggle("has-custom-logo", hasCustom);
        }
        if (resetLogoBtn) {
            resetLogoBtn.disabled = !hasCustom;
        }
    }

    function getAddressValuesFromForm() {
        return {
            addressStreet: streetInput ? streetInput.value.trim() : "",
            addressBarangay: barangayInput ? barangayInput.value.trim() : "",
            addressCity: cityInput ? cityInput.value.trim() : "",
            addressProvince: provinceInput ? provinceInput.value.trim() : "",
            addressPostalCode: postalInput ? postalInput.value.trim() : "",
            addressCountry: countryInput ? countryInput.value.trim() : "",
            addressLandmark: landmarkInput ? landmarkInput.value.trim() : ""
        };
    }

    function updateLivePreviews() {
        const displayName = (nameInput ? nameInput.value.trim() : "") || "E-Pharma";
        const formattedAddress = branding.formatAddress(getAddressValuesFromForm());

        if (brandNamePreview) {
            brandNamePreview.textContent = displayName;
        }
        if (brandAddressPreview) {
            brandAddressPreview.textContent = formattedAddress;
        }
        if (fullAddressPreview) {
            fullAddressPreview.textContent = formattedAddress;
        }
        if (logoPreview) {
            logoPreview.alt = `${displayName} Logo Preview`;
        }
    }

    function populateFields(settings) {
        if (nameInput) nameInput.value = settings.pharmacyName || "E-Pharma";
        if (emailInput) emailInput.value = settings.pharmacyEmail || "";
        if (phoneInput) phoneInput.value = settings.pharmacyPhone || "";
        if (streetInput) streetInput.value = settings.addressStreet || "";
        if (barangayInput) barangayInput.value = settings.addressBarangay || "";
        if (cityInput) cityInput.value = settings.addressCity || "";
        if (provinceInput) provinceInput.value = settings.addressProvince || "";
        if (postalInput) postalInput.value = settings.addressPostalCode || "";
        if (countryInput) countryInput.value = settings.addressCountry || "";
        if (landmarkInput) landmarkInput.value = settings.addressLandmark || "";

        if (adminNameInput) adminNameInput.value = settings.adminName || "Admin";
        if (adminEmailInput) adminEmailInput.value = settings.adminEmail || "";
        if (cashierNameInput) cashierNameInput.value = settings.cashierName || "Cashier";
        if (dateFormatInput) dateFormatInput.value = settings.dateFormat || "MM/DD/YYYY";
        if (lowStockInput) lowStockInput.value = settings.lowStockLevel || 10;

        pendingLogoValue = settings.pharmacyLogo || "";
        updateLogoPreviewUI(pendingLogoValue);
        updateLivePreviews();
    }

    populateFields(branding.getCachedSettings());

    // Refresh from backend if configured on server.
    branding.syncFromServer().then(serverSettings => {
        if (serverSettings && document.getElementById("pharmacySettingsForm")) {
            populateFields(serverSettings);
        }
    });

    [
        nameInput,
        streetInput,
        barangayInput,
        cityInput,
        provinceInput,
        postalInput,
        countryInput,
        landmarkInput
    ].forEach(field => {
        if (field) {
            field.addEventListener("input", updateLivePreviews);
        }
    });

    if (logoInput) {
        logoInput.onchange = async function () {
            const file = logoInput.files && logoInput.files[0];
            if (!file) return;

            try {
                setInlineStatus("Processing logo image...", false);
                const optimizedDataUrl = await branding.processLogoFile(file);
                pendingLogoValue = optimizedDataUrl;
                updateLogoPreviewUI(pendingLogoValue);
                setInlineStatus("Logo selected. Click Save Pharmacy Information to apply.", false);
            } catch (error) {
                setInlineStatus(error.message || "Unable to load selected logo.", true);
                logoInput.value = "";
            }
        };
    }

    if (resetLogoBtn) {
        resetLogoBtn.onclick = function () {
            pendingLogoValue = "";
            if (logoInput) logoInput.value = "";
            updateLogoPreviewUI("");
            setInlineStatus("Default logo selected. Click Save Pharmacy Information to apply.", false);
        };
    }

    pharmacyForm.onsubmit = async function (event) {
        event.preventDefault();

        const pharmacyName = nameInput ? nameInput.value.trim() : "";
        if (!pharmacyName) {
            setInlineStatus("Please enter a pharmacy name.", true);
            showSettingsMessage("Please enter a pharmacy name.", true);
            if (nameInput) nameInput.focus();
            return;
        }

        const addressFields = getAddressValuesFromForm();
        const payload = {
            pharmacyName,
            pharmacyEmail: emailInput ? emailInput.value.trim() : "",
            pharmacyPhone: phoneInput ? phoneInput.value.trim() : "",
            ...addressFields,
            pharmacyAddress: branding.formatAddress(addressFields),
            pharmacyLogo: pendingLogoValue
        };

        const submitBtn = pharmacyForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        try {
            const result = await branding.saveSettings(payload);
            populateFields(result.settings);
            recordLocalActivity("Settings", "Updated Pharmacy Info", `Saved settings for ${pharmacyName}`);
            const msg = result.warning || (result.syncedToServer
                ? "Pharmacy information saved. Logo updated across the app."
                : "Saved in this browser only. Connect to the server to share the logo across devices.");
            setInlineStatus(msg, false);
            showSettingsMessage(msg, false);
        } catch (error) {
            const errMsg = error.message || "Unable to save pharmacy information.";
            setInlineStatus(errMsg, true);
            showSettingsMessage(errMsg, true);
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    };

    if (adminForm) {
        adminForm.onsubmit = async function (event) {
            event.preventDefault();
            const adminName = adminNameInput ? adminNameInput.value.trim() : "";
            const cashierName = cashierNameInput ? cashierNameInput.value.trim() : "Cashier";
            if (!adminName) {
                showSettingsMessage("Please enter the administrator name.", true);
                return;
            }
            if (!cashierName) {
                showSettingsMessage("Please enter the cashier display name.", true);
                return;
            }

            await branding.saveSettings({
                adminName,
                adminEmail: adminEmailInput ? adminEmailInput.value.trim() : "",
                cashierName
            });
            showSettingsMessage("Staff profiles saved.", false);
        };
    }

    systemForm.onsubmit = async function (event) {
        event.preventDefault();
        const lowStock = Number(lowStockInput ? lowStockInput.value : 10);
        if (!Number.isInteger(lowStock) || lowStock < 1) {
            showSettingsMessage("Low stock alert level must be at least 1.", true);
            return;
        }

        await branding.saveSettings({
            dateFormat: dateFormatInput ? dateFormatInput.value : "MM/DD/YYYY",
            lowStockLevel: lowStock
        });
        recordLocalActivity("Settings", "Updated Preferences", `Low stock threshold set to ${lowStock}`);
        showSettingsMessage("System preferences saved.", false);
    };
}

function showSettingsMessage(message, isError) {
    const box = document.getElementById("settingsMessage");
    if (!box) return;

    box.textContent = message;
    box.style.color = isError ? "#b91c1c" : "#0f766e";
}

/* =========================================
   ADMIN: CASHIER MANAGEMENT PAGE
========================================= */

let cashierUsers = [];

function showCashierMessage(text, isError = false) {
    const box = document.getElementById("cashiersMessage");
    if (!box) return;
    box.textContent = text;
    box.style.color = isError ? "#B91C1C" : "#067D70";
}

async function loadUsersForManagement() {
    const branding = window.EPharmaBranding;
    try {
        const response = await fetch("/api/users");
        const rows = await response.json().catch(() => ({}));
        if (isServerDbUnavailable(response, rows)) {
            isDemoDatabaseMode = true;
            cashierUsers = branding ? branding.getDemoUsers() : [];
            renderCashiers();
            return;
        }
        if (!response.ok) {
            throw new Error(rows.message || "Unable to load accounts.");
        }
        cashierUsers = Array.isArray(rows) ? rows : [];
        renderCashiers();
    } catch (error) {
        console.error("Load users error:", error);
        cashierUsers = [];
        renderCashiers();
        showCashierMessage("Unable to load accounts. Check the database connection.", true);
    }
}

function renderCashiers() {
    const tbody = document.getElementById("cashiersBody");
    if (!tbody) return;

    const search = (document.getElementById("cashierSearch")?.value || "").trim().toLowerCase();

    const cashierAccounts = cashierUsers.filter(u => u.role === "cashier");
    const totalEl = document.getElementById("cashierTotalCount");
    const activeEl = document.getElementById("cashierActiveCount");
    const inactiveEl = document.getElementById("cashierInactiveCount");

    if (totalEl) totalEl.textContent = String(cashierUsers.length);
    if (activeEl) activeEl.textContent = String(cashierAccounts.filter(u => u.status === "Active").length);
    if (inactiveEl) inactiveEl.textContent = String(cashierAccounts.filter(u => u.status !== "Active").length);

    const filtered = cashierUsers.filter(u => {
        const hay = `${u.full_name} ${u.username} ${u.email || ""} ${u.role} ${u.status}`.toLowerCase();
        return hay.includes(search);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="inventory-empty">No matching user accounts found.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(u => {
        const isPrimaryAdmin = u.username === "admin";
        const isActive = u.status === "Active";
        const toggleLabel = isActive ? "Deactivate" : "Activate";
        return `
            <tr>
                <td>USR-${String(u.user_id).padStart(3, "0")}</td>
                <td><strong>${escapeSupplierText(u.full_name)}</strong></td>
                <td>${escapeSupplierText(u.username)}</td>
                <td><span class="badge ${u.role === "admin" ? "role-admin" : "role-cashier"}">${escapeSupplierText(u.role)}</span></td>
                <td>${escapeSupplierText(u.email || "-")}</td>
                <td><span class="status-badge ${isActive ? "status-in-stock" : "status-out-of-stock"}">${escapeSupplierText(u.status)}</span></td>
                <td>${u.online ? "Online (recent activity)" : "Offline"}</td>
                <td>
                    <div class="action-buttons">
                        <button type="button" data-cashier-action="edit" data-id="${u.user_id}">Edit</button>
                        ${!isPrimaryAdmin ? `<button type="button" data-cashier-action="toggle" data-id="${u.user_id}">${toggleLabel}</button>` : ""}
                        ${!isPrimaryAdmin && u.role === "cashier" ? `<button type="button" class="delete-button" data-cashier-action="delete" data-id="${u.user_id}">Delete</button>` : ""}
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

async function initializeCashiersPage() {
    if (isCashierRole()) return;

    const form = document.getElementById("cashierForm");
    const panel = document.getElementById("cashierFormPanel");
    const addBtn = document.getElementById("addCashierBtn");
    const cancelBtn = document.getElementById("cancelCashierBtn");
    const searchInput = document.getElementById("cashierSearch");
    const tbody = document.getElementById("cashiersBody");

    if (!form || form.dataset.initialized === "true") return;
    form.dataset.initialized = "true";

    const idField = document.getElementById("cashierUserId");
    const nameField = document.getElementById("cashierFullName");
    const usernameField = document.getElementById("cashierUsername");
    const emailField = document.getElementById("cashierEmail");
    const statusField = document.getElementById("cashierStatus");
    const passwordField = document.getElementById("cashierPassword");
    const passwordLabel = document.getElementById("cashierPasswordLabel");
    const formTitle = document.getElementById("cashierFormTitle");

    function openCashierForm(user = null) {
        form.reset();
        if (user) {
            formTitle.textContent = `Edit Account: ${user.username}`;
            idField.value = String(user.user_id);
            nameField.value = user.full_name || "";
            usernameField.value = user.username || "";
            usernameField.readOnly = true;
            emailField.value = user.email || "";
            statusField.value = user.status || "Active";
            passwordField.required = false;
            passwordField.value = "";
            passwordLabel.textContent = "New Password (leave blank to keep current)";
        } else {
            formTitle.textContent = "Add New Cashier Account";
            idField.value = "";
            usernameField.readOnly = false;
            statusField.value = "Active";
            passwordField.required = true;
            passwordLabel.textContent = "Password * (min 12 characters)";
        }
        panel.hidden = false;
        nameField.focus();
    }

    if (addBtn) addBtn.addEventListener("click", () => openCashierForm(null));
    if (cancelBtn) cancelBtn.addEventListener("click", () => {
        panel.hidden = true;
        form.reset();
    });
    if (searchInput) searchInput.addEventListener("input", renderCashiers);

    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        const editingId = idField.value ? Number(idField.value) : null;
        const fullName = nameField.value.trim();
        const username = usernameField.value.trim().toLowerCase();
        const email = emailField.value.trim();
        const status = statusField.value;
        const password = passwordField.value;

        if (!fullName || !username) {
            showCashierMessage("Full name and username are required.", true);
            return;
        }
        if (!editingId && (!password || password.length < 12)) {
            showCashierMessage("Password must be at least 12 characters.", true);
            return;
        }
        if (editingId && password && password.length < 12) {
            showCashierMessage("New password must be at least 12 characters.", true);
            return;
        }

        const branding = window.EPharmaBranding;
        try {
            const url = editingId ? `/api/users/${editingId}` : "/api/users";
            const payload = {
                full_name: fullName,
                username,
                email,
                role: "cashier",
                status
            };
            if (password) payload.password = password;

            const response = await fetch(url, {
                method: editingId ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const result = await response.json().catch(() => ({}));

            if (isServerDbUnavailable(response, result)) {
                isDemoDatabaseMode = true;
                const demoList = branding ? branding.getDemoUsers() : cashierUsers;
                if (editingId) {
                    const target = demoList.find(u => Number(u.user_id) === editingId);
                    if (target) {
                        target.full_name = fullName;
                        target.email = email;
                        if (target.username !== "admin") target.status = status;
                        if (password) target.password = password;
                    }
                    recordLocalActivity("Cashiers", "Updated Cashier", `Updated ${fullName} (${username}, ${status})`);
                } else {
                    if (demoList.some(u => u.username.toLowerCase() === username)) {
                        showCashierMessage("Username already exists.", true);
                        return;
                    }
                    const nextId = demoList.reduce((m, u) => Math.max(m, Number(u.user_id || 0)), 0) + 1;
                    demoList.push({
                        user_id: nextId,
                        username,
                        password,
                        full_name: fullName,
                        email,
                        role: "cashier",
                        status
                    });
                    recordLocalActivity("Cashiers", "Created Cashier", `Created cashier account ${username} (${fullName})`);
                }
                if (branding) branding.saveDemoUsers(demoList);
                cashierUsers = demoList;
                panel.hidden = true;
                form.reset();
                renderCashiers();
                showCashierMessage("Cashier account saved in preview mode.");
                return;
            }

            if (!response.ok) {
                throw new Error(result.message || "Unable to save cashier account.");
            }

            panel.hidden = true;
            form.reset();
            await loadUsersForManagement();
            showCashierMessage(result.message || "Cashier account saved.");
        } catch (error) {
            showCashierMessage(error.message || "Unable to save cashier account.", true);
        }
    });

    if (tbody) {
        tbody.addEventListener("click", async function (event) {
            const btn = event.target.closest("button[data-cashier-action]");
            if (!btn) return;
            const action = btn.dataset.cashierAction;
            const userId = Number(btn.dataset.id);
            const user = cashierUsers.find(u => Number(u.user_id) === userId);
            if (!user) return;

            const branding = window.EPharmaBranding;

            if (action === "edit") {
                openCashierForm(user);
                return;
            }

            if (action === "toggle") {
                const nextStatus = user.status === "Active" ? "Inactive" : "Active";
                try {
                    const response = await fetch(`/api/users/${userId}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            full_name: user.full_name,
                            email: user.email,
                            status: nextStatus
                        })
                    });
                    const result = await response.json().catch(() => ({}));
                    if (isServerDbUnavailable(response, result)) {
                        const demoList = branding ? branding.getDemoUsers() : cashierUsers;
                        const target = demoList.find(u => Number(u.user_id) === userId);
                        if (target) target.status = nextStatus;
                        if (branding) branding.saveDemoUsers(demoList);
                        cashierUsers = demoList;
                        recordLocalActivity("Cashiers", `${nextStatus === "Active" ? "Activated" : "Deactivated"} Cashier`, `${user.username} is now ${nextStatus}`);
                        renderCashiers();
                        showCashierMessage(`${user.username} is now ${nextStatus}.`);
                        return;
                    }
                    if (!response.ok) throw new Error(result.message || "Unable to update status.");
                    await loadUsersForManagement();
                    showCashierMessage(`${user.username} is now ${nextStatus}.`);
                } catch (err) {
                    showCashierMessage(err.message || "Status update failed.", true);
                }
                return;
            }

            if (action === "delete") {
                if (!confirm(`Delete cashier account "${user.username}" (${user.full_name})?`)) return;
                try {
                    const response = await fetch(`/api/users/${userId}`, { method: "DELETE" });
                    const result = await response.json().catch(() => ({}));
                    if (isServerDbUnavailable(response, result)) {
                        let demoList = branding ? branding.getDemoUsers() : cashierUsers;
                        demoList = demoList.filter(u => Number(u.user_id) !== userId);
                        if (branding) branding.saveDemoUsers(demoList);
                        cashierUsers = demoList;
                        recordLocalActivity("Cashiers", "Deleted Cashier", `Removed ${user.username} (${user.full_name})`);
                        renderCashiers();
                        showCashierMessage(`Deleted ${user.username} (preview mode).`);
                        return;
                    }
                    if (!response.ok) throw new Error(result.message || "Unable to delete cashier.");
                    await loadUsersForManagement();
                    showCashierMessage(result.message || "Cashier deleted.");
                } catch (err) {
                    showCashierMessage(err.message || "Delete failed.", true);
                }
            }
        });
    }

    await loadUsersForManagement();
}

/* =========================================
   ADMIN: ACTIVITY LOGS PAGE
========================================= */

function renderActivityLogs() {
    const tbody = document.getElementById("activityLogsBody");
    if (!tbody) return;

    const search = (document.getElementById("logsSearch")?.value || "").trim().toLowerCase();
    const roleFilter = document.getElementById("logsRoleFilter")?.value || "all";
    const moduleFilter = document.getElementById("logsModuleFilter")?.value || "all";

    const totalEl = document.getElementById("logTotalCount");
    const adminEl = document.getElementById("logAdminCount");
    const cashierEl = document.getElementById("logCashierCount");

    if (totalEl) totalEl.textContent = String(activityLogs.length);
    if (adminEl) adminEl.textContent = String(activityLogs.filter(l => l.role === "admin").length);
    if (cashierEl) cashierEl.textContent = String(activityLogs.filter(l => l.role === "cashier").length);

    const filtered = activityLogs.filter(log => {
        if (roleFilter !== "all" && log.role !== roleFilter) return false;
        if (moduleFilter !== "all" && log.module !== moduleFilter) return false;
        if (search) {
            const hay = `${log.username} ${log.actor_name} ${log.module} ${log.action} ${log.details}`.toLowerCase();
            if (!hay.includes(search)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="inventory-empty">No activity log entries found.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(log => {
        const dt = new Date(log.created_at).toLocaleString("en-PH");
        return `
            <tr>
                <td>${escapeSupplierText(dt)}</td>
                <td><strong>${escapeSupplierText(log.actor_name || log.username)}</strong><small>${escapeSupplierText(log.username)}</small></td>
                <td><span class="badge ${log.role === "admin" ? "role-admin" : "role-cashier"}">${escapeSupplierText(log.role)}</span></td>
                <td>${escapeSupplierText(log.module)}</td>
                <td><strong>${escapeSupplierText(log.action)}</strong></td>
                <td>${escapeSupplierText(log.details || "-")}</td>
            </tr>
        `;
    }).join("");
}

async function initializeActivityLogsPage() {
    if (isCashierRole()) return;

    const searchInput = document.getElementById("logsSearch");
    const roleFilter = document.getElementById("logsRoleFilter");
    const moduleFilter = document.getElementById("logsModuleFilter");

    if (searchInput && searchInput.dataset.initialized !== "true") {
        searchInput.dataset.initialized = "true";
        searchInput.addEventListener("input", renderActivityLogs);
    }
    if (roleFilter && roleFilter.dataset.initialized !== "true") {
        roleFilter.dataset.initialized = "true";
        roleFilter.addEventListener("change", renderActivityLogs);
    }
    if (moduleFilter && moduleFilter.dataset.initialized !== "true") {
        moduleFilter.dataset.initialized = "true";
        moduleFilter.addEventListener("change", renderActivityLogs);
    }

    try {
        const response = await fetch("/api/activity-logs?limit=150");
        const rows = await response.json().catch(() => ({}));
        if (!isServerDbUnavailable(response, rows) && response.ok && Array.isArray(rows)) {
            activityLogs = rows;
        }
    } catch {
        // Keep local preview activityLogs.
    }

    renderActivityLogs();
}

/* =========================================
   SHARED: MY ACCOUNT PAGE (ADMIN & CASHIER)
========================================= */

function initializeAccountPage() {
    const profileForm = document.getElementById("accountProfileForm");
    const passwordForm = document.getElementById("accountPasswordForm");
    if (!profileForm || !passwordForm) return;

    const session = getCurrentSession();
    const branding = window.EPharmaBranding;
    const usernameInput = document.getElementById("accountUsername");
    const fullNameInput = document.getElementById("accountFullName");
    const emailInput = document.getElementById("accountEmail");
    const roleBadge = document.getElementById("accountRoleBadge");
    const profileMsg = document.getElementById("accountProfileMessage");
    const passwordMsg = document.getElementById("accountPasswordMessage");

    if (usernameInput) usernameInput.value = session.username || "";
    if (fullNameInput) fullNameInput.value = session.fullName || getCurrentDisplayName();
    if (emailInput) emailInput.value = session.email || "";
    if (roleBadge) {
        const isCashier = session.role === "cashier";
        roleBadge.textContent = isCashier ? "Cashier" : "Admin";
        roleBadge.className = "role-badge " + (isCashier ? "role-badge--cashier" : "role-badge--admin");
    }

    function setMsg(el, text, isError) {
        if (!el) return;
        el.textContent = text;
        el.style.color = isError ? "#B91C1C" : "#067D70";
    }

    profileForm.onsubmit = async function (event) {
        event.preventDefault();
        const fullName = fullNameInput ? fullNameInput.value.trim() : "";
        const email = emailInput ? emailInput.value.trim() : "";
        if (!fullName) {
            setMsg(profileMsg, "Full name is required.", true);
            return;
        }

        try {
            const response = await fetch("/api/account/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: session.username,
                    full_name: fullName,
                    email
                })
            });
            const result = await response.json().catch(() => ({}));

            if (isServerDbUnavailable(response, result)) {
                isDemoDatabaseMode = true;
                if (branding) {
                    const demoUsers = branding.getDemoUsers();
                    const user = demoUsers.find(u => u.username.toLowerCase() === String(session.username).toLowerCase());
                    if (user) {
                        user.full_name = fullName;
                        user.email = email;
                        branding.saveDemoUsers(demoUsers);
                    }
                    branding.setActiveSession({
                        ...session,
                        fullName,
                        email
                    });
                    branding.applyBranding();
                }
                recordLocalActivity("Account", "Updated Profile", `Updated profile name to ${fullName}`);
                setMsg(profileMsg, "Profile updated in preview mode.", false);
                return;
            }

            if (!response.ok) {
                throw new Error(result.message || "Unable to update profile.");
            }

            if (branding && result.user) {
                branding.setActiveSession({
                    ...session,
                    fullName: result.user.fullName || result.user.full_name,
                    email: result.user.email || ""
                });
                branding.applyBranding();
            }
            setMsg(profileMsg, result.message || "Profile updated successfully.", false);
        } catch (err) {
            setMsg(profileMsg, err.message || "Profile update failed.", true);
        }
    };

    passwordForm.onsubmit = async function (event) {
        event.preventDefault();
        const currentPassword = document.getElementById("accountCurrentPassword")?.value || "";
        const newPassword = document.getElementById("accountNewPassword")?.value || "";
        const confirmPassword = document.getElementById("accountConfirmPassword")?.value || "";

        if (!currentPassword || !newPassword) {
            setMsg(passwordMsg, "Please fill out all password fields.", true);
            return;
        }
        if (newPassword.length < 12) {
            setMsg(passwordMsg, "New password must be at least 12 characters.", true);
            return;
        }
        if (newPassword !== confirmPassword) {
            setMsg(passwordMsg, "New passwords do not match.", true);
            return;
        }

        try {
            const response = await fetch("/api/account/password", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: session.username,
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });
            const result = await response.json().catch(() => ({}));

            if (isServerDbUnavailable(response, result)) {
                isDemoDatabaseMode = true;
                if (branding) {
                    const demoUsers = branding.getDemoUsers();
                    const user = demoUsers.find(u => u.username.toLowerCase() === String(session.username).toLowerCase());
                    if (!user || user.password !== currentPassword) {
                        setMsg(passwordMsg, "Current password is incorrect.", true);
                        return;
                    }
                    user.password = newPassword;
                    branding.saveDemoUsers(demoUsers);
                }
                passwordForm.reset();
                recordLocalActivity("Account", "Changed Password", `Password updated for ${session.username}`);
                setMsg(passwordMsg, "Password updated in preview mode.", false);
                return;
            }

            if (!response.ok) {
                throw new Error(result.message || "Unable to change password.");
            }

            passwordForm.reset();
            if (branding) branding.clearActiveSession();
            alert("Password changed. Please sign in again.");
            window.location.href = "index.html";
        } catch (err) {
            setMsg(passwordMsg, err.message || "Password update failed.", true);
        }
    };
}

let notificationReadState = {};

function initializeNotifications() {
    const button = document.getElementById("notificationButton");
    const panel = document.getElementById("notificationPanel");
    const markReadButton = document.getElementById("markNotificationsRead");

    if (!button || !panel || !markReadButton) return;

    button.onclick = function (event) {
        event.stopPropagation();

        panel.hidden = !panel.hidden;
        button.setAttribute("aria-expanded", String(!panel.hidden));

        if (!panel.hidden) {
            renderNotifications();
        }
    };

    panel.onclick = function (event) {
        event.stopPropagation();
    };

    document.addEventListener("click", function () {
        panel.hidden = true;
    });

    markReadButton.onclick = function () {
        getNotifications().forEach(item => {
            notificationReadState[item.id] = true;
        });

        renderNotifications();
    };

    renderNotifications();
}

function getNotifications() {
    const notifications = [];

    // Check current inventory quantities.
    if (typeof inventoryMedicines !== "undefined") {
        inventoryMedicines.forEach(medicine => {
            if (Number(medicine.quantity) <= 0) {
                notifications.push({
                    id: `stock-${medicine.id}`,
                    title: "Out of Stock",
                    message: `${medicine.name} has no stock remaining.`,
                    type: "stock"
                });
            } else if (
                Number(medicine.quantity) <= Number(medicine.reorderLevel)
            ) {
                notifications.push({
                    id: `stock-${medicine.id}`,
                    title: "Low Stock Alert",
                    message: `${medicine.name} has only ${medicine.quantity} units left.`,
                    type: "stock"
                });
            }
        });
    }

    // Check expiration records when available.
    if (Array.isArray(inventoryMedicines)) {
        inventoryMedicines.filter(medicine => medicine.expiry).forEach(medicine => {
            const result = getExpirationStatus(medicine.expiry);

            if (result.status === "Expired") {
                notifications.push({
                    id: `expired-${medicine.batch}`,
                    title: "Expired Medicine",
                    message: `${medicine.name} (${medicine.batch}) has expired.`,
                    type: "expiry"
                });
            } else if (result.status === "Expiring Soon") {
                notifications.push({
                    id: `expiring-${medicine.batch}`,
                    title: "Expiring Soon",
                    message: `${medicine.name} expires in ${result.daysRemaining} days.`,
                    type: "expiry"
                });
            }
        });
    }

    return notifications;
}

function renderNotifications() {
    const count = document.getElementById("notificationCount");
    const list = document.getElementById("notificationList");

    if (!count || !list) return;

    const notifications = getNotifications();
    const unreadCount = notifications.filter(
        item => !notificationReadState[item.id]
    ).length;

    const stockAlerts = notifications.filter(item => item.type === "stock").length;
    const expiryAlerts = notifications.filter(item => item.type === "expiry").length;
    const button = document.getElementById("notificationButton");
    if (button) button.setAttribute("aria-label", `Alerts: ${stockAlerts} low or out of stock, ${expiryAlerts} near-expiry or expired`);
    const alertCount = notifications.length;
    count.textContent = alertCount > 99 ? "99+" : String(alertCount);
    count.style.display = alertCount > 0 ? "inline-flex" : "none";
    count.title = `${stockAlerts} stock alerts, ${expiryAlerts} expiration alerts (${unreadCount} unread)`;

    if (notifications.length === 0) {
        list.innerHTML = `
            <div class="notification-empty">
                <p>No alerts right now.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = notifications.map(item => `
        <div class="notification-item ${
            notificationReadState[item.id] ? "" : "unread"
        }">
            <strong>${escapeSupplierText(item.title)}</strong>
            <p>${escapeSupplierText(item.message)}</p>
        </div>
    `).join("");
}

// Refresh the notification count when changing pages.
const originalShowPageForNotifications =
    typeof showPage === "function" ? showPage : null;

if (originalShowPageForNotifications) {
    // Keep the existing navigation function and refresh alerts afterward.
    showPage = function (pageName) {
        originalShowPageForNotifications(pageName);
        renderNotifications();
    };
}

initializeNotifications();



function refreshDashboardStats() {
    applyDashboardRoleView();

    const cashierMode = isCashierRole();
    const myUsername = getCurrentUsername().toLowerCase();
    const totalMedicinesElement = document.getElementById("totalMedicines");
    const lowStockElement = document.getElementById("lowStock");
    const totalSalesElement = document.getElementById("totalSales");
    const expiringSoonElement = document.getElementById("expiringSoon");

    if (typeof inventoryMedicines !== "undefined") {
        const availableCount = cashierMode
            ? inventoryMedicines.filter(m => Number(m.quantity) > 0).length
            : inventoryMedicines.length;

        const lowStockMedicines = inventoryMedicines.filter(medicine =>
            Number(medicine.quantity) <= Number(medicine.reorderLevel)
        );

        if (totalMedicinesElement) {
            totalMedicinesElement.textContent = String(availableCount);
        }

        if (lowStockElement) {
            lowStockElement.textContent = String(lowStockMedicines.length);
        }

        const lowStockBody = document.querySelector("#lowStockTable tbody");
        if (lowStockBody) {
            if (lowStockMedicines.length === 0) {
                lowStockBody.innerHTML = '<tr><td colspan="3" class="inventory-empty">All medicines are adequately stocked.</td></tr>';
            } else {
                lowStockBody.innerHTML = lowStockMedicines.slice(0, 5).map(med => `
                    <tr>
                        <td>
                            <strong>${escapeSupplierText(med.name)}</strong>
                            <small>${escapeSupplierText(med.category || "Medicine")}</small>
                        </td>
                        <td>${med.quantity}</td>
                        <td>
                            <span class="badge ${med.quantity === 0 ? "danger" : "warning"}">
                                ${med.quantity === 0 ? "Out" : "Low"}
                            </span>
                        </td>
                    </tr>
                `).join("");
            }
        }
    }

    if (typeof salesRecords !== "undefined") {
        const now = new Date();
        const completedSales = salesRecords.filter(s => s.status !== "VOIDED");
        // Cashier data is already restricted to their account by the server.
        const visibleSales = completedSales;

        if (totalSalesElement) {
            if (cashierMode) {
                const myTodayCount = visibleSales.filter(s => {
                    const d = new Date(s.timestamp);
                    return d.getFullYear() === now.getFullYear() &&
                        d.getMonth() === now.getMonth() &&
                        d.getDate() === now.getDate();
                }).length;
                totalSalesElement.textContent = String(myTodayCount);

                const shiftNote = document.getElementById("cashierShiftSummaryNote");
                if (shiftNote) {
                    shiftNote.textContent = `You have completed ${myTodayCount} transaction${myTodayCount === 1 ? "" : "s"} today (${visibleSales.length} total on record).`;
                }
            } else {
                const salesTotalSum = completedSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
                totalSalesElement.textContent = "₱" + salesTotalSum.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            }
        }

        const recentSalesBody = document.querySelector("#recentSalesTable tbody");
        if (recentSalesBody) {
            if (visibleSales.length === 0) {
                recentSalesBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="inventory-empty">
                            ${cashierMode ? "No transactions recorded by your account yet." : "No recent sales recorded yet."}
                        </td>
                    </tr>
                `;
            } else {
                recentSalesBody.innerHTML = visibleSales.slice(0, 5).map(sale => `
                    <tr>
                        <td>${escapeSupplierText(sale.receipt)}</td>
                        <td>${escapeSupplierText(sale.date)}</td>
                        <td>${escapeSupplierText(sale.cashierName || sale.cashierUsername || "Staff")}</td>
                        <td>${sale.quantity} item${sale.quantity === 1 ? "" : "s"} (${escapeSupplierText(sale.medicineName)})</td>
                        <td>₱${Number(sale.total).toFixed(2)}</td>
                        <td><span class="badge success">Completed</span></td>
                    </tr>
                `).join("");
            }
        }

        if (!cashierMode) {
            renderSalesOverviewChart();
        }
    }

    if (expiringSoonElement) {
        const expAlerts = inventoryMedicines.filter(med => {
            if (!med.expiry) return false;
            const st = getExpirationStatus(med.expiry).status;
            return st === "Expired" || st === "Expiring Soon";
        }).length;
        expiringSoonElement.textContent = String(expAlerts);
    }

    renderNotifications();
}


async function loadMedicinesFromDatabase() {
    try {
        const response = await fetch("/api/medicines");
        const rows = await response.json().catch(() => ({}));

        if (isServerDbUnavailable(response, rows)) {
            isDemoDatabaseMode = true;
            renderInventory();
            if (typeof refreshDashboardStats === "function") {
                refreshDashboardStats();
            }
            return;
        }

        if (!response.ok) {
            throw new Error("Failed to load medicines from MySQL.");
        }

        isDemoDatabaseMode = false;
        inventoryMedicines = rows.map(function (row) {
            return {
                id: Number(row.medicine_id),
                name: row.medicine_name,
                category: row.category || "",
                price: Number(row.price),
                discount: normalizeDiscountPercent(row.discount_percent),
                quantity: Number(row.quantity),
                reorderLevel: Number(row.reorder_level),
                batch: row.batch_number || "",
                expiry: row.expiry_date ? String(row.expiry_date).slice(0, 10) : "",
                shelf: row.shelf_location || "",
                requiresPrescription: Number(row.requires_prescription) === 1
            };
        });

        nextMedicineId = Math.max(
            0,
            ...inventoryMedicines.map(function (medicine) {
                return medicine.id;
            })
        ) + 1;

        renderInventory();

        if (typeof refreshDashboardStats === "function") {
            refreshDashboardStats();
        }
    } catch (error) {
        console.error("Load medicines error:", error);
        renderInventory();
        showInventoryMessage(
            "Unable to load inventory. Reconnect MySQL and try again."
        );
    }
}


async function loadSalesRecordsFromDatabase() {
    try {
        const query = isCashierRole()
            ? `/api/sales?cashier_username=${encodeURIComponent(getCurrentUsername())}`
            : "/api/sales";
        const response = await fetch(query);
        const rows = await response.json().catch(() => ({}));

        if (isServerDbUnavailable(response, rows)) {
            isDemoDatabaseMode = true;
            populateSalesCashierFilter();
            renderSalesRecords();
            if (typeof refreshDashboardStats === "function") {
                refreshDashboardStats();
            }
            return;
        }

        if (!response.ok) {
            throw new Error("Unable to load sales history.");
        }

        isDemoDatabaseMode = false;
        salesRecords = rows.map(function (row) {
            return {
                saleId: Number(row.sale_id),
                status: row.status || "COMPLETED",
                cashierId: row.cashier_id,
                voidReason: row.void_reason || "",
                receipt: "EP-" +
                    String(row.sale_id).padStart(4, "0"),
                date: new Date(row.sale_date).toLocaleString("en-PH"),
                timestamp: new Date(row.sale_date).getTime(),
                cashierUsername: row.cashier_username || "",
                cashierName: row.cashier_name || "Admin",
                medicineName: row.medicine_name,
                quantity: Number(row.quantity),
                originalPrice: Number(row.original_price || row.unit_price),
                discount: normalizeDiscountPercent(row.discount_percent),
                unitPrice: Number(row.unit_price),
                total: Number(row.subtotal)
            };
        });

        nextReceiptNumber = salesRecords.reduce(
            function (max, sale) {
                const number = Number(sale.receipt.replace("EP-", ""));
                return Math.max(max, number + 1);
            },
            1
        );

        populateSalesCashierFilter();
        renderSalesRecords();
        if (typeof refreshDashboardStats === "function") {
            refreshDashboardStats();
        }
    } catch (error) {
        console.error("Load sales error:", error);
        populateSalesCashierFilter();
        renderSalesRecords();
    }
}

async function loadPurchaseRecordsFromDatabase() {
    try {
        const response = await fetch("/api/purchases");
        const rows = await response.json().catch(() => ({}));

        if (isServerDbUnavailable(response, rows)) {
            isDemoDatabaseMode = true;
            renderPurchaseRecords();
            return;
        }

        if (!response.ok) {
            throw new Error("Unable to load purchase records.");
        }

        isDemoDatabaseMode = false;
        purchaseRecords = rows.map(function (row) {
            return {
                purchaseNo: "PUR-" +
                    String(row.purchase_id).padStart(4, "0"),
                date: new Date(row.purchase_date).toLocaleString("en-PH"),
                medicineId: Number(row.medicine_id),
                medicineName: row.medicine_name,
                supplier: row.supplier_name || "Unknown",
                quantity: Number(row.quantity),
                unitCost: Number(row.unit_cost),
                total: Number(row.subtotal),
                status: row.status
            };
        });

        nextPurchaseNumber = purchaseRecords.reduce(
            function (max, purchase) {
                const number = Number(
                    purchase.purchaseNo.replace("PUR-", "")
                );
                return Math.max(max, number + 1);
            },
            1
        );

        renderPurchaseRecords();
    } catch (error) {
        console.error("Load purchases error:", error);
        renderPurchaseRecords();
    }
}

function initializePurchaseReceiveButton() {
    const tbody = document.getElementById("purchaseRecordsBody");

    if (!tbody || tbody.dataset.receiveInitialized === "true") return;

    tbody.dataset.receiveInitialized = "true";

    tbody.addEventListener("click", async function (event) {
        const button = event.target.closest("button[data-purchase-id]");
        if (!button) return;

        const purchaseId = button.dataset.purchaseId;

        if (!confirm(
            "Mark this purchase as Received?\n\n" +
            "The medicine stock will increase."
        )) {
            return;
        }

        button.disabled = true;
        button.textContent = "Processing...";

        try {
            const response = await fetch(
                `/api/purchases/${encodeURIComponent(purchaseId)}/receive`,
                { method: "PATCH" }
            );

            const result = await response.json().catch(() => ({}));

            if (isServerDbUnavailable(response, result)) {
                isDemoDatabaseMode = true;
                const record = purchaseRecords.find(
                    item => item.purchaseNo.replace("PUR-", "") === String(purchaseId)
                );
                if (record && record.status === "Pending") {
                    record.status = "Received";
                    const med = inventoryMedicines.find(m => m.id === record.medicineId);
                    if (med) {
                        med.quantity += record.quantity;
                    }
                    recordLocalActivity("Purchase", "Received Purchase", `${record.purchaseNo}: +${record.quantity} ${record.medicineName}`);
                }
                renderPurchaseRecords();
                refreshDashboardStats();

                const message = document.getElementById("purchaseMessage");
                if (message) {
                    message.textContent = "Purchase marked Received in local preview mode; stock updated.";
                }
                return;
            }

            if (!response.ok) {
                throw new Error(
                    result.message || "Unable to receive purchase."
                );
            }

            await loadPurchaseRecordsFromDatabase();
            await loadMedicinesFromDatabase();

            const message = document.getElementById("purchaseMessage");

            if (message) {
                message.textContent = result.message;
            }

        } catch (error) {
            console.error("Receive purchase error:", error);
            alert(error.message);
            button.disabled = false;
            button.textContent = "Mark as Received";
        }
    });
}

// POS-only keyboard navigation. Do not hijack typing in form controls.
document.addEventListener("keydown", function (event) {
    const salesForm = document.getElementById("salesForm");
    if (!salesForm) return;
    const typing = event.target && (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName));
    if ((event.key === "F2" || (event.altKey && event.key.toLowerCase() === "s")) && !typing) {
        const medicine = document.getElementById("salesMedicine");
        if (medicine && !document.getElementById("posCheckoutSection")?.hidden) {
            event.preventDefault();
            medicine.focus();
        }
    }
    if (event.key === "Escape" && !typing) {
        const panel = document.getElementById("notificationPanel");
        if (panel && !panel.hidden) panel.hidden = true;
    }
});

// =========================================
// INITIAL ROLE & ROUTE STARTUP
// =========================================

(async function bootRoleAndInitialPage() {
    try {
        const response = await fetch("/api/auth/session");
        if (!response.ok) throw new Error("Session unavailable");
        const data = await response.json();
        if (!data.user) throw new Error("Session unavailable");
        window.EPharmaBranding.setActiveSession(data.user);
    } catch {
        window.location.href = "index.html";
        return;
    }
    applyRoleAccessControl();

    const hashPage = (window.location.hash || "").replace(/^#/, "").trim();
    const startPage = hashPage && canAccessPage(hashPage)
        ? hashPage
        : "dashboard";

    if (startPage !== "dashboard") {
        showPage(startPage);
    } else {
        initializeDashboard();
        refreshDashboardStats();
        loadMedicinesFromDatabase();
        loadSalesRecordsFromDatabase();
    }
})();


