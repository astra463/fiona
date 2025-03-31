import {
  handleMyBalance,
  handleStartCommand,
  handleShowTransactions,
  handleAddTransaction,
} from './commands/index.js';

import { bot } from './bot.js';
import logger from './utils/logger.js';
import { sessionManager } from './utils/sessionManager.js';

bot.onText(/\/start/, handleStartCommand);

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  const token = sessionManager.getToken(chatId);
  const name = msg.from?.first_name || 'Unknown';

  logger.info(`Обработка сообщения от пользователя`, {
    chatId,
    name,
    text,
    hasToken: !!token
  });

  if (text.startsWith('/start')) {
    logger.info(`Пропуск сообщения /start, так как оно обрабатывается отдельно`, { chatId });
    return;
  }

  if (!token) {
    logger.warn(`Пользователь не авторизован`, { chatId, name });
    bot.sendMessage(chatId, 'Сначала выполните /start для авторизации.');
    return;
  }

  // Проверяем, есть ли активное состояние сессии
  const state = sessionManager.getState(chatId);
  if (state) {
    // Если есть активное состояние, то обработчики уже должны быть установлены
    // через sessionManager, поэтому здесь ничего не делаем
    logger.info(`Пользователь находится в состоянии ${state}`, { chatId, name });
    return;
  }

  switch (text) {
    case '💰 Мой баланс':
      logger.info(`Запрос баланса`, { chatId, name });
      handleMyBalance(chatId);
      break;
    case '💳 Добавить транзакцию':
      logger.info(`Запрос добавления транзакции`, { chatId, name });
      handleAddTransaction(chatId);
      break;
    case '📜 Показать транзакции':
      logger.info(`Запрос просмотра транзакций`, { chatId, name });
      handleShowTransactions(chatId);
      break;
    default:
      // Если сообщение не соответствует ни одной команде
      if (text && !text.startsWith('/')) {
        logger.info(`Получено неизвестное сообщение`, { chatId, name, text });
        bot.sendMessage(chatId, 'Используйте кнопки меню для взаимодействия с ботом.');
      }
  }
});
