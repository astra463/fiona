FROM node:22.14.0

WORKDIR /app

RUN apt-get install libsqlite3-dev

COPY package.json ./

RUN corepack enable pnpm

RUN npm install --build-from-source

COPY . .

CMD ["pnpm", "start"]
