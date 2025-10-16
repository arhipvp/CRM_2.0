#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
INFRA_DIR="${ROOT_DIR}/infra"
ENV_FILE="${ROOT_DIR}/.env"
COMPOSE_CMD=(docker compose --env-file "${ENV_FILE}")
LOG_PREFIX="[dev-up]"

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
Использование: $0 [--open-browser|--no-browser] [--skip-frontend] [--skip-backend] [--with-backend]

  --open-browser   принудительно открыть браузер после запуска
  --no-browser     не открывать браузер (перекрывает переменную LOCAL_LAUNCH_OPEN_BROWSER)
  --skip-frontend  пропустить запуск контейнера фронтенда
  --skip-backend   не запускать профиль backend (gateway, auth, crm, documents, notifications, tasks)
  --with-backend   запустить scripts/start-backend.sh после миграций bootstrap-скрипта
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

open_browser_mode="auto"
skip_frontend=false
skip_backend=false
with_backend=false
bootstrap_args=()

if is_truthy "${DEV_UP_WITH_BACKEND:-}"; then
  with_backend=true
  bootstrap_args+=(--with-backend)
fi

while (($# > 0)); do
  case "$1" in
    --open-browser)
      open_browser_mode="force_open"
      ;;
    --no-browser)
      open_browser_mode="force_no"
      ;;
    --skip-frontend)
      skip_frontend=true
      bootstrap_args+=(--skip-frontend)
      ;;
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

if [[ "${with_backend}" == "true" && "${skip_backend}" == "false" ]]; then
  log_warn "Флаг --with-backend не отключает docker compose профиль backend. Добавьте --skip-backend при необходимости."
fi

log_info "Запуск bootstrap-скрипта"
"${ROOT_DIR}/scripts/bootstrap-local.sh" "${bootstrap_args[@]}"

log_info "Синхронизация .env для фронтенда"
if ! "${ROOT_DIR}/scripts/sync-env.sh" --non-interactive frontend; then
  log_error "Синхронизация фронтенда завершилась с ошибкой"
  exit 1
fi

if [[ "${skip_frontend}" == "false" ]]; then
  log_info "Запуск фронтенда в Docker Compose"
  load_env || exit 1
  (
    cd "${INFRA_DIR}" && "${COMPOSE_CMD[@]}" --profile app up -d frontend
  )
else
  log_warn "Пропущен запуск фронтенда (--skip-frontend)"
fi

extract_env_value() {
  local key="$1"
  if [[ ! -f "${ENV_FILE}" ]]; then
    return 1
  fi
  local line
  line=$(grep -E "^${key}=" "${ENV_FILE}" | tail -n 1 || true)
  if [[ -z "${line}" ]]; then
    return 1
  fi
  local value="${line#*=}"
  # Отсекаем inline-комментарии и пробелы по краям
  value="$(printf '%s' "${value}" | sed -e 's/[[:space:]]*#.*$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  printf '%s' "${value}"
}

frontend_port="$(extract_env_value FRONTEND_SERVICE_PORT || true)"
if [[ -z "${frontend_port}" ]]; then
  frontend_port="3000"
  log_warn "Не удалось определить FRONTEND_SERVICE_PORT из .env, используется ${frontend_port}"
fi

open_browser_default="${LOCAL_LAUNCH_OPEN_BROWSER:-}"
if [[ -z "${open_browser_default}" ]]; then
  open_browser_default="$(extract_env_value LOCAL_LAUNCH_OPEN_BROWSER || true)"
fi
open_browser_default="${open_browser_default,,}"

should_open_browser=false
case "${open_browser_mode}" in
  force_open)
    should_open_browser=true
    ;;
  force_no)
    should_open_browser=false
    ;;
  auto)
    if [[ "${open_browser_default}" == "true" ]]; then
      should_open_browser=true
    fi
    ;;
esac

app_url="http://localhost:${frontend_port}"
log_info "Откройте ${app_url}"

if [[ "${should_open_browser}" == "true" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    if python3 -m webbrowser "${app_url}"; then
      log_info "Открыт браузер с ${app_url}"
    else
      log_warn "Не удалось открыть браузер автоматически. Откройте URL вручную."
    fi
  else
    log_warn "Команда python3 недоступна. Откройте URL вручную."
  fi
fi

log_info "Готово"
