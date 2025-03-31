import express from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

// Загружаем переменные окружения
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  logger.error('JWT_SECRET is not defined!');
  process.exit(1);
}

export default function authRoutes(db) {
  const router = express.Router();

  // Авторизация через Telegram
  router.post('/telegram', (req, res) => {
    const { chat_id, name } = req.body;

    if (!chat_id) {
      logger.error('chat_id is missing in auth request!');
      return res.status(400).json({ error: 'chat_id is required' });
    }

    db.get(
      'SELECT * FROM users WHERE telegram_chat_id = ?',
      [chat_id],
      (err, user) => {
        if (err) {
          logger.error('Database error in auth:', { error: err.message });
          return res.status(500).json({ error: err.message });
        }

        if (user) {
          logger.info('Existing user authenticated:', { 
            userId: user.id, 
            chatId: chat_id,
            name: user.name
          });
          const token = jwt.sign({ user_id: user.id }, JWT_SECRET, {
            expiresIn: '24h', // Увеличиваем срок действия токена до 24 часов
          });
          return res.json({ 
            message: 'Welcome back!', 
            token,
            net_worth: user.net_worth 
          });
        } else {
          logger.info('Creating new user:', { chatId: chat_id, name });

          db.run(
            'INSERT INTO users (telegram_chat_id, name) VALUES (?, ?)',
            [chat_id, name],
            function (err) {
              if (err) {
                logger.error('Error inserting new user:', { 
                  error: err.message,
                  chatId: chat_id,
                  name
                });
                return res.status(500).json({ error: err.message });
              }
              
              logger.info('New user created successfully:', { 
                userId: this.lastID,
                chatId: chat_id,
                name
              });

              const token = jwt.sign({ user_id: this.lastID }, JWT_SECRET, {
                expiresIn: '24h', // Увеличиваем срок действия токена до 24 часов
              });
              return res.json({ 
                message: 'Registration successful!', 
                token,
                net_worth: 0 // Новый пользователь, net_worth = 0 по умолчанию в БД
              });
            }
          );
        }
      }
    );
  });

  return router;
}
