
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Serve E-Pharma frontend files
app.use(express.static(__dirname));

// MySQL connection pool
const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "epharma_db",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const DB_CONN_ERRORS = new Set([
    "ECONNREFUSED",
    "ETIMEDOUT",
    "EHOSTUNREACH",
    "ENOTFOUND",
    "PROTOCOL_CONNECTION_LOST",
    "ER_ACCESS_DENIED_ERROR",
    "ER_BAD_DB_ERROR"
]);

function isDbConnectionError(error) {
    return Boolean(
        error &&
        (DB_CONN_ERRORS.has(error.code) || error.errno === 1045 || error.errno === 1049)
    );
}

function sendDbError(res, error, fallbackMessage) {
    if (isDbConnectionError(error)) {
        return res.status(503).json({
            dbUnavailable: true,
            message: "Database connection unavailable. Using demo/local fallback."
        });
    }
    return res.status(500).json({
        message: fallbackMessage
    });
}

let schemaUpgraded = false;
async function ensureSchemaUpgrades() {
    if (schemaUpgraded) return;

    const dbName = process.env.DB_NAME || "epharma_db";
    const checks = [
        {
            table: "medicines",
            column: "discount_percent",
            sql: "ALTER TABLE medicines ADD COLUMN discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER price"
        },
        {
            table: "sales",
            column: "cashier_name",
            sql: "ALTER TABLE sales ADD COLUMN cashier_name VARCHAR(120) DEFAULT 'Admin' AFTER total_amount"
        },
        {
            table: "sale_items",
            column: "original_price",
            sql: "ALTER TABLE sale_items ADD COLUMN original_price DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER quantity"
        },
        {
            table: "sale_items",
            column: "discount_percent",
            sql: "ALTER TABLE sale_items ADD COLUMN discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER unit_price"
        }
    ];

    for (const check of checks) {
        const [cols] = await db.query(
            `SELECT COLUMN_NAME
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
            [dbName, check.table, check.column]
        );
        if (cols.length === 0) {
            await db.query(check.sql);
        }
    }

    schemaUpgraded = true;
}

// Test server
app.get("/api", (req, res) => {
    res.json({
        message: "E-Pharma API is running!"
    });
});

// Test MySQL connection
app.get("/api/test-db", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT 1 AS result");

        res.json({
            success: true,
            message: "MySQL connected successfully!",
            result: rows[0].result
        });
    } catch (error) {
        console.error("Database error:", error.message);

        res.status(500).json({
            success: false,
            message: "Database connection failed. Check your .env settings."
        });
    }
});


/* ===== MEDICINES API ===== */

// Get all medicines
app.get("/api/medicines", async (req, res) => {
    try {
        await ensureSchemaUpgrades();
        const [rows] = await db.query(
            "SELECT * FROM medicines ORDER BY medicine_id DESC"
        );

        res.json(rows);
    } catch (error) {
        console.error("Get medicines error:", error.message);
        sendDbError(res, error, "Unable to retrieve medicines.");
    }
});

// Add a medicine
app.post("/api/medicines", async (req, res) => {
    try {
        const {
            medicine_name,
            category,
            price,
            discount_percent,
            quantity,
            reorder_level,
            expiry_date,
            batch_number
        } = req.body;

        const discount = discount_percent === undefined || discount_percent === ""
            ? 0
            : Number(discount_percent);

        if (
            !medicine_name ||
            price === undefined ||
            quantity === undefined ||
            Number(price) <= 0 ||
            Number(quantity) < 0 ||
            !Number.isFinite(Number(price)) ||
            !Number.isInteger(Number(quantity)) ||
            !Number.isFinite(discount) ||
            discount < 0 ||
            discount > 100
        ) {
            return res.status(400).json({
                message: "Please provide valid medicine details (discount must be 0–100%)."
            });
        }

        await ensureSchemaUpgrades();

        const [result] = await db.query(
            `INSERT INTO medicines
            (medicine_name, category, price, discount_percent, quantity,
             reorder_level, expiry_date, batch_number)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                medicine_name.trim(),
                category || null,
                Number(price),
                Number(discount.toFixed(2)),
                Number(quantity),
                Number(reorder_level ?? 10),
                expiry_date || null,
                batch_number || null
            ]
        );

        res.status(201).json({
            message: "Medicine added successfully.",
            medicine_id: result.insertId
        });
    } catch (error) {
        console.error("Add medicine error:", error.message);
        sendDbError(res, error, "Unable to add medicine.");
    }
});

// Update a medicine
app.put("/api/medicines/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const {
            medicine_name,
            category,
            price,
            discount_percent,
            quantity,
            reorder_level,
            expiry_date,
            batch_number
        } = req.body;

        const discount = discount_percent === undefined || discount_percent === ""
            ? 0
            : Number(discount_percent);

        if (
            !medicine_name ||
            price === undefined ||
            quantity === undefined ||
            Number(price) <= 0 ||
            Number(quantity) < 0 ||
            !Number.isFinite(Number(price)) ||
            !Number.isInteger(Number(quantity)) ||
            !Number.isFinite(discount) ||
            discount < 0 ||
            discount > 100
        ) {
            return res.status(400).json({
                message: "Please provide valid medicine details (discount must be 0–100%)."
            });
        }

        await ensureSchemaUpgrades();

        const [result] = await db.query(
            `UPDATE medicines
             SET medicine_name = ?, category = ?, price = ?, discount_percent = ?,
                 quantity = ?, reorder_level = ?, expiry_date = ?,
                 batch_number = ?
             WHERE medicine_id = ?`,
            [
                medicine_name.trim(),
                category || null,
                Number(price),
                Number(discount.toFixed(2)),
                Number(quantity),
                Number(reorder_level ?? 10),
                expiry_date || null,
                batch_number || null,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Medicine not found."
            });
        }

        res.json({ message: "Medicine updated successfully." });
    } catch (error) {
        console.error("Update medicine error:", error.message);
        sendDbError(res, error, "Unable to update medicine.");
    }
});

// Delete a medicine
app.delete("/api/medicines/:id", async (req, res) => {
    try {
        const [result] = await db.query(
            "DELETE FROM medicines WHERE medicine_id = ?",
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Medicine not found."
            });
        }

        res.json({ message: "Medicine deleted successfully." });
    } catch (error) {
        console.error("Delete medicine error:", error.message);
        sendDbError(
            res,
            error,
            "Unable to delete medicine. It may have related sales or purchases."
        );
    }
});


/* ===== SALES API ===== */

// Get sales history
app.get("/api/sales", async (req, res) => {
    try {
        await ensureSchemaUpgrades();
        const [rows] = await db.query(`
            SELECT
                s.sale_id,
                s.total_amount,
                s.cashier_name,
                s.sale_date,
                si.medicine_id,
                m.medicine_name,
                si.quantity,
                si.original_price,
                si.unit_price,
                si.discount_percent,
                si.subtotal
            FROM sales s
            JOIN sale_items si ON si.sale_id = s.sale_id
            JOIN medicines m ON m.medicine_id = si.medicine_id
            ORDER BY s.sale_id DESC
        `);

        res.json(rows);
    } catch (error) {
        console.error("Get sales error:", error.message);
        sendDbError(res, error, "Unable to retrieve sales.");
    }
});

// Create a sale and deduct stock safely
app.post("/api/sales", async (req, res) => {
    let connection;

    try {
        const { medicine_id, quantity, discount_percent, cashier_name } = req.body;
        const medicineId = Number(medicine_id);
        const qty = Number(quantity);

        if (
            !Number.isInteger(medicineId) ||
            medicineId <= 0 ||
            !Number.isInteger(qty) ||
            qty <= 0
        ) {
            return res.status(400).json({
                message: "Enter a valid medicine and quantity."
            });
        }

        if (discount_percent !== undefined && discount_percent !== "") {
            const parsedDiscount = Number(discount_percent);
            if (!Number.isFinite(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > 100) {
                return res.status(400).json({
                    message: "Discount must be between 0% and 100%."
                });
            }
        }

        await ensureSchemaUpgrades();
        connection = await db.getConnection();

        await connection.beginTransaction();

        const [medicines] = await connection.query(
            "SELECT * FROM medicines WHERE medicine_id = ? FOR UPDATE",
            [medicineId]
        );

        if (medicines.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: "Medicine not found."
            });
        }

        const medicine = medicines[0];

        if (medicine.quantity < qty) {
            await connection.rollback();
            return res.status(400).json({
                message: "Not enough stock available."
            });
        }

        const originalPrice = Number(medicine.price);
        let discountPercent = discount_percent !== undefined && discount_percent !== ""
            ? Number(discount_percent)
            : Number(medicine.discount_percent || 0);

        if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
            await connection.rollback();
            return res.status(400).json({
                message: "Discount must be between 0% and 100%."
            });
        }

        discountPercent = Number(discountPercent.toFixed(2));
        const unitPrice = Number((originalPrice * (1 - discountPercent / 100)).toFixed(2));
        const subtotal = Number((unitPrice * qty).toFixed(2));
        const cashierLabel = String(cashier_name || "Admin").trim().slice(0, 120) || "Admin";

        const [saleResult] = await connection.query(
            "INSERT INTO sales (total_amount, cashier_name) VALUES (?, ?)",
            [subtotal, cashierLabel]
        );

        await connection.query(
            `INSERT INTO sale_items
             (sale_id, medicine_id, quantity, original_price, unit_price, discount_percent, subtotal)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [saleResult.insertId, medicineId, qty, originalPrice, unitPrice, discountPercent, subtotal]
        );

        await connection.query(
            `UPDATE medicines
             SET quantity = quantity - ?
             WHERE medicine_id = ?`,
            [qty, medicineId]
        );

        await connection.commit();

        res.status(201).json({
            message: "Sale completed successfully.",
            sale_id: saleResult.insertId,
            original_price: originalPrice,
            unit_price: unitPrice,
            discount_percent: discountPercent,
            total_amount: subtotal,
            cashier_name: cashierLabel
        });
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch {}
        }

        console.error("Create sale error:", error.message);
        sendDbError(res, error, "Unable to complete sale.");
    } finally {
        if (connection) {
            connection.release();
        }
    }
});


/* ===== PURCHASES API ===== */

// Get purchase records
app.get("/api/purchases", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                p.purchase_id,
                p.supplier_id,
                p.total_cost,
                p.purchase_date,
                p.status,
                pi.medicine_id,
                m.medicine_name,
                pi.quantity,
                pi.unit_cost,
                pi.subtotal,
                s.supplier_name
            FROM purchases p
            JOIN purchase_items pi ON pi.purchase_id = p.purchase_id
            JOIN medicines m ON m.medicine_id = pi.medicine_id
            LEFT JOIN suppliers s ON s.supplier_id = p.supplier_id
            ORDER BY p.purchase_id DESC
        `);

        res.json(rows);
    } catch (error) {
        console.error("Get purchases error:", error.message);
        sendDbError(res, error, "Unable to retrieve purchases.");
    }
});

// Create purchase; stock is not changed until Received
app.post("/api/purchases", async (req, res) => {
    let connection;

    try {
        connection = await db.getConnection();

        const {
            medicine_id,
            supplier_name,
            quantity,
            unit_cost
        } = req.body;

        const medicineId = Number(medicine_id);
        const qty = Number(quantity);
        const cost = Number(unit_cost);
        const supplierName = String(supplier_name || "").trim();

        if (
            !Number.isInteger(medicineId) || medicineId <= 0 ||
            !Number.isInteger(qty) || qty <= 0 ||
            !Number.isFinite(cost) || cost <= 0 ||
            !supplierName
        ) {
            return res.status(400).json({
                message: "Enter valid purchase details."
            });
        }

        await connection.beginTransaction();

        const [medicines] = await connection.query(
            "SELECT medicine_id FROM medicines WHERE medicine_id = ? FOR UPDATE",
            [medicineId]
        );

        if (medicines.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: "Medicine not found."
            });
        }

        // Find existing supplier or create one.
        const [suppliers] = await connection.query(
            "SELECT supplier_id FROM suppliers WHERE supplier_name = ? LIMIT 1",
            [supplierName]
        );

        let supplierId;

        if (suppliers.length > 0) {
            supplierId = suppliers[0].supplier_id;
        } else {
            const [supplierResult] = await connection.query(
                "INSERT INTO suppliers (supplier_name) VALUES (?)",
                [supplierName]
            );

            supplierId = supplierResult.insertId;
        }

        const total = Number((qty * cost).toFixed(2));

        const [purchaseResult] = await connection.query(
            "INSERT INTO purchases (supplier_id, total_cost, status) VALUES (?, ?, 'Pending')",
            [supplierId, total]
        );

        await connection.query(
            `INSERT INTO purchase_items
             (purchase_id, medicine_id, quantity, unit_cost, subtotal)
             VALUES (?, ?, ?, ?, ?)`,
            [purchaseResult.insertId, medicineId, qty, cost, total]
        );

        await connection.commit();

        res.status(201).json({
            message: "Purchase saved as Pending.",
            purchase_id: purchaseResult.insertId
        });
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch {}
        }
        console.error("Create purchase error:", error.message);
        sendDbError(res, error, "Unable to save purchase.");
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// Change purchase status to Received and add stock once
app.patch("/api/purchases/:id/receive", async (req, res) => {
    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [purchases] = await connection.query(
            "SELECT purchase_id, status FROM purchases WHERE purchase_id = ? FOR UPDATE",
            [req.params.id]
        );

        if (purchases.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: "Purchase not found."
            });
        }

        if (purchases[0].status !== "Pending") {
            await connection.rollback();
            return res.status(400).json({
                message: "Only Pending purchases can be received."
            });
        }

        const [items] = await connection.query(
            "SELECT medicine_id, quantity FROM purchase_items WHERE purchase_id = ?",
            [req.params.id]
        );

        for (const item of items) {
            await connection.query(
                "UPDATE medicines SET quantity = quantity + ? WHERE medicine_id = ?",
                [item.quantity, item.medicine_id]
            );
        }

        await connection.query(
            "UPDATE purchases SET status = 'Received' WHERE purchase_id = ?",
            [req.params.id]
        );

        await connection.commit();

        res.json({
            message: "Purchase received and stock updated."
        });
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch {}
        }
        console.error("Receive purchase error:", error.message);
        sendDbError(res, error, "Unable to receive purchase.");
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

app.get("/api/suppliers", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT *
            FROM suppliers
            ORDER BY supplier_id DESC
        `);

        res.json(rows);
    } catch (error) {
        console.error("Load suppliers error:", error);
        sendDbError(res, error, "Failed to load suppliers.");
    }
});

app.post("/api/suppliers", async (req, res) => {
    try {
        const {
            supplier_name,
            contact_person,
            phone,
            email,
            address,
            status
        } = req.body;

        if (!supplier_name || !supplier_name.trim()) {
            return res.status(400).json({
                message: "Supplier name is required."
            });
        }

        const [result] = await db.query(
            `INSERT INTO suppliers
            (supplier_name, contact_person, phone, email, address, status)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                supplier_name.trim(),
                contact_person || "",
                phone || "",
                email || "",
                address || "",
                status || "Active"
            ]
        );

        res.status(201).json({
            success: true,
            message: "Supplier added successfully!",
            supplier_id: result.insertId
        });
    } catch (error) {
        console.error("Add supplier error:", error);
        sendDbError(res, error, "Failed to add supplier.");
    }
});

app.put("/api/suppliers/:id", async (req, res) => {
    try {
        const {
            supplier_name,
            contact_person,
            phone,
            email,
            address,
            status
        } = req.body;

        if (!supplier_name || !supplier_name.trim()) {
            return res.status(400).json({
                message: "Supplier name is required."
            });
        }

        const [result] = await db.query(
            `UPDATE suppliers
             SET supplier_name = ?,
                 contact_person = ?,
                 phone = ?,
                 email = ?,
                 address = ?,
                 status = ?
             WHERE supplier_id = ?`,
            [
                supplier_name.trim(),
                contact_person || "",
                phone || "",
                email || "",
                address || "",
                status || "Active",
                req.params.id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Supplier not found."
            });
        }

        res.json({
            success: true,
            message: "Supplier updated successfully!"
        });
    } catch (error) {
        console.error("Update supplier error:", error);
        sendDbError(res, error, "Failed to update supplier.");
    }
});

app.delete("/api/suppliers/:id", async (req, res) => {
    try {
        const [result] = await db.query(
            "DELETE FROM suppliers WHERE supplier_id = ?",
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Supplier not found."
            });
        }

        res.json({
            success: true,
            message: "Supplier deleted successfully!"
        });
    } catch (error) {
        console.error("Delete supplier error:", error);
        sendDbError(
            res,
            error,
            "Unable to delete supplier. It may be linked to existing purchases."
        );
    }
});


/* ===== SETTINGS API ===== */

const SETTINGS_DIR = path.join(__dirname, "data");
const SETTINGS_FILE = path.join(SETTINGS_DIR, "pharmacy-settings.json");

const DEFAULT_SETTINGS = {
    pharmacyName: "E-Pharma",
    pharmacyEmail: "epharma@example.com",
    pharmacyPhone: "09123456789",
    addressStreet: "",
    addressBarangay: "",
    addressCity: "",
    addressProvince: "",
    addressPostalCode: "",
    addressCountry: "Philippines",
    addressLandmark: "",
    pharmacyAddress: "Philippines",
    pharmacyLogo: "",
    adminName: "Admin",
    adminEmail: "admin@example.com",
    cashierName: "Cashier",
    dateFormat: "MM/DD/YYYY",
    lowStockLevel: 10
};

function formatPharmacyAddress(settings) {
    const street = String(settings.addressStreet || "").trim();
    const barangay = String(settings.addressBarangay || "").trim();
    const city = String(settings.addressCity || "").trim();
    const province = String(settings.addressProvince || "").trim();
    const postal = String(settings.addressPostalCode || "").trim();
    const country = String(settings.addressCountry || "").trim();
    const landmark = String(settings.addressLandmark || "").trim();

    const cityProvincePostal = [
        city,
        province && postal ? `${province} ${postal}` : province || postal
    ]
        .filter(Boolean)
        .join(", ");

    const mainParts = [street, barangay, cityProvincePostal, country].filter(Boolean);
    let full = mainParts.join(", ");

    if (landmark) {
        full = full ? `${full} (${landmark})` : landmark;
    }

    return full || String(settings.pharmacyAddress || "").trim() || "Philippines";
}

function isSafeLogoValue(value) {
    if (value === "" || value === "assets/default-logo.svg") {
        return true;
    }

    if (typeof value !== "string" || value.length > 5 * 1024 * 1024) {
        return false;
    }

    const rasterMatch = /^data:image\/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+$/i.test(value);
    if (rasterMatch) {
        return true;
    }

    if (/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/i.test(value)) {
        try {
            const b64 = value.split(",")[1] || "";
            const decoded = Buffer.from(b64, "base64").toString("utf8");
            if (/<script[\s>]|on\w+\s*=|javascript:/i.test(decoded)) {
                return false;
            }
            return true;
        } catch {
            return false;
        }
    }

    return false;
}

function normalizeSettings(raw = {}) {
    const merged = {
        ...DEFAULT_SETTINGS,
        ...raw
    };

    merged.pharmacyName = String(merged.pharmacyName || "").trim() || DEFAULT_SETTINGS.pharmacyName;
    merged.pharmacyEmail = String(merged.pharmacyEmail || "").trim();
    merged.pharmacyPhone = String(merged.pharmacyPhone || "").trim();
    merged.addressStreet = String(merged.addressStreet || "").trim();
    merged.addressBarangay = String(merged.addressBarangay || "").trim();
    merged.addressCity = String(merged.addressCity || "").trim();
    merged.addressProvince = String(merged.addressProvince || "").trim();
    merged.addressPostalCode = String(merged.addressPostalCode || "").trim();
    merged.addressCountry = String(merged.addressCountry || "").trim();
    merged.addressLandmark = String(merged.addressLandmark || "").trim();
    merged.pharmacyAddress = formatPharmacyAddress(merged);

    if (!merged.pharmacyLogo || merged.pharmacyLogo === "assets/default-logo.svg") {
        merged.pharmacyLogo = "";
    }

    merged.adminName = String(merged.adminName || "").trim() || DEFAULT_SETTINGS.adminName;
    merged.adminEmail = String(merged.adminEmail || "").trim();
    merged.cashierName = String(merged.cashierName || "").trim() || DEFAULT_SETTINGS.cashierName;
    merged.dateFormat = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"].includes(merged.dateFormat)
        ? merged.dateFormat
        : DEFAULT_SETTINGS.dateFormat;

    const lowStockNum = Number(merged.lowStockLevel);
    merged.lowStockLevel = Number.isInteger(lowStockNum) && lowStockNum >= 1
        ? lowStockNum
        : DEFAULT_SETTINGS.lowStockLevel;

    return merged;
}

async function ensureSettingsTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS pharmacy_settings (
            setting_id INT PRIMARY KEY,
            pharmacy_name VARCHAR(150) NOT NULL DEFAULT 'E-Pharma',
            pharmacy_email VARCHAR(150) DEFAULT '',
            pharmacy_phone VARCHAR(50) DEFAULT '',
            address_street VARCHAR(255) DEFAULT '',
            address_barangay VARCHAR(150) DEFAULT '',
            address_city VARCHAR(150) DEFAULT '',
            address_province VARCHAR(150) DEFAULT '',
            address_postal_code VARCHAR(30) DEFAULT '',
            address_country VARCHAR(100) DEFAULT 'Philippines',
            address_landmark VARCHAR(255) DEFAULT '',
            pharmacy_address VARCHAR(500) DEFAULT 'Philippines',
            pharmacy_logo LONGTEXT NULL,
            admin_name VARCHAR(120) DEFAULT 'Admin',
            admin_email VARCHAR(150) DEFAULT 'admin@example.com',
            cashier_name VARCHAR(120) DEFAULT 'Cashier',
            date_format VARCHAR(30) DEFAULT 'MM/DD/YYYY',
            low_stock_level INT DEFAULT 10,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);

    const dbName = process.env.DB_NAME || "epharma_db";
    const [cols] = await db.query(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'pharmacy_settings' AND COLUMN_NAME = 'cashier_name'`,
        [dbName]
    );
    if (cols.length === 0) {
        await db.query(
            "ALTER TABLE pharmacy_settings ADD COLUMN cashier_name VARCHAR(120) DEFAULT 'Cashier' AFTER admin_email"
        );
    }
}

async function readSettingsFromFile() {
    try {
        const content = await fs.promises.readFile(SETTINGS_FILE, "utf8");
        const parsed = JSON.parse(content);
        return { configured: true, settings: normalizeSettings(parsed) };
    } catch {
        return { configured: false, settings: { ...DEFAULT_SETTINGS } };
    }
}

async function writeSettingsToFile(settings) {
    await fs.promises.mkdir(SETTINGS_DIR, { recursive: true });
    await fs.promises.writeFile(
        SETTINGS_FILE,
        JSON.stringify(settings, null, 2),
        "utf8"
    );
}

async function readStoredSettings() {
    try {
        await ensureSettingsTable();
        const [rows] = await db.query(
            "SELECT * FROM pharmacy_settings WHERE setting_id = 1 LIMIT 1"
        );

        if (rows.length > 0) {
            const row = rows[0];
            return {
                configured: true,
                source: "mysql",
                settings: normalizeSettings({
                    pharmacyName: row.pharmacy_name,
                    pharmacyEmail: row.pharmacy_email,
                    pharmacyPhone: row.pharmacy_phone,
                    addressStreet: row.address_street,
                    addressBarangay: row.address_barangay,
                    addressCity: row.address_city,
                    addressProvince: row.address_province,
                    addressPostalCode: row.address_postal_code,
                    addressCountry: row.address_country,
                    addressLandmark: row.address_landmark,
                    pharmacyAddress: row.pharmacy_address,
                    pharmacyLogo: row.pharmacy_logo || "",
                    adminName: row.admin_name,
                    adminEmail: row.admin_email,
                    cashierName: row.cashier_name,
                    dateFormat: row.date_format,
                    lowStockLevel: row.low_stock_level
                })
            };
        }
    } catch {
        // Fallback to local JSON settings file when MySQL is offline.
    }

    const fileResult = await readSettingsFromFile();
    return {
        configured: fileResult.configured,
        source: fileResult.configured ? "file" : "default",
        settings: fileResult.settings
    };
}

app.get("/api/settings", async (req, res) => {
    try {
        const result = await readStoredSettings();
        res.json({
            success: true,
            configured: result.configured,
            source: result.source,
            settings: result.settings
        });
    } catch (error) {
        console.error("Load settings error:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to load settings."
        });
    }
});

async function handleSaveSettings(req, res) {
    try {
        const body = req.body || {};

        if (
            Object.prototype.hasOwnProperty.call(body, "pharmacyName") &&
            !String(body.pharmacyName || "").trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Pharmacy name is required."
            });
        }

        if (
            Object.prototype.hasOwnProperty.call(body, "pharmacyLogo") &&
            !isSafeLogoValue(body.pharmacyLogo)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid or unsupported logo image format."
            });
        }

        const current = await readStoredSettings();
        const updated = normalizeSettings({
            ...current.settings,
            ...body
        });

        await writeSettingsToFile(updated);

        let savedToMysql = false;
        try {
            await ensureSettingsTable();
            await db.query(
                `INSERT INTO pharmacy_settings (
                    setting_id, pharmacy_name, pharmacy_email, pharmacy_phone,
                    address_street, address_barangay, address_city, address_province,
                    address_postal_code, address_country, address_landmark, pharmacy_address,
                    pharmacy_logo, admin_name, admin_email, cashier_name, date_format, low_stock_level
                ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    pharmacy_name = VALUES(pharmacy_name),
                    pharmacy_email = VALUES(pharmacy_email),
                    pharmacy_phone = VALUES(pharmacy_phone),
                    address_street = VALUES(address_street),
                    address_barangay = VALUES(address_barangay),
                    address_city = VALUES(address_city),
                    address_province = VALUES(address_province),
                    address_postal_code = VALUES(address_postal_code),
                    address_country = VALUES(address_country),
                    address_landmark = VALUES(address_landmark),
                    pharmacy_address = VALUES(pharmacy_address),
                    pharmacy_logo = VALUES(pharmacy_logo),
                    admin_name = VALUES(admin_name),
                    admin_email = VALUES(admin_email),
                    cashier_name = VALUES(cashier_name),
                    date_format = VALUES(date_format),
                    low_stock_level = VALUES(low_stock_level)`,
                [
                    updated.pharmacyName,
                    updated.pharmacyEmail,
                    updated.pharmacyPhone,
                    updated.addressStreet,
                    updated.addressBarangay,
                    updated.addressCity,
                    updated.addressProvince,
                    updated.addressPostalCode,
                    updated.addressCountry,
                    updated.addressLandmark,
                    updated.pharmacyAddress,
                    updated.pharmacyLogo,
                    updated.adminName,
                    updated.adminEmail,
                    updated.cashierName,
                    updated.dateFormat,
                    updated.lowStockLevel
                ]
            );
            savedToMysql = true;
        } catch {
            // File persistence already succeeded; ignore if MySQL is not running.
        }

        res.json({
            success: true,
            configured: true,
            source: savedToMysql ? "mysql+file" : "file",
            message: "Settings saved successfully.",
            settings: updated
        });
    } catch (error) {
        console.error("Save settings error:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to save settings."
        });
    }
}

app.put("/api/settings", handleSaveSettings);
app.post("/api/settings", handleSaveSettings);


// Start server
app.listen(PORT, "0.0.0.0", () => {
    console.log(`E-Pharma server running at http://localhost:${PORT}`);
});

process.on("SIGINT", async () => {
    await db.end();
    process.exit(0);
});
