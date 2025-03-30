import express from 'express';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import transactionsRoutes from './routes/transactions.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';

// Получаем __dirname в ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Загружаем переменные окружения
import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT;

// Путь к базе данных - в Docker контейнере это будет /app/db/fiona.db
const dbPath = process.env.NODE_ENV === 'production' 
  ? '/app/db/fiona.db'  // Путь в Docker контейнере
  : path.resolve(__dirname, '../../db/fiona.db'); // Путь для локальной разработки

// Подключение к базе данных SQLite
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Ошибка подключения к БД:', err.message);
    process.exit(1); // Завершаем процесс, если не удалось подключиться
  } else {
    console.log('Подключение к SQLite установлено.');
  }
});

// Чтение и выполнение SQL-скрипта для инициализации таблиц
const initSqlPath = process.env.NODE_ENV === 'production'
  ? '/app/db/init.sql'  // Путь в Docker контейнере
  : path.resolve(__dirname, '../../db/init.sql'); // Путь для локальной разработки

(async () => {
  try {
    const initSql = await fs.readFile(initSqlPath, 'utf-8');
    db.exec(initSql, (err) => {
      if (err) {
        console.error('Ошибка выполнения SQL-скрипта:', err.message);
      } else {
        console.log('Таблицы успешно созданы.');
      }
    });
  } catch (err) {
    console.error('Ошибка чтения файла init.sql:', err.message);
    process.exit(1);
  }
})();

app.use(express.json());

// Передача подключения `db` в маршруты
app.use('/api/transactions', transactionsRoutes(db));
app.use('/api/auth', authRoutes(db));
app.use('/api/users', usersRoutes(db));

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
