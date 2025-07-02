import express from 'express';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import cors from 'cors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 3000;

// Настройки сервера
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Раздаём статику

// Подключение БД
const db = new Database('cake_shop.db');

// Создаём таблицы если их нет
// order_items теперь содержит product_name и product_price
// orders теперь содержит products_info (JSON-строка с позициями заказа)
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    price INTEGER NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
  
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address TEXT NOT NULL,
    total INTEGER NOT NULL,
    items_count INTEGER NOT NULL,
    products_info TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT,
    product_price INTEGER,
    quantity INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
`);

// Тестовые данные
const initProducts = () => {
  const count = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  if (count === 0) {
    const insert = db.prepare('INSERT INTO products (id, name, price) VALUES (?, ?, ?)');
    const products = [
      [1, "Розовая мечта", 8000],
      [2, "Звезда", 7500],
      [3, "Клубничная фантазия", 8200],
      [4, "Ванильное облако", 7800],
      [5, "Космос", 7300],
      [6, "Желание", 8500]
    ];
    products.forEach(p => insert.run(p));
  }
};
initProducts();

// API для фронтенда
app.get('/api/products', (req, res) => {
  const products = db.prepare('SELECT * FROM products').all();
  res.json(products);
});

app.get('/api/cart', (req, res) => {
  const cart = db.prepare(`
    SELECT cart_items.id, products.id as product_id, products.name, products.price, cart_items.quantity 
    FROM cart_items 
    JOIN products ON cart_items.product_id = products.id
  `).all();
  res.json(cart);
});

app.post('/api/cart', (req, res) => {
  const { product_id } = req.body;
  const existing = db.prepare('SELECT * FROM cart_items WHERE product_id = ?').get(product_id);
  
  if (existing) {
    db.prepare('UPDATE cart_items SET quantity = quantity + 1 WHERE id = ?').run(existing.id);
  } else {
    db.prepare('INSERT INTO cart_items (product_id) VALUES (?)').run(product_id);
  }
  
  res.json({ success: true });
});

app.delete('/api/cart/:id', (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Уменьшить количество товара в корзине на 1
app.patch('/api/cart/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM cart_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'Позиция не найдена' });
  if (item.quantity > 1) {
    db.prepare('UPDATE cart_items SET quantity = quantity - 1 WHERE id = ?').run(item.id);
  } else {
    db.prepare('DELETE FROM cart_items WHERE id = ?').run(item.id);
  }
  res.json({ success: true });
});

// Оформление заказа
app.post('/api/orders', (req, res) => {
  const { customer_name, customer_phone, customer_address } = req.body;
  if (!customer_name || !customer_phone || !customer_address) {
    return res.status(400).json({ success: false, message: 'Заполните все поля' });
  }
  // Получаем корзину
  const cart = db.prepare(`
    SELECT product_id, quantity FROM cart_items
  `).all();
  if (cart.length === 0) {
    return res.status(400).json({ success: false, message: 'Корзина пуста' });
  }
  // Считаем итоговую сумму
  const total = cart.reduce((sum, item) => {
    const product = db.prepare('SELECT price FROM products WHERE id = ?').get(item.product_id);
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);
  // Считаем количество позиций
  const items_count = cart.length;
  // Формируем products_info (JSON)
  const productsInfo = cart.map(item => {
    const product = db.prepare('SELECT name, price FROM products WHERE id = ?').get(item.product_id);
    return {
      name: product.name,
      price: product.price,
      quantity: item.quantity
    };
  });
  const productsInfoStr = JSON.stringify(productsInfo);
  // Вставляем заказ с products_info
  const orderStmt = db.prepare('INSERT INTO orders (customer_name, customer_phone, customer_address, total, items_count, products_info) VALUES (?, ?, ?, ?, ?, ?)');
  const orderResult = orderStmt.run(customer_name, customer_phone, customer_address, total, items_count, productsInfoStr);
  const orderId = orderResult.lastInsertRowid;
  // Вставляем позиции заказа с названием и ценой
  const itemStmt = db.prepare('INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity) VALUES (?, ?, ?, ?, ?)');
  cart.forEach(item => {
    const product = db.prepare('SELECT name, price FROM products WHERE id = ?').get(item.product_id);
    itemStmt.run(orderId, item.product_id, product.name, product.price, item.quantity);
  });
  // Очищаем корзину
  db.prepare('DELETE FROM cart_items').run();
  res.json({ success: true, order_id: orderId });
});

// Все остальные запросы → index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Сервер запущен: http://localhost:${port}`);
});