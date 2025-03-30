import express from 'express';
import { authenticateToken } from './middleware/auth.js';
import logger from '../utils/logger.js';

// Функция для создания роутера
export default function usersRoutes(db) {
  const router = express.Router();

  // Обновить net_worth для пользователя
  router.post('/update-net-worth', authenticateToken, (req, res) => {
    const { chat_id, net_worth } = req.body;
    const user_id = req.user.user_id;

    logger.info('Запрос на обновление баланса:', {
      user_id,
      chat_id,
      net_worth
    });

    if (!chat_id || net_worth === undefined) {
      logger.warn('Отсутствуют обязательные параметры:', { chat_id, net_worth });
      return res.status(400).json({ error: 'chat_id and net_worth are required' });
    }

    // Проверяем, что пользователь обновляет только свои данные
    db.get(
      'SELECT telegram_chat_id FROM users WHERE id = ?',
      [user_id],
      (err, row) => {
        if (err) {
          logger.error('Ошибка при получении данных пользователя:', { error: err.message, user_id });
          return res.status(500).json({ error: err.message });
        }

        logger.info('Данные пользователя получены:', { 
          user_id, 
          db_telegram_chat_id: row?.telegram_chat_id,
          request_chat_id: chat_id,
          db_chat_id_type: row ? typeof row.telegram_chat_id : 'undefined',
          request_chat_id_type: typeof chat_id
        });

        // Преобразуем chat_id к строке для корректного сравнения
        const dbChatId = row?.telegram_chat_id?.toString();
        const requestChatId = chat_id.toString();

        if (!row) {
          logger.error('Пользователь не найден:', { user_id });
          return res.status(404).json({ error: 'User not found' });
        }
        
        if (dbChatId !== requestChatId) {
          logger.error('Попытка обновления чужих данных:', { 
            user_id, 
            db_chat_id: dbChatId, 
            request_chat_id: requestChatId 
          });
          return res.status(403).json({ error: 'Unauthorized: Cannot update other user\'s data' });
        }

        db.run(
          'UPDATE users SET net_worth = ? WHERE telegram_chat_id = ?',
          [net_worth, chat_id],
          function (err) {
            if (err) {
              logger.error('Ошибка при обновлении баланса:', { error: err.message, user_id, chat_id });
              res.status(500).json({ error: err.message });
              return;
            }

            if (this.changes === 0) {
              logger.warn('Пользователь не найден при обновлении:', { chat_id });
              res.status(404).json({ error: 'User not found' });
            } else {
              logger.info('Баланс успешно обновлен:', { user_id, chat_id, net_worth });
              res.json({ message: 'Net worth updated successfully' });
            }
          }
        );
      }
    );
  });

  // Эндпоинт /me - получить данные текущего пользователя
  router.get('/me', authenticateToken, (req, res) => {
    const { user_id } = req.user;
    db.get(
      'SELECT id, name, net_worth, created_at FROM users WHERE id = ?',
      [user_id],
      (err, row) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        if (!row) {
          res.status(404).json({ error: 'User not found' });
        } else {
          res.json(row);
        }
      }
    );
  });

  return router;
}
