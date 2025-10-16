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

START_BACKEND_LOG_FILE_DEFAULT="${BACKEND_RUN_DIR}/start-backend.log"
START_BACKEND_LOG_FILE_ENV="${START_BACKEND_LOG_FILE:-}"
BACKEND_SCRIPT_LOG_FILE="${START_BACKEND_LOG_FILE_ENV:-${START_BACKEND_LOG_FILE_DEFAULT}}"
SCRIPT_LOG_FILE_OVERRIDE=false
if [[ -n "${START_BACKEND_LOG_FILE_ENV}" ]]; then
  SCRIPT_LOG_FILE_OVERRIDE=true
fi
STOP_CLEAN_LOGS=false

SERVICES=(
  "gateway"
  "crm-worker"
  "crm-api"
  "auth"
)

declare -A SERVICE_SET=()
for service in "${SERVICES[@]}"; do
  SERVICE_SET["$service"]=1
done

declare -a SELECTED_SERVICES=()
declare -A SELECTED_SERVICE_SET=()

trim_whitespace() {
  local value="$1"
  value="${value#${value%%[![:space:]]*}}"
  value="${value%${value##*[![:space:]]}}"
  printf '%s' "${value}"
}

list_available_services() {
  local IFS=", "
  printf '%s' "${SERVICES[*]}"
}

add_selected_service() {
  local raw="$1"
  local service
  service="$(trim_whitespace "${raw}")"
  if [[ -z "${service}" ]]; then
    return
  fi

  if [[ -z "${SERVICE_SET["${service}"]:-}" ]]; then
    log_error "Неизвестный сервис: '${service}'. Доступные значения: $(list_available_services)"
    exit 1
  fi

  if [[ -z "${SELECTED_SERVICE_SET["${service}"]:-}" ]]; then
    SELECTED_SERVICES+=("${service}")
    SELECTED_SERVICE_SET["${service}"]=1
  fi
}

parse_service_arg() {
  local arg="$1"
  local IFS=','
  read -r -a parts <<<"${arg}"
  for part in "${parts[@]}"; do
    add_selected_service "${part}"
  done
}

usage() {
  cat <<USAGE
Usage: $0 [--run-dir PATH] [--log-file PATH] [--service NAME[,NAME...]] [--clean-logs]

Останавливает backend-процессы, запущенные scripts/start-backend.sh, по PID-файлам.
  --run-dir PATH  каталог с PID/логами (по умолчанию ${BACKEND_RUN_DIR})
  --log-file PATH путь к журналу запуска backend (по умолчанию ${BACKEND_SCRIPT_LOG_FILE})
  --service NAME  остановить только перечисленные сервисы (можно указывать несколько флагов или CSV)
  --clean-logs    удалить журналы запуска и сервисов после остановки
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
        if [[ "${SCRIPT_LOG_FILE_OVERRIDE}" != true ]]; then
          BACKEND_SCRIPT_LOG_FILE="${BACKEND_RUN_DIR}/start-backend.log"
        fi
        shift
        ;;
      --log-file)
        if (($# < 2)); then
          log_error "Для --log-file требуется путь"
          exit 1
        fi
        BACKEND_SCRIPT_LOG_FILE="$(abspath "$2")"
        SCRIPT_LOG_FILE_OVERRIDE=true
        shift
        ;;
      --service)
        if (($# < 2)); then
          log_error "Для --service требуется имя сервиса"
          exit 1
        fi
        parse_service_arg "$2"
        shift
        ;;
      --service=*)
        parse_service_arg "${1#--service=}"
        ;;
      --clean-logs)
        STOP_CLEAN_LOGS=true
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

  if [[ "${SCRIPT_LOG_FILE_OVERRIDE}" != true && "${BACKEND_SCRIPT_LOG_FILE}" != /* ]]; then
    BACKEND_SCRIPT_LOG_FILE="$(abspath "${BACKEND_SCRIPT_LOG_FILE}")"
  fi
}

stop_pid() {
  local service="$1"
  local pid_file="${PID_DIR}/${service}.pid"

  log_info "${service}: PID-файл ${pid_file}"

  if [[ ! -f "${pid_file}" ]]; then
    log_warn "${service}: PID-файл ${pid_file} не найден."
    return
  fi

  local pid
  pid=$(<"${pid_file}")
  if [[ -z "${pid}" ]]; then
    log_warn "${service}: PID-файл ${pid_file} пуст, удаляем."
    rm -f "${pid_file}"
    return
  fi

  if ! kill -0 "$pid" >/dev/null 2>&1; then
    log_warn "${service}: процесс ${pid} уже завершён, удаляем PID-файл ${pid_file}."
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

all_services_selected() {
  local -a selected=("$@")
  if ((${#selected[@]} != ${#SERVICES[@]})); then
    return 1
  fi

  declare -A seen=()
  local item
  for item in "${selected[@]}"; do
    seen["$item"]=1
  done

  local service
  for service in "${SERVICES[@]}"; do
    if [[ -z "${seen["${service}"]:-}" ]]; then
      return 1
    fi
  done

  return 0
}

clean_logs() {
  local -a services_to_clean=("$@")
  local removed_any=false
  local remove_all=false

  if all_services_selected "${services_to_clean[@]}"; then
    remove_all=true
  fi

  if [[ -d "${LOG_DIR}" ]]; then
    if [[ "${remove_all}" == true ]]; then
      rm -rf "${LOG_DIR}"
      removed_any=true
      log_info "Удалён каталог логов сервисов ${LOG_DIR}"
    else
      local service
      for service in "${services_to_clean[@]}"; do
        local log_file="${LOG_DIR}/${service}.log"
        if [[ -f "${log_file}" ]]; then
          rm -f "${log_file}"
          removed_any=true
          log_info "${service}: удалён лог-файл ${log_file}"
        fi
      done
      if [[ -d "${LOG_DIR}" && -z "$(ls -A "${LOG_DIR}")" ]]; then
        rmdir "${LOG_DIR}" >/dev/null 2>&1 || true
        if [[ ! -d "${LOG_DIR}" ]]; then
          log_info "Каталог логов ${LOG_DIR} удалён (стал пустым)"
        fi
      fi
    fi
  fi

  if [[ -n "${BACKEND_SCRIPT_LOG_FILE}" ]]; then
    if [[ "${BACKEND_SCRIPT_LOG_FILE}" == "${BACKEND_RUN_DIR}"/* ]]; then
      if [[ -f "${BACKEND_SCRIPT_LOG_FILE}" ]]; then
        if [[ "${remove_all}" == true ]]; then
          rm -f "${BACKEND_SCRIPT_LOG_FILE}"
          removed_any=true
          log_info "Удалён журнал запуска ${BACKEND_SCRIPT_LOG_FILE}"
        else
          log_info "Журнал запуска ${BACKEND_SCRIPT_LOG_FILE} сохранён, так как остановлены не все сервисы"
        fi
      fi
    else
      log_warn "Журнал запуска ${BACKEND_SCRIPT_LOG_FILE} расположен вне ${BACKEND_RUN_DIR}, пропускаем удаление"
    fi
  fi

  if [[ "${removed_any}" == true ]]; then
    log_info "Лог-файлы очищены"
  fi
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
  log_info "Журнал запуска backend: ${BACKEND_SCRIPT_LOG_FILE}"

  local services_to_stop=("${SERVICES[@]}")
  if ((${#SELECTED_SERVICES[@]} > 0)); then
    services_to_stop=("${SELECTED_SERVICES[@]}")
    local IFS=', '
    log_info "Останавливаем выбранные сервисы: ${services_to_stop[*]}"
  else
    local IFS=', '
    log_info "Останавливаем все сервисы: ${services_to_stop[*]}"
  fi

  local service
  for service in "${services_to_stop[@]}"; do
    stop_pid "$service"
  done

  if [[ "${STOP_CLEAN_LOGS}" == true ]]; then
    clean_logs "${services_to_stop[@]}"
  fi

  cleanup_run_dir
}

main "$@"
