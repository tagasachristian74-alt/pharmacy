-- =========================================
-- E-PHARMA DATABASE SCHEMA (MySQL 8+)
-- Database: epharma_db
-- =========================================

CREATE DATABASE IF NOT EXISTS epharma_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE epharma_db;

-- 1. USERS (Admin & Cashier accounts)
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(150) DEFAULT '',
    avatar_data LONGTEXT NULL,
    employee_id VARCHAR(40) NULL,
    UNIQUE KEY uq_users_employee_id (employee_id),
    role ENUM('admin', 'cashier') NOT NULL DEFAULT 'cashier',
    status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Durable allocation counter. Gaps are expected; IDs are never reissued.
CREATE TABLE IF NOT EXISTS staff_id_sequence (
    sequence_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY
);

-- 2. MEDICINES INVENTORY
CREATE TABLE IF NOT EXISTS medicines (
    medicine_id INT AUTO_INCREMENT PRIMARY KEY,
    medicine_name VARCHAR(120) NOT NULL,
    category VARCHAR(80) DEFAULT NULL,
    price DECIMAL(10, 2) NOT NULL,
    discount_percent DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    quantity INT NOT NULL DEFAULT 0,
    reorder_level INT NOT NULL DEFAULT 10,
    expiry_date DATE DEFAULT NULL,
    batch_number VARCHAR(80) DEFAULT NULL,
    shelf_location VARCHAR(100) DEFAULT NULL,
    requires_prescription TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. SUPPLIERS
CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(120) NOT NULL,
    phone VARCHAR(40) NOT NULL,
    email VARCHAR(150) DEFAULT '',
    address VARCHAR(255) NOT NULL,
    status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 4. SALES HEADER
CREATE TABLE IF NOT EXISTS sales (
    sale_id INT AUTO_INCREMENT PRIMARY KEY,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status ENUM('COMPLETED', 'VOIDED') NOT NULL DEFAULT 'COMPLETED',
    void_reason VARCHAR(255) DEFAULT NULL,
    discount_type ENUM('regular', 'senior', 'pwd') NOT NULL DEFAULT 'regular',
    customer_name VARCHAR(120) DEFAULT NULL,
    discount_id_number VARCHAR(100) DEFAULT NULL,
    vat_exempt_sales DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    cashier_id INT DEFAULT NULL,
    cashier_employee_id VARCHAR(40) DEFAULT NULL,
    cashier_username VARCHAR(80) DEFAULT 'admin',
    cashier_name VARCHAR(120) DEFAULT 'Admin',
    sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sales_cashier FOREIGN KEY (cashier_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 5. SALE ITEMS
CREATE TABLE IF NOT EXISTS sale_items (
    sale_item_id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id INT NOT NULL,
    medicine_id INT NOT NULL,
    quantity INT NOT NULL,
    original_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    unit_price DECIMAL(10, 2) NOT NULL,
    discount_percent DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    subtotal DECIMAL(10, 2) NOT NULL,
    CONSTRAINT fk_sale_items_sale
        FOREIGN KEY (sale_id) REFERENCES sales(sale_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_sale_items_medicine
        FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id)
        ON DELETE RESTRICT
);

-- 6. PURCHASES HEADER
CREATE TABLE IF NOT EXISTS purchases (
    purchase_id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT DEFAULT NULL,
    total_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status ENUM('Pending', 'Received', 'Cancelled') NOT NULL DEFAULT 'Pending',
    purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_purchases_supplier
        FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
        ON DELETE SET NULL
);

-- 7. PURCHASE ITEMS
CREATE TABLE IF NOT EXISTS purchase_items (
    purchase_item_id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id INT NOT NULL,
    medicine_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_cost DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    CONSTRAINT fk_purchase_items_purchase
        FOREIGN KEY (purchase_id) REFERENCES purchases(purchase_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_purchase_items_medicine
        FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id)
        ON DELETE RESTRICT
);

-- 8. PHARMACY SETTINGS & BRANDING
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
);

-- 9. ACTIVITY LOGS (Admin Audit Trail)
CREATE TABLE IF NOT EXISTS activity_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(80) NOT NULL,
    actor_name VARCHAR(120) NOT NULL,
    role ENUM('admin', 'cashier') NOT NULL DEFAULT 'admin',
    module VARCHAR(60) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details VARCHAR(500) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- On an empty users table, server.js creates an admin using DB_ADMIN_PASSWORD from the environment.
