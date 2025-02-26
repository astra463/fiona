import {
  handleMyBalance,
  handleStartCommand,
  handleShowTransactions,
  handleAddTransaction,
} from './commands/index.js';

import { bot } from './bot.js';

export const userTokens = {};

bot.onText(/\/start/, handleStartCommand);

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const token = userTokens[chatId];

  if (!token) {
    bot.sendMessage(chatId, 'Сначала выполните /start для авторизации.');
    return;
  }

  switch (text) {
    case '💰 Мой баланс':
      handleMyBalance(chatId, token);
      break;
    case '💳 Добавить транзакцию':
      handleAddTransaction(chatId, token);
      break;
    case '📜 Показать транзакции':
      handleShowTransactions(chatId, token);
      break;
  }
});
