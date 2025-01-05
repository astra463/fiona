import express from 'express';
import { authenticateToken } from './middleware/auth.js'; // Подключаем middleware

// Создаём функцию для создания роутера
export default function categoriesRoutes(db) {
  const router = express.Router();

  // Получить список всех категорий для авторизованного пользователя
  router.get('/', authenticateToken, (req, res) => {
    const user_id = req.user.user_id; // Получаем user_id из токена

    db.all(
      'SELECT * FROM categories WHERE user_id = ?',
      [user_id],
      (err, rows) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json(rows);
      }
    );
  });

  // Создать новую категорию
  router.post('/', authenticateToken, (req, res) => {
    const { name, parent_id } = req.body;
    const user_id = req.user.user_id; // Получаем user_id из токена

    if (!name) {
      return res.status(400).json({ error: 'Название категории обязательно.' });
    }

    db.run(
      'INSERT INTO categories (name, parent_id, user_id) VALUES (?, ?, ?)',
      [name, parent_id || null, user_id],
      function (err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ id: this.lastID, message: 'Категория успешно создана!' });
      }
    );
  });

  // Обновить категорию
  router.put('/:id', authenticateToken, (req, res) => {
    const { name, parent_id } = req.body;
    const { id } = req.params;
    const user_id = req.user.user_id; // Получаем user_id из токена

    if (!name) {
      return res.status(400).json({ error: 'Название категории обязательно.' });
    }

    db.run(
      'UPDATE categories SET name = ?, parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [name, parent_id || null, id, user_id],
      function (err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        if (this.changes === 0) {
          res.status(404).json({
            error: 'Категория не найдена или не принадлежит пользователю.',
          });
          return;
        }

        res.json({
          updated: this.changes,
          message: 'Категория успешно обновлена!',
        });
      }
    );
  });

  // Удалить категорию
  router.delete('/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const user_id = req.user.user_id; // Получаем user_id из токена

    db.run(
      'DELETE FROM categories WHERE id = ? AND user_id = ?',
      [id, user_id],
      function (err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        if (this.changes === 0) {
          res.status(404).json({
            error: 'Категория не найдена или не принадлежит пользователю.',
          });
          return;
        }

        res.json({
          deleted: this.changes,
          message: 'Категория успешно удалена!',
        });
      }
    );
  });

  return router;
}
