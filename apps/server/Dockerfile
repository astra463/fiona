FROM node:22.14.0

WORKDIR /app

COPY package.json ./

RUN corepack enable pnpm

RUN pnpm install --filter '!sqlite3'

COPY artifacts/sqlite3 /node_modules/.pnpm/sqlite3@5.1.7/node_modules/sqlite3

COPY . .

CMD ["pnpm", "start"]
