import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import logger from './utils/logger.js';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  logger.error('BOT_TOKEN is not defined!');
  process.exit(1);
}

// Создаем экземпляр бота с расширенным логированием
export const bot = new TelegramBot(BOT_TOKEN, { 
  polling: true,
  filepath: false // Отключаем сохранение файлов локально
});

// Логируем запуск бота
logger.info('Бот запущен и готов к работе.', {
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch
});

// Обработка ошибок бота
bot.on('polling_error', (error) => {
  logger.error('Ошибка при опросе Telegram API:', { 
    error: error.message,
    code: error.code,
    stack: error.stack
  });
});

bot.on('webhook_error', (error) => {
  logger.error('Ошибка webhook:', { 
    error: error.message,
    stack: error.stack
  });
});

bot.on('error', (error) => {
  logger.error('Общая ошибка бота:', { 
    error: error.message,
    stack: error.stack
  });
});

// Логирование всех входящих сообщений
bot.on('message', (msg) => {
  logger.info('Получено сообщение:', {
    chatId: msg.chat.id,
    from: msg.from ? `${msg.from.first_name} (${msg.from.id})` : 'Unknown',
    text: msg.text || '[Нет текста]',
    messageType: Object.keys(msg).filter(key => 
      ['text', 'audio', 'document', 'photo', 'sticker', 'video', 'voice', 'contact', 'location'].includes(key)
    )[0] || 'unknown'
  });
});

// Логирование всех callback-запросов
bot.on('callback_query', (query) => {
  logger.info('Получен callback_query:', {
    chatId: query.message.chat.id,
    from: query.from ? `${query.from.first_name} (${query.from.id})` : 'Unknown',
    data: query.data
  });
});
