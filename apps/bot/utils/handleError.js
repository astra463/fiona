import { bot } from '../bot.js';
import logger from './logger.js';

/**
 * Обрабатывает ошибки, отправляя сообщение пользователю и логируя ошибку
 * @param {number} chatId - ID чата пользователя
 * @param {Error} error - Объект ошибки
 * @param {string} message - Сообщение для пользователя
 * @param {Object} additionalInfo - Дополнительная информация для логирования
 */
function handleError(chatId, error, message = 'Произошла ошибка.', additionalInfo = {}) {
  // Отправляем сообщение пользователю
  bot.sendMessage(chatId, message).catch(sendError => {
    logger.error('Не удалось отправить сообщение об ошибке пользователю:', {
      chatId,
      error: sendError.message,
      originalError: error.message
    });
  });
  
  // Логируем ошибку с дополнительной информацией
  logger.error('Ошибка в боте:', {
    chatId,
    error: error.message,
    stack: error.stack,
    code: error.code,
    response: error.response?.body,
    ...additionalInfo
  });
}

export default handleError;
