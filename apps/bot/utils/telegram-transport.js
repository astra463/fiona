import Transport from 'winston-transport';
import axios from 'axios';

/**
 * Транспорт для отправки логов в Telegram
 */
export class TelegramTransport extends Transport {
  constructor(opts) {
    super(opts);
    
    this.name = 'TelegramTransport';
    this.level = opts.level || 'error';
    this.botToken = opts.botToken;
    this.chatId = opts.chatId;
    
    if (!this.botToken || !this.chatId) {
      console.warn('TelegramTransport: botToken или chatId не указаны. Логи не будут отправляться в Telegram.');
    }
  }

  /**
   * Отправляет лог в Telegram
   */
  async log(info, callback) {
    if (!this.botToken || !this.chatId) {
      return callback();
    }

    try {
      const { level, message, ...meta } = info;
      
      // Форматируем сообщение для Telegram
      let telegramMessage = `🔔 *${level.toUpperCase()}*: ${message}\n`;
      
      // Добавляем метаданные, если они есть
      if (Object.keys(meta).length > 0) {
        // Исключаем некоторые поля, которые не нужно отправлять в Telegram
        const { timestamp, service, ...relevantMeta } = meta;
        
        if (Object.keys(relevantMeta).length > 0) {
          telegramMessage += '\n*Детали:*\n';
          
          // Форматируем каждое поле метаданных
          for (const [key, value] of Object.entries(relevantMeta)) {
            // Если значение - объект, преобразуем его в строку
            const valueStr = typeof value === 'object' 
              ? JSON.stringify(value, null, 2)
              : value;
              
            telegramMessage += `- *${key}*: ${valueStr}\n`;
          }
        }
      }
      
      // Добавляем временную метку
      telegramMessage += `\n📅 ${new Date().toISOString()}`;
      
      // Отправляем сообщение в Telegram
      await axios.post(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          chat_id: this.chatId,
          text: telegramMessage,
          parse_mode: 'Markdown',
        }
      );
      
      callback();
    } catch (error) {
      console.error('Ошибка отправки лога в Telegram:', error);
      callback();
    }
  }
}

export default TelegramTransport;
