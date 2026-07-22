FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --only=production

COPY . .

RUN mkdir -p /app/data

EXPOSE 3400

CMD ["node", "server.js"]
