#!/usr/bin/env bash
set -euo pipefail

MODE="dev"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prod|--production)
      MODE="prod"
      shift
      ;;
    *)
      echo "Неизвестный аргумент: $1" >&2
      exit 1
      ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo "→ Подготовка фронтенда в режиме: $MODE"

pushd "$FRONTEND_DIR" >/dev/null

if [[ -f package-lock.json ]]; then
  npm install
fi

if [[ "$MODE" == "prod" ]]; then
  npm run build
fi

popd >/dev/null

export FRONTEND_TARGET="$MODE"
if [[ "$MODE" == "prod" ]]; then
  export FRONTEND_CONTAINER_PORT="80"
else
  export FRONTEND_CONTAINER_PORT="3000"
fi

echo "→ Перезапуск Docker-контейнера frontend"
docker compose -f "$ROOT_DIR/infra/docker-compose.yml" up -d --build frontend

unset FRONTEND_TARGET
unset FRONTEND_CONTAINER_PORT

echo "✓ Готово. Фронтенд доступен на http://localhost:3000/"
