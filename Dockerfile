FROM node:20-alpine

# Timezone Brasil
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime && \
    echo "America/Sao_Paulo" > /etc/timezone

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --only=production

COPY . .

RUN mkdir -p /app/data

EXPOSE 3400

CMD ["node", "server.js"]
