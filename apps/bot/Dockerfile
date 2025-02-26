FROM node:22.12.0

WORKDIR /app

COPY package*.json ./

RUN corepack enable && pnpm install --production

COPY . .

CMD ["node", "index.js"]
