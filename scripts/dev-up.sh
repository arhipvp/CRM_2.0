#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
INFRA_DIR="${ROOT_DIR}/infra"
ENV_FILE="${ROOT_DIR}/.env"
COMPOSE_CMD=(docker compose --env-file "${ENV_FILE}")
LOG_PREFIX="[dev-up]"

DEFAULT_LOG_FILE="${ROOT_DIR}/.local/logs/dev-up.log"
DEV_UP_LOG_FILE="${DEV_UP_LOG_FILE:-${DEFAULT_LOG_FILE}}"

log_info() {
  printf '%s %s\n' "${LOG_PREFIX}" "$1"
}

log_warn() {
  printf '%s[предупреждение] %s\n' "${LOG_PREFIX}" "$1"
}

log_error() {
  printf '%s[ошибка] %s\n' "${LOG_PREFIX}" "$1" >&2
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
Использование: $0 [--skip-backend] [--with-backend] [--log-file PATH]

  --skip-backend   не запускать профиль backend (gateway, auth, crm, documents)
  --with-backend   запустить scripts/start-backend.sh после миграций bootstrap-скрипта
  --log-file PATH  путь к файлу журнала (по умолчанию ${DEV_UP_LOG_FILE})
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

skip_backend=false
with_backend=false
bootstrap_args=()

if is_truthy "${DEV_UP_WITH_BACKEND:-}"; then
  with_backend=true
  bootstrap_args+=(--with-backend)
fi

while (($# > 0)); do
  case "$1" in
    --skip-backend)
      skip_backend=true
      bootstrap_args+=(--skip-backend)
      ;;
    --with-backend)
      with_backend=true
      if [[ ! " ${bootstrap_args[*]} " =~ " --with-backend " ]]; then
        bootstrap_args+=(--with-backend)
      fi
      ;;
    --log-file)
      if (($# < 2)); then
        log_error "Для --log-file требуется путь"
        exit 1
      fi
      DEV_UP_LOG_FILE="$2"
      shift
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

setup_logging() {
  local target="$1"
  if [[ -z "${target}" ]]; then
    target="${DEFAULT_LOG_FILE}"
  fi

  if [[ "${target}" != /* ]]; then
    target="${ROOT_DIR}/${target}"
  fi

  local dir
  dir="$(dirname "${target}")"
  mkdir -p "${dir}"
  DEV_UP_LOG_FILE="${target}"

  # shellcheck disable=SC2094
  exec > >(tee -a "${DEV_UP_LOG_FILE}") 2>&1
}

setup_logging "${DEV_UP_LOG_FILE}"
log_info "Логи сохраняются в ${DEV_UP_LOG_FILE}"

if [[ "${with_backend}" == "true" && "${skip_backend}" == "false" ]]; then
  log_warn "Флаг --with-backend не отключает docker compose профиль backend. Добавьте --skip-backend при необходимости."
fi

log_info "Запуск bootstrap-скрипта"
"${ROOT_DIR}/scripts/bootstrap-local.sh" "${bootstrap_args[@]}"

log_info "Bootstrap завершён. Backend готов к работе."
