FROM node:22.14.0

WORKDIR /app

COPY package.json ./

RUN corepack enable pnpm

RUN pnpm -v

RUN pnpm install

COPY . .

CMD ["pnpm", "start"]
