import express from 'express';
import { authenticateToken } from './middleware/auth.js';

// Функция для создания роутера
export default function transactionsRoutes(db) {
  const router = express.Router();

  // Получить список транзакций для авторизованного пользователя
  router.get('/', authenticateToken, (req, res) => {
    const user_id = req.user.user_id; // Получаем user_id из токена
    const { period } = req.query; // Получаем период из query параметров

    let dateCondition = '';

    // Определяем условие для фильтрации по периоду
    if (period === 'transactions_week') {
      dateCondition = "AND t.date >= datetime('now', '-7 days')";
    } else if (period === 'transactions_month') {
      dateCondition = "AND t.date >= datetime('now', '-1 month')";
    } else if (period) {
      return res.status(400).json({ error: 'Некорректный параметр периода' });
    }

    const query = `
      SELECT 
        t.id, 
        t.amount, 
        t.description, 
        t.date, 
        t.created_at, 
        t.updated_at,
        t.category_id
      FROM 
        transactions t
      WHERE 
        t.user_id = ? 
        ${dateCondition}
      ORDER BY 
        t.date DESC
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
    console.log(req.body);
    const { amount, description, date, category_id } = req.body;
    const user_id = req.user.user_id;
    
    let finalCategoryId = null;
    let isCustomCategory = false;
    
    // Проверяем, является ли категория пользовательской
    if (category_id && typeof category_id === 'string' && category_id.startsWith('custom_')) {
      finalCategoryId = parseInt(category_id.split('_')[1], 10);
      isCustomCategory = true;
    } else if (category_id) {
      finalCategoryId = category_id;
    }

    if (!amount) {
      return res.status(400).json({ error: 'amount is required' });
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      // Если это пользовательская категория, проверяем, что она принадлежит пользователю
      if (isCustomCategory && finalCategoryId) {
        db.get(
          'SELECT id FROM custom_categories WHERE id = ? AND user_id = ?',
          [finalCategoryId, user_id],
          (err, row) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }
            
            if (!row) {
              db.run('ROLLBACK');
              return res.status(403).json({ error: 'Категория не найдена или не принадлежит пользователю' });
            }
            
            // Категория принадлежит пользователю, продолжаем добавление транзакции
            insertTransaction();
          }
        );
      } else {
        // Если это стандартная категория или категория не указана, просто добавляем транзакцию
        insertTransaction();
      }
      
      function insertTransaction() {
        db.run(
          'INSERT INTO transactions (amount, description, date, user_id, category_id) VALUES (?, ?, ?, ?, ?)',
          [
            amount,
            description || null,
            date || new Date().toISOString(),
            user_id,
            finalCategoryId
          ],
          function (err) {
            if (err) {
              db.run('ROLLBACK');
              res.status(500).json({ error: err.message });
              return;
            }

            db.run(
              'UPDATE users SET net_worth = net_worth + ? WHERE id = ?',
              [amount, user_id],
              function (updateErr) {
                if (updateErr) {
                  db.run('ROLLBACK');
                  res.status(500).json({ error: updateErr.message });
                  return;
                }

                db.run('COMMIT', (commitErr) => {
                  if (commitErr) {
                    res
                      .status(500)
                      .json({ error: 'Failed to commit transaction' });
                    return;
                  }

                  res.json({
                    id: this.lastID,
                    message:
                      'Transaction added and net worth updated successfully!',
                  });
                });
              }
            );
          }
        );
      }
    });
  });

  // Обновить транзакцию
  router.put('/:id', authenticateToken, (req, res) => {
    const { amount, description, date } = req.body;
    const { id } = req.params;
    const user_id = req.user.user_id;

    db.run(
      'UPDATE transactions SET amount = ?, description = ?, date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [amount, description || null, date || null, id, user_id],
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
    const user_id = req.user.user_id;

    db.get(
      'SELECT amount FROM transactions WHERE id = ? AND user_id = ?',
      [id, user_id],
      (err, row) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        if (!row) {
          res
            .status(404)
            .json({ error: 'Transaction not found or not owned by user' });
          return;
        }

        const amount = row.amount;

        db.serialize(() => {
          db.run('BEGIN TRANSACTION');

          db.run(
            'DELETE FROM transactions WHERE id = ? AND user_id = ?',
            [id, user_id],
            function (err) {
              if (err) {
                db.run('ROLLBACK');
                res.status(500).json({ error: err.message });
                return;
              }

              db.run(
                'UPDATE users SET net_worth = net_worth - ? WHERE id = ?',
                [amount, user_id],
                function (updateErr) {
                  if (updateErr) {
                    db.run('ROLLBACK');
                    res.status(500).json({ error: updateErr.message });
                    return;
                  }

                  db.run('COMMIT', (commitErr) => {
                    if (commitErr) {
                      res
                        .status(500)
                        .json({ error: 'Failed to commit transaction' });
                      return;
                    }

                    res.json({
                      deleted: 1,
                      message:
                        'Transaction deleted and net worth updated successfully!',
                    });
                  });
                }
              );
            }
          );
        });
      }
    );
  });

  return router;
}
