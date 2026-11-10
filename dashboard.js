
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
// 4. SALES CHART SAMPLE DATA
// =========================================

const chartData = {
    month: {
        total: "₱25,430",
        bars: [30, 45, 38, 62, 55, 78, 90]
    },

    week: {
        total: "₱6,820",
        bars: [35, 60, 45, 80, 55, 72, 95]
    }
};

function initializeDashboard() {
    updateDate();

    const salesPeriod = document.getElementById("salesPeriod");

    if (salesPeriod && salesPeriod.dataset.initialized !== "true") {
        salesPeriod.dataset.initialized = "true";

        salesPeriod.addEventListener("change", function () {
            const selected = chartData[salesPeriod.value];

            if (!selected) return;

            const chartTotal = document.getElementById("chartTotal");

            if (chartTotal) {
                chartTotal.textContent = selected.total;
            }

            document.querySelectorAll("#salesChart .bar")
                .forEach(function (bar, index) {
                    if (selected.bars[index] !== undefined) {
                        bar.style.height = selected.bars[index] + "%";
                    }
                });
        });
    }
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
    });
}


// =========================================
// 6. NOTIFICATIONS
// =========================================

if (notificationButton) {
    notificationButton.addEventListener("click", function () {
        const brandName = (window.EPharmaBranding
            ? window.EPharmaBranding.getCachedSettings().pharmacyName
            : "E-Pharma").toUpperCase();
        alert(
            brandName + " NOTIFICATIONS\n\n" +
            "• Check medicines with low stock.\n" +
            "• Review medicines nearing expiration.\n\n" +
            "Sample notifications only."
        );
    });
}


// =========================================
// 7. LOGOUT
// =========================================

if (logoutButton) {
    logoutButton.addEventListener("click", function () {
        const confirmed = confirm("Are you sure you want to log out?");

        if (confirmed) {
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
                    Manage medicine stock, types, prices, and reorder levels.
                </p>
            </div>
        </section>

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
                            <th>Category / Type</th>
                            <th>Price</th>
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
                    <p>Enter the medicine details below.</p>
                </div>
            </div>

            <form class="inventory-form" id="medicineForm">

                <input type="hidden" id="medicineId">

                <div class="form-field">
                    <label for="medicineName">Medicine Name *</label>
                    <input id="medicineName"
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
                           required>
                </div>

                <div class="form-field">
                    <label for="medicineQuantity">Quantity *</label>
                    <input type="number"
                           id="medicineQuantity"
                           min="0"
                           step="1"
                           required>
                </div>

                <div class="form-field">
                    <label for="medicineReorder">Reorder Level *</label>
                    <input type="number"
                           id="medicineReorder"
                           min="0"
                           step="1"
                           required>
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
            <p class="breadcrumb">Main Menu / Sales</p>
            <h1>Sales Management</h1>
            <p class="subtitle">Process medicine sales and manage transaction records.</p>
        </div>
    </section>

    <section class="inventory-summary">
        <article class="inventory-summary-card">
            <p>Today's Sales</p>
            <h3 id="salesTodayTotal">₱0.00</h3>
        </article>
        <article class="inventory-summary-card">
            <p>Transactions</p>
            <h3 id="salesTransactionCount">0</h3>
        </article>
        <article class="inventory-summary-card">
            <p>Medicines Sold</p>
            <h3 id="salesItemsSold">0</h3>
        </article>
    </section>

    <section class="panel">
        <div class="panel-heading">
            <div>
                <h3>New Sale</h3>
                <p>Select a medicine and enter the quantity.</p>
            </div>
        </div>

        <form id="salesForm" class="inventory-form">
            <div class="form-field form-full">
                <label for="salesMedicine">Medicine *</label>
                <select id="salesMedicine" required>
                    <option value="">Select medicine</option>
                </select>
            </div>

            <div class="form-field">
                <label for="salesQuantity">Quantity *</label>
                <input type="number" id="salesQuantity"
                       min="1" step="1" value="1" required>
                <small id="salesStockInfo"></small>
            </div>

            <div class="form-field">
                <label for="salesUnitPrice">Unit Price</label>
                <input type="text" id="salesUnitPrice"
                       value="₱0.00" readonly>
            </div>

            <div class="form-field form-full">
                <label for="salesTotal">Total Amount</label>
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
    </section>

    <section class="panel">
        <div class="panel-heading">
            <div>
                <h3>Sales Records</h3>
                <p>Completed transactions in this demo session.</p>
            </div>
        </div>

        <div class="inventory-toolbar">
            <input type="search" id="salesSearch"
                   class="inventory-search"
                   placeholder="Search receipt or medicine..."
                   aria-label="Search sales records">
        </div>

        <div class="table-wrapper">
            <table class="inventory-table">
                <thead>
                    <tr>
                        <th>Receipt No.</th>
                        <th>Date & Time</th>
                        <th>Medicine</th>
                        <th>Quantity</th>
                        <th>Unit Price</th>
                        <th>Total</th>
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
                        <th>Status</th>
                        <th>Actions</th>
                        <th>Purchase No.</th>
                        <th>Date</th>
                        <th>Medicine</th>
                        <th>Supplier</th>
                        <th>Quantity</th>
                        <th>Unit Cost</th>
                        <th>Total Cost</th>
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
            <h1>Suppliers Management</h1>
            <p>Manage your pharmacy suppliers and contact information.</p>
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
            <h1>Expiration Monitoring</h1>
            <p>Monitor expired and soon-to-expire medicines.</p>
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
                placeholder="Search medicine..."
                aria-label="Search medicines"
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
        </div>

        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Medicine</th>
                        <th>Batch Number</th>
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
            <h1>Settings</h1>
            <p>Manage your pharmacy information and system preferences.</p>
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
                <div class="settings-icon">👤</div>
                <div>
                    <h2>Administrator Profile</h2>
                    <p>Update the displayed administrator details.</p>
                </div>
            </div>

            <form id="adminSettingsForm">
                <div class="settings-form-grid">
                    <div class="form-group">
                        <label for="settingAdminName">Full Name</label>
                        <input id="settingAdminName" type="text"
                            value="Admin" required>
                    </div>

                    <div class="form-group">
                        <label for="settingAdminEmail">Email Address</label>
                        <input id="settingAdminEmail" type="email"
                            value="admin@example.com">
                    </div>
                </div>

                <button type="submit" class="primary-btn">
                    Save Administrator Profile
                </button>
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

};


// =========================================
// 9. NAVIGATION FUNCTION
// Sidebar and topbar stay in place.
// =========================================

function showPage(pageName) {

    if (!pageContent) return;

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

    // Initialize the selected page.
    if (pageName === "dashboard") {
        initializeDashboard();
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
if (pageName === "settings") {
    initializeSettingsPage();
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
// 11. INVENTORY SAMPLE DATA
// =========================================

let inventoryMedicines = [
    {
        id: 1,
        name: "Paracetamol 500mg",
        category: "Pain Reliever",
        price: 5,
        quantity: 5,
        reorderLevel: 20
    },
    {
        id: 2,
        name: "Amoxicillin 500mg",
        category: "Antibiotic",
        price: 8,
        quantity: 50,
        reorderLevel: 20
    },
    {
        id: 3,
        name: "Cetirizine 10mg",
        category: "Antihistamine",
        price: 12,
        quantity: 10,
        reorderLevel: 15
    },
    {
        id: 4,
        name: "Ibuprofen 400mg",
        category: "Pain Reliever",
        price: 9,
        quantity: 6,
        reorderLevel: 20
    },
    {
        id: 5,
        name: "Vitamin C 500mg",
        category: "Vitamins",
        price: 4,
        quantity: 100,
        reorderLevel: 30
    }
];

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

    const query = searchInput.value.trim().toLowerCase();
    const filter = filterInput.value;

    const filteredMedicines = inventoryMedicines.filter(function (medicine) {
        const matchesSearch =
            medicine.name.toLowerCase().includes(query) ||
            medicine.category.toLowerCase().includes(query);

        const status = getMedicineStatus(medicine);

        const matchesFilter =
            filter === "all" || filter === status;

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

    tbody.innerHTML = "";

    if (filteredMedicines.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 7;
        cell.className = "inventory-empty";
        cell.textContent = "No medicines found.";

        row.appendChild(cell);
        tbody.appendChild(row);

        return;
    }

    filteredMedicines.forEach(function (medicine) {
        const status = getMedicineStatus(medicine);

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

        const values = [
            medicine.name,
            medicine.category,
            "₱" + medicine.price.toFixed(2),
            String(medicine.quantity),
            String(medicine.reorderLevel)
        ];

        values.forEach(function (value) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        // Stock status.
        const statusCell = document.createElement("td");
        const badge = document.createElement("span");

        badge.className = "badge " + statusClasses[status];
        badge.textContent = statusLabels[status];

        statusCell.appendChild(badge);
        row.appendChild(statusCell);

        // Action buttons.
        const actionsCell = document.createElement("td");
        const actions = document.createElement("div");

        actions.className = "action-buttons";

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
            alert(
                "Reorder request: " + medicine.name +
                "\nCurrent stock: " + medicine.quantity +
                "\nReorder level: " + medicine.reorderLevel +
                "\n\nSupplier order tracking is not connected yet."
            );
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.className = "delete-button";

        deleteButton.addEventListener("click", function () {
            deleteMedicine(medicine.id);
        });

        actions.append(editButton, reorderButton, deleteButton);

        actionsCell.appendChild(actions);
        row.appendChild(actionsCell);

        tbody.appendChild(row);
    });
}


// =========================================
// 14. ADD / EDIT MEDICINE FORM
// =========================================

function openMedicineForm(medicineId = null) {
    const form = document.getElementById("medicineForm");
    const panel = document.getElementById("medicineFormPanel");

    if (!form || !panel) return;

    form.reset();

    document.getElementById("medicineId").value = "";

    if (medicineId !== null) {
        const medicine = inventoryMedicines.find(function (item) {
            return item.id === medicineId;
        });

        if (!medicine) return;

        document.getElementById("medicineId").value = medicine.id;
        document.getElementById("medicineName").value = medicine.name;
        document.getElementById("medicineCategory").value = medicine.category;
        document.getElementById("medicinePrice").value = medicine.price;
        document.getElementById("medicineQuantity").value = medicine.quantity;
        document.getElementById("medicineReorder").value = medicine.reorderLevel;

        document.getElementById("medicineFormTitle").textContent =
            "Edit Medicine";

    } else {
        document.getElementById("medicineFormTitle").textContent =
            "Add New Medicine";
    }

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

        const result = await response.json();

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

        alert(
            "Hindi na-delete ang medicine.\n\n" + error.message
        );
    }
}


// =========================================
// 16. INVENTORY MESSAGE
// =========================================

function showInventoryMessage(text) {
    const message = document.getElementById("inventoryMessage");

    if (message) {
        message.textContent = text;
    }
}


// =========================================
// 17. INITIALIZE INVENTORY PAGE
// =========================================


async function initializeInventoryPage() {
    const form = document.getElementById("medicineForm");

    if (!form || form.dataset.initialized === "true") return;

    form.dataset.initialized = "true";

    document.getElementById("addMedicineBtn")
        .addEventListener("click", function () {
            openMedicineForm();
        });

    document.getElementById("cancelMedicineBtn")
        .addEventListener("click", function () {
            document.getElementById("medicineFormPanel").hidden = true;
            form.reset();
        });

    document.getElementById("invSearch")
        .addEventListener("input", renderInventory);

    document.getElementById("invFilter")
        .addEventListener("change", renderInventory);

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const idValue = document.getElementById("medicineId").value;
        const name = document.getElementById("medicineName").value.trim();
        const category = document.getElementById("medicineCategory").value;

        const price = Number(
            document.getElementById("medicinePrice").value
        );

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
            !Number.isInteger(quantity) ||
            quantity < 0 ||
            !Number.isInteger(reorderLevel) ||
            reorderLevel < 0
        ) {
            alert("Please enter valid medicine details.");
            return;
        }

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
            quantity: quantity,
            reorder_level: reorderLevel
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

            const result = await response.json();

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
            alert(
                "Hindi na-save ang medicine sa MySQL. " +
                "Siguraduhing tumatakbo ang server.js at subukan ulit.\n\n" +
                error.message
            );
        }
    });

    await loadMedicinesFromDatabase();
}



// =========================================
// 18. INITIALIZE DASHBOARD ON PAGE LOAD
// =========================================

initializeDashboard();


/* =========================================
   E-PHARMA SALES MANAGEMENT
   Demo session only
========================================= */


let salesRecords = [];
let nextReceiptNumber = 1;

async function initializeSalesPage() {
    const form = document.getElementById("salesForm");

    if (!form || form.dataset.initialized === "true") return;

    form.dataset.initialized = "true";

    const medicineSelect = document.getElementById("salesMedicine");
    const quantityInput = document.getElementById("salesQuantity");
    const searchInput = document.getElementById("salesSearch");
    const message = document.getElementById("salesMessage");

    async function loadSalesMedicines() {
        await loadMedicinesFromDatabase();

        medicineSelect.innerHTML =
            '<option value="">Select medicine</option>';

        inventoryMedicines.forEach(function (medicine) {
            const option = document.createElement("option");

            option.value = String(medicine.id);
            option.textContent =
                medicine.name + " — ₱" + medicine.price.toFixed(2) +
                " (Stock: " + medicine.quantity + ")";

            medicineSelect.appendChild(option);
        });
    }

    function updateSaleTotal() {
        const medicineId = Number(medicineSelect.value);

        const medicine = inventoryMedicines.find(function (item) {
            return item.id === medicineId;
        });

        const quantity = Number(quantityInput.value);
        const price = medicine ? medicine.price : 0;

        const total =
            medicine && Number.isInteger(quantity) && quantity > 0
                ? price * quantity
                : 0;

        document.getElementById("salesUnitPrice").value =
            "₱" + price.toFixed(2);

        document.getElementById("salesTotal").value =
            "₱" + total.toFixed(2);

        document.getElementById("salesStockInfo").textContent =
            medicine ? "Available stock: " + medicine.quantity : "";

        quantityInput.max = medicine ? String(medicine.quantity) : "";
    }

    medicineSelect.addEventListener("change", updateSaleTotal);
    quantityInput.addEventListener("input", updateSaleTotal);

    form.addEventListener("reset", function () {
        setTimeout(updateSaleTotal, 0);
    });

    searchInput.addEventListener("input", renderSalesRecords);

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const medicineId = Number(medicineSelect.value);
        const quantity = Number(quantityInput.value);

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

        const confirmed = confirm(
            "Complete this sale?\n\n" +
            "Medicine: " + medicine.name +
            "\nQuantity: " + quantity +
            "\nTotal: ₱" + (medicine.price * quantity).toFixed(2)
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
                    quantity: quantity
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Unable to complete sale."
                );
            }

            // Reload stock from MySQL after successful sale.
            await loadMedicinesFromDatabase();
            await loadSalesRecordsFromDatabase();

            form.reset();
            updateSaleTotal();

            if (message) {
                message.textContent =
                    result.message +
                    " Receipt: EP-" +
                    String(result.sale_id).padStart(4, "0");
            }

            if (typeof refreshDashboardStats === "function") {
                refreshDashboardStats();
            }

            if (typeof renderNotifications === "function") {
                renderNotifications();
            }
        } catch (error) {
            console.error("Sale error:", error);

            alert(
                "Hindi nakumpleto ang sale.\n\n" + error.message
            );
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });

    await loadSalesMedicines();
    await loadSalesRecordsFromDatabase();
    updateSaleTotal();

    renderSalesRecords();
}

function renderSalesRecords() {
    const tbody = document.getElementById("salesRecordsBody");

    if (!tbody) return;

    const search = document.getElementById("salesSearch")
        .value.trim().toLowerCase();

    const today = new Date();

    const todaysSales = salesRecords.filter(function (sale) {
        const date = new Date(sale.timestamp);

        return date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate();
    });

    const todayTotal = todaysSales.reduce(function (sum, sale) {
        return sum + sale.total;
    }, 0);

    const itemsSold = todaysSales.reduce(function (sum, sale) {
        return sum + sale.quantity;
    }, 0);

    document.getElementById("salesTodayTotal").textContent =
        "₱" + todayTotal.toFixed(2);

    document.getElementById("salesTransactionCount").textContent =
        String(todaysSales.length);

    document.getElementById("salesItemsSold").textContent =
        String(itemsSold);

    const filteredRecords = salesRecords.filter(function (sale) {
        return sale.receipt.toLowerCase().includes(search) ||
            sale.medicineName.toLowerCase().includes(search);
    });

    tbody.innerHTML = "";

    if (filteredRecords.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.className = "inventory-empty";
        cell.textContent = "No sales records found.";

        row.appendChild(cell);
        tbody.appendChild(row);
        return;
    }

    filteredRecords.forEach(function (sale) {
        const row = document.createElement("tr");

        [
            sale.receipt,
            sale.date,
            sale.medicineName,
            String(sale.quantity),
            "₱" + sale.unitPrice.toFixed(2),
            "₱" + sale.total.toFixed(2)
        ].forEach(function (value) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        tbody.appendChild(row);
    });
}

/* =========================================
   E-PHARMA PURCHASE MANAGEMENT
   Demo session only
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

            const result = await response.json();

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
            alert("Hindi na-save ang purchase.\n\n" + error.message);
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
            "₱" + Number(record.total).toFixed(2),
            record.status || "Pending"
        ];

        values.forEach(function (value) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        const actionCell = document.createElement("td");

        if ((record.status || "Pending") === "Pending") {
            const receiveButton = document.createElement("button");

            receiveButton.type = "button";
            receiveButton.className = "primary-btn";
            receiveButton.textContent = "Mark as Received";
            receiveButton.dataset.purchaseId =
                record.purchaseNo.replace("PUR-", "");

            actionCell.appendChild(receiveButton);
        } else {
            actionCell.textContent =
                record.status === "Received" ? "Completed" : record.status;
        }

        row.appendChild(actionCell);
        tbody.appendChild(row);
    });
}
let supplierRecords = [];
let nextSupplierId = 1;

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

    // Load suppliers from MySQL
    await loadSuppliersFromDatabase();

    // Show Add Supplier form
   addButton.onclick = function (event) {
    event.preventDefault();

    const supplierForm = document.getElementById("supplierForm");

    if (!supplierForm) {
        console.error("supplierForm not found");
        return;
    }

    supplierForm.hidden = false;
    supplierForm.removeAttribute("hidden");
    supplierForm.style.display = "block";
    supplierForm.style.visibility = "visible";

    console.log("Add Supplier clicked");
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

            const result = await response.json();

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

                const result = await response.json();

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

        if (!response.ok) {
            throw new Error("Failed to load suppliers.");
        }

        const rows = await response.json();

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
        showSupplierMessage("Hindi ma-load ang suppliers. Check your server.", true);
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

const expirationMedicines = [
    {
        name: "Paracetamol 500mg",
        batch: "PAR-2026-001",
        quantity: 120,
        expiry: "2026-11-15"
    },
    {
        name: "Amoxicillin 500mg",
        batch: "AMX-2026-002",
        quantity: 80,
        expiry: "2026-10-10"
    },
    {
        name: "Cetirizine 10mg",
        batch: "CET-2026-003",
        quantity: 60,
        expiry: "2027-06-20"
    },
    {
        name: "Ibuprofen 200mg",
        batch: "IBU-2026-004",
        quantity: 90,
        expiry: "2026-12-05"
    }
];

function initializeExpirationPage() {
    const search = document.getElementById("expirationSearch");
    const filter = document.getElementById("expirationFilter");

    if (!search || !filter) return;

    search.oninput = renderExpirationMedicines;
    filter.onchange = renderExpirationMedicines;

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

    const records = expirationMedicines.map(medicine => ({
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
            item.batch.toLowerCase().includes(search);

        const matchesFilter =
            filter === "All" || item.status === filter;

        return matchesSearch && matchesFilter;
    });

    if (filtered.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="6">No medicines found.</td>
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
                <td>${escapeSupplierText(item.batch)}</td>
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

    if (!pharmacyForm || !adminForm || !systemForm) return;

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
            const msg = "Pharmacy information saved. Name and logo updated across the web!";
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

    adminForm.onsubmit = async function (event) {
        event.preventDefault();
        const adminName = adminNameInput ? adminNameInput.value.trim() : "";
        if (!adminName) {
            showSettingsMessage("Please enter the administrator name.", true);
            return;
        }

        await branding.saveSettings({
            adminName,
            adminEmail: adminEmailInput ? adminEmailInput.value.trim() : ""
        });
        showSettingsMessage("Administrator profile saved.", false);
    };

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
        showSettingsMessage("System preferences saved.", false);
    };
}

function showSettingsMessage(message, isError) {
    const box = document.getElementById("settingsMessage");
    if (!box) return;

    box.textContent = message;
    box.style.color = isError ? "#b91c1c" : "#0f766e";
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
    if (typeof expirationMedicines !== "undefined") {
        expirationMedicines.forEach(medicine => {
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

    count.textContent = unreadCount > 99 ? "99+" : unreadCount;
    count.style.display = unreadCount > 0 ? "inline-flex" : "none";

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
    const totalMedicinesElement = document.getElementById("totalMedicines");
    const lowStockElement = document.getElementById("lowStock");

    if (typeof inventoryMedicines !== "undefined") {
        const totalMedicines = inventoryMedicines.length;

        const lowStockCount = inventoryMedicines.filter(medicine =>
            Number(medicine.quantity) <= Number(medicine.reorderLevel)
        ).length;

        if (totalMedicinesElement) {
            totalMedicinesElement.textContent = totalMedicines;
        }

        if (lowStockElement) {
            lowStockElement.textContent = lowStockCount;
        }
    }

    renderNotifications();
}


async function loadMedicinesFromDatabase() {
    try {
        const response = await fetch("/api/medicines");

        if (!response.ok) {
            throw new Error("Failed to load medicines from MySQL.");
        }

        const rows = await response.json();

        inventoryMedicines = rows.map(function (row) {
            return {
                id: Number(row.medicine_id),
                name: row.medicine_name,
                category: row.category || "",
                price: Number(row.price),
                quantity: Number(row.quantity),
                reorderLevel: Number(row.reorder_level)
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
        showInventoryMessage(
            "Hindi makuha ang medicines. Tingnan kung tumatakbo ang server.",
            true
        );
    }
}


async function loadSalesRecordsFromDatabase() {
    try {
        const response = await fetch("/api/sales");

        if (!response.ok) {
            throw new Error("Unable to load sales history.");
        }

        const rows = await response.json();

        salesRecords = rows.map(function (row) {
            return {
                receipt: "EP-" +
                    String(row.sale_id).padStart(4, "0"),
                date: new Date(row.sale_date).toLocaleString("en-PH"),
                timestamp: new Date(row.sale_date).getTime(),
                medicineName: row.medicine_name,
                quantity: Number(row.quantity),
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

        renderSalesRecords();
    } catch (error) {
        console.error("Load sales error:", error);
        showInventoryMessage(
            "Hindi ma-load ang sales history mula sa database.",
            true
        );
    }
}

async function loadPurchaseRecordsFromDatabase() {
    try {
        const response = await fetch("/api/purchases");

        if (!response.ok) {
            throw new Error("Unable to load purchase records.");
        }

        const rows = await response.json();

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
        alert("Hindi ma-load ang purchase records. Tingnan ang server.");
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

            const result = await response.json();

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

