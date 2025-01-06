FROM node:18

WORKDIR /apps/bot

COPY package*.json ./

RUN pnpm install

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
