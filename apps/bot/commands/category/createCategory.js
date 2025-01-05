import axios from 'axios';
import { bot } from '../../bot.js';
import handleError from '../../utils/handleError.js';

export async function createCategory(chatId, token, name, parentId) {
  try {
    const response = await axios.post(
      'http://localhost:3000/api/categories',
      { name, parent_id: parentId },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.status === 200) {
      bot.sendMessage(chatId, `✅ Категория "${name}" успешно создана!`);
    } else {
      bot.sendMessage(chatId, '❌ Ошибка при создании категории.');
    }
  } catch (error) {
    handleError(
      chatId,
      error,
      '❌ Ошибка при создании категории. Попробуйте позже.'
    );
  }
}
