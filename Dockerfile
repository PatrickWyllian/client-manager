# Build stage
FROM node:20-alpine AS builder

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

RUN mkdir -p /app/data

EXPOSE 3400

CMD ["node", "server.js"]