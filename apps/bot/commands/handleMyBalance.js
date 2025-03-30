import axios from 'axios';
import { bot } from '../bot.js';
import handleError from '../utils/handleError.js';
import logger from '../utils/logger.js';
import { SERVER_URL } from '../config.js';

export async function handleMyBalance(chatId, token) {
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
    handleError(
      bot,
      logger,
      chatId,
      error,
      'Ошибка при получении баланса. Попробуйте позже.'
    );
  }
}
