#!/bin/sh
# Carrega Docker Secrets como env vars e executa o app.
# APP-02: roda como usuario 'node' (USER node no Dockerfile).
set -e

load_secret() {
  env_var="$1"
  secret_file="/run/secrets/${env_var}"
  if [ -f "$secret_file" ]; then
    value=$(tr -d "\n" < "$secret_file")
    export "${env_var}=${value}"
    echo "[entrypoint] Loaded $env_var"
  else
    echo "[entrypoint] AVISO: secret $env_var nao encontrado em $secret_file"
  fi
}

load_secret "JWT_SECRET"
load_secret "ADMIN_PASS"
load_secret "EVOLUTION_API_TOKEN"
load_secret "ENCRYPTION_SECRET"

if [ $# -eq 0 ]; then
  echo "[entrypoint] Sem args: executando node server.js"
  set -- node server.js
fi

exec "$@"
