#!/usr/bin/env bash
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[Ошибка] Файл .env не найден в $REPO_ROOT. Скопируйте env.example и заполните значения." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

REPORT=()
EXIT_CODE=0

function add_result() {
  local name="$1"
  local status="$2"
  local message="$3"
  REPORT+=("$name|$status|$message")
  if [[ "$status" == "FAIL" ]]; then
    EXIT_CODE=1
  fi
}

function check_postgres() {
  local name="PostgreSQL"
  local url="${DATABASE_URL:-}"
  if [[ -z "$url" ]]; then
    add_result "$name" "FAIL" "DATABASE_URL не задан в .env"
    return
  fi
  local output
  if output=$(psql "$url" -c "SELECT 1" -tA 2>&1); then
    if [[ "$output" == "1" ]]; then
      add_result "$name" "OK" "SELECT 1 выполнен"
    else
      add_result "$name" "FAIL" "Неожиданный ответ: $output"
    fi
  else
    add_result "$name" "FAIL" "$output"
  fi
}

function check_redis() {
  local name="Redis"
  local url="${REDIS_URL:-}"
  if [[ -z "$url" ]]; then
    add_result "$name" "FAIL" "REDIS_URL не задан в .env"
    return
  fi
  local output
  if output=$(redis-cli -u "$url" ping 2>&1); then
    if [[ "$output" == "PONG" ]]; then
      add_result "$name" "OK" "PING → PONG"
    else
      add_result "$name" "FAIL" "Ответ: $output"
    fi
  else
    add_result "$name" "FAIL" "$output"
  fi
}

function check_consul() {
  local name="Consul"
  local addr="${CONSUL_HTTP_ADDR:-}"
  if [[ -z "$addr" ]]; then
    add_result "$name" "FAIL" "CONSUL_HTTP_ADDR не задан в .env"
    return
  fi
  local output
  if output=$(curl -fsS "$addr/v1/status/leader" 2>&1); then
    if [[ -n "$output" && "$output" != "\"\"" ]]; then
      add_result "$name" "OK" "Лидер: $output"
    else
      add_result "$name" "FAIL" "Пустой ответ от API статуса"
    fi
  else
    add_result "$name" "FAIL" "$output"
  fi
}

function check_rabbitmq() {
  local name="RabbitMQ UI"
  local url_base="${RABBITMQ_MANAGEMENT_URL:-}"
  local user="${RABBITMQ_DEFAULT_USER:-}"
  local pass="${RABBITMQ_DEFAULT_PASS:-}"
  if [[ -z "$url_base" || -z "$user" || -z "$pass" ]]; then
    add_result "$name" "FAIL" "Требуются RABBITMQ_MANAGEMENT_URL, RABBITMQ_DEFAULT_USER, RABBITMQ_DEFAULT_PASS"
    return
  fi
  local output
  if output=$(curl -fsS -u "$user:$pass" "$url_base/api/overview" 2>&1); then
    add_result "$name" "OK" "UI доступен"
  else
    add_result "$name" "FAIL" "$output"
  fi
}

check_postgres
check_redis
check_consul
check_rabbitmq

printf "\n%-18s | %-6s | %s\n" "Проверка" "Статус" "Комментарий"
printf '%s\n' "------------------+--------+--------------------------------"
for entry in "${REPORT[@]}"; do
  IFS='|' read -r name status message <<<"$entry"
  printf "%-18s | %-6s | %s\n" "$name" "$status" "$message"
done

exit $EXIT_CODE
