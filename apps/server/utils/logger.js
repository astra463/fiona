import winston from 'winston';
import path from 'path';
import fs from 'fs';
import TelegramTransport from './telegram-transport.js';

// Создаем директорию для логов, если она не существует
const logDir = process.env.NODE_ENV === 'production' ? '/app/logs' : path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Настройка форматирования логов
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Создаем логгер
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'server' },
  transports: [
    // Запись логов в файлы
    new winston.transports.File({ 
      filename: path.join(logDir, 'server-error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({ 
      filename: path.join(logDir, 'server-combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  // Не завершать процесс при необработанных исключениях
  exitOnError: false,
});

// Добавляем транспорт для отправки критических логов в Telegram
if (process.env.BOT_TOKEN && process.env.TELEGRAM_LOG_CHAT_ID) {
  logger.add(new TelegramTransport({
    level: 'error', // Отправляем только ошибки и выше
    botToken: process.env.BOT_TOKEN,
    chatId: process.env.TELEGRAM_LOG_CHAT_ID,
  }));
  logger.info('Telegram транспорт для логов активирован');
}

// Если не в production, также выводим логи в консоль
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
      })
    ),
  }));
}

// Добавляем обработчики для необработанных исключений и отклоненных промисов
process.on('uncaughtException', (error) => {
  logger.error('Необработанное исключение:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Необработанное отклонение промиса:', { reason, promise });
});

export default logger;
