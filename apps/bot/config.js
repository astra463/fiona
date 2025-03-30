import dotenv from 'dotenv';

dotenv.config();

// Use environment variable or fallback to localhost for development
export const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

export default {
  SERVER_URL
};
