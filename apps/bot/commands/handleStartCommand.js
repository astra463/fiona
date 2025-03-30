import axios from 'axios';
import logger from '../utils/logger.js';
import { bot } from '../bot.js';
import { userTokens } from '../index.js';
import handleError from '../utils/handleError.js';
import { SERVER_URL } from '../config.js';

export async function handleStartCommand(msg) {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'User';

  logger.info(`Получена команда /start от chatId: ${chatId}, name: ${name}`);

  try {
    logger.info(`Отправка запроса авторизации на сервер`, { chatId, name });
    
    const response = await axios.post(
      `${SERVER_URL}/api/auth/telegram`,
      {
        chat_id: chatId,
        name,
      }
    );

    if (response.status === 200) {
      const { token, net_worth } = response.data;
      userTokens[chatId] = token;
      
      // Проверяем, новый ли это пользователь (баланс = 0)
      const isNewUser = net_worth === 0;
      
      logger.info(`Пользователь успешно авторизован`, { 
        chatId, 
        name,
        isNewUser,
        net_worth
      });

      if (!isNewUser) {
        bot.sendMessage(chatId, `👋 Добро пожаловать, ${name}!`, {
          reply_markup: {
            keyboard: [
              ['💰 Мой баланс', '💳 Добавить транзакцию'],
              ['📜 Показать транзакции'],
            ],
            resize_keyboard: true,
          },
        });
      } else {
        bot.sendMessage(
          chatId,
          `👋 Добро пожаловать, ${name}!

Чтобы начать, введите текущий бюджет (сумму, которая у вас сейчас на руках):`
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
            // Добавляем токен авторизации в заголовки запроса
            const updateResponse = await axios.post(
              `${SERVER_URL}/api/users/update-net-worth`,
              {
                chat_id: chatId,
                net_worth: netWorth,
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            if (updateResponse.status === 200) {
              bot.sendMessage(chatId, '✅ Ваш бюджет успешно обновлен!', {
                reply_markup: {
                  keyboard: [
                    ['💰 Мой баланс', '💳 Добавить транзакцию'],
                    ['📜 Показать транзакции'],
                  ],
                  resize_keyboard: true,
                },
              });
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
      }
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
