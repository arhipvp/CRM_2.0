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

START_BACKEND_LOG_FILE_DEFAULT="${BACKEND_RUN_DIR}/start-backend.log"
START_BACKEND_LOG_FILE_ENV="${START_BACKEND_LOG_FILE:-}"
BACKEND_SCRIPT_LOG_FILE="${START_BACKEND_LOG_FILE_ENV:-${START_BACKEND_LOG_FILE_DEFAULT}}"
SCRIPT_LOG_FILE_OVERRIDE=false
if [[ -n "${START_BACKEND_LOG_FILE_ENV}" ]]; then
  SCRIPT_LOG_FILE_OVERRIDE=true
fi
PARSE_ERROR=""
PARSE_EXIT_CODE=0
PARSE_SHOW_USAGE=false

SERVICES=(
  "auth|backend/auth|./gradlew bootRun"
  "crm-api|backend/crm|poetry run crm-api"
  "crm-worker|backend/crm|poetry run crm-worker worker -l info"
  "gateway|backend/gateway|pnpm start:dev"
)

declare -A SERVICE_ENTRY_BY_NAME=()
ALL_SERVICE_NAMES=()
for entry in "${SERVICES[@]}"; do
  IFS='|' read -r service_name _ <<<"${entry}"
  SERVICE_ENTRY_BY_NAME["${service_name}"]="${entry}"
  ALL_SERVICE_NAMES+=("${service_name}")
done

SELECTED_SERVICE_NAMES=()
declare -A SELECTED_SERVICE_SEEN=()

usage() {
  cat <<USAGE
Usage: $0 [--run-dir PATH] [--log-file PATH] [--service NAME[,NAME2] ...]

Запускает основные backend-процессы вне Docker Compose и сохраняет PID/логи в каталоге .local/run/backend.
  --run-dir PATH  переопределить каталог для PID и логов (по умолчанию ${BACKEND_RUN_DIR})
  --log-file PATH путь к файлу журнала запуска (по умолчанию ${BACKEND_SCRIPT_LOG_FILE})
  --service NAME[,NAME2]
                  запустить только указанные сервисы (можно повторять опцию несколько раз)
USAGE
}

available_services_list() {
  local names=()
  for entry in "${SERVICES[@]}"; do
    IFS='|' read -r name _ <<<"$entry"
    names+=("$name")
  done
  printf '%s' "${names[*]}"
}

is_valid_service() {
  local candidate="$1"
  for entry in "${SERVICES[@]}"; do
    IFS='|' read -r name _ <<<"$entry"
    if [[ "$name" == "$candidate" ]]; then
      return 0
    fi
  done
  return 1
}

should_run_service() {
  local candidate="$1"
  if [[ ${#SELECTED_SERVICES[@]} -eq 0 ]]; then
    return 0
  fi
  for selected in "${SELECTED_SERVICES[@]}"; do
    if [[ "$selected" == "$candidate" ]]; then
      return 0
    fi
  done
  return 1
}

abspath() {
  local path="$1"
  if [[ "${path}" == /* ]]; then
    printf '%s' "${path}"
  else
    printf '%s/%s' "$(pwd)" "${path}"
  fi
}

join_by() {
  local sep="$1"
  shift || true
  local result=""
  local first=true
  for part in "$@"; do
    if [[ "${first}" == true ]]; then
      result="${part}"
      first=false
    else
      result+="${sep}${part}"
    fi
  done
  printf '%s' "${result}"
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

ensure_poetry_env() {
  local service_dir="$1"
  local service_name="$2"

  if [[ ! -d "${service_dir}" ]]; then
    log_error "${service_name}: каталог ${service_dir} не найден для подготовки Poetry-окружения."
    exit 1
  fi

  (
    cd "${service_dir}" || exit 1
    if ! poetry env info --path >/dev/null 2>&1; then
      log_info "${service_name}: Poetry-окружение не найдено, выполняем 'poetry install --sync --no-root' для установки зависимостей."
      poetry install --sync --no-root
    fi
  )
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
          PARSE_ERROR="Для --run-dir требуется путь"
          PARSE_EXIT_CODE=1
          return
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
          PARSE_ERROR="Для --log-file требуется путь"
          PARSE_EXIT_CODE=1
          return
        fi
        BACKEND_SCRIPT_LOG_FILE="$(abspath "$2")"
        SCRIPT_LOG_FILE_OVERRIDE=true
        shift
        ;;
      --service)
        if (($# < 2)); then
          PARSE_ERROR="Для --service требуется имя сервиса"
          PARSE_EXIT_CODE=1
          return
        fi
        local raw_names="$2"
        if [[ -z "${raw_names//[[:space:]]/}" ]]; then
          PARSE_ERROR="Опция --service не может быть пустой"
          PARSE_EXIT_CODE=1
          return
        fi
        IFS=',' read -ra requested_names <<<"${raw_names}"
        for requested_name in "${requested_names[@]}"; do
          local normalized_name
          normalized_name="${requested_name//[[:space:]]/}"
          if [[ -z "${normalized_name}" ]]; then
            PARSE_ERROR="Обнаружено пустое имя сервиса в списке --service"
            PARSE_EXIT_CODE=1
            return
          fi
          if [[ -z "${SERVICE_ENTRY_BY_NAME["${normalized_name}"]+x}" ]]; then
            PARSE_ERROR="Неизвестный сервис '${normalized_name}'. Доступны: $(join_by ', ' "${ALL_SERVICE_NAMES[@]}")"
            PARSE_EXIT_CODE=1
            return
          fi
          if [[ -n "${SELECTED_SERVICE_SEEN["${normalized_name}"]:-}" ]]; then
            PARSE_ERROR="Сервис '${normalized_name}' указан несколько раз"
            PARSE_EXIT_CODE=1
            return
          fi
          SELECTED_SERVICE_SEEN["${normalized_name}"]=1
          SELECTED_SERVICE_NAMES+=("${normalized_name}")
        done
        shift
        ;;
      -h|--help)
        PARSE_SHOW_USAGE=true
        return
        ;;
      *)
        PARSE_ERROR="Неизвестный аргумент: $1"
        PARSE_EXIT_CODE=1
        return
        ;;
    esac
    shift
  done

  if [[ "${SCRIPT_LOG_FILE_OVERRIDE}" != true ]]; then
    if [[ "${BACKEND_SCRIPT_LOG_FILE}" != /* ]]; then
      BACKEND_SCRIPT_LOG_FILE="$(abspath "${BACKEND_SCRIPT_LOG_FILE}")"
    fi
  fi
}

setup_logging() {
  local target="$1"
  if [[ -z "${target}" ]]; then
    target="${BACKEND_RUN_DIR}/start-backend.log"
  fi

  local dir
  dir="$(dirname "${target}")"
  mkdir -p "${dir}"
  BACKEND_SCRIPT_LOG_FILE="${target}"

  # shellcheck disable=SC2094
  exec > >(tee -a "${BACKEND_SCRIPT_LOG_FILE}") 2>&1
}

main() {
  parse_args "$@"

  if [[ "${PARSE_SHOW_USAGE}" == true ]]; then
    setup_logging "${BACKEND_SCRIPT_LOG_FILE}"
    usage
    exit 0
  fi

  setup_logging "${BACKEND_SCRIPT_LOG_FILE}"

  if [[ -n "${PARSE_ERROR}" ]]; then
    log_error "${PARSE_ERROR}"
    usage
    exit "${PARSE_EXIT_CODE}"
  fi

  load_env
  ensure_directories

  log_info "Журнал запуска: ${BACKEND_SCRIPT_LOG_FILE}"
  log_info "PID-файлы: ${PID_DIR}"
  log_info "Логи сервисов: ${LOG_DIR}"
  if [[ ${#SELECTED_SERVICES[@]} -gt 0 ]]; then
    log_info "Выбранные сервисы: ${SELECTED_SERVICES[*]}"
  else
    log_info "Выбраны все доступные сервисы"
  fi

  require_command pnpm
  require_command poetry
  require_command java "java (JDK 17+)"

  local gradlew="${ROOT_DIR}/backend/auth/gradlew"
  if [[ -f "${gradlew}" && ! -x "${gradlew}" ]]; then
    chmod +x "${gradlew}"
  fi

  local services_to_run=()
  if ((${#SELECTED_SERVICE_NAMES[@]} == 0)); then
    services_to_run=("${SERVICES[@]}")
    log_info "Запускаем все сервисы: $(join_by ', ' "${ALL_SERVICE_NAMES[@]}")"
  else
    for selected_name in "${SELECTED_SERVICE_NAMES[@]}"; do
      services_to_run+=("${SERVICE_ENTRY_BY_NAME["${selected_name}"]}")
    done
    log_info "Запускаем выбранные сервисы: $(join_by ', ' "${SELECTED_SERVICE_NAMES[@]}")"
  fi

  for entry in "${services_to_run[@]}"; do
    IFS='|' read -r name dir_rel command <<<"$entry"
    local service_dir="${ROOT_DIR}/${dir_rel}"

    if ! should_run_service "$name"; then
      log_info "${name}: пропускаем (не выбран через --service)"
      continue
    fi

    if [[ "$name" == "crm-api" || "$name" == "crm-worker" ]]; then
      ensure_poetry_env "${service_dir}" "$name"
    fi

    start_service "$name" "$dir_rel" "$command"
  done
}

main "$@"
