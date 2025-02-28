# Dockerfile для сервера
FROM node:22.12.0

WORKDIR /app

# Копируем package.json и pnpm-lock.yaml для сервера
COPY apps/server/package.json package-lock.json ./

# Устанавливаем зависимости сервера
RUN npm install -g pnpm && pnpm install

# Копируем файлы сервера
COPY apps/server /app/server

# Запуск сервера
CMD ["node", "apps/server/index.js"]
