FROM node:14-alpine

WORKDIR /app

COPY package.json ./

RUN corepack enable pnpm

RUN pnpm install

COPY . .

CMD ["pnpm", "start"]
