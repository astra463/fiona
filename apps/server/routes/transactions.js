import express from 'express';
import { authenticateToken } from './middleware/auth.js';

// Функция для создания роутера
export default function transactionsRoutes(db) {
  const router = express.Router();

  // Получить список всех транзакций для авторизованного пользователя
  router.get('/', authenticateToken, (req, res) => {
    const user_id = req.user.user_id; // Получаем user_id из токена

    const query = `
      SELECT 
        t.id, 
        t.amount, 
        t.description, 
        t.date, 
        t.created_at, 
        t.updated_at, 
        c.name AS category_name
      FROM 
        transactions t
      JOIN 
        categories c
      ON 
        t.category_id = c.id
      WHERE 
        t.user_id = ?
    `;

    db.all(query, [user_id], (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    });
  });

  // Создать новую транзакцию
  router.post('/', authenticateToken, (req, res) => {
    const { amount, category_id, description, date } = req.body;
    const user_id = req.user.user_id; // Получаем user_id из токена

    if (!amount || !category_id) {
      return res
        .status(400)
        .json({ error: 'amount and category_id are required' });
    }

    db.serialize(() => {
      // Начинаем транзакцию базы данных
      db.run('BEGIN TRANSACTION');

      // Добавляем транзакцию
      db.run(
        'INSERT INTO transactions (amount, category_id, description, date, user_id) VALUES (?, ?, ?, ?, ?)',
        [
          amount,
          category_id,
          description || null,
          date || new Date().toISOString(),
          user_id,
        ],
        function (err) {
          if (err) {
            db.run('ROLLBACK'); // Откатить изменения в случае ошибки
            res.status(500).json({ error: err.message });
            return;
          }

          // Обновляем net_worth пользователя
          db.run(
            'UPDATE users SET net_worth = net_worth + ? WHERE id = ?',
            [amount, user_id],
            function (updateErr) {
              if (updateErr) {
                db.run('ROLLBACK'); // Откатить изменения в случае ошибки
                res.status(500).json({ error: updateErr.message });
                return;
              }

              // Фиксируем изменения в базе данных
              db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                  res
                    .status(500)
                    .json({ error: 'Failed to commit transaction' });
                  return;
                }

                // Возвращаем успешный ответ
                res.json({
                  id: this.lastID, // ID добавленной транзакции
                  message:
                    'Transaction added and net worth updated successfully!',
                });
              });
            }
          );
        }
      );
    });
  });

  // Обновить транзакцию
  router.put('/:id', authenticateToken, (req, res) => {
    const { amount, category_id, description, date } = req.body;
    const { id } = req.params;
    const user_id = req.user.user_id; // Получаем user_id из токена

    db.run(
      'UPDATE transactions SET amount = ?, category_id = ?, description = ?, date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [amount, category_id, description || null, date || null, id, user_id],
      function (err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        if (this.changes === 0) {
          res
            .status(404)
            .json({ error: 'Transaction not found or not owned by user' });
          return;
        }

        res.json({ updated: this.changes });
      }
    );
  });

  // Удалить транзакцию
  router.delete('/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const user_id = req.user.user_id; // Получаем user_id из токена

    db.run(
      'DELETE FROM transactions WHERE id = ? AND user_id = ?',
      [id, user_id],
      function (err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        if (this.changes === 0) {
          res
            .status(404)
            .json({ error: 'Transaction not found or not owned by user' });
          return;
        }

        res.json({ deleted: this.changes });
      }
    );
  });

  return router;
}
