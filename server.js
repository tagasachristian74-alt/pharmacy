
const express = require("express");
const mysql = require("mysql2/promise");
const crypto = require("crypto");
const pricing = require("./pricing");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// The browser app is same-origin; do not enable cross-origin API access.
app.disable("x-powered-by");
app.use(express.json({ limit: "10mb" }));

// Serve only public app assets; never expose source, configuration or data files.
const publicFiles = new Set(["/", "/index.html", "/dashboard.html", "/style.css", "/dashboard.css", "/inventory.css", "/script.js", "/pricing.js", "/dashboard.js", "/pharmacy-branding.js"]);
app.use((req, res, next) => {
    if (req.path.startsWith("/api") || publicFiles.has(req.path) || /^\/assets\/[A-Za-z0-9_.-]+$/.test(req.path)) return next();
    return res.sendStatus(404);
});
app.use(express.static(__dirname, { dotfiles: "deny" }));

function hashPassword(plainText) {
    const salt = crypto.randomBytes(16).toString("hex");
    const derived = crypto.scryptSync(String(plainText), salt, 64).toString("hex");
    return `${salt}:${derived}`;
}

function verifyPassword(plainText, storedHash) {
    const raw = String(storedHash || "");
    const [salt, keyHex] = raw.split(":");
    if (!/^[a-f0-9]{32}$/i.test(salt || "") || !/^[a-f0-9]{128}$/i.test(keyHex || "") || raw !== `${salt}:${keyHex}`) return false;
    const expected = Buffer.from(keyHex, "hex");
    const actual = crypto.scryptSync(String(plainText), salt, 64);
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
}

// MySQL connection pool
const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    dateStrings: true,
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
            message: "Database connection unavailable. Reconnect MySQL and try again."
        });
    }
    return res.status(500).json({
        message: fallbackMessage
    });
}

let schemaUpgraded = false;
let schemaUpgradePromise = null;
async function ensureSchemaUpgrades() {
    if (schemaUpgraded) return;
    if (!schemaUpgradePromise) schemaUpgradePromise = performSchemaUpgrades();
    try { await schemaUpgradePromise; } finally { schemaUpgradePromise = null; }
}
async function performSchemaUpgrades() {

    const dbName = process.env.DB_NAME || "epharma_db";
    const checks = [
        { table: "sales", column: "discount_type", sql: "ALTER TABLE sales ADD COLUMN discount_type ENUM('regular', 'senior', 'pwd') NOT NULL DEFAULT 'regular'" },
        { table: "sales", column: "customer_name", sql: "ALTER TABLE sales ADD COLUMN customer_name VARCHAR(120) NULL" },
        { table: "sales", column: "discount_id_number", sql: "ALTER TABLE sales ADD COLUMN discount_id_number VARCHAR(100) NULL" },
        { table: "sales", column: "vat_exempt_sales", sql: "ALTER TABLE sales ADD COLUMN vat_exempt_sales DECIMAL(10,2) NOT NULL DEFAULT 0.00" },
        { table: "sales", column: "discount_amount", sql: "ALTER TABLE sales ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00" },
        { table: "sales", column: "status", sql: "ALTER TABLE sales ADD COLUMN status ENUM('COMPLETED', 'VOIDED') NOT NULL DEFAULT 'COMPLETED'" },
        { table: "sales", column: "void_reason", sql: "ALTER TABLE sales ADD COLUMN void_reason VARCHAR(255) NULL" },
        { table: "medicines", column: "requires_prescription", sql: "ALTER TABLE medicines ADD COLUMN requires_prescription TINYINT(1) NOT NULL DEFAULT 0" },
        { table: "sales", column: "cashier_id", sql: "ALTER TABLE sales ADD COLUMN cashier_id INT NULL" },
        { table: "medicines", column: "shelf_location", sql: "ALTER TABLE medicines ADD COLUMN shelf_location VARCHAR(100) DEFAULT NULL" },
        {
            table: "medicines",
            column: "discount_percent",
            sql: "ALTER TABLE medicines ADD COLUMN discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER price"
        },
        {
            table: "sales",
            column: "cashier_username",
            sql: "ALTER TABLE sales ADD COLUMN cashier_username VARCHAR(80) DEFAULT 'admin' AFTER total_amount"
        },
        {
            table: "sales",
            column: "cashier_name",
            sql: "ALTER TABLE sales ADD COLUMN cashier_name VARCHAR(120) DEFAULT 'Admin' AFTER cashier_username"
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

    await db.query(`
        CREATE TABLE IF NOT EXISTS users (
            user_id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(80) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(120) NOT NULL,
            email VARCHAR(150) DEFAULT '',
            avatar_data LONGTEXT NULL,
            role ENUM('admin', 'cashier') NOT NULL DEFAULT 'cashier',
            status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);

    const [avatarColumns] = await db.query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar_data'", [dbName]
    );
    if (avatarColumns.length === 0) await db.query("ALTER TABLE users ADD COLUMN avatar_data LONGTEXT NULL");

    await db.query(`
        CREATE TABLE IF NOT EXISTS activity_logs (
            log_id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(80) NOT NULL,
            actor_name VARCHAR(120) NOT NULL,
            role ENUM('admin', 'cashier') NOT NULL DEFAULT 'admin',
            module VARCHAR(60) NOT NULL,
            action VARCHAR(100) NOT NULL,
            details VARCHAR(500) DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const [cashierFk] = await db.query(
        "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sales' AND COLUMN_NAME = 'cashier_id' AND REFERENCED_TABLE_NAME = 'users'",
        [dbName]
    );
    if (cashierFk.length === 0) {
        await db.query("ALTER TABLE sales ADD CONSTRAINT fk_sales_cashier FOREIGN KEY (cashier_id) REFERENCES users(user_id) ON DELETE SET NULL");
    }

    const [countRows] = await db.query("SELECT COUNT(*) AS cnt FROM users");
    if (Number(countRows[0]?.cnt || 0) === 0) {
        const password = process.env.DB_ADMIN_PASSWORD || "";
        if (password.length < 12) {
            throw new Error("Set DB_ADMIN_PASSWORD to a unique password of at least 12 characters before first login.");
        }
        await db.query(
            "INSERT INTO users (username, password_hash, full_name, email, role, status) VALUES (?, ?, ?, ?, ?, ?)",
            ["admin", hashPassword(password), "Administrator", "", "admin", "Active"]
        );
    }

    schemaUpgraded = true;
}

async function recordActivityLog({ username, actor_name, role, module, action, details = "" }) {
    try {
        await ensureSchemaUpgrades();
        await db.query(
            `INSERT INTO activity_logs (username, actor_name, role, module, action, details)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                String(username || "admin").trim().slice(0, 80) || "admin",
                String(actor_name || "Admin").trim().slice(0, 120) || "Admin",
                role === "cashier" ? "cashier" : "admin",
                String(module || "System").trim().slice(0, 60),
                String(action || "Updated").trim().slice(0, 100),
                String(details || "").trim().slice(0, 500)
            ]
        );
    } catch {
        // Never fail primary API request if audit logging fails.
    }
}

// Server-issued, HttpOnly sessions. Stored in memory: restart logs everyone out.
const sessions = new Map();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SESSION_IDLE_MS = 30 * 60 * 1000;
const loginAttempts = new Map();
function cookieToken(req) {
    const match = (req.headers.cookie || "").match(/(?:^|;\s*)epharma_session=([a-f0-9]{64})(?:;|$)/);
    return match ? match[1] : "";
}
function cookieOptions() {
    return { httpOnly: true, sameSite: "strict", secure: process.env.COOKIE_SECURE === "true", path: "/", maxAge: SESSION_TTL_MS };
}
app.use("/api", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.headers.origin) {
        try {
            if (new URL(req.headers.origin).host !== req.headers.host) return res.status(403).json({ message: "Cross-origin request denied." });
        } catch { return res.status(403).json({ message: "Invalid origin." }); }
    }
    if ((req.path === "/auth/login" && req.method === "POST") || (req.path === "/settings" && req.method === "GET") || (req.path === "/" && req.method === "GET")) return next();
    const token = cookieToken(req);
    const session = sessions.get(token);
    if (!session || session.expires <= Date.now() || Date.now() - session.last_active_at >= SESSION_IDLE_MS) {
        if (token) sessions.delete(token);
        return res.status(401).json({ message: "Please sign in." });
    }
    if (req.path === "/auth/logout" && req.method === "POST") { req.session = session; return next(); }
    try {
        const [rows] = await db.query("SELECT user_id, username, full_name, email, role, status, password_hash, avatar_data FROM users WHERE user_id = ? LIMIT 1", [session.userId]);
        const user = rows[0];
        if (!user || user.status !== "Active" || user.password_hash !== session.passwordHash) {
            sessions.delete(token);
            return res.status(401).json({ message: "Session expired. Please sign in again." });
        }
        session.last_active_at = Date.now();
        req.user = user;
        if (req.path === "/auth/session" || req.path === "/auth/logout") return next();
        if (user.role !== "admin") {
            const allowed = (req.path === "/medicines" && req.method === "GET") ||
                (req.path === "/sales" && ["GET", "POST"].includes(req.method)) ||
                (["/account/profile", "/account/password"].includes(req.path) && req.method === "PUT");
            if (!allowed) return res.status(403).json({ message: "Administrator access required." });
        }
        if (req.path.startsWith("/account/")) { req.body = req.body || {}; req.body.username = user.username; }
        return next();
    } catch (error) { return sendDbError(res, error, "Unable to verify session."); }
});
app.get("/api/auth/session", (req, res) => res.json({ user: {
    user_id: req.user.user_id, username: req.user.username, fullName: req.user.full_name,
    email: req.user.email || "", role: req.user.role, avatar: req.user.avatar_data || ""
} }));
app.post("/api/auth/logout", async (req, res) => {
    sessions.delete(cookieToken(req));
    await recordActivityLog({ username: req.session.username, actor_name: req.session.fullName,
        role: req.session.role, module: "Auth", action: "Logged Out", details: "Session ended" });
    res.clearCookie("epharma_session", { ...cookieOptions(), maxAge: undefined });
    res.json({ success: true });
});

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
            batch_number,
            shelf_location,
            requires_prescription
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
             reorder_level, expiry_date, batch_number, shelf_location, requires_prescription)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                medicine_name.trim(),
                category || null,
                Number(price),
                Number(discount.toFixed(2)),
                Number(quantity),
                Number(reorder_level ?? 10),
                expiry_date || null,
                batch_number || null,
                shelf_location ? String(shelf_location).trim().slice(0, 100) : null,
                requires_prescription === true || requires_prescription === 1 ? 1 : 0
            ]
        );

        await recordActivityLog({
            username: req.user.username,
            actor_name: req.user.full_name,
            role: req.user.role,
            module: "Inventory",
            action: "Added Medicine",
            details: `${medicine_name.trim()} (₱${Number(price).toFixed(2)}, ${Number(discount.toFixed(2))}% off, Qty: ${Number(quantity)})`
        });

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
            batch_number,
            shelf_location,
            requires_prescription
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
                 batch_number = ?, shelf_location = ?, requires_prescription = COALESCE(?, requires_prescription)
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
                shelf_location ? String(shelf_location).trim().slice(0, 100) : null,
                requires_prescription === undefined ? null : (requires_prescription === true || requires_prescription === 1 ? 1 : 0),
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Medicine not found."
            });
        }

        await recordActivityLog({
            username: req.user.username,
            actor_name: req.user.full_name,
            role: req.user.role,
            module: "Inventory",
            action: "Updated Medicine",
            details: `${medicine_name.trim()} (₱${Number(price).toFixed(2)}, ${Number(discount.toFixed(2))}% off, Qty: ${Number(quantity)})`
        });

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

        await recordActivityLog({
            username: req.user.username,
            actor_name: req.user.full_name,
            role: req.user.role,
            module: "Inventory",
            action: "Deleted Medicine",
            details: `Removed medicine ID #${req.params.id}`
        });

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

// Get sales history (optionally filtered by cashier_username)
app.get("/api/sales", async (req, res) => {
    try {
        await ensureSchemaUpgrades();
        const cashierUsername = String(req.query.cashier_username || "").trim();
        const params = [];
        let whereClause = "";
        if (req.user.role === "cashier") {
            // Legacy rows without a stable cashier ID remain visible to admins only.
            whereClause = "WHERE s.cashier_id = ?";
            params.push(req.user.user_id);
        } else if (cashierUsername) {
            whereClause = "WHERE s.cashier_username = ?";
            params.push(cashierUsername);
        }

        const [rows] = await db.query(`
            SELECT
                s.sale_id,
                s.status,
                s.void_reason,
                s.discount_type,
                s.customer_name,
                s.discount_id_number,
                s.vat_exempt_sales,
                s.discount_amount,
                s.total_amount,
                s.cashier_id,
                s.cashier_username,
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
            ${whereClause}
            ORDER BY s.sale_id DESC
        `, params);

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
        const {
            medicine_id,
            quantity,
            discount_percent,
            cashier_name,
            cashier_username,
            actor_role
        } = req.body;
        const medicineId = Number(medicine_id);
        const qty = Number(quantity);
        const discountType = req.body.discount_type || "regular";
        const customerName = typeof req.body.customer_name === "string" ? req.body.customer_name.trim() : "";
        const discountId = typeof req.body.discount_id_number === "string" ? req.body.discount_id_number.trim() : "";
        if (!["regular", "senior", "pwd"].includes(discountType) ||
            (discountType !== "regular" && (!customerName || !discountId || customerName.length > 120 || discountId.length > 100 || /[\x00-\x1f\x7f]/.test(customerName + discountId)))) {
            return res.status(400).json({ message: "Select a valid customer type and provide customer name and ID for Senior/PWD sales." });
        }

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
        // MySQL DATE values are strings; compare calendar dates in the pharmacy timezone.
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
        if (medicine.expiry_date && String(medicine.expiry_date).slice(0, 10) < today) {
            await connection.rollback();
            return res.status(400).json({ message: "This medicine has expired and cannot be sold." });
        }
        if (Number(medicine.requires_prescription) === 1 && req.body.prescription_verified !== true) {
            await connection.rollback();
            return res.status(400).json({ message: "Prescription verification is required for this medicine." });
        }

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

        if (req.user.role === "cashier" && discountType === "regular" && ![0, Number(medicine.discount_percent || 0)].includes(discountPercent)) {
            await connection.rollback();
            return res.status(403).json({ message: "Cashiers may only use the inventory discount or approved presets." });
        }
        // For eligible customers compare the configured promotion to statutory pricing, never stack them.
        if (discountType !== "regular") discountPercent = Number(medicine.discount_percent || 0);
        const calculated = pricing.calculate(originalPrice, qty, discountPercent, discountType);
        discountPercent = calculated.discountPercent;
        const unitPrice = calculated.unitPrice;
        const subtotal = calculated.total;
        if (req.body.cash_tendered !== undefined && req.body.cash_tendered !== null && req.body.cash_tendered !== "") {
            const tendered = Number(req.body.cash_tendered);
            if (!Number.isFinite(tendered) || tendered < subtotal) {
                await connection.rollback();
                return res.status(400).json({ message: "Cash tendered is below the current total." });
            }
        }
        const cashierUser = req.user.username;
        const cashierLabel = req.user.full_name;

        const [saleResult] = await connection.query(
            "INSERT INTO sales (total_amount, cashier_username, cashier_name, cashier_id, discount_type, customer_name, discount_id_number, vat_exempt_sales, discount_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [subtotal, cashierUser, cashierLabel, req.user.user_id, discountType, discountType === "regular" ? null : customerName, discountType === "regular" ? null : discountId, calculated.vatExemptSales, calculated.discountAmount]
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

        await recordActivityLog({
            username: cashierUser,
            actor_name: cashierLabel,
            role: req.user.role,
            module: "Sales",
            action: "Completed Sale",
            details: `Receipt EP-${String(saleResult.insertId).padStart(4, "0")}: ${medicine.medicine_name} x${qty} (₱${subtotal.toFixed(2)})`
        });

        res.status(201).json({
            message: "Sale completed successfully.",
            sale_id: saleResult.insertId,
            original_price: originalPrice,
            unit_price: unitPrice,
            discount_percent: discountPercent,
            total_amount: subtotal,
            discount_type: discountType,
            customer_name: discountType === "regular" ? "" : customerName,
            discount_id_number: discountType === "regular" ? "" : discountId,
            vat_exempt_sales: calculated.vatExemptSales,
            discount_amount: calculated.discountAmount,
            applied_discount: calculated.applied,
            cashier_username: cashierUser,
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

// Admin-only void: lock the sale so concurrent requests cannot restore stock twice.
app.post("/api/sales/:id/void", async (req, res) => {
    const id = Number(req.params.id);
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!Number.isSafeInteger(id) || id <= 0 || !reason || reason.length > 255 || /[\x00-\x1f\x7f]/.test(reason)) {
        return res.status(400).json({ message: "Provide a valid sale ID and void reason (up to 255 characters)." });
    }
    let connection;
    try {
        await ensureSchemaUpgrades();
        connection = await db.getConnection();
        await connection.beginTransaction();
        const [sales] = await connection.query("SELECT sale_id, status FROM sales WHERE sale_id = ? FOR UPDATE", [id]);
        if (!sales.length) { await connection.rollback(); return res.status(404).json({ message: "Sale not found." }); }
        if (sales[0].status === "VOIDED") { await connection.rollback(); return res.status(409).json({ message: "Sale is already voided." }); }
        const [items] = await connection.query("SELECT medicine_id, quantity FROM sale_items WHERE sale_id = ? ORDER BY medicine_id FOR UPDATE", [id]);
        if (!items.length) { await connection.rollback(); return res.status(409).json({ message: "Sale has no items to restore." }); }
        for (const item of items) {
            const [updated] = await connection.query("UPDATE medicines SET quantity = quantity + ? WHERE medicine_id = ?", [item.quantity, item.medicine_id]);
            if (!updated.affectedRows) throw new Error("Unable to restore medicine stock.");
        }
        await connection.query("UPDATE sales SET status = 'VOIDED', void_reason = ? WHERE sale_id = ?", [reason, id]);
        await connection.commit();
        await recordActivityLog({ username: req.user.username, actor_name: req.user.full_name, role: req.user.role, module: "Sales", action: "Voided Sale", details: `Receipt EP-${String(id).padStart(4, "0")}: ${reason}` });
        res.json({ success: true, message: "Sale voided and stock restored." });
    } catch (error) {
        if (connection) { try { await connection.rollback(); } catch {} }
        console.error("Void sale error:", error.message);
        sendDbError(res, error, "Unable to void sale.");
    } finally { if (connection) connection.release(); }
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
        const {
            medicine_id,
            supplier_name,
            supplier_id,
            quantity,
            unit_cost
        } = req.body;

        const medicineId = Number(medicine_id);
        const qty = Number(quantity);
        const cost = Number(unit_cost);
        let supplierName = String(supplier_name || "").trim();
        const supplierIdInput = supplier_id == null || supplier_id === "" ? null : Number(supplier_id);

        if (
            !Number.isInteger(medicineId) || medicineId <= 0 ||
            !Number.isInteger(qty) || qty <= 0 ||
            !Number.isFinite(cost) || cost <= 0 ||
            (supplierIdInput !== null && (!Number.isSafeInteger(supplierIdInput) || supplierIdInput <= 0)) ||
            (supplierIdInput === null && !supplierName)
        ) {
            return res.status(400).json({
                message: "Enter valid purchase details."
            });
        }

        connection = await db.getConnection();

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

        // A purchase must reference an existing active supplier with complete contact details.
        const [suppliers] = await connection.query(
            supplierIdInput !== null
                ? "SELECT supplier_id, supplier_name FROM suppliers WHERE supplier_id = ? AND status = 'Active' FOR UPDATE"
                : "SELECT supplier_id, supplier_name FROM suppliers WHERE supplier_name = ? AND status = 'Active' LIMIT 1 FOR UPDATE",
            [supplierIdInput !== null ? supplierIdInput : supplierName]
        );
        if (!suppliers.length) {
            await connection.rollback();
            return res.status(400).json({ message: "Choose an existing active supplier. Create the supplier in Suppliers first." });
        }
        const supplierId = suppliers[0].supplier_id;
        supplierName = suppliers[0].supplier_name;

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

        await recordActivityLog({
            username: req.user.username,
            actor_name: req.user.full_name,
            role: req.user.role,
            module: "Purchase",
            action: "Created Purchase",
            details: `PUR-${String(purchaseResult.insertId).padStart(4, "0")}: medicine #${medicineId} x${qty} from ${supplierName}`
        });

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

        await recordActivityLog({
            username: req.user.username,
            actor_name: req.user.full_name,
            role: req.user.role,
            module: "Purchase",
            action: "Received Purchase",
            details: `Marked PUR-${String(req.params.id).padStart(4, "0")} Received and added stock`
        });

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

        await recordActivityLog({
            username: req.user.username,
            actor_name: req.user.full_name,
            role: req.user.role,
            module: "Suppliers",
            action: "Added Supplier",
            details: `Added supplier ${supplier_name.trim()}`
        });

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

        await recordActivityLog({
            username: req.user.username,
            actor_name: req.user.full_name,
            role: req.user.role,
            module: "Suppliers",
            action: "Updated Supplier",
            details: `Updated supplier #${req.params.id} (${supplier_name.trim()})`
        });

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

        await recordActivityLog({
            username: req.user.username,
            actor_name: req.user.full_name,
            role: req.user.role,
            module: "Suppliers",
            action: "Deleted Supplier",
            details: `Deleted supplier #${req.params.id}`
        });

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

    if (typeof value !== "string" || value.length > 7 * 1024 * 1024) {
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

// Avatars are smaller and stricter than pharmacy logos: raster data only.
function isSafeAvatarValue(value) {
    if (value === "") return true;
    return typeof value === "string" && value.length <= 140000 &&
        /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(value) && isSafeLogoValue(value);
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
            const settings = normalizeSettings({
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
                });
            try { await writeSettingsToFile(settings); }
            catch (error) { console.error("Settings fallback sync failed:", error.message); }
            return { configured: true, source: "mysql", settings };
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
        let mirrorWarning = null;
        try { await writeSettingsToFile(updated); }
        catch (error) { mirrorWarning = "Saved in MySQL, but local fallback could not be synchronized."; console.error(mirrorWarning, error.message); }

        await recordActivityLog({
            username: req.user.username,
            actor_name: req.user.full_name,
            role: req.user.role,
            module: "Settings",
            action: "Updated Pharmacy Settings",
            details: `Saved settings for ${updated.pharmacyName}`
        });

        res.json({
            success: true,
            configured: true,
            source: mirrorWarning ? "mysql" : "mysql+file",
            message: mirrorWarning || "Settings saved successfully.",
            warning: mirrorWarning,
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


/* ===== AUTH & MY ACCOUNT API ===== */

app.post("/api/auth/login", async (req, res) => {
    const key = req.ip;
    const now = Date.now();
    const attempts = (loginAttempts.get(key) || []).filter(time => now - time < 15 * 60 * 1000);
    if (attempts.length >= 10) return res.status(429).json({ message: "Too many login attempts. Try again later." });
    attempts.push(now);
    loginAttempts.set(key, attempts);
    try {
        const username = String(req.body?.username || "").trim();
        const password = String(req.body?.password || "");

        if (!username || !password) {
            return res.status(400).json({
                message: "Please enter your username and password."
            });
        }

        await ensureSchemaUpgrades();

        const [rows] = await db.query(
            `SELECT user_id, username, password_hash, full_name, email, role, status, avatar_data
             FROM users
             WHERE username = ?
             LIMIT 1`,
            [username]
        );

        if (rows.length === 0 || !verifyPassword(password, rows[0].password_hash)) {
            return res.status(401).json({
                message: "Invalid username or password."
            });
        }

        const user = rows[0];
        if (user.status !== "Active") {
            return res.status(403).json({
                message: "This account is currently inactive. Contact the administrator."
            });
        }

        await recordActivityLog({
            username: user.username,
            actor_name: user.full_name,
            role: user.role,
            module: "Auth",
            action: "Logged In",
            details: `${user.role === "cashier" ? "Cashier" : "Admin"} signed in`
        });

        loginAttempts.delete(key);
        const token = crypto.randomBytes(32).toString("hex");
        sessions.set(token, { userId: user.user_id, username: user.username, fullName: user.full_name, role: user.role, passwordHash: user.password_hash, last_active_at: Date.now(), expires: Date.now() + SESSION_TTL_MS });
        res.cookie("epharma_session", token, cookieOptions());
        res.json({
            success: true,
            user: {
                user_id: user.user_id,
                username: user.username,
                fullName: user.full_name,
                email: user.email || "",
                role: user.role,
                status: user.status,
                avatar: user.avatar_data || ""
            }
        });
    } catch (error) {
        console.error("Login error:", error.message);
        if (error.message.startsWith("Set DB_ADMIN_PASSWORD")) return res.status(503).json({ message: "Server administrator must configure the initial admin password." });
        sendDbError(res, error, "Unable to sign in.");
    }
});

app.put("/api/account/profile", async (req, res) => {
    try {
        const username = String(req.body?.username || "").trim();
        const fullName = String(req.body?.fullName ?? req.body?.full_name ?? "").trim();
        const email = String(req.body?.email || "").trim();
        const avatar = req.body?.avatar_data;
        if (avatar !== undefined && !isSafeAvatarValue(avatar)) return res.status(400).json({ message: "Invalid or oversized profile photo." });

        if (!username || !fullName) {
            return res.status(400).json({
                message: "Username and full name are required."
            });
        }

        await ensureSchemaUpgrades();

        const [rows] = await db.query(
            "SELECT user_id, username, role FROM users WHERE username = ? LIMIT 1",
            [username]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: "Account not found." });
        }

        const user = rows[0];
        await db.query(
            "UPDATE users SET full_name = ?, email = ? WHERE user_id = ?",
            [fullName.slice(0, 120), email.slice(0, 150), user.user_id]
        );

        if (avatar !== undefined) await db.query("UPDATE users SET avatar_data = ? WHERE user_id = ?", [avatar || null, user.user_id]);

        await recordActivityLog({
            username: user.username,
            actor_name: fullName,
            role: user.role,
            module: "Account",
            action: "Updated Profile",
            details: `Updated display name to ${fullName}`
        });

        res.json({
            success: true,
            message: "Profile updated successfully.",
            user: {
                user_id: user.user_id,
                username: user.username,
                fullName,
                email,
                role: user.role,
                avatar: avatar === undefined ? (req.user.avatar_data || "") : avatar
            }
        });
    } catch (error) {
        console.error("Update profile error:", error.message);
        sendDbError(res, error, "Unable to update profile.");
    }
});

app.put("/api/account/password", async (req, res) => {
    try {
        const username = String(req.body?.username || "").trim();
        const currentPassword = String(req.body?.currentPassword ?? req.body?.current_password ?? "");
        const newPassword = String(req.body?.newPassword ?? req.body?.new_password ?? "");

        if (!username || !currentPassword || !newPassword) {
            return res.status(400).json({
                message: "Current password and new password are required."
            });
        }

        if (newPassword.length < 12) {
            return res.status(400).json({
                message: "New password must be at least 12 characters."
            });
        }

        await ensureSchemaUpgrades();

        const [rows] = await db.query(
            "SELECT user_id, username, full_name, role, password_hash FROM users WHERE username = ? LIMIT 1",
            [username]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: "Account not found." });
        }

        const user = rows[0];
        if (!verifyPassword(currentPassword, user.password_hash)) {
            return res.status(401).json({
                message: "Current password is incorrect."
            });
        }

        await db.query(
            "UPDATE users SET password_hash = ? WHERE user_id = ?",
            [hashPassword(newPassword), user.user_id]
        );

        for (const [token, session] of sessions) if (session.userId === user.user_id) sessions.delete(token);
        await recordActivityLog({
            username: user.username,
            actor_name: user.full_name,
            role: user.role,
            module: "Account",
            action: "Changed Password",
            details: `Password updated for ${user.username}`
        });

        res.json({
            success: true,
            message: "Password changed successfully."
        });
    } catch (error) {
        console.error("Change password error:", error.message);
        sendDbError(res, error, "Unable to change password.");
    }
});


/* ===== CASHIER & USER MANAGEMENT API (ADMIN) ===== */

app.get("/api/users", async (req, res) => {
    try {
        await ensureSchemaUpgrades();
        const [rows] = await db.query(
            `SELECT user_id, username, full_name, email, role, status, created_at, avatar_data AS avatar
             FROM users
             ORDER BY role ASC, user_id ASC`
        );
        const now = Date.now();
        const onlineIds = new Set();
        for (const [token, session] of sessions) {
            if (session.expires <= now || now - session.last_active_at >= SESSION_IDLE_MS) sessions.delete(token);
            else onlineIds.add(session.userId);
        }
        res.json(rows.map(row => ({ ...row, online: row.status === "Active" && onlineIds.has(row.user_id) })));
    } catch (error) {
        console.error("Get users error:", error.message);
        sendDbError(res, error, "Unable to load users.");
    }
});

app.post("/api/users", async (req, res) => {
    try {
        const username = String(req.body?.username || "").trim();
        const fullName = String(req.body?.full_name || "").trim();
        const email = String(req.body?.email || "").trim();
        const password = String(req.body?.password || "");
        const role = req.body?.role === "admin" ? "admin" : "cashier";
        const status = req.body?.status === "Inactive" ? "Inactive" : "Active";
        const avatar = req.body?.avatar_data ?? "";
        if (!isSafeAvatarValue(avatar)) return res.status(400).json({ message: "Invalid or oversized profile photo." });

        if (!username || !fullName || password.length < 12) {
            return res.status(400).json({
                message: "Username, full name, and a password of at least 12 characters are required."
            });
        }

        if (!/^[A-Za-z0-9_.-]{3,50}$/.test(username)) {
            return res.status(400).json({
                message: "Username must be 3–50 characters using letters, numbers, dots, underscores, or hyphens."
            });
        }

        await ensureSchemaUpgrades();

        const [existing] = await db.query(
            "SELECT user_id FROM users WHERE username = ? LIMIT 1",
            [username]
        );
        if (existing.length > 0) {
            return res.status(409).json({
                message: "Username already exists."
            });
        }

        const [result] = await db.query(
            `INSERT INTO users (username, password_hash, full_name, email, role, status, avatar_data)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [username, hashPassword(password), fullName, email, role, status, avatar || null]
        );

        await recordActivityLog({
            username: req.user.username,
            actor_name: req.user.full_name,
            role: "admin",
            module: "Cashiers",
            action: "Created Account",
            details: `Created ${role} account '${username}' (${fullName})`
        });

        res.status(201).json({
            success: true,
            message: "Account created successfully.",
            user_id: result.insertId
        });
    } catch (error) {
        console.error("Create user error:", error.message);
        sendDbError(res, error, "Unable to create account.");
    }
});

app.put("/api/users/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        const fullName = String(req.body?.full_name || "").trim();
        const email = String(req.body?.email || "").trim();
        const status = req.body?.status === "Inactive" ? "Inactive" : "Active";
        const newPassword = String(req.body?.password || "");
        const avatar = req.body?.avatar_data;
        if (avatar !== undefined && !isSafeAvatarValue(avatar)) return res.status(400).json({ message: "Invalid or oversized profile photo." });

        if (!Number.isInteger(id) || id <= 0 || !fullName) {
            return res.status(400).json({
                message: "Valid user ID and full name are required."
            });
        }

        if (newPassword && newPassword.length < 12) {
            return res.status(400).json({
                message: "New password must be at least 12 characters."
            });
        }

        await ensureSchemaUpgrades();

        const [rows] = await db.query("SELECT * FROM users WHERE user_id = ? LIMIT 1", [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: "Account not found." });
        }

        if (rows[0].username === "admin" && status === "Inactive") {
            return res.status(400).json({
                message: "The primary administrator account cannot be deactivated."
            });
        }

        if (newPassword) {
            await db.query(
                "UPDATE users SET full_name = ?, email = ?, status = ?, password_hash = ? WHERE user_id = ?",
                [fullName, email, status, hashPassword(newPassword), id]
            );
        } else {
            await db.query(
                "UPDATE users SET full_name = ?, email = ?, status = ? WHERE user_id = ?",
                [fullName, email, status, id]
            );
        }

        if (avatar !== undefined) await db.query("UPDATE users SET avatar_data = ? WHERE user_id = ?", [avatar || null, id]);
        if (newPassword || status === "Inactive") {
            for (const [token, session] of sessions) if (session.userId === id) sessions.delete(token);
        }
        await recordActivityLog({
            username: req.user.username,
            actor_name: req.user.full_name,
            role: "admin",
            module: "Cashiers",
            action: "Updated Account",
            details: `Updated '${rows[0].username}' (${status})`
        });

        res.json({
            success: true,
            message: "Account updated successfully."
        });
    } catch (error) {
        console.error("Update user error:", error.message);
        sendDbError(res, error, "Unable to update account.");
    }
});

app.delete("/api/users/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: "Invalid user ID." });
        }
        if (id === 1) {
            return res.status(400).json({
                message: "Cannot delete the primary administrator account."
            });
        }

        await ensureSchemaUpgrades();

        const [rows] = await db.query("SELECT * FROM users WHERE user_id = ? LIMIT 1", [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: "Account not found." });
        }
        if (rows[0].username === "admin") {
            return res.status(400).json({
                message: "Cannot delete the primary administrator account."
            });
        }

        await db.query("DELETE FROM users WHERE user_id = ?", [id]);
        // Revoke all sessions for the deleted account, including other devices.
        for (const [token, session] of sessions) {
            if (session.userId === id) sessions.delete(token);
        }

        await recordActivityLog({
            username: req.user.username,
            actor_name: req.user.full_name,
            role: req.user.role,
            module: "Cashiers",
            action: "Deleted Account",
            details: `Deleted account '${rows[0].username}'`
        });

        res.json({
            success: true,
            message: "Account deleted successfully."
        });
    } catch (error) {
        console.error("Delete user error:", error.message);
        sendDbError(res, error, "Unable to delete account.");
    }
});


/* ===== ACTIVITY LOGS API (ADMIN) ===== */

app.get("/api/activity-logs", async (req, res) => {
    try {
        await ensureSchemaUpgrades();
        const [rows] = await db.query(
            `SELECT log_id, username, actor_name, role, module, action, details, created_at
             FROM activity_logs
             ORDER BY log_id DESC
             LIMIT 200`
        );
        res.json(rows);
    } catch (error) {
        console.error("Get activity logs error:", error.message);
        sendDbError(res, error, "Unable to load activity logs.");
    }
});

app.post("/api/activity-logs", async (req, res) => {
    try {
        const { module, action, details } = req.body || {};
        const { username, full_name: actor_name, role } = req.user;
        // Client events may not impersonate server-generated audit actions.
        if (module !== "Client" || !["Opened Help"].includes(action) ||
            (details !== undefined && (typeof details !== "string" || details.length > 500 || /[\x00-\x1f\x7f]/.test(details)))) {
            return res.status(400).json({ message: "Invalid client activity event." });
        }
        await recordActivityLog({ username, actor_name, role, module, action, details });
        res.status(201).json({ success: true });
    } catch (error) {
        console.error("Create activity log error:", error.message);
        sendDbError(res, error, "Unable to record activity log.");
    }
});


// Start server
app.listen(PORT, "0.0.0.0", () => {
    console.log(`E-Pharma server running at http://localhost:${PORT}`);
});

process.on("SIGINT", async () => {
    await db.end();
    process.exit(0);
});
