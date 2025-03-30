import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import logger from '../../utils/logger.js';

// Загружаем переменные окружения из .env
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  logger.error('JWT_SECRET is not defined!');
  process.exit(1);
}

export function authenticateToken(req, res, next) {
  logger.info('Проверка аутентификации для запроса:', { 
    method: req.method, 
    url: req.originalUrl,
    ip: req.ip
  });

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    logger.warn('Отсутствует токен авторизации:', { 
      method: req.method, 
      url: req.originalUrl 
    });
    return res
      .status(401)
      .json({ error: 'Access token is missing or invalid' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      logger.error('Ошибка верификации токена:', { 
        error: err.message, 
        method: req.method, 
        url: req.originalUrl 
      });
      return res.status(403).json({ error: 'Invalid token' });
    }

    logger.info('Пользователь успешно аутентифицирован:', { 
      user_id: user.user_id,
      method: req.method, 
      url: req.originalUrl 
    });
    
    req.user = user;
    next();
  });
}
