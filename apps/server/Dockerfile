FROM node:14-alpine

WORKDIR /app

COPY package.json ./

RUN npm install -g pnpm@7.30.5

RUN pnpm install

COPY . .

CMD ["pnpm", "start"]
