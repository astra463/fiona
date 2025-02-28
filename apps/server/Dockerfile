FROM node:22.12.0

WORKDIR /app

COPY package*.json ./

RUN npm install -g pnpm && pnpm install

COPY . .

CMD ["node", "index.js"]
