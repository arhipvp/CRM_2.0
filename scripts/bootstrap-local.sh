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

BACKEND_PROFILE_SERVICES=(gateway auth crm documents notifications tasks)

BOOTSTRAP_SKIP_FRONTEND_FLAG="${BOOTSTRAP_SKIP_FRONTEND:-false}"
BOOTSTRAP_SKIP_BACKEND_FLAG="${BOOTSTRAP_SKIP_BACKEND:-false}"

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

check_port_available() {
  local var_name="$1"
  local port="${!var_name:-}"

  if [[ -z "${port}" ]]; then
    return 0
  fi

  if ! [[ "${port}" =~ ^[0-9]+$ ]]; then
    log_error "Переменная ${var_name} содержит некорректное значение '${port}'. Обновите ${var_name} в ${ENV_FILE}."
    return 1
  fi

  local port_num=$((10#${port}))
  if (( port_num < 1 || port_num > 65535 )); then
    log_error "Переменная ${var_name} содержит некорректное значение '${port}'. Обновите ${var_name} в ${ENV_FILE}."
    return 1
  fi

  local exit_code
  python3 - "$port_num" <<'PY'
import errno
import socket
import sys

port = int(sys.argv[1])

families = (
    (socket.AF_INET, ("0.0.0.0", port)),
    (socket.AF_INET6, ("::", port)),
)

try:
    for family, address in families:
        try:
            sock = socket.socket(family, socket.SOCK_STREAM)
        except OSError:
            continue
        try:
            if family == socket.AF_INET6:
                try:
                    sock.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 1)
                except (AttributeError, OSError):
                    pass
            sock.bind(address)
        except OSError as exc:
            sock.close()
            if exc.errno in {
                getattr(errno, "EADDRINUSE", 98),
                getattr(errno, "WSAEADDRINUSE", 10048),
                getattr(errno, "EACCES", 13),
                getattr(errno, "WSAEACCES", 10013),
            }:
                sys.exit(10)
            if (
                family == socket.AF_INET6
                and exc.errno in {
                    getattr(errno, "EADDRNOTAVAIL", 99),
                    getattr(errno, "WSAEADDRNOTAVAIL", 10049),
                }
            ):
                continue
            raise
        else:
            sock.close()
except OSError:
    sys.exit(11)
else:
    sys.exit(0)
PY
  exit_code=$?

  if (( exit_code == 0 )); then
    return 0
  fi

  case "$exit_code" in
    10)
      log_error "Порт ${port}, заданный переменной ${var_name} в ${ENV_FILE}, уже используется. Измените ${var_name} в ${ENV_FILE} и повторите запуск."
      ;;
    11)
      log_error "Произошла внутренняя ошибка при проверке порта ${port} из переменной ${var_name}. Повторите попытку позже или проверьте настройки окружения."
      ;;
    *)
      log_error "Не удалось проверить порт ${port} из переменной ${var_name}. Проверьте настройки ${ENV_FILE}."
      ;;
  esac
  return 1
}

load_env() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    log_error "Файл окружения ${ENV_FILE} не найден. Запустите scripts/sync-env.sh и повторите попытку."
    return 1
  fi

  set -a
  local had_nounset=false
  if [[ $- == *u* ]]; then
    had_nounset=true
    set +u
  fi

  # shellcheck disable=SC1090
  source "${ENV_FILE}"

  if [[ "${had_nounset}" == true ]]; then
    set -u
  fi
  set +a
}

usage() {
  cat <<USAGE
Использование: $0 [--skip-frontend] [--skip-backend]

  --skip-frontend  пропустить запуск контейнера фронтенда
  --skip-backend   пропустить запуск профиля backend (gateway, auth, crm, documents, notifications, tasks)
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
      --skip-backend)
        BOOTSTRAP_SKIP_BACKEND_FLAG="true"
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
  local safe_name
  safe_name=$(printf '%s' "$name" | tr -cs '[:alnum:]_-' '_')
  mkdir -p "${TMP_DIR}"
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

step_check_ports() {
  load_env || return 1

  local status=0
  local port_vars=(
    POSTGRES_PORT
    RABBITMQ_PORT
    REDIS_PORT
    PGADMIN_PORT
  )

  local checked=()
  for var_name in "${port_vars[@]}"; do
    if [[ -n "${!var_name:-}" ]]; then
      checked+=("$var_name")
      if ! check_port_available "$var_name"; then
        status=1
      fi
    fi
  done

  if (( ${#checked[@]} == 0 )); then
    log_warn "Не найдено переменных портов для проверки. Обновите ${ENV_FILE}, если требуется изменить порты."
  fi

  return $status
}

step_sync_env() {
  (cd "${ROOT_DIR}" && ./scripts/sync-env.sh --non-interactive)
}

step_compose_up() {
  load_env || return 1
  (
    cd "${INFRA_DIR}" && "${COMPOSE_CMD[@]}" up -d
  )
}

step_compose_backend_up() {
  load_env || return 1
  (
    cd "${INFRA_DIR}" || return 1
    "${COMPOSE_CMD[@]}" --profile backend up -d "${BACKEND_PROFILE_SERVICES[@]}"
  )
}

step_wait_infra() {
  load_env || return 1
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

step_wait_backend() {
  load_env || return 1
  (
    cd "${INFRA_DIR}" || return 1
    local services=("${BACKEND_PROFILE_SERVICES[@]}")
    if "${COMPOSE_CMD[@]}" --profile backend wait "${services[@]}" >/dev/null 2>&1; then
      echo "docker compose --profile backend wait завершён успешно"
      return 0
    fi

    echo "Команда 'docker compose --profile backend wait' недоступна, включён ручной мониторинг статусов"
    local attempt=0
    local max_attempts=60
    local sleep_seconds=3
    local ps_output=""

    while (( attempt < max_attempts )); do
      if ! ps_output=$("${COMPOSE_CMD[@]}" --profile backend ps); then
        sleep "$sleep_seconds"
        attempt=$((attempt + 1))
        continue
      fi

      if grep -qE '\\b(Exit|Down|Stopped)\\b' <<<"$ps_output"; then
        echo "$ps_output"
        echo "Обнаружены контейнеры backend-профиля в состоянии Exit/Down/Stopped" >&2
        return 1
      fi

      local unhealthy=false
      local starting=false

      for service in "${services[@]}"; do
        local line
        line=$(printf '%s\n' "$ps_output" | grep -E "^[[:space:]]*${service}[[:space:]]" || true)
        if [[ -z "$line" ]]; then
          starting=true
          break
        fi

        if grep -q '(unhealthy)' <<<"$line"; then
          unhealthy=true
          break
        fi

        if grep -q '(health: starting)' <<<"$line" || ! grep -q '(healthy)' <<<"$line"; then
          starting=true
        fi
      done

      if [[ "$unhealthy" == true ]]; then
        echo "$ps_output"
        echo "Контейнеры backend-профиля имеют статус unhealthy" >&2
        return 1
      fi

      if [[ "$starting" == true ]]; then
        sleep "$sleep_seconds"
        attempt=$((attempt + 1))
        continue
      fi

      echo "$ps_output"
      echo "Backend-сервисы готовы."
      return 0
    done

    echo "Истёк таймаут ожидания готовности backend-сервисов" >&2
    "${COMPOSE_CMD[@]}" --profile backend ps
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
  load_env || return 1
  (
    cd "${INFRA_DIR}" && "${COMPOSE_CMD[@]}" --profile app up -d frontend
  )
}

step_check_backup_env() {
  load_env || return 1

  local s3_vars=(
    BACKUP_S3_ENDPOINT_URL
    BACKUP_S3_BUCKET
    BACKUP_S3_ACCESS_KEY
    BACKUP_S3_SECRET_KEY
  )
  local populated=()
  for var in "${s3_vars[@]}"; do
    if [[ -n "${!var:-}" ]]; then
      populated+=("$var")
    fi
  done

  if (( ${#populated[@]} == 0 )); then
    log_info "BACKUP_S3_* переменные отсутствуют или пусты — будет использован DummyStorage."
    return 0
  fi

  local required=(
    BACKUP_S3_BUCKET
    BACKUP_S3_ACCESS_KEY
    BACKUP_S3_SECRET_KEY
  )
  local missing=()

  for var in "${required[@]}"; do
    if [[ -z "${!var:-}" ]]; then
      missing+=("$var")
    fi
  done

  if (( ${#missing[@]} > 0 )); then
    log_error "Переменные ${missing[*]} не заданы. Заполните конфигурацию S3 или удалите значения, чтобы использовать DummyStorage."
    return 1
  fi

  log_info "Обнаружена полная конфигурация S3 для backup (переменные ${required[*]})."
}

step_smoke_backup_dummy_storage() {
  load_env || return 1

  local s3_vars=(
    BACKUP_S3_ENDPOINT_URL
    BACKUP_S3_BUCKET
    BACKUP_S3_ACCESS_KEY
    BACKUP_S3_SECRET_KEY
  )

  for var in "${s3_vars[@]}"; do
    if [[ -n "${!var:-}" ]]; then
      log_info "Переменная ${var} задана — предполагается S3, проверка DummyStorage не требуется."
      return 0
    fi
  done

  log_info "BACKUP_S3_* пусты — проверяем, что контейнер backup работает в режиме DummyStorage."

  (
    cd "${INFRA_DIR}" || return 1

    local container_id
    if ! container_id=$("${COMPOSE_CMD[@]}" ps -q backup); then
      log_error "Не удалось получить идентификатор контейнера backup."
      return 1
    fi
    if [[ -z "${container_id}" ]]; then
      log_error "Контейнер backup не запущен (docker compose ps -q вернул пустой результат)."
      return 1
    fi

    local status
    if ! status=$(docker inspect -f '{{.State.Status}}' "${container_id}"); then
      log_error "Не удалось получить статус контейнера backup через docker inspect."
      return 1
    fi
    if [[ "${status}" != "running" ]]; then
      log_error "Контейнер backup имеет статус '${status}', ожидался 'running'."
      return 1
    fi

    local logs
    if logs=$("${COMPOSE_CMD[@]}" logs --no-color --tail 200 backup 2>/dev/null); then
      if grep -q "DummyStorage" <<<"${logs}"; then
        log_info "Логи backup содержат предупреждение о DummyStorage — fallback активен."
      else
        log_warn "Логи backup не содержат явного сообщения о DummyStorage. Это не критично, но проверьте конфигурацию при необходимости."
      fi
    else
      log_warn "Не удалось получить логи backup для проверки DummyStorage."
    fi

    log_info "Контейнер backup запущен и работает без конфигурации S3."
    return 0
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

  run_step "Проверка портов .env" step_check_ports
  run_step "docker compose up -d" step_compose_up
  if is_truthy "${BOOTSTRAP_SKIP_BACKEND_FLAG}"; then
    run_step_skip "Запуск backend-профиля" "передан флаг пропуска backend-профиля"
  else
    run_step "Запуск backend-профиля" step_compose_backend_up
  fi
  run_step "Smoke-проверка BACKUP_*" step_check_backup_env
  run_step "Smoke-проверка backup без S3" step_smoke_backup_dummy_storage
  run_step "Ожидание готовности docker compose" step_wait_infra
  if is_truthy "${BOOTSTRAP_SKIP_BACKEND_FLAG}"; then
    run_step_skip "Ожидание готовности backend-сервисов" "backend-профиль пропущен"
  else
    run_step "Ожидание готовности backend-сервисов" step_wait_backend
  fi
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
