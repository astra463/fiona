import axios from 'axios';
import { bot } from '../../bot.js';
import handleError from '../../utils/handleError.js';
import { default_categories } from '../constants/default_categories.js';
import { findCategoryById } from './handleAddTransaction.js';
export async function handleShowTransactions(chatId, token) {
  bot.sendMessage(chatId, 'Выберите период для просмотра транзакций:', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📅 За прошлую неделю', callback_data: 'transactions_week' },
          { text: '📅 За месяц', callback_data: 'transactions_month' },
        ],
      ],
    },
  });

  bot.once('callback_query', async (callbackQuery) => {
    const period = callbackQuery.data;

    try {
      const response = await axios.get(
        `http://localhost:3000/api/transactions?period=${period}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.status === 200) {
        const formatter = new Intl.DateTimeFormat('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        const transactions = response.data;
        if (transactions.length === 0) {
          bot.sendMessage(chatId, 'За выбранный период транзакций нет.');
        } else {
          const transactionList = transactions
            .map((t) => {
              return `
💰 Сумма: ${t.amount}, 
Категория: ${findCategoryById(default_categories, t.category_id).name}, 
Описание: ${t.description || 'нет'}, 
${formatter.format(new Date(t.date))}`;
            })
            .join('\n');
          bot.sendMessage(chatId, `Ваши транзакции:\n\n${transactionList}`);
        }
      } else {
        bot.sendMessage(chatId, 'Ошибка при получении транзакций.');
      }
    } catch (error) {
      console.log(error);
      handleError(chatId, error, 'Ошибка при получении транзакций.');
    }
  });
}
