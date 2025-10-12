#!/usr/bin/env bash
set -uo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
INFRA_DIR="${ROOT_DIR}/infra"
ENV_FILE="${ROOT_DIR}/.env"
TMP_DIR="$(mktemp -d -t bootstrap-local-XXXXXX)"
LOG_PREFIX="[bootstrap-local]"

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

require_command() {
  local cmd="$1"
  local human_name="${2:-$1}"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_error "Не найдена команда '${human_name}'. Установите её и повторите попытку."
    return 1
  fi
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
  require_command python3 || status=1
  require_command poetry || status=1
  require_command psql || status=1
  require_command redis-cli || status=1
  require_command curl || status=1
  if require_command java "java (JDK 17+)"; then
    :
  else
    status=1
  fi
  if [[ -x "${ROOT_DIR}/backend/auth/gradlew" ]]; then
    :
  else
    log_warn "Делаем gradlew исполняемым"
    chmod +x "${ROOT_DIR}/backend/auth/gradlew"
  fi
  return $status
}

step_sync_env() {
  (cd "${ROOT_DIR}" && ./scripts/sync-env.sh)
}

step_compose_up() {
  (cd "${INFRA_DIR}" && docker compose up -d)
}

step_rabbitmq_bootstrap() {
  "${INFRA_DIR}/rabbitmq/bootstrap.sh" "${ENV_FILE}"
}

step_migrate() {
  (cd "${ROOT_DIR}" && ./scripts/migrate-local.sh)
}

step_load_seeds() {
  (cd "${ROOT_DIR}" && ./scripts/load-seeds.sh)
}

step_check_infra() {
  (cd "${ROOT_DIR}" && ./scripts/check-local-infra.sh)
}

main() {
  run_step "Проверка зависимостей" step_check_dependencies
  run_step "Синхронизация .env" step_sync_env

  if [[ -f "${ENV_FILE}" ]]; then
    add_result "Проверка .env" "OK" "Файл найден"
  else
    log_error "Файл .env не найден после синхронизации."
    add_result "Проверка .env" "FAIL" "Файл .env отсутствует после sync-env"
  fi

  run_step "docker compose up -d" step_compose_up
  run_step "Bootstrap RabbitMQ" step_rabbitmq_bootstrap
  run_step "Миграции CRM/Auth" step_migrate

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
