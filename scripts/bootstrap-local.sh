#!/usr/bin/env bash
set -uo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
INFRA_DIR="${ROOT_DIR}/infra"
ENV_FILE="${ROOT_DIR}/.env"
COMPOSE_CMD=(docker compose --env-file "${ENV_FILE}")
TMP_DIR="$(mktemp -d -t bootstrap-local-XXXXXX)"
LOG_PREFIX="[bootstrap-local]"

BOOTSTRAP_SKIP_FRONTEND_FLAG="${BOOTSTRAP_SKIP_FRONTEND:-false}"

cleanup() {
  if [[ -d "${TMP_DIR}" ]]; then
    if (( FAIL_COUNT == 0 )); then
      rm -rf "${TMP_DIR}"
    else
      log_info "Подробные логи шагов сохранены в ${TMP_DIR}"
    fi
  fi
}

trap cleanup EXIT

log_info() {
  printf '%s %s\n' "${LOG_PREFIX}" "$1"
}

log_warn() {
  printf '%s[предупреждение] %s\n' "${LOG_PREFIX}" "$1"
}

log_error() {
  printf '%s[ошибка] %s\n' "${LOG_PREFIX}" "$1" >&2
}

usage() {
  cat <<USAGE
Использование: $0 [--skip-frontend]

  --skip-frontend  пропустить запуск контейнера фронтенда
USAGE
}

is_truthy() {
  local value="${1:-}"
  value="${value,,}"
  case "$value" in
    1|true|yes|y)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

parse_args() {
  while (($# > 0)); do
    case "$1" in
      --skip-frontend)
        BOOTSTRAP_SKIP_FRONTEND_FLAG="true"
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        log_error "Неизвестный аргумент: $1"
        usage
        exit 1
        ;;
    esac
    shift
  done
}

require_command() {
  local cmd="$1"
  local human_name="${2:-$1}"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_error "Не найдена команда '${human_name}'. Установите её и повторите попытку."
    return 1
  fi
}

check_optional_command() {
  local cmd="$1"
  local human_name="${2:-$1}"
  local hint="${3:-}"
  if command -v "$cmd" >/dev/null 2>&1; then
    return 0
  fi
  if [[ -n "$hint" ]]; then
    log_warn "Команда '${human_name}' не найдена. ${hint}"
  else
    log_warn "Команда '${human_name}' не найдена."
  fi
  return 1
}

STEP_RESULTS=()
FAIL_COUNT=0

add_result() {
  local name="$1" status="$2" message="$3"
  STEP_RESULTS+=("$name|$status|$message")
  if [[ "$status" == "FAIL" ]]; then
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

run_step() {
  local name="$1"
  local func="$2"
  local index=${#STEP_RESULTS[@]}
  local safe_name=${name// /_}
  local log_file="${TMP_DIR}/$(printf '%02d' "$index")_${safe_name}.log"
  log_info "→ ${name}"
  if "$func" > >(tee "$log_file") 2> >(tee -a "$log_file" >&2); then
    add_result "$name" "OK" ""
    rm -f "$log_file"
    return 0
  else
    local exit_code=$?
    add_result "$name" "FAIL" "Код ${exit_code}. Лог: ${log_file}"
    log_error "Шаг '${name}' завершился с кодом ${exit_code}. См. лог: ${log_file}"
    return $exit_code
  fi
}

run_step_skip() {
  local name="$1" reason="$2"
  log_warn "Пропускаем шаг '${name}': ${reason}"
  add_result "$name" "SKIP" "$reason"
}

step_check_dependencies() {
  local status=0
  require_command docker || status=1
  if docker compose version >/dev/null 2>&1; then
    :
  else
    log_error "Плагин 'docker compose' недоступен. Установите Docker Compose V2."
    status=1
  fi
  require_command poetry || status=1
  if require_command java "java (JDK 17+)"; then
    :
  else
    status=1
  fi
  if require_command python3 "python3 (Python 3)"; then
    :
  else
    log_error "Python 3 обязателен для bootstrap. Установите интерпретатор python3 из поставки вашей ОС (например, 'sudo apt install python3') и повторите попытку."
    status=1
  fi
  check_optional_command psql "psql" "Отсутствует локальный CLI PostgreSQL — скрипты будут пытаться использовать docker compose exec."
  check_optional_command redis-cli "redis-cli" "Для локальных проверок Redis используйте docker compose exec redis redis-cli."
  check_optional_command curl "curl" "Smoke-проверки HTTP будут пропущены или потребуют альтернативные инструменты."
  if [[ -x "${ROOT_DIR}/backend/auth/gradlew" ]]; then
    :
  else
    log_warn "Делаем gradlew исполняемым"
    chmod +x "${ROOT_DIR}/backend/auth/gradlew"
  fi
  return $status
}

step_sync_env() {
  (cd "${ROOT_DIR}" && ./scripts/sync-env.sh --non-interactive)
}

step_compose_up() {
  (
    cd "${INFRA_DIR}" && "${COMPOSE_CMD[@]}" up -d
  )
}

step_wait_infra() {
  (
    cd "${INFRA_DIR}" || return 1
    if "${COMPOSE_CMD[@]}" wait >/dev/null 2>&1; then
      echo "docker compose wait завершён успешно"
      return 0
    fi

    echo "Команда 'docker compose wait' недоступна, включён ручной мониторинг статусов"
    local attempt=0
    local max_attempts=30
    local sleep_seconds=2
    local ps_output=""

    while (( attempt < max_attempts )); do
      if ! ps_output=$("${COMPOSE_CMD[@]}" ps); then
        sleep "$sleep_seconds"
        attempt=$((attempt + 1))
        continue
      fi

      if grep -qE '\\b(Exit|Down|Stopped)\\b' <<<"$ps_output"; then
        echo "$ps_output"
        echo "Обнаружены контейнеры в состоянии Exit/Down/Stopped" >&2
        return 1
      fi

      if grep -q '(health: starting)' <<<"$ps_output"; then
        sleep "$sleep_seconds"
        attempt=$((attempt + 1))
        continue
      fi

      if grep -q '(unhealthy)' <<<"$ps_output"; then
        echo "$ps_output"
        echo "Контейнеры имеют статус unhealthy" >&2
        return 1
      fi

      echo "$ps_output"
      echo "Контейнеры готовы."
      return 0
    done

    echo "Истёк таймаут ожидания готовности контейнеров" >&2
    "${COMPOSE_CMD[@]}" ps
    return 1
  )
}

step_rabbitmq_bootstrap() {
  "${INFRA_DIR}/rabbitmq/bootstrap.sh" "${ENV_FILE}"
}

step_migrate() {
  (cd "${ROOT_DIR}" && ./scripts/migrate-local.sh)
}

step_start_frontend() {
  (
    cd "${INFRA_DIR}" && "${COMPOSE_CMD[@]}" --profile app up -d frontend
  )
}

step_load_seeds() {
  (cd "${ROOT_DIR}" && ./scripts/load-seeds.sh)
}

step_check_infra() {
  (cd "${ROOT_DIR}" && ./scripts/check-local-infra.sh)
}

main() {
  parse_args "$@"

  run_step "Проверка зависимостей" step_check_dependencies
  run_step "Синхронизация .env" step_sync_env

  if [[ -f "${ENV_FILE}" ]]; then
    add_result "Проверка .env" "OK" "Файл найден"
  else
    log_error "Файл .env не найден после синхронизации."
    add_result "Проверка .env" "FAIL" "Файл .env отсутствует после sync-env"
  fi

  run_step "docker compose up -d" step_compose_up
  run_step "Ожидание готовности docker compose" step_wait_infra
  run_step "Bootstrap RabbitMQ" step_rabbitmq_bootstrap
  run_step "Миграции CRM/Auth" step_migrate
  if is_truthy "${BOOTSTRAP_SKIP_FRONTEND_FLAG}"; then
    run_step_skip "Запуск фронтенда" "передан флаг пропуска фронтенда"
  else
    run_step "Запуск фронтенда" step_start_frontend
  fi

  if [[ -x "${ROOT_DIR}/scripts/load-seeds.sh" ]]; then
    run_step "Загрузка seed-данных" step_load_seeds
  elif [[ -f "${ROOT_DIR}/scripts/load-seeds.sh" ]]; then
    run_step_skip "Загрузка seed-данных" "файл найден, но не исполняемый"
  else
    run_step_skip "Загрузка seed-данных" "скрипт отсутствует"
  fi

  if [[ -x "${ROOT_DIR}/scripts/check-local-infra.sh" ]]; then
    run_step "Проверка локальной инфраструктуры" step_check_infra
  else
    run_step_skip "Проверка локальной инфраструктуры" "скрипт check-local-infra.sh не найден или не исполняем"
  fi

  printf '\n%-38s | %-4s | %s\n' "Шаг" "Статус" "Комментарий"
  printf '%s\n' "--------------------------------------+-------+-------------------------------------------"
  for entry in "${STEP_RESULTS[@]}"; do
    IFS='|' read -r name status message <<<"$entry"
    printf "%-38s | %-4s | %s\n" "$name" "$status" "$message"
  done

  if (( FAIL_COUNT > 0 )); then
    log_error "Bootstrap завершился с ошибками (${FAIL_COUNT}). См. таблицу выше."
    return 1
  else
    log_info "Bootstrap завершён успешно. Все обязательные шаги выполнены."
    return 0
  fi
}

main "$@"
