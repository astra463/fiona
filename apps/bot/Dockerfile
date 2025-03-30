FROM node:14-alpine

WORKDIR /app

COPY package.json ./

# Install a specific version of pnpm that's compatible with Node.js 14
RUN npm install -g pnpm@7.30.5

RUN pnpm install

COPY . .

CMD ["pnpm", "start"]
