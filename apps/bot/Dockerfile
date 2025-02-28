FROM node:22.12.0

WORKDIR /app

COPY package*.json ./

RUN npm install -g pnpm && pnpm install

RUN apt-get update && apt-get install -y \
  build-essential \
  python3 \
  libsqlite3-dev \
  && rm -rf /var/lib/apt/lists/*

COPY . .

CMD ["node", "index.js"]
