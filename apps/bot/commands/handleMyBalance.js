import axios from 'axios';
import { bot } from '../bot.js';
import handleError from '../utils/handleError.js';
import logger from '../utils/logger.js';
import { SERVER_URL } from '../config.js';
import { sessionManager } from '../utils/sessionManager.js';

export async function handleMyBalance(chatId) {
  // Получаем актуальный токен из менеджера сессий
  const token = sessionManager.getToken(chatId);
  
  if (!token) {
    bot.sendMessage(chatId, 'Сначала выполните /start для авторизации.');
    return;
  }
  try {
    const response = await axios.get(`${SERVER_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 200) {
      const { net_worth } = response.data;
      bot.sendMessage(
        chatId,
        `💰 Ваш текущий баланс: ${net_worth.toLocaleString('ru-RU', {
          style: 'currency',
          currency: 'RUB',
        })} 💵`
      );
    } else {
      bot.sendMessage(chatId, 'Ошибка при получении баланса.');
    }
  } catch (error) {
    logger.error('Ошибка при получении баланса:', {
      error: error.message,
      stack: error.stack,
      chatId
    });
    handleError(
      chatId,
      error,
      'Ошибка при получении баланса. Попробуйте позже.'
    );
  }
}
