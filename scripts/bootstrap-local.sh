#!/usr/bin/env bash
set -euo pipefail
set -o errtrace

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
INFRA_DIR="${ROOT_DIR}/infra"
ENV_FILE="${ROOT_DIR}/.env"

LOG_PREFIX="[bootstrap-local]"

log_info() {
  printf '%s %s\n' "${LOG_PREFIX}" "$1"
}

log_warn() {
  printf '%s[предупреждение] %s\n' "${LOG_PREFIX}" "$1"
}

log_error() {
  printf '%s[ошибка] %s\n' "${LOG_PREFIX}" "$1" >&2
}

CURRENT_STEP="инициализация"

on_error() {
  local exit_code=$?
  local line=$1
  log_error "Шаг \"${CURRENT_STEP}\" завершился ошибкой (строка ${line}). Проверьте вывод выше."
  exit "${exit_code}"
}

trap 'on_error $LINENO' ERR

require_command() {
  local cmd="$1"
  local human_name="${2:-$1}"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    log_error "Не найдена команда '${human_name}'. Установите её и повторите попытку."
    exit 1
  fi
}

check_env_file() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    log_error "Файл .env не найден. Скопируйте env.example (cp env.example .env) или запустите ./scripts/sync-env.sh."
    exit 1
  fi
}

load_env() {
  log_info "Загружаем переменные окружения из ${ENV_FILE}"
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
}

wait_for_container() {
  local container_name="$1"
  local timeout="$2"
  local elapsed=0

  log_info "Ожидаем готовности контейнера ${container_name} (таймаут ${timeout} с)"
  while true; do
    if ! docker inspect "${container_name}" >/dev/null 2>&1; then
      log_warn "Контейнер ${container_name} ещё не создан. Повторная проверка через 5 секунд."
    else
      local status
      status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_name}")
      if [[ "${status}" == "healthy" || "${status}" == "running" ]]; then
        log_info "Контейнер ${container_name} готов (статус: ${status})."
        return 0
      fi
      log_info "Текущий статус ${container_name}: ${status}. Повторная проверка через 5 секунд."
    fi

    sleep 5
    elapsed=$((elapsed + 5))
    if (( elapsed >= timeout )); then
      log_error "Контейнер ${container_name} не перешёл в статус healthy за ${timeout} секунд."
      return 1
    fi
  done
}

CURRENT_STEP="проверка зависимостей"
require_command docker
if ! docker compose version >/dev/null 2>&1; then
  log_error "Плагин 'docker compose' недоступен. Обновите Docker CLI до версии 20.10+ или установите Compose V2."
  exit 1
fi
require_command python3 "python3"
require_command poetry

if [[ ! -x "${ROOT_DIR}/backend/auth/gradlew" ]]; then
  log_warn "gradlew в backend/auth не имеет права на исполнение. Выдаём chmod +x."
  chmod +x "${ROOT_DIR}/backend/auth/gradlew"
fi

check_env_file

CURRENT_STEP="загрузка переменных окружения"
load_env

CURRENT_STEP="запуск docker compose"
log_info "Запускаем инфраструктурные сервисы (docker compose up -d)"
(
  cd "${INFRA_DIR}"
  docker compose up -d
)

CURRENT_STEP="ожидание готовности инфраструктуры"
wait_for_container "crm-postgres" 180
wait_for_container "crm-rabbitmq" 180
wait_for_container "crm-redis" 120

CURRENT_STEP="настройка rabbitmq"
log_info "Запускаем настройку RabbitMQ (infra/rabbitmq/bootstrap.sh)"
"${INFRA_DIR}/rabbitmq/bootstrap.sh" "${ENV_FILE}"

CURRENT_STEP="миграции crm"
log_info "Применяем миграции CRM (poetry run alembic upgrade head)"
(
  cd "${ROOT_DIR}/backend/crm"
  poetry run alembic upgrade head
)

CURRENT_STEP="миграции auth"
log_info "Применяем миграции Auth (./gradlew update)"
(
  cd "${ROOT_DIR}/backend/auth"
  ./gradlew update
)

trap - ERR
log_info "Bootstrap завершён успешно. Все шаги выполнены."
