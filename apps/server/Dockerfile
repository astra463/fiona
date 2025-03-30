FROM node:22.14.0

WORKDIR /app

COPY package.json ./

RUN corepack enable pnpm

# Install native node_modules in Dockerfile so it uses pnpm's supportedArchitectures feature in package.json
RUN pnpm install sqlite3@5.1.7

COPY . .

CMD ["pnpm", "start"]
