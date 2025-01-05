FROM node:18-alpine

WORKDIR /apps/server

COPY package*.json ./

RUN pnpm install

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
