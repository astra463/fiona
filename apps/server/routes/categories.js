import express from 'express';
import { authenticateToken } from './middleware/auth.js';
import logger from '../utils/logger.js';

// Функция для создания роутера
export default function categoriesRoutes(db) {
  const router = express.Router();

  // Получить все пользовательские категории
  router.get('/custom', authenticateToken, (req, res) => {
    const user_id = req.user.user_id;

    db.all(
      'SELECT id, name, parent_id, created_at FROM custom_categories WHERE user_id = ?',
      [user_id],
      (err, rows) => {
        if (err) {
          logger.error('Ошибка при получении пользовательских категорий:', { 
            error: err.message, 
            user_id 
          });
          return res.status(500).json({ error: err.message });
        }

        res.json(rows);
      }
    );
  });

  // Добавить новую пользовательскую категорию
  router.post('/custom', authenticateToken, (req, res) => {
    const { name, parent_id } = req.body;
    const user_id = req.user.user_id;

    if (!name) {
      return res.status(400).json({ error: 'Название категории обязательно' });
    }

    db.run(
      'INSERT INTO custom_categories (name, user_id, parent_id) VALUES (?, ?, ?)',
      [name, user_id, parent_id || null],
      function (err) {
        if (err) {
          logger.error('Ошибка при создании пользовательской категории:', { 
            error: err.message, 
            user_id,
            name
          });
          return res.status(500).json({ error: err.message });
        }

        db.get(
          'SELECT id, name, parent_id, created_at FROM custom_categories WHERE id = ?',
          [this.lastID],
          (err, row) => {
            if (err) {
              logger.error('Ошибка при получении созданной категории:', { 
                error: err.message, 
                category_id: this.lastID 
              });
              return res.status(500).json({ error: err.message });
            }

            res.status(201).json(row);
          }
        );
      }
    );
  });

  // Удалить пользовательскую категорию
  router.delete('/custom/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const user_id = req.user.user_id;

    db.get(
      'SELECT id FROM custom_categories WHERE id = ? AND user_id = ?',
      [id, user_id],
      (err, row) => {
        if (err) {
          logger.error('Ошибка при проверке категории:', { 
            error: err.message, 
            category_id: id,
            user_id
          });
          return res.status(500).json({ error: err.message });
        }

        if (!row) {
          return res.status(404).json({ error: 'Категория не найдена или не принадлежит пользователю' });
        }

        db.run(
          'DELETE FROM custom_categories WHERE id = ?',
          [id],
          function (err) {
            if (err) {
              logger.error('Ошибка при удалении категории:', { 
                error: err.message, 
                category_id: id 
              });
              return res.status(500).json({ error: err.message });
            }

            res.json({ message: 'Категория успешно удалена' });
          }
        );
      }
    );
  });

  return router;
}
