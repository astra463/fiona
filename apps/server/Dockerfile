FROM node:14-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++ gcc

COPY package.json ./

RUN corepack enable pnpm

RUN pnpm install --build-from-source

COPY . .

CMD ["pnpm", "start"]
