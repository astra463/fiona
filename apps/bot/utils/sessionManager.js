import axios from 'axios';
import logger from './logger.js';
import { SERVER_URL } from '../config.js';

// Централизованное хранилище сессий
class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.tokenRefreshTimers = new Map();
    
    // Интервал для очистки устаревших сессий (каждый час)
    setInterval(() => this.cleanupSessions(), 60 * 60 * 1000);
    
    logger.info('SessionManager инициализирован');
  }

  /**
   * Получение сессии пользователя. Если сессии нет, она будет создана автоматически.
   * @param {number} chatId - ID чата пользователя
   * @returns {Object} Объект сессии пользователя
   */
  getSession(chatId) {
    if (!this.sessions.has(chatId)) {
      this.sessions.set(chatId, {
        chatId,
        token: null,
        state: null,
        data: {},
        lastActivity: Date.now(),
        handlers: {
          message: null,
          callback: null
        }
      });
    } else {
      // Обновляем время последней активности
      const session = this.sessions.get(chatId);
      session.lastActivity = Date.now();
    }
    
    return this.sessions.get(chatId);
  }

  /**
   * Установка токена для пользователя и настройка автоматического обновления
   * @param {number} chatId - ID чата пользователя
   * @param {string} token - JWT токен
   * @param {string} name - Имя пользователя (опционально)
   */
  setToken(chatId, token, name) {
    const session = this.getSession(chatId);
    session.token = token;
    session.name = name;
    
    // Очищаем предыдущий таймер обновления токена, если он существует
    if (this.tokenRefreshTimers.has(chatId)) {
      clearTimeout(this.tokenRefreshTimers.get(chatId));
    }
    
    // Устанавливаем таймер для обновления токена за 1 час до истечения срока (23 часа)
    const refreshTimer = setTimeout(() => {
      this.refreshToken(chatId);
    }, 23 * 60 * 60 * 1000);
    
    this.tokenRefreshTimers.set(chatId, refreshTimer);
    
    logger.info('Токен установлен для пользователя', { chatId, name });
  }

  /**
   * Обновление токена пользователя
   * @param {number} chatId - ID чата пользователя
   */
  async refreshToken(chatId) {
    const session = this.getSession(chatId);
    
    if (!session.token) {
      logger.warn('Попытка обновить токен для пользователя без токена', { chatId });
      return;
    }
    
    try {
      logger.info('Обновление токена для пользователя', { chatId });
      
      const response = await axios.post(
        `${SERVER_URL}/api/auth/telegram`,
        {
          chat_id: chatId,
          name: session.name || 'User'
        }
      );
      
      if (response.status === 200) {
        const { token } = response.data;
        this.setToken(chatId, token, session.name);
        logger.info('Токен успешно обновлен', { chatId });
      } else {
        logger.error('Ошибка при обновлении токена', { 
          chatId, 
          status: response.status 
        });
      }
    } catch (error) {
      logger.error('Ошибка при обновлении токена', { 
        chatId, 
        error: error.message 
      });
    }
  }

  /**
   * Получение токена пользователя
   * @param {number} chatId - ID чата пользователя
   * @returns {string|null} JWT токен или null, если токен не найден
   */
  getToken(chatId) {
    const session = this.getSession(chatId);
    return session.token;
  }

  /**
   * Установка состояния сессии пользователя
   * @param {number} chatId - ID чата пользователя
   * @param {string} state - Состояние сессии
   * @param {Object} data - Дополнительные данные состояния (опционально)
   */
  setState(chatId, state, data = {}) {
    const session = this.getSession(chatId);
    session.state = state;
    
    // Объединяем существующие данные с новыми
    session.data = { ...session.data, ...data };
    
    logger.info('Состояние сессии обновлено', { 
      chatId, 
      state, 
      data 
    });
  }

  /**
   * Получение состояния сессии пользователя
   * @param {number} chatId - ID чата пользователя
   * @returns {string|null} Состояние сессии или null, если состояние не установлено
   */
  getState(chatId) {
    const session = this.getSession(chatId);
    return session.state;
  }

  /**
   * Получение данных сессии пользователя
   * @param {number} chatId - ID чата пользователя
   * @returns {Object} Данные сессии
   */
  getData(chatId) {
    const session = this.getSession(chatId);
    return session.data;
  }

  /**
   * Установка обработчика сообщений для пользователя
   * @param {number} chatId - ID чата пользователя
   * @param {Function} handler - Функция-обработчик
   * @param {Object} bot - Экземпляр бота
   */
  setMessageHandler(chatId, handler, bot) {
    const session = this.getSession(chatId);
    
    // Удаляем предыдущий обработчик, если он существует
    if (session.handlers.message) {
      bot.removeListener('message', session.handlers.message);
    }
    
    session.handlers.message = handler;
    
    if (handler) {
      bot.on('message', handler);
    }
  }

  /**
   * Установка обработчика callback-запросов для пользователя
   * @param {number} chatId - ID чата пользователя
   * @param {Function} handler - Функция-обработчик
   * @param {Object} bot - Экземпляр бота
   */
  setCallbackHandler(chatId, handler, bot) {
    const session = this.getSession(chatId);
    
    // Удаляем предыдущий обработчик, если он существует
    if (session.handlers.callback) {
      bot.removeListener('callback_query', session.handlers.callback);
    }
    
    session.handlers.callback = handler;
    
    if (handler) {
      bot.on('callback_query', handler);
    }
  }

  /**
   * Очистка сессии пользователя
   * @param {number} chatId - ID чата пользователя
   * @param {Object} bot - Экземпляр бота
   */
  clearSession(chatId, bot) {
    const session = this.getSession(chatId);
    
    // Удаляем обработчики
    if (session.handlers.message) {
      bot.removeListener('message', session.handlers.message);
    }
    
    if (session.handlers.callback) {
      bot.removeListener('callback_query', session.handlers.callback);
    }
    
    // Сбрасываем состояние и данные, но сохраняем токен
    session.state = null;
    session.data = {};
    session.handlers = {
      message: null,
      callback: null
    };
    
    logger.info('Сессия очищена для пользователя', { chatId });
  }

  /**
   * Полное удаление сессии пользователя
   * @param {number} chatId - ID чата пользователя
   * @param {Object} bot - Экземпляр бота
   */
  deleteSession(chatId, bot) {
    // Сначала очищаем сессию, чтобы удалить обработчики
    this.clearSession(chatId, bot);
    
    // Удаляем таймер обновления токена
    if (this.tokenRefreshTimers.has(chatId)) {
      clearTimeout(this.tokenRefreshTimers.get(chatId));
      this.tokenRefreshTimers.delete(chatId);
    }
    
    // Удаляем сессию
    this.sessions.delete(chatId);
    
    logger.info('Сессия удалена для пользователя', { chatId });
  }

  /**
   * Очистка устаревших сессий
   * Удаляет сессии, которые не использовались более 24 часов
   */
  cleanupSessions() {
    const now = Date.now();
    const inactiveThreshold = 24 * 60 * 60 * 1000; // 24 часа
    
    for (const [chatId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > inactiveThreshold) {
        logger.info('Удаление неактивной сессии', { 
          chatId, 
          inactiveDuration: Math.floor((now - session.lastActivity) / (60 * 60 * 1000)) + ' часов' 
        });
        
        // Удаляем таймер обновления токена
        if (this.tokenRefreshTimers.has(chatId)) {
          clearTimeout(this.tokenRefreshTimers.get(chatId));
          this.tokenRefreshTimers.delete(chatId);
        }
        
        this.sessions.delete(chatId);
      }
    }
    
    logger.info('Очистка сессий завершена', { 
      activeSessionsCount: this.sessions.size 
    });
  }
}

// Экспортируем единственный экземпляр менеджера сессий
export const sessionManager = new SessionManager();
