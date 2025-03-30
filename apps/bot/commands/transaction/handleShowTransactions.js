import axios from 'axios';
import { bot } from '../../bot.js';
import handleError from '../../utils/handleError.js';
import logger from '../../utils/logger.js';
import { default_categories } from '../constants/default_categories.js';
import { findCategoryById } from './handleAddTransaction.js';
import { SERVER_URL } from '../../config.js';
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
        `${SERVER_URL}/api/transactions?period=${period}`,
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
              // Определяем тип транзакции (доход/расход) по сумме
              const isIncome = t.amount > 0;
              
              // Для доходов не показываем категорию, для расходов проверяем наличие категории
              const categoryText = isIncome 
                ? 'Доход' 
                : (t.category_id && findCategoryById(default_categories, t.category_id) 
                    ? findCategoryById(default_categories, t.category_id).name 
                    : 'Без категории');
              
              return `
💰 Сумма: ${t.amount}, 
${isIncome ? 'Тип' : 'Категория'}: ${categoryText}, 
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
      logger.error('Ошибка при получении транзакций:', {
        error: error.message,
        stack: error.stack,
        chatId,
        period
      });
      handleError(chatId, error, 'Ошибка при получении транзакций.');
    }
  });
}
