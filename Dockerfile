# --- build stage: instala APENAS deps de producao e compila modulos nativos
# (better-sqlite3) para alpine. Dev deps (jest/eslint) NAO entram na imagem ---
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- runtime ---
FROM node:20-alpine

# Timezone Brasil
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime && \
    echo "America/Sao_Paulo" > /etc/timezone

WORKDIR /app

# node_modules de producao (compilados no builder)
COPY --from=builder /app/node_modules ./node_modules

# Codigo-fonte (node_modules/.git/data-db/data-wa-auth excluidos via .dockerignore)
COPY . .

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