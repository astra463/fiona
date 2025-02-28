# Dockerfile для бота
FROM node:22.12.0

WORKDIR /app

# Копируем package.json и pnpm-lock.yaml
COPY apps/bot/package.json pnpm-lock.yaml ./

# Устанавливаем зависимости бота
RUN npm install -g pnpm && pnpm install

# Копируем файлы бота
COPY apps/bot /app/bot

# Запуск бота
CMD ["node", "apps/bot/index.js"]
