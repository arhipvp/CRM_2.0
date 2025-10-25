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
REQUIRED_SERVICES=(postgres redis consul rabbitmq backup)
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
    DOCKER_COMPOSE_CMD=(docker compose --env-file "$ENV_FILE")
  elif command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD=(docker-compose --env-file "$ENV_FILE")
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

function is_service_running() {
  local service="$1"
  if [[ "$CHECK_MODE" != "docker" ]]; then
    return 0
  fi
  local container_id
  if ! container_id=$("${DOCKER_COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" ps -q "$service" 2>/dev/null); then
    return 1
  fi
  [[ -n "$container_id" ]]
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

function check_reports_schema() {
  local name="Reports schema"
  local schema="${REPORTS_SCHEMA:-reports}"

  if [[ "$CHECK_MODE" == "docker" ]]; then
    local user="${REPORTS_DB_USER:-}"
    local pass="${REPORTS_DB_PASSWORD:-}"
    local db="${POSTGRES_DB:-postgres}"

    if [[ -z "$user" || -z "$pass" ]]; then
      add_result "$name" "FAIL" "REPORTS_DB_USER/REPORTS_DB_PASSWORD не заданы"
      return
    fi

    local output
    if output=$(docker_exec postgres env PGPASSWORD="$pass" psql -U "$user" -d "$db" -tAc "SELECT current_schema" 2>&1); then
      local trimmed
      trimmed=$(tr -d '[:space:]' <<<"$output")
      if [[ "$trimmed" == "$schema" ]]; then
        add_result "$name" "OK" "current_schema=$trimmed (docker exec)"
      else
        add_result "$name" "FAIL" "ожидали $schema, получено: $output"
      fi
    else
      add_result "$name" "FAIL" "$output"
    fi
    return
  fi

  local url="${REPORTS_DATABASE_URL:-}"
  if [[ -z "$url" ]]; then
    add_result "$name" "FAIL" "REPORTS_DATABASE_URL не задан"
    return
  fi

  local output
  if output=$(psql "$url" -tAc "SELECT current_schema" 2>&1); then
    local trimmed
    trimmed=$(tr -d '[:space:]' <<<"$output")
    if [[ "$trimmed" == "$schema" ]]; then
      add_result "$name" "OK" "current_schema=$trimmed"
    else
      add_result "$name" "FAIL" "ожидали $schema, получено: $output"
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

function check_backup_api() {
  local name="Backup API"
  local base_url="${BACKUP_BASE_URL:-}"
  if [[ -z "$base_url" ]]; then
    add_result "$name" "WARN" "BACKUP_BASE_URL не задан"
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

function check_backup_env_vars() {
  local name="Backup env"
  if [[ "$CHECK_MODE" != "docker" ]]; then
    add_result "$name" "WARN" "Проверка доступна только в Docker Compose режиме"
    return
  fi

  local output
  if ! output=$(docker_exec backup sh -c 'env | grep "^BACKUP_"' 2>&1); then
    add_result "$name" "FAIL" "$output"
    return
  fi

  if [[ -z "$output" ]]; then
    add_result "$name" "FAIL" "Переменные BACKUP_* не найдены"
    return
  fi

  local -A optional_vars=(
    [BACKUP_S3_ENDPOINT_URL]=1
    [BACKUP_S3_BUCKET]=1
    [BACKUP_S3_ACCESS_KEY]=1
    [BACKUP_S3_SECRET_KEY]=1
    [BACKUP_CONSUL_TOKEN]=1
    [BACKUP_REDIS_PASSWORD]=1
  )
  local -A env_values=()
  local missing_required=()
  local optional_empty=()

  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    local var_name="${line%%=*}"
    local var_value="${line#*=}"
    env_values["$var_name"]="$var_value"

    if [[ -z "$var_value" ]]; then
      if [[ -n "${optional_vars[$var_name]:-}" ]]; then
        optional_empty+=("$var_name")
      else
        missing_required+=("$var_name")
      fi
    fi
  done <<<"$output"

  if (( ${#missing_required[@]} > 0 )); then
    add_result "$name" "FAIL" "Пустые значения: ${missing_required[*]}"
    return
  fi

  local s3_creds=(BACKUP_S3_ENDPOINT_URL BACKUP_S3_BUCKET BACKUP_S3_ACCESS_KEY BACKUP_S3_SECRET_KEY)
  local all_s3_empty=true
  for var in "${s3_creds[@]}"; do
    if [[ -n "${env_values[$var]:-}" ]]; then
      all_s3_empty=false
      break
    fi
  done

  if $all_s3_empty; then
    local message="S3-креды не заданы, используется DummyStorage"
    local non_s3_optionals=()
    for var in "${optional_empty[@]}"; do
      if [[ "$var" != "BACKUP_S3_ENDPOINT_URL" && "$var" != "BACKUP_S3_BUCKET" && "$var" != "BACKUP_S3_ACCESS_KEY" && "$var" != "BACKUP_S3_SECRET_KEY" ]]; then
        non_s3_optionals+=("$var")
      fi
    done
    if (( ${#non_s3_optionals[@]} > 0 )); then
      message+="; опциональные переменные пусты: ${non_s3_optionals[*]}"
    fi
    add_result "$name" "WARN" "$message"
    return
  fi

  if (( ${#optional_empty[@]} > 0 )); then
    add_result "$name" "WARN" "Опциональные переменные пусты: ${optional_empty[*]}"
  else
    add_result "$name" "OK" "Все BACKUP_* заданы"
  fi
}

function check_gateway_api() {
  local port="${GATEWAY_SERVICE_PORT:-8080}"
  http_health_check "Gateway REST" "http://localhost:${port}/api/v1/health" "gateway"
}

function check_gateway_sse() {
  local port="${GATEWAY_SERVICE_PORT:-8080}"
  sse_health_check "Gateway SSE" "http://localhost:${port}/api/v1/streams/heartbeat" "gateway"
}

function check_auth_api() {
  local port="${AUTH_SERVICE_PORT:-8081}"
  http_health_check "Auth API" "http://localhost:${port}/actuator/health" "auth"
}

function check_crm_api() {
  local port="${CRM_SERVICE_PORT:-8082}"
  http_health_check "CRM API" "http://localhost:${port}/healthz" "crm"
}

function check_documents_api() {
  local port="${DOCUMENTS_SERVICE_PORT:-8084}"
  http_health_check "Documents API" "http://localhost:${port}/health" "documents"
}

function check_notifications_api() {
  local port="${CRM_SERVICE_PORT:-8082}"
  http_health_check "Notifications REST" "http://localhost:${port}/api/notifications/health" "notifications"
}

function check_notifications_sse() {
  local port="${CRM_SERVICE_PORT:-8082}"
  sse_health_check "Notifications SSE" "http://localhost:${port}/api/notifications/stream" "notifications"
}

function check_tasks_api() {
  local port="${TASKS_SERVICE_PORT:-8086}"
  http_health_check "Tasks API" "http://localhost:${port}/api/health" "tasks"
}

function print_mode_message() {
  if [[ "$CHECK_MODE" == "docker" ]]; then
    return
  fi
  echo "[Инфо] Проверки выполняются локальными CLI-инструментами." >&2
}

function http_health_check() {
  local name="$1"
  local url="$2"
  local service="$3"
  local expect_status="${4:-200}"

  if ! command -v curl >/dev/null 2>&1; then
    add_result "$name" "WARN" "curl недоступен"
    return
  fi

  if [[ -n "$service" ]] && ! is_service_running "$service"; then
    add_result "$name" "WARN" "Сервис $service не запущен (профиль backend отключён?)"
    return
  fi

  local response
  if ! response=$(curl -fsS -o /dev/null -w '%{http_code}' --connect-timeout 2 --max-time 5 "$url" 2>&1); then
    add_result "$name" "FAIL" "$response"
    return
  fi

  if [[ "$response" == "$expect_status" ]]; then
    add_result "$name" "OK" "$url → HTTP $response"
  else
    add_result "$name" "WARN" "$url → HTTP $response"
  fi
}

function sse_health_check() {
  local name="$1"
  local url="$2"
  local service="$3"

  if ! command -v python3 >/dev/null 2>&1; then
    add_result "$name" "WARN" "python3 недоступен"
    return
  fi

  if [[ -n "$service" ]] && ! is_service_running "$service"; then
    add_result "$name" "WARN" "Сервис $service не запущен (профиль backend отключён?)"
    return
  fi

  local output
  if output=$(python3 - "$url" <<'PY'
import sys
import urllib.request

url = sys.argv[1]
req = urllib.request.Request(url, headers={"Accept": "text/event-stream"})
try:
    with urllib.request.urlopen(req, timeout=5) as resp:
        status = resp.status
        content_type = resp.headers.get("Content-Type", "")
        first_line = resp.readline().decode("utf-8", "replace").strip()
        if status == 200 and first_line:
            print(f"HTTP {status}, {content_type}, первое событие: {first_line}")
            sys.exit(0)
        print(f"HTTP {status}, {content_type}, пустой поток")
        sys.exit(2)
except Exception as exc:  # noqa: BLE001
    print(str(exc))
    sys.exit(1)
PY
  ); then
    add_result "$name" "OK" "$output"
  else
    local exit_code=$?
    if (( exit_code == 2 )); then
      add_result "$name" "WARN" "$output"
    else
      add_result "$name" "FAIL" "$output"
    fi
  fi
}

detect_docker_compose
print_mode_message

check_postgres
check_reports_schema
check_redis
check_consul
check_rabbitmq
check_gateway_api
check_gateway_sse
check_auth_api
check_crm_api
check_documents_api
check_notifications_api
check_notifications_sse
check_tasks_api
check_reports_api
check_backup_api
check_backup_env_vars

printf "\n%-18s | %-6s | %s\n" "Проверка" "Статус" "Комментарий"
printf '%s\n' "------------------+--------+--------------------------------"
for entry in "${REPORT[@]}"; do
  IFS='|' read -r name status message <<<"$entry"
  printf "%-18s | %-6s | %s\n" "$name" "$status" "$message"

done

exit $EXIT_CODE
