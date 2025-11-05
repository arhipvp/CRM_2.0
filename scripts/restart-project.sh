#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
INFRA_DIR="${ROOT_DIR}/infra"
ENV_FILE="${ROOT_DIR}/.env"
COMPOSE_CMD=(docker compose --env-file "${ENV_FILE}")
LOG_PREFIX="[restart-project]"

log_info() {
  printf '%s %s\n' "${LOG_PREFIX}" "$1"
}

log_error() {
  printf '%s[ошибка] %s\n' "${LOG_PREFIX}" "$1" >&2
}

usage() {
  cat <<USAGE
Использование: $0 [опции bootstrap-local.sh]

  Скрипт выключает контейнеры (docker compose --env-file .env down --remove-orphans) и
  повторно запускает ./scripts/bootstrap-local.sh с включённым AUTH bootstrap.
  Все переданные аргументы перенаправляются в bootstrap-local.sh.
USAGE
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

validate_auth_bootstrap_env() {
  local email="${AUTH_BOOTSTRAP_EMAIL:-}" password="${AUTH_BOOTSTRAP_PASSWORD:-}" roles="${AUTH_BOOTSTRAP_ROLES:-}"

  if [[ -z "${email}" ]]; then
    log_error "AUTH_BOOTSTRAP_EMAIL не задан. Добавьте значение в ${ENV_FILE} и перезапустите скрипт."
    return 1
  fi

  if [[ -z "${password}" ]]; then
    log_error "AUTH_BOOTSTRAP_PASSWORD не задан. Заполните переменную в ${ENV_FILE} и попробуйте снова."
    return 1
  fi

  if [[ -z "${roles}" ]]; then
    log_error "AUTH_BOOTSTRAP_ROLES не заданы. Укажите список ролей в ${ENV_FILE} и повторите запуск."
    return 1
  fi
}

bootstrap_args=()
while (($# > 0)); do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    *)
      bootstrap_args+=("$1")
      ;;
  esac
  shift
done

log_info "Загрузка переменных окружения из ${ENV_FILE}"
load_env

validate_auth_bootstrap_env

log_info "Отключаем Docker Compose окружение (--env-file .env down --remove-orphans)"
(
  cd "${INFRA_DIR}"
  "${COMPOSE_CMD[@]}" down --remove-orphans
)

export AUTH_BOOTSTRAP_ENABLED=true
export AUTH_BOOTSTRAP_EMAIL="${AUTH_BOOTSTRAP_EMAIL}"
export AUTH_BOOTSTRAP_PASSWORD="${AUTH_BOOTSTRAP_PASSWORD}"
export AUTH_BOOTSTRAP_ROLES="${AUTH_BOOTSTRAP_ROLES}"

log_info "Запускаем ./scripts/bootstrap-local.sh"
"${SCRIPT_DIR}/bootstrap-local.sh" "${bootstrap_args[@]}"
