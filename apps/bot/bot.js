import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import winston from 'winston';
import dotenv from 'dotenv';

dotenv.config();

// Чтение токена бота и базового URL API из переменных окружения
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN is not defined!');
  process.exit(1);
}

// Настройка логгера
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'bot.log' }),
  ],
});

// Инициализация бота
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const userTokens = {}; // Хранилище токенов: { chatId: token }

logger.info('Бот запущен и готов к работе.');

// Функция для отправки сообщений об ошибке
function handleError(chatId, error, message = 'Произошла ошибка.') {
  bot.sendMessage(chatId, message);
  logger.error(error.message);
}

// Функция обработки команды /start
async function handleStartCommand(msg) {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'User';

  logger.info(`Получена команда /start от chatId: ${chatId}, name: ${name}`);
  try {
    // Шаг 1: Регистрация пользователя
    const response = await axios.post(
      'http://localhost:3000/api/auth/telegram',
      {
        chat_id: chatId,
        name,
      }
    );

    if (response.status === 200) {
      const { token } = response.data;
      userTokens[chatId] = token;

      // Приветственное сообщение и запрос текущего бюджета
      bot.sendMessage(
        chatId,
        `👋 Добро пожаловать, ${name}!\n\n` +
          `Чтобы начать, введите текущий бюджет (сумму, которая у вас сейчас на руках):`
      );

      // Шаг 2: Ожидание ввода текущего бюджета
      bot.once('message', async (msg) => {
        const budgetInput = msg.text.trim();
        const netWorth = parseFloat(budgetInput);

        if (isNaN(netWorth) || netWorth < 0) {
          bot.sendMessage(
            chatId,
            '❌ Пожалуйста, введите корректное число для вашего бюджета.'
          );
          return;
        }

        try {
          // Шаг 3: Обновляем net_worth через API
          const updateResponse = await axios.post(
            'http://localhost:3000/api/users/update-net-worth',
            {
              chat_id: chatId,
              net_worth: netWorth,
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (updateResponse.status === 200) {
            bot.sendMessage(
              chatId,
              `✅ Ваш бюджет успешно обновлен! Теперь вы можете использовать следующие функции:\n\n` +
                `1️⃣ Проверить баланс\n` +
                `2️⃣ Добавить транзакцию\n` +
                `3️⃣ Добавить категорию\n\n` +
                `Используйте меню ниже для действий.`,
              {
                reply_markup: {
                  keyboard: [
                    ['💰 Мой баланс', '💳 Добавить транзакцию'],
                    ['📂 Добавить категорию', '📜 Показать транзакции'],
                  ],
                  resize_keyboard: true,
                },
              }
            );
          } else {
            bot.sendMessage(
              chatId,
              '❌ Ошибка при обновлении бюджета. Попробуйте позже.'
            );
          }
        } catch (err) {
          handleError(
            chatId,
            err,
            '❌ Ошибка при обновлении бюджета. Попробуйте позже.'
          );
        }
      });
    } else {
      bot.sendMessage(chatId, 'Ошибка регистрации. Попробуйте позже.');
    }
  } catch (error) {
    handleError(
      chatId,
      error,
      'Ошибка соединения с сервером. Попробуйте позже.'
    );
  }
}

// Функция обработки "Мой баланс"
async function handleMyBalance(chatId, token) {
  try {
    const response = await axios.get('http://localhost:3000/api/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 200) {
      const { net_worth } = response.data; // Получаем поле net_worth из ответа сервера
      bot.sendMessage(chatId, `💰 Ваш текущий баланс: ${net_worth} 💵`);
    } else {
      bot.sendMessage(chatId, 'Ошибка при получении баланса.');
    }
  } catch (error) {
    handleError(
      chatId,
      error,
      'Ошибка при получении баланса. Попробуйте позже.'
    );
  }
}

async function createCategory(chatId, token, name, parentId) {
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

async function handleAddCategory(chatId, token) {
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
// Функция добавления транзакции
async function handleAddTransaction(chatId, token) {
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

// Функция обработки кнопки "Показать транзакции"
async function handleShowTransactions(chatId, token) {
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
        const transactions = response.data;
        if (transactions.length === 0) {
          bot.sendMessage(chatId, 'За выбранный период транзакций нет.');
        } else {
          const transactionList = transactions
            .map(
              (t) =>
                `💰 Сумма: ${t.amount}, Категория: ${
                  t.category_name
                }, Описание: ${t.description || 'нет'}, Дата: ${t.date}`
            )
            .join('\n');
          bot.sendMessage(chatId, `Ваши транзакции:\n\n${transactionList}`);
        }
      } else {
        bot.sendMessage(chatId, 'Ошибка при получении транзакций.');
      }
    } catch (error) {
      handleError(chatId, error, 'Ошибка при получении транзакций.');
    }
  });
}

// Обработка текстовых команд
bot.onText(/\/start/, handleStartCommand);

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const token = userTokens[chatId];

  if (!token) {
    bot.sendMessage(chatId, 'Сначала выполните /start для авторизации.');
    return;
  }

  switch (text) {
    case '💰 Мой баланс':
      handleMyBalance(chatId, token);
      break;
    case '💳 Добавить транзакцию':
      handleAddTransaction(chatId, token);
      break;
    case '📂 Добавить категорию':
      handleAddCategory(chatId, token);
      break;
    case '📜 Показать транзакции':
      handleShowTransactions(chatId, token);
      break;
  }
});
