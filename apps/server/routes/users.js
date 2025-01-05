import express from 'express';
import { authenticateToken } from './middleware/auth.js';

// Функция для создания роутера
export default function usersRoutes(db) {
  const router = express.Router();

  // Создать нового пользователя
  router.post('/', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    db.run(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, password],
      function (err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ id: this.lastID });
      }
    );
  });

  // Получить всех пользователей (для тестов)
  router.get('/', (req, res) => {
    db.all('SELECT id, username, created_at FROM users', [], (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    });
  });

  // Обновить net_worth для пользователя
  router.post('/update-net-worth', (req, res) => {
    const { chat_id, net_worth } = req.body;

    if (!chat_id || net_worth === undefined) {
      return res.status(400).json({ error: 'chat_id and net_worth are required' });
    }

    db.run(
      'UPDATE users SET net_worth = ? WHERE telegram_chat_id = ?',
      [net_worth, chat_id],
      function (err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        if (this.changes === 0) {
          res.status(404).json({ error: 'User not found' });
        } else {
          res.json({ message: 'Net worth updated successfully' });
        }
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
