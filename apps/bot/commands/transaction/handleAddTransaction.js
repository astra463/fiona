import axios from 'axios';
import { bot } from '../../bot.js';
import handleError from '../../utils/handleError.js';
import { default_categories } from '../constants/default_categories.js';
import { SERVER_URL } from '../../config.js';
import logger from '../../utils/logger.js';
import { sessionManager } from '../../utils/sessionManager.js';

// Функция для форматирования суммы
const formatAmount = (amount) => {
  return amount.toLocaleString('ru-RU', {
    style: 'currency',
    currency: 'RUB',
  });
};

// Функция для получения текущего баланса пользователя
const getUserBalance = async (token) => {
  try {
    const response = await axios.get(`${SERVER_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (response.status === 200) {
      return response.data.net_worth;
    }
    return null;
  } catch (error) {
    logger.error('Ошибка при получении баланса:', {
      error: error.message,
      stack: error.stack
    });
    return null;
  }
};

export async function handleAddTransaction(chatId, token) {
  // Очищаем предыдущую сессию пользователя
  sessionManager.clearSession(chatId, bot);
  
  // Устанавливаем новое состояние сессии
  sessionManager.setState(chatId, 'selecting_type');

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

  // Создаем обработчик для выбора типа транзакции
  const typeSelectionHandler = async (callbackQuery) => {
    // Проверяем, что это сообщение от нужного пользователя
    if (callbackQuery.message.chat.id !== chatId) {
      return;
    }
    
    const transactionType = callbackQuery.data;
    const isIncome = transactionType === 'transaction_income';
    
    logger.info(`Пользователь выбрал тип транзакции`, { 
      chatId, 
      transactionType,
      isIncome
    });

    if (isIncome) {
      // Обновляем состояние сессии
      sessionManager.setState(chatId, 'entering_income');
      
      bot.sendMessage(
        chatId,
        'Введите сумму и источник дохода в формате: сумма, источник.'
      );
      
      // Создаем обработчик для ввода дохода
      const incomeMessageHandler = async (msg) => {
        // Проверяем, что это сообщение от нужного пользователя
        if (msg.chat.id !== chatId) {
          return;
        }
        
        const [amountText, ...descriptionParts] = msg.text.split(',');
        const amount = parseFloat(amountText.trim());
        const description = descriptionParts.join(',').trim();

        if (isNaN(amount) || amount <= 0) {
          bot.sendMessage(chatId, 'Введите корректное значение суммы.');
          // Очищаем сессию пользователя
          sessionManager.clearSession(chatId, bot);
          return;
        }

        try {
          logger.info(`Добавление дохода`, { 
            chatId, 
            amount,
            description
          });
          
          // Получаем актуальный токен из менеджера сессий
          const currentToken = sessionManager.getToken(chatId);
          
          const response = await axios.post(
            `${SERVER_URL}/api/transactions`,
            {
              amount,
              category_id: null, // Для доходов категории нет
              description: description || 'Источник не указан',
            },
            { headers: { Authorization: `Bearer ${currentToken}` } }
          );

          // Получаем обновленный баланс
          const newBalance = await getUserBalance(currentToken);

          bot.sendMessage(
            chatId,
            `✅ Доход успешно добавлен!\n\n💰 Сумма: ${formatAmount(amount)}\n📝 Источник: ${
              description || 'не указан'
            }${
              newBalance !== null ? `\n\n💼 Новый баланс: ${formatAmount(newBalance)}` : ''
            }`
          );
          
          // Очищаем сессию пользователя
          sessionManager.clearSession(chatId, bot);
        } catch (error) {
          logger.error(`Ошибка при добавлении дохода`, { 
            chatId, 
            error: error.message
          });
          handleError(chatId, error, 'Ошибка при добавлении дохода.');
          // Очищаем сессию пользователя
          sessionManager.clearSession(chatId, bot);
        }
      };
      
      // Регистрируем обработчик для ввода дохода
      sessionManager.setMessageHandler(chatId, incomeMessageHandler, bot);

      return;
    }

    // Для расходов выбираем категорию
    // Сохраняем данные в сессии
    sessionManager.setState(chatId, 'selecting_category', {
      currentCategories: default_categories,
      path: [],
      selectedCategory: null,
      customCategories: [] // Добавляем пустой массив для пользовательских категорий
    });
    
    // Загружаем пользовательские категории
    try {
      const currentToken = sessionManager.getToken(chatId);
      const response = await axios.get(
        `${SERVER_URL}/api/categories/custom`,
        { headers: { Authorization: `Bearer ${currentToken}` } }
      );
      
      if (response.status === 200) {
        // Обновляем данные в сессии
        const sessionData = sessionManager.getData(chatId);
        sessionData.customCategories = response.data;
        sessionManager.setState(chatId, 'selecting_category', sessionData);
      }
    } catch (error) {
      logger.error('Ошибка при загрузке пользовательских категорий:', { 
        error: error.message,
        chatId
      });
      // Продолжаем работу даже если не удалось загрузить пользовательские категории
    }

    const updateCategoriesMessage = () => {
      // Получаем данные из сессии
      const sessionData = sessionManager.getData(chatId);
      const currentCategories = sessionData.currentCategories;
      const path = sessionData.path;
      const selectedCategory = sessionData.selectedCategory;
      const customCategories = sessionData.customCategories || [];
      
      const categoryButtons = currentCategories.map((cat) => [
        { text: cat.name, callback_data: `category_${cat.id}` },
      ]);
      
      // Добавляем пользовательские категории, если мы на верхнем уровне
      if (path.length === 0 && customCategories.length > 0) {
        customCategories.forEach(cat => {
          categoryButtons.push([
            { text: `🔹 ${cat.name}`, callback_data: `custom_category_${cat.id}` },
            { text: `🗑️`, callback_data: `delete_custom_category_${cat.id}` }
          ]);
        });
      }
      
      // Добавляем кнопку для создания новой категории на верхнем уровне
      if (path.length === 0) {
        categoryButtons.push([
          { text: '➕ Добавить свою категорию', callback_data: 'add_custom_category' }
        ]);
      }

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
            ? `🔹 Выбрана: ${
                selectedCategory.isCustom 
                  ? selectedCategory.name 
                  : path.map((id) => findCategoryById(default_categories, id).name).join(' > ')
              }`
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

    // Создаем обработчик для выбора категории
    const categorySelectionHandler = async (callbackQuery) => {
      // Проверяем, что это сообщение от нужного пользователя
      if (callbackQuery.message.chat.id !== chatId) {
        return;
      }
      
      const callbackData = callbackQuery.data;
      const state = sessionManager.getState(chatId);
      
      if (state !== 'selecting_category') {
        return;
      }

      // Получаем данные из сессии
      const sessionData = sessionManager.getData(chatId);
      
      // Обработка добавления новой пользовательской категории
      if (callbackData === 'add_custom_category') {
        // Обновляем состояние сессии
        sessionManager.setState(chatId, 'adding_custom_category', sessionData);
        
        bot.sendMessage(
          chatId,
          'Введите название новой категории:'
        );
        
        // Создаем обработчик для ввода названия категории
        const customCategoryNameHandler = async (msg) => {
          // Проверяем, что это сообщение от нужного пользователя
          if (msg.chat.id !== chatId) {
            return;
          }
          
          const categoryName = msg.text.trim();
          
          // Проверяем, не является ли текст командой бота
          if (categoryName.startsWith('/') || 
              categoryName === '💰 Мой баланс' || 
              categoryName === '💳 Добавить транзакцию' || 
              categoryName === '📜 Показать транзакции') {
            bot.sendMessage(chatId, 'Нельзя использовать команды бота в качестве названия категории. Введите другое название:');
            return;
          }
          
          if (!categoryName) {
            bot.sendMessage(chatId, 'Название категории не может быть пустым. Попробуйте еще раз:');
            return;
          }
          
          try {
            // Получаем актуальный токен из менеджера сессий
            const currentToken = sessionManager.getToken(chatId);
            
            // Создаем новую категорию
            const response = await axios.post(
              `${SERVER_URL}/api/categories/custom`,
              {
                name: categoryName
              },
              { headers: { Authorization: `Bearer ${currentToken}` } }
            );
            
            if (response.status === 201) {
              const newCategory = response.data;
              
              // Добавляем новую категорию в список пользовательских категорий
              sessionData.customCategories.push(newCategory);
              
              // Выбираем новую категорию
              sessionData.selectedCategory = {
                id: newCategory.id,
                name: newCategory.name,
                isCustom: true
              };
              
              // Обновляем состояние сессии
              sessionManager.setState(chatId, 'selecting_category', sessionData);
              
              bot.sendMessage(
                chatId,
                `✅ Категория "${categoryName}" успешно добавлена!`
              );
              
              // Обновляем сообщение с категориями
              updateCategoriesMessage();
            }
          } catch (error) {
            logger.error('Ошибка при создании пользовательской категории:', { 
              error: error.message,
              chatId,
              categoryName
            });
            handleError(chatId, error, 'Ошибка при создании категории.');
            
            // Возвращаемся к выбору категории
            sessionManager.setState(chatId, 'selecting_category', sessionData);
            updateCategoriesMessage();
          }
        };
        
        // Регистрируем обработчик для ввода названия категории
        sessionManager.setMessageHandler(chatId, customCategoryNameHandler, bot);
        
        return;
      }
      
      // Обработка удаления пользовательской категории
      if (callbackData.startsWith('delete_custom_category_')) {
        const categoryId = parseInt(callbackData.split('_')[3], 10);
        const customCategory = sessionData.customCategories.find(cat => cat.id === categoryId);
        
        if (customCategory) {
          try {
            // Получаем актуальный токен из менеджера сессий
            const currentToken = sessionManager.getToken(chatId);
            
            // Удаляем категорию
            const response = await axios.delete(
              `${SERVER_URL}/api/categories/custom/${categoryId}`,
              { headers: { Authorization: `Bearer ${currentToken}` } }
            );
            
            if (response.status === 200) {
              // Удаляем категорию из списка
              sessionData.customCategories = sessionData.customCategories.filter(cat => cat.id !== categoryId);
              
              // Обновляем состояние сессии
              sessionManager.setState(chatId, 'selecting_category', sessionData);
              
              bot.sendMessage(
                chatId,
                `✅ Категория "${customCategory.name}" успешно удалена!`
              );
              
              // Обновляем сообщение с категориями
              updateCategoriesMessage();
            }
          } catch (error) {
            logger.error('Ошибка при удалении пользовательской категории:', { 
              error: error.message,
              chatId,
              categoryId
            });
            handleError(chatId, error, 'Ошибка при удалении категории.');
          }
        }
        
        return;
      }
      
      // Обработка выбора пользовательской категории
      if (callbackData.startsWith('custom_category_')) {
        const categoryId = parseInt(callbackData.split('_')[2], 10);
        const customCategory = sessionData.customCategories.find(cat => cat.id === categoryId);
        
        if (customCategory) {
          sessionData.selectedCategory = {
            id: customCategory.id,
            name: customCategory.name,
            isCustom: true
          };
          
          // Обновляем данные в сессии
          sessionManager.setState(chatId, 'selecting_category', sessionData);
          
          updateCategoriesMessage();
        }
        
        return;
      }
      
      if (callbackData === 'category_back') {
        sessionData.path.pop();
        sessionData.selectedCategory =
          sessionData.path.length > 0
            ? findCategoryById(default_categories, sessionData.path[sessionData.path.length - 1])
            : null;
        sessionData.currentCategories =
          sessionData.path.length === 0 ? default_categories : sessionData.selectedCategory.children;
        
        // Обновляем данные в сессии
        sessionManager.setState(chatId, 'selecting_category', sessionData);
        
        updateCategoriesMessage();
        return;
      }

      if (callbackData === 'category_confirm') {
        // Обновляем состояние сессии
        sessionManager.setState(chatId, 'entering_expense', sessionData);
        
        bot.sendMessage(
          chatId,
          'Введите сумму и описание (необязательно) в формате: сумма, описание.'
        );

        // Создаем обработчик для ввода расхода
        const expenseMessageHandler = async (msg) => {
          // Проверяем, что это сообщение от нужного пользователя
          if (msg.chat.id !== chatId) {
            return;
          }
          
          const [amountText, ...descriptionParts] = msg.text.split(',');
          const amount = parseFloat(amountText.trim());
          const description = descriptionParts.join(',').trim();

          if (isNaN(amount) || amount <= 0) {
            bot.sendMessage(chatId, 'Введите корректное значение суммы.');
            // Очищаем сессию пользователя
            sessionManager.clearSession(chatId, bot);
            return;
          }

          try {
            // Получаем данные из сессии
            const sessionData = sessionManager.getData(chatId);
            
            logger.info(`Добавление расхода`, { 
              chatId, 
              amount,
              category: sessionData.selectedCategory.id,
              description
            });
            
            // Получаем актуальный токен из менеджера сессий
            const currentToken = sessionManager.getToken(chatId);
            
            const response = await axios.post(
              `${SERVER_URL}/api/transactions`,
              {
                amount: -amount,
                category_id: sessionData.selectedCategory.isCustom 
                  ? `custom_${sessionData.selectedCategory.id}` 
                  : sessionData.selectedCategory.id,
                description: description || null,
              },
              { headers: { Authorization: `Bearer ${currentToken}` } }
            );

            // Получаем обновленный баланс
            const newBalance = await getUserBalance(currentToken);
            
            // Формируем сообщение о категории
            let categoryText = '';
            if (sessionData.selectedCategory.isCustom) {
              categoryText = sessionData.selectedCategory.name;
            } else {
              categoryText = sessionData.path
                .map((id) => findCategoryById(default_categories, id).name)
                .join(' > ');
            }

            bot.sendMessage(
              chatId,
              `✅ Расход успешно добавлен!\n\n💰 Сумма: ${formatAmount(-amount)}\n📂 Категория: ${categoryText}\n📝 Описание: ${description || 'нет'}${
                newBalance !== null ? `\n\n💼 Новый баланс: ${formatAmount(newBalance)}` : ''
              }`
            );
            
            // Очищаем сессию пользователя
            sessionManager.clearSession(chatId, bot);
          } catch (error) {
            logger.error(`Ошибка при добавлении расхода`, { 
              chatId, 
              error: error.message
            });
            handleError(chatId, error, 'Ошибка при добавлении расхода.');
            // Очищаем сессию пользователя
            sessionManager.clearSession(chatId, bot);
          }
        };
        
        // Регистрируем обработчик для ввода расхода
        sessionManager.setMessageHandler(chatId, expenseMessageHandler, bot);

        return;
      }

      const categoryId = parseInt(callbackData.split('_')[1], 10);
      const category = findCategoryById(default_categories, categoryId);

      if (!category) return;

      if (category.children) {
        sessionData.path.push(categoryId);
        sessionData.currentCategories = category.children;
        sessionData.selectedCategory = null;
      } else {
        sessionData.selectedCategory = category;
      }

      // Обновляем данные в сессии
      sessionManager.setState(chatId, 'selecting_category', sessionData);
      
      updateCategoriesMessage();
    };
    
    // Регистрируем обработчик для выбора категории
    sessionManager.setCallbackHandler(chatId, categorySelectionHandler, bot);
  };
  
  // Регистрируем обработчик для выбора типа транзакции
  sessionManager.setCallbackHandler(chatId, typeSelectionHandler, bot);
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
