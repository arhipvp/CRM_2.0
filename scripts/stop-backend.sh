#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_RUN_BASE="${ROOT_DIR}/.local/run"
BACKEND_RUN_DIR="${BACKEND_RUN_BASE}/backend"
PID_DIR="${BACKEND_RUN_DIR}/pids"
LOG_DIR="${BACKEND_RUN_DIR}/logs"
LOG_PREFIX="[stop-backend]"

SERVICES=(
  "gateway"
  "crm-worker"
  "crm-api"
  "auth"
)

usage() {
  cat <<USAGE
Usage: $0 [--run-dir PATH]

Останавливает backend-процессы, запущенные scripts/start-backend.sh, по PID-файлам.
  --run-dir PATH  каталог с PID/логами (по умолчанию ${BACKEND_RUN_DIR})
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
    log_warn "Каталог ${BACKEND_RUN_DIR} не найден. Нечего останавливать."
    exit 0
  fi

  PID_DIR="${BACKEND_RUN_DIR}/pids"
  LOG_DIR="${BACKEND_RUN_DIR}/logs"
}

stop_pid() {
  local service="$1"
  local pid_file="${PID_DIR}/${service}.pid"

  if [[ ! -f "${pid_file}" ]]; then
    log_warn "${service}: PID-файл не найден."
    return
  fi

  local pid
  pid=$(<"${pid_file}")
  if [[ -z "${pid}" ]]; then
    log_warn "${service}: PID-файл пуст, удаляем ${pid_file}."
    rm -f "${pid_file}"
    return
  fi

  if ! kill -0 "$pid" >/dev/null 2>&1; then
    log_warn "${service}: процесс ${pid} уже завершён, удаляем PID-файл."
    rm -f "${pid_file}"
    return
  fi

  log_info "${service}: отправляем SIGTERM (PID ${pid})."
  kill "$pid" >/dev/null 2>&1 || true

  local attempts=0
  local max_attempts=30
  local sleep_seconds=1

  while kill -0 "$pid" >/dev/null 2>&1; do
    if (( attempts >= max_attempts )); then
      log_warn "${service}: не завершился за ${max_attempts}s, отправляем SIGKILL."
      kill -9 "$pid" >/dev/null 2>&1 || true
      break
    fi
    sleep "$sleep_seconds"
    attempts=$((attempts + 1))
  done

  if kill -0 "$pid" >/dev/null 2>&1; then
    log_error "${service}: процесс ${pid} продолжает работать после SIGKILL. Проверьте вручную."
  else
    log_info "${service}: остановлен."
  fi

  rm -f "${pid_file}"
}

cleanup_run_dir() {
  if [[ -d "${PID_DIR}" ]]; then
    rmdir "${PID_DIR}" >/dev/null 2>&1 || true
  fi

  if [[ -d "${BACKEND_RUN_DIR}" ]]; then
    if [[ -z "$(ls -A "${BACKEND_RUN_DIR}")" ]]; then
      rmdir "${BACKEND_RUN_DIR}" >/dev/null 2>&1 || true
    fi
  fi
}

main() {
  parse_args "$@"

  if [[ ! -d "${PID_DIR}" ]]; then
    log_warn "Каталог PID ${PID_DIR} отсутствует. Нечего останавливать."
    exit 0
  fi

  log_info "Используем каталог ${BACKEND_RUN_DIR}"

  for service in "${SERVICES[@]}"; do
    stop_pid "$service"
  done

  cleanup_run_dir
}

main "$@"
