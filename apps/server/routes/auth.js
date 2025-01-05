import express from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('JWT_SECRET is not defined!');
  process.exit(1);
}

// Функция для создания роутера
export default function authRoutes(db) {
  const router = express.Router();

  // Авторизация через Telegram
  router.post('/telegram', (req, res) => {
    const { chat_id, name } = req.body;

    if (!chat_id) {
      console.error('chat_id is missing!');
      return res.status(400).json({ error: 'chat_id is required' });
    }

    console.log(`Received chat_id: ${chat_id}, name: ${name}`);

    db.get(
      'SELECT * FROM users WHERE telegram_chat_id = ?',
      [chat_id],
      (err, user) => {
        if (err) {
          console.error('Database error:', err.message);
          return res.status(500).json({ error: err.message });
        }

        if (user) {
          console.log('User exists, generating token...');
          const token = jwt.sign({ user_id: user.id }, JWT_SECRET, {
            expiresIn: '1h',
          });
          return res.json({ message: 'Welcome back!', token });
        } else {
          console.log('User not found, creating new user...');
          db.run(
            'INSERT INTO users (telegram_chat_id, name) VALUES (?, ?)',
            [chat_id, name || 'Anonymous'],
            function (err) {
              if (err) {
                console.error('Error inserting new user:', err.message);
                return res.status(500).json({ error: err.message });
              }

              const token = jwt.sign({ user_id: this.lastID }, JWT_SECRET, {
                expiresIn: '1h',
              });
              return res.json({ message: 'Registration successful!', token });
            }
          );
        }
      }
    );
  });

  return router;
}
