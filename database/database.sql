-- H&L Chopp - Projeto Integrado (DWS, POO e BD)
-- Execute este arquivo no phpMyAdmin > SQL > Importar.
-- Preços e produtos abaixo são APENAS EXEMPLOS PARA DEMONSTRAÇÃO.
CREATE DATABASE IF NOT EXISTS hl_chopp_escolar
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hl_chopp_escolar;

CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(85) NOT NULL,
    category VARCHAR(40) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    min_stock INT NOT NULL DEFAULT 5,
    active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_type VARCHAR(10) NOT NULL,
    table_name VARCHAR(35),
    client_name VARCHAR(70),
    pickup_time TIME,
    notes VARCHAR(300),
    status VARCHAR(20) NOT NULL DEFAULT 'Pendente',
    payment_method VARCHAR(15),
    paid_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total DECIMAL(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    product_name VARCHAR(85) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    quantity INT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Insira os produtos de demonstração apenas na primeira instalação.
INSERT INTO products (name, category, price, stock, min_stock)
SELECT 'Espetinho de carne','Espetinhos tradicionais',12.00,30,5 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Espetinho de carne');
INSERT INTO products (name, category, price, stock, min_stock)
SELECT 'Espetinho de frango','Espetinhos tradicionais',11.00,25,5 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Espetinho de frango');
INSERT INTO products (name, category, price, stock, min_stock)
SELECT 'Espetinho de coração','Espetinhos especiais',13.00,20,5 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Espetinho de coração');
INSERT INTO products (name, category, price, stock, min_stock)
SELECT 'Jantinha tradicional','Jantinhas',23.00,18,4 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Jantinha tradicional');
INSERT INTO products (name, category, price, stock, min_stock)
SELECT 'Chopp 500 ml','Chopp',12.00,40,10 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Chopp 500 ml');
INSERT INTO products (name, category, price, stock, min_stock)
SELECT 'Refrigerante lata','Outras bebidas',7.00,32,8 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Refrigerante lata');
