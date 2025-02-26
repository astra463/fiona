import { bot } from '../bot.js';

function handleError(chatId, error, message = 'Произошла ошибка.') {
  bot.sendMessage(chatId, message);
  console.error(error.message);
}

export default handleError;
