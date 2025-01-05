import axios from 'axios';
import { bot } from '../../bot.js';
import handleError from '../../utils/handleError.js';

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

    try {
      const categoryResponse = await axios.get(
        'http://localhost:3000/api/categories',
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (categoryResponse.status === 200 && categoryResponse.data.length > 0) {
        const categories = categoryResponse.data;
        const categoryButtons = categories.map((cat) => [
          { text: cat.name, callback_data: `category_${cat.id}` },
        ]);

        bot.sendMessage(chatId, 'Выберите категорию для транзакции:', {
          reply_markup: { inline_keyboard: categoryButtons },
        });

        bot.once('callback_query', async (callbackQuery) => {
          const categoryId = parseInt(callbackQuery.data.split('_')[1]);
          const selectedCategory = categories.find(
            (cat) => cat.id === categoryId
          );

          bot.sendMessage(
            chatId,
            `Вы выбрали категорию: "${selectedCategory.name}". Введите сумму и описание (необязательно) в формате: сумма, описание.`
          );

          bot.once('message', async (msg) => {
            const [amountText, ...descriptionParts] = msg.text.split(',');
            const amount = parseFloat(amountText.trim());
            const description = descriptionParts.join(',').trim();

            if (isNaN(amount) || amount <= 0) {
              bot.sendMessage(chatId, 'Введите корректное значение суммы.');
              return;
            }

            const finalAmount = isIncome ? amount : -amount;

            try {
              const transactionResponse = await axios.post(
                'http://localhost:3000/api/transactions',
                {
                  amount: finalAmount,
                  category_id: categoryId,
                  description: description || null,
                },
                { headers: { Authorization: `Bearer ${token}` } }
              );

              if (transactionResponse.status === 200) {
                bot.sendMessage(
                  chatId,
                  `✅ Транзакция успешно добавлена!\n\n💰 Сумма: ${finalAmount}\n📂 Категория: ${
                    selectedCategory.name
                  }\n📝 Описание: ${description || 'нет'}`
                );
              } else {
                bot.sendMessage(chatId, 'Ошибка при добавлении транзакции.');
              }
            } catch (error) {
              handleError(chatId, error, 'Ошибка при добавлении транзакции.');
            }
          });
        });
      } else {
        bot.sendMessage(
          chatId,
          'У вас еще нет категорий. Сначала создайте категорию.'
        );
      }
    } catch (error) {
      handleError(chatId, error, 'Ошибка при получении списка категорий.');
    }
  });
}
