import axios from 'axios';
import logger from '../utils/logger.js';
import { bot } from '../bot.js';
import { sessionManager } from '../utils/sessionManager.js';
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
      
      // Сохраняем токен в менеджере сессий
      sessionManager.setToken(chatId, token, name);
      
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

        // Очищаем предыдущую сессию пользователя
        sessionManager.clearSession(chatId, bot);
        
        // Устанавливаем новое состояние сессии
        sessionManager.setState(chatId, 'entering_initial_balance');

        // Создаем обработчик для ввода начального баланса
        const initialBalanceHandler = async (msg) => {
          // Проверяем, что это сообщение от нужного пользователя
          if (msg.chat.id !== chatId) {
            return;
          }
          
          const budgetInput = msg.text.trim();
          const netWorth = parseFloat(budgetInput);

          if (isNaN(netWorth) || netWorth < 0) {
            bot.sendMessage(
              chatId,
              '❌ Пожалуйста, введите корректное число для вашего бюджета.'
            );
            // Очищаем сессию пользователя
            sessionManager.clearSession(chatId, bot);
            return;
          }

          try {
            logger.info(`Обновление начального баланса пользователя`, { 
              chatId, 
              netWorth
            });
            
            // Получаем токен из менеджера сессий
            const currentToken = sessionManager.getToken(chatId);
            
            // Добавляем токен авторизации в заголовки запроса
            const updateResponse = await axios.post(
              `${SERVER_URL}/api/users/update-net-worth`,
              {
                chat_id: chatId,
                net_worth: netWorth,
              },
              { headers: { Authorization: `Bearer ${currentToken}` } }
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
            
            // Очищаем сессию пользователя
            sessionManager.clearSession(chatId, bot);
          } catch (err) {
            logger.error(`Ошибка при обновлении баланса`, { 
              chatId, 
              error: err.message,
              stack: err.stack
            });
            handleError(
              chatId,
              err,
              '❌ Ошибка при обновлении бюджета. Попробуйте позже.'
            );
            
            // Очищаем сессию пользователя
            sessionManager.clearSession(chatId, bot);
          }
        };
        
        // Регистрируем обработчик для ввода начального баланса
        sessionManager.setMessageHandler(chatId, initialBalanceHandler, bot);
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
