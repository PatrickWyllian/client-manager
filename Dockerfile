# Build stage
FROM node:20-alpine AS builder

# Toolchain para módulos nativos (better-sqlite3) quando não há prebuild
RUN apk add --no-cache python3 make g++

# Timezone Brasil
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime && \
    echo "America/Sao_Paulo" > /etc/timezone

WORKDIR /app

COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for test)
RUN npm ci

COPY . .

# Skip tests in build (run separately in CI)
# RUN npm test

# Production stage
FROM node:20-alpine AS production

# Timezone Brasil
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime && \
    echo "America/Sao_Paulo" > /etc/timezone

WORKDIR /app

COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --only=production

COPY --from=builder /app .

# APP-02: /app/data gravavel pelo usuario node (uid 1000); codigo fica root-owned
RUN mkdir -p /app/data && chown -R node:node /app/data

# Entrypoint: carrega Docker Secrets antes de subir o app. O servico no Swarm
# sobrescreve via Command (/opt/client-manager/entrypoint-secrets.sh), entao
# este ENTRYPOINT e apenas o default compativel da imagem.
COPY entrypoint.sh /entrypoint.sh
RUN chmod 755 /entrypoint.sh

# APP-02: container nao-roda-como-root (imagem node oficial tem usuario 'node')
USER node

ENTRYPOINT ["/entrypoint.sh"]

EXPOSE 3400

CMD ["node", "server.js"]