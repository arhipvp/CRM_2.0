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

COMPOSE_FILE="$REPO_ROOT/infra/docker-compose.yml"
REQUIRED_SERVICES=(postgres redis consul rabbitmq)
DOCKER_COMPOSE_CMD=()
CHECK_MODE="local"

function add_result() {
  local name="$1"
  local status="$2"
  local message="$3"
  REPORT+=("$name|$status|$message")
  if [[ "$status" == "FAIL" ]]; then
    EXIT_CODE=1
  fi
}

function detect_docker_compose() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD=(docker compose)
  elif command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD=(docker-compose)
  fi

  if [[ ${#DOCKER_COMPOSE_CMD[@]} -eq 0 ]]; then
    CHECK_MODE="local"
    return
  fi

  if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo "[Предупреждение] Файл $COMPOSE_FILE отсутствует. Используем локальные CLI-инструменты." >&2
    DOCKER_COMPOSE_CMD=()
    CHECK_MODE="local"
    return
  fi

  local ps_output
  if ! ps_output=$("${DOCKER_COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" ps 2>&1); then
    echo "[Ошибка] Не удалось получить список сервисов Docker Compose: $ps_output" >&2
    echo "[Подсказка] Убедитесь, что Docker запущен и у вас есть права на управление демоном." >&2
    exit 1
  fi

  local missing=()
  for service in "${REQUIRED_SERVICES[@]}"; do
    local container_id
    if ! container_id=$("${DOCKER_COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" ps -q "$service" 2>/dev/null); then
      echo "[Ошибка] Не удалось проверить состояние сервиса '$service'." >&2
      exit 1
    fi
    if [[ -z "$container_id" ]]; then
      missing+=("$service")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "[Ошибка] Следующие сервисы Docker Compose не запущены: ${missing[*]}." >&2
    echo "[Подсказка] Запустите инфраструктуру командой:\n  ${DOCKER_COMPOSE_CMD[*]} -f $COMPOSE_FILE up -d" >&2
    exit 1
  fi

  CHECK_MODE="docker"
  echo "[Инфо] Проверки выполняются в режиме Docker Compose (${DOCKER_COMPOSE_CMD[*]} exec)." >&2
}

function docker_exec() {
  local service="$1"
  shift
  "${DOCKER_COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" exec -T "$service" "$@"
}

function check_postgres() {
  local name="PostgreSQL"
  if [[ "$CHECK_MODE" == "docker" ]]; then
    local user="${POSTGRES_USER:-postgres}"
    local db="${POSTGRES_DB:-postgres}"
    local output
    if output=$(docker_exec postgres psql -U "$user" -d "$db" -tAc "SELECT 1" 2>&1); then
      if [[ "$output" == "1" ]]; then
        add_result "$name" "OK" "SELECT 1 выполнен (docker exec)"
      else
        add_result "$name" "FAIL" "Неожиданный ответ: $output"
      fi
    else
      add_result "$name" "FAIL" "$output"
    fi
    return
  fi

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
  if [[ "$CHECK_MODE" == "docker" ]]; then
    local output
    if output=$(docker_exec redis redis-cli ping 2>&1); then
      if [[ "$output" == "PONG" ]]; then
        add_result "$name" "OK" "PING → PONG (docker exec)"
      else
        add_result "$name" "FAIL" "Ответ: $output"
      fi
    else
      add_result "$name" "FAIL" "$output"
    fi
    return
  fi

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
  if [[ "$CHECK_MODE" == "docker" ]]; then
    local output
    if output=$(docker_exec consul consul info 2>&1); then
      local leader
      leader=$(grep -E "^[[:space:]]*leader[[:space:]]*=" <<<"$output" | head -n1 | awk -F'=' '{print $2}' | xargs)
      if [[ -n "$leader" && "$leader" != "<none>" ]]; then
        add_result "$name" "OK" "Лидер: $leader (docker exec)"
      else
        add_result "$name" "FAIL" "Команда consul info не вернула лидера"
      fi
    else
      add_result "$name" "FAIL" "$output"
    fi
    return
  fi

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
  if [[ "$CHECK_MODE" == "docker" ]]; then
    local user="${RABBITMQ_DEFAULT_USER:-}"
    local pass="${RABBITMQ_DEFAULT_PASS:-}"
    if [[ -z "$user" || -z "$pass" ]]; then
      add_result "$name" "FAIL" "Требуются RABBITMQ_DEFAULT_USER и RABBITMQ_DEFAULT_PASS"
      return
    fi

    if docker_exec rabbitmq sh -c 'command -v curl >/dev/null 2>&1' 2>/dev/null; then
      local output
      if output=$(docker_exec rabbitmq curl -fsS -u "$user:$pass" http://127.0.0.1:15672/api/overview 2>&1); then
        add_result "$name" "OK" "UI доступен (docker exec)"
      else
        add_result "$name" "FAIL" "$output"
      fi
    else
      local output
      if output=$(docker_exec rabbitmq rabbitmq-diagnostics -q check_running 2>&1); then
        add_result "$name" "OK" "Нода запущена (rabbitmq-diagnostics)"
      else
        add_result "$name" "FAIL" "$output"
      fi
    fi
    return
  fi

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

function check_reports_api() {
  local name="Reports API"
  local base_url="${REPORTS_BASE_URL:-}"
  if [[ -z "$base_url" ]]; then
    add_result "$name" "WARN" "REPORTS_BASE_URL не задан"
    return
  fi

  local health_url
  health_url="${base_url%/}/health"
  local response
  if response=$(curl -fsS -o /dev/null -w '%{http_code}' "$health_url" 2>&1); then
    if [[ "$response" == "200" ]]; then
      add_result "$name" "OK" "$health_url отвечает"
    else
      add_result "$name" "WARN" "HTTP $response от $health_url"
    fi
  else
    add_result "$name" "WARN" "Недоступен: $response"
  fi
}

function print_mode_message() {
  if [[ "$CHECK_MODE" == "docker" ]]; then
    return
  fi
  echo "[Инфо] Проверки выполняются локальными CLI-инструментами." >&2
}

detect_docker_compose
print_mode_message

check_postgres
check_redis
check_consul
check_rabbitmq
check_reports_api

printf "\n%-18s | %-6s | %s\n" "Проверка" "Статус" "Комментарий"
printf '%s\n' "------------------+--------+--------------------------------"
for entry in "${REPORT[@]}"; do
  IFS='|' read -r name status message <<<"$entry"
  printf "%-18s | %-6s | %s\n" "$name" "$status" "$message"

done

exit $EXIT_CODE
