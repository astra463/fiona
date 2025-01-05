import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

import logger from '../../shared/logger.js';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN is not defined!');
  process.exit(1);
}

export const bot = new TelegramBot(BOT_TOKEN, { polling: true });

logger.info('Бот запущен и готов к работе.');
