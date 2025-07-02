import express from 'express';
import Database from 'better-sqlite3';
import cors from 'cors';

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Подключение к SQLite (файл БД создастся автоматически)
const db = new Database('cake_shop.db');

// Создание таблиц при первом запуске
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
    FOREIGN KEY (product_id) REFERENCES products (id)
  );
`);

// Заполняем тестовыми товарами (если таблица пустая)
const initProducts = () => {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM products');
  const { count } = stmt.get();
  
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
    console.log('Добавлены тестовые товары');
  }
};
initProducts();

// API для получения товаров
app.get('/api/products', (req, res) => {
  const products = db.prepare('SELECT * FROM products').all();
  res.json(products);
});

// API для работы с корзиной
app.get('/api/cart', (req, res) => {
  const cartItems = db.prepare(`
    SELECT cart_items.id, products.id as product_id, products.name, products.price, cart_items.quantity 
    FROM cart_items 
    JOIN products ON cart_items.product_id = products.id
  `).all();
  
  res.json(cartItems);
});

app.post('/api/cart', (req, res) => {
  const { product_id } = req.body;
  
  // Проверяем, есть ли уже такой товар в корзине
  const existingItem = db.prepare('SELECT * FROM cart_items WHERE product_id = ?').get(product_id);
  
  if (existingItem) {
    // Увеличиваем количество
    db.prepare('UPDATE cart_items SET quantity = quantity + 1 WHERE id = ?').run(existingItem.id);
  } else {
    // Добавляем новый товар
    db.prepare('INSERT INTO cart_items (product_id) VALUES (?)').run(product_id);
  }
  
  res.json({ success: true });
});

app.delete('/api/cart/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM cart_items WHERE id = ?').run(id);
  res.json({ success: true });
});

app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`);
});