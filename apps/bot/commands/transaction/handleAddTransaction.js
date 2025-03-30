import axios from 'axios';
import { bot } from '../../bot.js';
import handleError from '../../utils/handleError.js';
import { default_categories } from '../constants/default_categories.js';
import { SERVER_URL } from '../../config.js';

export async function handleAddTransaction(chatId, token) {
  bot.sendMessage(chatId, 'Это доход или расход?', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '💵 Доход', callback_data: 'transaction_income' },
          { text: '💸 Расход', callback_data: 'transaction_expense' },
        ],
      ],
    },
  });

  bot.once('callback_query', async (callbackQuery) => {
    const transactionType = callbackQuery.data;
    const isIncome = transactionType === 'transaction_income';

    if (isIncome) {
      bot.sendMessage(
        chatId,
        'Введите сумму и источник дохода в формате: сумма, источник.'
      );
      bot.once('message', async (msg) => {
        const [amountText, ...descriptionParts] = msg.text.split(',');
        const amount = parseFloat(amountText.trim());
        const description = descriptionParts.join(',').trim();

        if (isNaN(amount) || amount <= 0) {
          bot.sendMessage(chatId, 'Введите корректное значение суммы.');
          return;
        }

        try {
          await axios.post(
            `${SERVER_URL}/api/transactions`,
            {
              amount,
              category_id: null, // Для доходов категории нет
              description: description || 'Источник не указан',
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          bot.sendMessage(
            chatId,
            `✅ Доход успешно добавлен!\n\n💰 Сумма: ${amount}\n📝 Источник: ${
              description || 'не указан'
            }`
          );
        } catch (error) {
          console.log(error);
          handleError(chatId, error, 'Ошибка при добавлении дохода.');
        }
      });

      return;
    }

    // Для расходов выбираем категорию
    let currentCategories = default_categories;
    let path = [];
    let selectedCategory = null;

    const updateCategoriesMessage = () => {
      const categoryButtons = currentCategories.map((cat) => [
        { text: cat.name, callback_data: `category_${cat.id}` },
      ]);

      const navigationButtons = [];
      if (path.length > 0) {
        navigationButtons.push({
          text: '🔙 Назад',
          callback_data: 'category_back',
        });
      }
      if (selectedCategory) {
        navigationButtons.push({
          text: `✅ Подтвердить`,
          callback_data: 'category_confirm',
        });
      }

      if (navigationButtons.length > 0) {
        categoryButtons.push(navigationButtons);
      }

      bot.editMessageText(
        `Выберите категорию расхода:\n\n${
          selectedCategory
            ? `🔹 Выбрана: ${path
                .map((id) => findCategoryById(default_categories, id).name)
                .join(' > ')}`
            : ''
        }`,
        {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          reply_markup: { inline_keyboard: categoryButtons },
        }
      );
    };

    updateCategoriesMessage();

    bot.on('callback_query', async (callbackQuery) => {
      const callbackData = callbackQuery.data;

      if (callbackData === 'category_back') {
        path.pop();
        selectedCategory =
          path.length > 0
            ? findCategoryById(default_categories, path[path.length - 1])
            : null;
        currentCategories =
          path.length === 0 ? default_categories : selectedCategory.children;
        updateCategoriesMessage();
        return;
      }

      if (callbackData === 'category_confirm') {
        bot.sendMessage(
          chatId,
          'Введите сумму и описание (необязательно) в формате: сумма, описание.'
        );

        bot.once('message', async (msg) => {
          const [amountText, ...descriptionParts] = msg.text.split(',');
          const amount = parseFloat(amountText.trim());
          const description = descriptionParts.join(',').trim();

          if (isNaN(amount) || amount <= 0) {
            bot.sendMessage(chatId, 'Введите корректное значение суммы.');
            return;
          }

          try {
            await axios.post(
              `${SERVER_URL}/api/transactions`,
              {
                amount: -amount,
                category_id: selectedCategory.id,
                description: description || null,
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            bot.sendMessage(
              chatId,
              `✅ Расход успешно добавлен!\n\n💰 Сумма: -${amount}\n📂 Категория: ${path
                .map((id) => findCategoryById(default_categories, id).name)
                .join(' > ')}\n📝 Описание: ${description || 'нет'}`
            );
          } catch (error) {
            handleError(chatId, error, 'Ошибка при добавлении расхода.');
          }
        });

        return;
      }

      const categoryId = parseInt(callbackData.split('_')[1], 10);
      const category = findCategoryById(default_categories, categoryId);

      if (!category) return;

      if (category.children) {
        path.push(categoryId);
        currentCategories = category.children;
        selectedCategory = null;
      } else {
        selectedCategory = category;
      }

      updateCategoriesMessage();
    });
  });
}

export const findCategoryById = (categories, id) => {
  for (const category of categories) {
    if (category.id === id) return category;
    if (category.children) {
      const found = findCategoryById(category.children, id);
      if (found) return found;
    }
  }
  return null;
};
