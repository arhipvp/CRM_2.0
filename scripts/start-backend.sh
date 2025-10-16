#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
BACKEND_RUN_BASE="${ROOT_DIR}/.local/run"
BACKEND_RUN_DIR="${BACKEND_RUN_BASE}/backend"
PID_DIR="${BACKEND_RUN_DIR}/pids"
LOG_DIR="${BACKEND_RUN_DIR}/logs"
LOG_PREFIX="[start-backend]"

SERVICES=(
  "auth|backend/auth|./gradlew bootRun"
  "crm-api|backend/crm|poetry run crm-api"
  "crm-worker|backend/crm|poetry run crm-worker worker -l info"
  "gateway|backend/gateway|pnpm start:dev"
)

usage() {
  cat <<USAGE
Usage: $0 [--run-dir PATH]

Запускает основные backend-процессы вне Docker Compose и сохраняет PID/логи в каталоге .local/run/backend.
  --run-dir PATH  переопределить каталог для PID и логов (по умолчанию ${BACKEND_RUN_DIR})
USAGE
}

abspath() {
  local path="$1"
  if [[ "${path}" == /* ]]; then
    printf '%s' "${path}"
  else
    printf '%s/%s' "$(pwd)" "${path}"
  fi
}

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
    exit 1
  fi
}

load_env() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    log_error "Файл окружения ${ENV_FILE} не найден. Запустите scripts/sync-env.sh и повторите попытку."
    exit 1
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

ensure_directories() {
  mkdir -p "${BACKEND_RUN_DIR}" "${PID_DIR}" "${LOG_DIR}"
}

check_existing_process() {
  local pid_file="$1"
  if [[ ! -f "$pid_file" ]]; then
    return 1
  fi

  local pid
  pid=$(<"$pid_file")
  if [[ -z "${pid}" ]]; then
    rm -f "$pid_file"
    return 1
  fi

  if kill -0 "$pid" >/dev/null 2>&1; then
    return 0
  fi

  log_warn "Процесс с PID ${pid} из $(basename "$pid_file") не найден. Удаляем устаревший PID-файл."
  rm -f "$pid_file"
  return 1
}

start_service() {
  local name="$1" dir_rel="$2" command="$3"
  local service_dir="${ROOT_DIR}/${dir_rel}"
  local pid_file="${PID_DIR}/${name}.pid"
  local log_file="${LOG_DIR}/${name}.log"

  if check_existing_process "$pid_file"; then
    local pid
    pid=$(<"$pid_file")
    log_info "${name}: уже запущен (PID ${pid}), пропускаем. Логи: ${log_file}"
    return
  fi

  if [[ ! -d "${service_dir}" ]]; then
    log_error "Каталог ${service_dir} не найден."
    exit 1
  fi

  : >"${log_file}"
  log_info "${name}: запускаем команду '${command}'. Логи: ${log_file}"

  (
    cd "${service_dir}" || exit 1
    nohup bash -lc "${command}" >>"${log_file}" 2>&1 &
    local child_pid=$!
    disown "$child_pid" 2>/dev/null || true
    echo "$child_pid" >"${pid_file}"
  )

  local pid
  pid=$(<"${pid_file}")
  if [[ -n "${pid}" ]] && kill -0 "$pid" >/dev/null 2>&1; then
    log_info "${name}: процесс запущен (PID ${pid})"
  else
    log_error "${name}: не удалось запустить процесс. См. логи ${log_file}"
    rm -f "${pid_file}"
    exit 1
  fi
}

parse_args() {
  while (($# > 0)); do
    case "$1" in
      --run-dir)
        if (($# < 2)); then
          log_error "Для --run-dir требуется путь"
          exit 1
        fi
        BACKEND_RUN_DIR="$(abspath "$2")"
        PID_DIR="${BACKEND_RUN_DIR}/pids"
        LOG_DIR="${BACKEND_RUN_DIR}/logs"
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

  if [[ ! -d "${BACKEND_RUN_DIR}" ]]; then
    mkdir -p "${BACKEND_RUN_DIR}"
  fi
  PID_DIR="${BACKEND_RUN_DIR}/pids"
  LOG_DIR="${BACKEND_RUN_DIR}/logs"
}

main() {
  parse_args "$@"
  load_env
  ensure_directories

  log_info "PID-файлы: ${PID_DIR}"
  log_info "Логи: ${LOG_DIR}"

  require_command pnpm
  require_command poetry
  require_command java "java (JDK 17+)"

  local gradlew="${ROOT_DIR}/backend/auth/gradlew"
  if [[ -f "${gradlew}" && ! -x "${gradlew}" ]]; then
    chmod +x "${gradlew}"
  fi

  for entry in "${SERVICES[@]}"; do
    IFS='|' read -r name dir_rel command <<<"$entry"
    start_service "$name" "$dir_rel" "$command"
  done
}

main "$@"
