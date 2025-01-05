import axios from 'axios';
import { bot } from '../../bot.js';
import handleError from '../../utils/handleError.js';
import { createCategory } from './createCategory.js';

export async function handleAddCategory(chatId, token) {
  try {
    // Шаг 1: Спрашиваем название категории
    bot.sendMessage(chatId, '📂 Введите название новой категории:');

    // Ожидаем следующего сообщения с названием категории
    bot.once('message', async (msg) => {
      const categoryName = msg.text.trim();

      if (!categoryName) {
        bot.sendMessage(chatId, '❌ Название категории не может быть пустым.');
        return;
      }

      try {
        // Проверяем, есть ли категория с таким именем
        const existingCategoriesResponse = await axios.get(
          'http://localhost:3000/api/categories',
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const existingCategories = existingCategoriesResponse.data;

        const duplicateCategory = existingCategories.find(
          (cat) => cat.name.toLowerCase() === categoryName.toLowerCase()
        );

        if (duplicateCategory) {
          bot.sendMessage(
            chatId,
            '❌ Категория с таким названием уже существует. Попробуйте другое название.'
          );
          return;
        }

        // Если категории есть, предлагаем выбрать родительскую
        if (existingCategories.length > 0) {
          const options = existingCategories.map((category) => ({
            text: category.name,
            callback_data: `parent_${category.id}`,
          }));

          options.push({
            text: 'Без родительской категории',
            callback_data: 'parent_null',
          });

          bot.sendMessage(
            chatId,
            'Выберите родительскую категорию или создайте её без родительской:',
            {
              reply_markup: { inline_keyboard: [options] },
            }
          );

          // Обрабатываем выбор родительской категории
          bot.once('callback_query', async (callbackQuery) => {
            const parentData = callbackQuery.data;

            let parentId = null;

            if (parentData.startsWith('parent_')) {
              const [, parentCategoryId] = parentData.split('_');
              parentId =
                parentCategoryId === 'null' ? null : parseInt(parentCategoryId);
            }

            await createCategory(chatId, token, categoryName, parentId);
          });
        } else {
          // Если нет категорий, сразу создаём новую без родительской
          // TODO: делать на бэке
          await createCategory(chatId, token, categoryName, null);
        }
      } catch (err) {
        handleError(
          chatId,
          err,
          '❌ Ошибка при обработке категории. Попробуйте позже.'
        );
      }
    });
  } catch (err) {
    handleError(
      chatId,
      err,
      '❌ Ошибка при добавлении категории. Попробуйте позже.'
    );
  }
}
