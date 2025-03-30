FROM node:14-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++ gcc

COPY package.json ./

# Install a specific version of pnpm that's compatible with Node.js 14
RUN npm install -g pnpm@7.30.5

# Установка sqlite3 с принудительной компиляцией для текущей архитектуры
RUN pnpm add sqlite3 --force
# Установка остальных зависимостей
RUN pnpm install

COPY . .

CMD ["pnpm", "start"]
