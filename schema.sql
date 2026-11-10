CREATE DATABASE IF NOT EXISTS epharma_db;

USE epharma_db;

-- 1. MEDICINES TABLE
CREATE TABLE IF NOT EXISTS medicines (
    medicine_id INT AUTO_INCREMENT PRIMARY KEY,
    medicine_name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    quantity INT NOT NULL DEFAULT 0,
    reorder_level INT NOT NULL DEFAULT 10,
    expiry_date DATE NULL,
    batch_number VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. SUPPLIERS TABLE
CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(30),
    email VARCHAR(150),
    address VARCHAR(255),
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. SALES TABLE
CREATE TABLE IF NOT EXISTS sales (
    sale_id INT AUTO_INCREMENT PRIMARY KEY,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. SALES ITEMS TABLE
CREATE TABLE IF NOT EXISTS sale_items (
    sale_item_id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id INT NOT NULL,
    medicine_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id),
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id)
);

-- 5. PURCHASES TABLE
CREATE TABLE IF NOT EXISTS purchases (
    purchase_id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT NULL,
    total_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('Pending', 'Received', 'Cancelled') DEFAULT 'Pending',
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
);

-- 6. PURCHASE ITEMS TABLE
CREATE TABLE IF NOT EXISTS purchase_items (
    purchase_item_id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id INT NOT NULL,
    medicine_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (purchase_id) REFERENCES purchases(purchase_id),
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id)
);

-- 7. PHARMACY SETTINGS TABLE (also auto-created by server.js if missing)
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
    date_format VARCHAR(30) DEFAULT 'MM/DD/YYYY',
    low_stock_level INT DEFAULT 10,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
