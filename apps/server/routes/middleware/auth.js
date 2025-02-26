import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Загружаем переменные окружения из .env
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('JWT_SECRET is not defined!');
  process.exit(1);
}

export function authenticateToken(req, res, next) {
  console.log('--- Incoming Request ---');
  console.log('Headers:', req.headers);

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.warn('Access token is missing or invalid');
    return res
      .status(401)
      .json({ error: 'Access token is missing or invalid' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('Token verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  });
}
