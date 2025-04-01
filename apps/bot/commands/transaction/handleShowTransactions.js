import axios from 'axios';
import { bot } from '../../bot.js';
import handleError from '../../utils/handleError.js';
import logger from '../../utils/logger.js';
import { default_categories } from '../constants/default_categories.js';
import { findCategoryById } from './handleAddTransaction.js';
import { SERVER_URL } from '../../config.js';
import { sessionManager } from '../../utils/sessionManager.js';

export async function handleShowTransactions(chatId) {
  // Получаем актуальный токен из менеджера сессий
  const token = sessionManager.getToken(chatId);
  
  if (!token) {
    bot.sendMessage(chatId, 'Сначала выполните /start для авторизации.');
    return;
  }

  // Очищаем предыдущую сессию пользователя
  sessionManager.clearSession(chatId, bot);
  
  // Устанавливаем новое состояние сессии
  sessionManager.setState(chatId, 'selecting_period');

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

  // Создаем обработчик для выбора периода
  const periodSelectionHandler = async (callbackQuery) => {
    // Проверяем, что это сообщение от нужного пользователя
    if (callbackQuery.message.chat.id !== chatId) {
      return;
    }
    
    const period = callbackQuery.data;
    
    logger.info(`Пользователь выбрал период для просмотра транзакций`, { 
      chatId, 
      period
    });

    try {
      // Получаем актуальный токен из менеджера сессий
      const currentToken = sessionManager.getToken(chatId);
      
      // Получаем транзакции
      const transactionsResponse = await axios.get(
        `${SERVER_URL}/api/transactions?period=${period}`,
        {
          headers: { Authorization: `Bearer ${currentToken}` },
        }
      );
      
      // Получаем пользовательские категории
      let customCategories = [];
      try {
        const categoriesResponse = await axios.get(
          `${SERVER_URL}/api/categories/custom`,
          {
            headers: { Authorization: `Bearer ${currentToken}` },
          }
        );
        
        if (categoriesResponse.status === 200) {
          customCategories = categoriesResponse.data;
        }
      } catch (error) {
        logger.error('Ошибка при получении пользовательских категорий:', {
          error: error.message,
          chatId
        });
        // Продолжаем работу даже если не удалось загрузить пользовательские категории
      }

      if (transactionsResponse.status === 200) {
        const formatter = new Intl.DateTimeFormat('ru-RU', {
          timeZone: 'Europe/Moscow',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });

        const transactions = transactionsResponse.data;
        if (transactions.length === 0) {
          bot.sendMessage(chatId, 'За выбранный период транзакций нет.');
        } else {
          const transactionList = transactions
            .map((t) => {
              // Определяем тип транзакции (доход/расход) по сумме
              const isIncome = t.amount > 0;

              // Определяем категорию транзакции
              let categoryText = 'Без категории';
              
              if (isIncome) {
                categoryText = 'Доход';
              } else if (t.category_id) {
                // Сначала проверяем, есть ли категория в пользовательских категориях
                const customCategory = customCategories.find(cat => cat.id === t.category_id);
                if (customCategory) {
                  categoryText = `🔹 ${customCategory.name}`;
                } else {
                  // Если не нашли в пользовательских, ищем в стандартных категориях
                  const category = findCategoryById(default_categories, t.category_id);
                  if (category) {
                    categoryText = category.name;
                  }
                }
              }

              // Форматирование вывода в зависимости от дохода или расхода
              return isIncome
                ? `💰 Пополнение: ${t.amount.toLocaleString('ru-RU', {
                    style: 'currency',
                    currency: 'RUB',
                  })}
Дата: ${formatter.format(new Date(t.date))}
Описание: ${t.description || 'нет'}`
                : `💸 Расход: ${t.amount.toLocaleString('ru-RU', {
                    style: 'currency',
                    currency: 'RUB',
                  })}
Дата: ${formatter.format(new Date(t.date))}
Описание: ${t.description || 'нет'}, 
Категория: ${categoryText}`;
            })
            .join('\n\n');
          bot.sendMessage(chatId, `Ваши транзакции:\n\n${transactionList}`);
        }
      } else {
        bot.sendMessage(chatId, 'Ошибка при получении транзакций.');
      }
      
      // Очищаем сессию пользователя
      sessionManager.clearSession(chatId, bot);
    } catch (error) {
      logger.error('Ошибка при получении транзакций:', {
        error: error.message,
        stack: error.stack,
        chatId,
        period,
      });
      handleError(chatId, error, 'Ошибка при получении транзакций.');
      
      // Очищаем сессию пользователя
      sessionManager.clearSession(chatId, bot);
    }
  };
  
  // Регистрируем обработчик для выбора периода
  sessionManager.setCallbackHandler(chatId, periodSelectionHandler, bot);
}
