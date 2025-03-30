import {
  handleMyBalance,
  handleStartCommand,
  handleShowTransactions,
  handleAddTransaction,
} from './commands/index.js';

import { bot } from './bot.js';
import logger from './utils/logger.js';

export const userTokens = {};

bot.onText(/\/start/, handleStartCommand);

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  const token = userTokens[chatId];
  const name = msg.from?.first_name || 'Unknown';

  // Логируем входящее сообщение
  logger.info(`Обработка сообщения от пользователя`, {
    chatId,
    name,
    text,
    hasToken: !!token
  });

  // Игнорируем команду /start, так как она обрабатывается отдельным обработчиком
  if (text.startsWith('/start')) {
    logger.info(`Пропуск сообщения /start, так как оно обрабатывается отдельно`, { chatId });
    return;
  }

  if (!token) {
    logger.warn(`Пользователь не авторизован`, { chatId, name });
    bot.sendMessage(chatId, 'Сначала выполните /start для авторизации.');
    return;
  }

  switch (text) {
    case '💰 Мой баланс':
      logger.info(`Запрос баланса`, { chatId, name });
      handleMyBalance(chatId, token);
      break;
    case '💳 Добавить транзакцию':
      logger.info(`Запрос добавления транзакции`, { chatId, name });
      handleAddTransaction(chatId, token);
      break;
    case '📜 Показать транзакции':
      logger.info(`Запрос просмотра транзакций`, { chatId, name });
      handleShowTransactions(chatId, token);
      break;
    default:
      // Если сообщение не соответствует ни одной команде
      if (text && !text.startsWith('/')) {
        logger.info(`Получено неизвестное сообщение`, { chatId, name, text });
        bot.sendMessage(chatId, 'Используйте кнопки меню для взаимодействия с ботом.');
      }
  }
});
