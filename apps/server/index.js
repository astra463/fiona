import express from 'express';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import transactionsRoutes from './routes/transactions.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import categoriesRoutes from './routes/categories.js';
import logger from './utils/logger.js';

// Получаем __dirname в ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Загружаем переменные окружения
import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT;

// Путь к базе данных - в Docker контейнере это будет /app/db/mr.black.db
const dbPath = process.env.NODE_ENV === 'production' 
  ? '/app/db/mrBlack.db'  // Путь в Docker контейнере
  : path.resolve(__dirname, '../../db/mrBlack.db'); // Путь для локальной разработки

// Подключение к базе данных SQLite
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    logger.error('Ошибка подключения к БД:', { error: err.message });
    process.exit(1); // Завершаем процесс, если не удалось подключиться
  } else {
    logger.info('Подключение к SQLite установлено.');
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
        logger.error('Ошибка выполнения SQL-скрипта:', { error: err.message });
      } else {
        logger.info('Таблицы успешно созданы.');
      }
    });
  } catch (err) {
    logger.error('Ошибка чтения файла init.sql:', { error: err.message, path: initSqlPath });
    process.exit(1);
  }
})();

app.use(express.json());

// Передача подключения `db` в маршруты
app.use('/api/transactions', transactionsRoutes(db));
app.use('/api/auth', authRoutes(db));
app.use('/api/users', usersRoutes(db));
app.use('/api/categories', categoriesRoutes(db));

// Middleware для логирования запросов
app.use((req, res, next) => {
  const start = Date.now();
  
  // Логируем запрос
  logger.info(`Входящий запрос: ${req.method} ${req.originalUrl}`, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    headers: req.headers,
  });
  
  // После завершения запроса логируем ответ
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`Ответ отправлен: ${req.method} ${req.originalUrl}`, {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
  });
  
  next();
});

// Middleware для обработки ошибок
app.use((err, req, res, next) => {
  logger.error('Ошибка сервера:', { 
    error: err.message, 
    stack: err.stack,
    method: req.method,
    url: req.originalUrl 
  });
  
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
  logger.info(`Сервер запущен на http://localhost:${PORT}`);
});
