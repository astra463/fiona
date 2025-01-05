import axios from 'axios';
import logger from '../../../shared/logger.js';
import { bot } from '../bot.js';
import { userTokens } from '../index.js';
import handleError from '../utils/handleError.js';

export async function handleStartCommand(msg) {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'User';

  logger.info(`Получена команда /start от chatId: ${chatId}, name: ${name}`);
  try {
    const response = await axios.post(
      'http://localhost:3000/api/auth/telegram',
      {
        chat_id: chatId,
        name,
      }
    );

    if (response.status === 200) {
      const { token } = response.data;
      userTokens[chatId] = token;

      bot.sendMessage(
        chatId,
        `👋 Добро пожаловать, ${name}!\n\n` +
          `Чтобы начать, введите текущий бюджет (сумму, которая у вас сейчас на руках):`
      );

      bot.once('message', async (msg) => {
        const budgetInput = msg.text.trim();
        const netWorth = parseFloat(budgetInput);

        if (isNaN(netWorth) || netWorth < 0) {
          bot.sendMessage(
            chatId,
            '❌ Пожалуйста, введите корректное число для вашего бюджета.'
          );
          return;
        }

        try {
          const updateResponse = await axios.post(
            'http://localhost:3000/api/users/update-net-worth',
            {
              chat_id: chatId,
              net_worth: netWorth,
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (updateResponse.status === 200) {
            bot.sendMessage(
              chatId,
              `✅ Ваш бюджет успешно обновлен! Теперь вы можете использовать следующие функции:\n\n` +
                `1️⃣ Проверить баланс\n` +
                `2️⃣ Добавить транзакцию\n` +
                `3️⃣ Добавить категорию\n\n` +
                `Используйте меню ниже для действий.`,
              {
                reply_markup: {
                  keyboard: [
                    ['💰 Мой баланс', '💳 Добавить транзакцию'],
                    ['📂 Добавить категорию', '📜 Показать транзакции'],
                  ],
                  resize_keyboard: true,
                },
              }
            );
          } else {
            bot.sendMessage(
              chatId,
              '❌ Ошибка при обновлении бюджета. Попробуйте позже.'
            );
          }
        } catch (err) {
          handleError(
            chatId,
            err,
            '❌ Ошибка при обновлении бюджета. Попробуйте позже.'
          );
        }
      });
    } else {
      bot.sendMessage(chatId, 'Ошибка регистрации. Попробуйте позже.');
    }
  } catch (error) {
    handleError(
      chatId,
      error,
      'Ошибка соединения с сервером. Попробуйте позже.'
    );
  }
}
