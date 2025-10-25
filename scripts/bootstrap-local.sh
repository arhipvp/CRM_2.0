#!/usr/bin/env bash
set -uo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
INFRA_DIR="${ROOT_DIR}/infra"
ENV_FILE="${ROOT_DIR}/.env"
COMPOSE_CMD=(docker compose --env-file "${ENV_FILE}")

create_tmp_dir() {
  if command -v mktemp >/dev/null 2>&1; then
    mktemp -d -t bootstrap-local-XXXXXX
    return
  fi

  local candidates=(
    "python3"
    "python"
    "python3.12"
    "python3.11"
    "python3.10"
    "python3.9"
    "python3.8"
    "py -3"
    "py -3.12"
    "py -3.11"
    "py -3.10"
    "py -3.9"
  )

  local python_cmd=""
  for candidate in "${candidates[@]}"; do
    if eval "${candidate} --version" >/dev/null 2>&1; then
      python_cmd="${candidate}"
      break
    fi
  done

  if [[ -n "${python_cmd}" ]]; then
    "${python_cmd}" - <<'PY'
import tempfile
print(tempfile.mkdtemp(prefix="bootstrap-local-"))
PY
    return
  fi

  local fallback="${ROOT_DIR}/.local/tmp/bootstrap-$(date +%s)-$$"
  mkdir -p "${fallback}"
  printf '%s\n' "${fallback}"
}

TMP_DIR="$(create_tmp_dir)"
LOG_PREFIX="[bootstrap-local]"
DEFAULT_LOG_DIR="${ROOT_DIR}/.local/logs/bootstrap"

PYTHON_CMD=""
PYTHON_CANDIDATES=(
  "python3"
  "python"
  "python3.12"
  "python3.11"
  "python3.10"
  "python3.9"
  "python3.8"
  "py -3"
  "py -3.12"
  "py -3.11"
  "py -3.10"
  "py -3.9"
)

if [[ -n "${BOOTSTRAP_LOG_DIR:-}" ]]; then
  if [[ "${BOOTSTRAP_LOG_DIR}" == /* ]]; then
    LOG_DIR="${BOOTSTRAP_LOG_DIR}"
  else
    LOG_DIR="${ROOT_DIR}/${BOOTSTRAP_LOG_DIR}"
  fi
else
  LOG_DIR="${DEFAULT_LOG_DIR}"
fi

SAVE_LOGS_FLAG="${BOOTSTRAP_SAVE_LOGS:-true}"
SESSION_LOG_DIR=""
SESSION_LOG_INITIALIZED=false
STEP_LOG_DIR=""
SUMMARY_JSON_FILE=""
SUMMARY_MARKDOWN_FILE=""
BOOTSTRAP_STARTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
BOOTSTRAP_FINISHED_AT=""

BACKEND_PROFILE_SERVICES=(gateway auth crm documents)

BOOTSTRAP_SKIP_BACKEND_FLAG="${BOOTSTRAP_SKIP_BACKEND:-false}"
BOOTSTRAP_WITH_BACKEND_FLAG="${BOOTSTRAP_WITH_BACKEND:-false}"
BOOTSTRAP_SKIP_BACKEND_WAIT_FLAG="${BOOTSTRAP_SKIP_BACKEND_WAIT:-false}"

strip_cr() {
  local value="$1"
  printf '%s' "${value//$'\r'/}"
}

docker_service_status() {
  local profile="$1" service="$2"
  local compose_args=()

  if [[ -n "${profile:-}" ]]; then
    compose_args+=(--profile "${profile}")
  fi

  local container_id=""
  if ! container_id=$("${COMPOSE_CMD[@]}" "${compose_args[@]}" ps -q "${service}" 2>/dev/null); then
    return 1
  fi

  container_id=$(strip_cr "${container_id}")

  if [[ -z "${container_id}" ]]; then
    printf '%s\n%s\n' "absent" ""
    return 0
  fi

  if ! docker inspect "${container_id}" >/dev/null 2>&1; then
    printf '%s\n%s\n' "absent" ""
    return 0
  fi

  docker inspect -f '{{.State.Status}}{{printf "\n"}}{{if .State.Health}}{{.State.Health.Status}}{{end}}' "${container_id}"
}

check_backend_services() {
  local json_output=""
  if ! json_output=$("${COMPOSE_CMD[@]}" --profile backend ps --format json 2>/dev/null); then
    echo "ERROR compose ps failed"
    return 2
  fi

  local result=""
  result=$(printf '%s\n' "${json_output}" | ${PYTHON_CMD} "${BACKEND_PROFILE_SERVICES[@]}" <<'PY'
import json
import sys

services = sys.argv[1:]
raw = sys.stdin.read().strip()
if not raw:
    print("PENDING no-data")
    sys.exit(0)

try:
    data = json.loads(raw)
except json.JSONDecodeError as exc:
    print(f"ERROR invalid-json {exc}")
    sys.exit(1)

if isinstance(data, dict):
    data = [data]

state_map = {}
for entry in data:
    service_name = entry.get("Service") or ""
    if service_name:
        state_map[service_name] = entry

missing = [svc for svc in services if svc not in state_map]
if missing:
    print("PENDING missing:" + ",".join(missing))
    sys.exit(0)

for svc in services:
    entry = state_map[svc]
    state = (entry.get("State") or entry.get("Status") or "").lower()
    health = (entry.get("Health") or "").lower()
    if state not in ("running", "up"):
        print(f"PENDING state:{svc}:{state}")
        sys.exit(0)
    if health and health != "healthy":
        print(f"UNHEALTHY health:{svc}:{health}")
        sys.exit(0)

print("READY")
PY
) || return 2

  case "${result}" in
    READY)
      return 0
      ;;
    UNHEALTHY*)
      echo "${result}"
      return 2
      ;;
    *)
      echo "${result}"
      return 1
      ;;
  esac
}

cleanup() {
  if ! is_truthy "${SAVE_LOGS_FLAG}"; then
    if [[ -d "${TMP_DIR}" ]]; then
      rm -rf "${TMP_DIR}"
    fi
    if [[ -n "${SESSION_LOG_DIR:-}" && -d "${SESSION_LOG_DIR}" ]]; then
      rm -rf "${SESSION_LOG_DIR}"
    fi
    return
  fi

  if [[ "${SESSION_LOG_INITIALIZED}" != true ]]; then
    if [[ -d "${TMP_DIR}" ]]; then
      log_info "Временные файлы сохранены в ${TMP_DIR}"
    fi
    return
  fi

  if [[ -d "${TMP_DIR}" ]]; then
    local tmp_target="${SESSION_LOG_DIR}/tmp"
    if [[ -e "${tmp_target}" ]]; then
      tmp_target="${tmp_target}-$(date +%H%M%S)"
    fi
    if mv "${TMP_DIR}" "${tmp_target}" 2>/dev/null; then
      TMP_DIR="${tmp_target}"
    else
      log_warn "Не удалось переместить временные файлы в ${SESSION_LOG_DIR}; оставлены в ${TMP_DIR}"
    fi
  fi

  if [[ -n "${SUMMARY_MARKDOWN_FILE:-}" && -f "${SUMMARY_MARKDOWN_FILE}" ]]; then
    log_info "Сводка шагов: ${SUMMARY_MARKDOWN_FILE}"
  fi

  if [[ -n "${SUMMARY_JSON_FILE:-}" && -f "${SUMMARY_JSON_FILE}" ]]; then
    log_info "JSON-отчёт: ${SUMMARY_JSON_FILE}"
  fi

  if [[ -n "${SESSION_LOG_DIR:-}" && -d "${SESSION_LOG_DIR}" ]]; then
    log_info "Подробные логи сохранены в ${SESSION_LOG_DIR}"
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

detect_python_cmd() {
  local candidate
  for candidate in "${PYTHON_CANDIDATES[@]}"; do
    if eval "${candidate} --version" >/dev/null 2>&1; then
      PYTHON_CMD="${candidate}"
      return 0
    fi
  done
  return 1
}

set_log_dir() {
  local value="$1"
  if [[ -z "${value}" ]]; then
    log_error "Аргумент --log-dir не может быть пустым"
    usage
    exit 1
  fi
  if [[ "${value}" == /* ]]; then
    LOG_DIR="${value}"
  else
    LOG_DIR="${ROOT_DIR}/${value}"
  fi
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
  ${PYTHON_CMD} - "$port_num" <<'PY'
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
                    getattr(errno, "EINVAL", 22),
                    getattr(errno, "WSAEINVAL", 10022),
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
Использование: $0 [--skip-backend] [--skip-backend-wait] [--with-backend] [--log-dir <dir>] [--discard-logs]

  --skip-backend   пропустить запуск профиля backend (gateway, auth, crm, documents)
  --with-backend   запустить scripts/start-backend.sh после миграций
  --log-dir <dir>  сохранять журналы и отчёты bootstrap в указанном каталоге (по умолчанию .local/logs/bootstrap)
  --discard-logs   удалить каталоги логов и отчётов после завершения работы
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
      --skip-backend)
        BOOTSTRAP_SKIP_BACKEND_FLAG="true"
        ;;
      --skip-backend-wait)
        BOOTSTRAP_SKIP_BACKEND_WAIT_FLAG="true"
        ;;
      --with-backend)
        BOOTSTRAP_WITH_BACKEND_FLAG="true"
        ;;
      --log-dir)
        if (($# < 2)); then
          log_error "Для --log-dir требуется значение"
          usage
          exit 1
        fi
        shift
        set_log_dir "$1"
        ;;
      --log-dir=*)
        set_log_dir "${1#*=}"
        ;;
      --discard-logs)
        SAVE_LOGS_FLAG="false"
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

initialize_log_storage() {
  local base_dir="${LOG_DIR:-${DEFAULT_LOG_DIR}}"
  if [[ "${base_dir}" != /* ]]; then
    base_dir="${ROOT_DIR}/${base_dir}"
  fi

  if ! mkdir -p "${base_dir}"; then
    log_error "Не удалось создать каталог логов ${base_dir}"
    exit 1
  fi

  local timestamp suffix candidate
  timestamp="$(date +%Y%m%d-%H%M%S)"
  suffix=0
  while :; do
    candidate="${base_dir}/run-${timestamp}"
    if (( suffix > 0 )); then
      candidate="${candidate}-${suffix}"
    fi
    if [[ ! -e "${candidate}" ]]; then
      break
    fi
    suffix=$((suffix + 1))
  done

  if ! mkdir -p "${candidate}/steps"; then
    log_error "Не удалось создать каталог шагов ${candidate}/steps"
    exit 1
  fi

  SESSION_LOG_DIR="${candidate}"
  STEP_LOG_DIR="${candidate}/steps"
  SUMMARY_JSON_FILE="${candidate}/summary.json"
  SUMMARY_MARKDOWN_FILE="${candidate}/summary.md"
  SESSION_LOG_INITIALIZED=true
}

write_summary_report() {
  if [[ "${SESSION_LOG_INITIALIZED}" != true ]]; then
    return
  fi

  mkdir -p "${SESSION_LOG_DIR}" "${STEP_LOG_DIR}"

  local overall_status="OK"
  if (( FAIL_COUNT > 0 )); then
    overall_status="FAIL"
  fi

  local steps_count=${#STEP_RESULTS[@]}
  local md_file="${SUMMARY_MARKDOWN_FILE}"
  {
    printf '# Сводка bootstrap\n\n'
    printf '* Старт: %s\n' "${BOOTSTRAP_STARTED_AT}"
    if [[ -n "${BOOTSTRAP_FINISHED_AT}" ]]; then
      printf '* Завершение: %s\n' "${BOOTSTRAP_FINISHED_AT}"
    fi
    printf '* Шагов: %d\n' "${steps_count}"
    printf '* Итоговый статус: %s\n\n' "${overall_status}"
    printf '| Шаг | Статус | Комментарий | Лог |\n'
    printf '| --- | --- | --- | --- |\n'
  } > "${md_file}"

  local data_file="${TMP_DIR}/step-results.tsv"
  : > "${data_file}"

  for entry in "${STEP_RESULTS[@]}"; do
    IFS='|' read -r name status message log_path <<<"$entry"
    local display_log="${log_path}"
    if [[ -n "${display_log}" && "${display_log}" == "${ROOT_DIR}/"* ]]; then
      display_log="./${display_log#"${ROOT_DIR}/"}"
    fi

    local name_cell="${name//|/\\|}"
    local message_cell
    message_cell="${message//|/\\|}"
    local log_cell
    if [[ -n "${display_log}" ]]; then
      log_cell="${display_log//|/\\|}"
    else
      log_cell='—'
    fi
    if [[ -z "${message_cell}" ]]; then
      message_cell='—'
    fi

    printf '%s|%s|%s|%s\n' "$name" "$status" "$message" "$log_path" >> "${data_file}"
    printf '| %s | %s | %s | %s |\n' "${name_cell}" "${status}" "${message_cell}" "${log_cell}" >> "${md_file}"
  done

  if [[ -n "${PYTHON_CMD:-}" ]]; then
    BOOTSTRAP_SUMMARY_STARTED_AT="${BOOTSTRAP_STARTED_AT}" \
    BOOTSTRAP_SUMMARY_FINISHED_AT="${BOOTSTRAP_FINISHED_AT}" \
    BOOTSTRAP_SUMMARY_STATUS="${overall_status}" \
      ${PYTHON_CMD} - "${data_file}" "${SUMMARY_JSON_FILE}" <<'PY'
import json
import os
import sys

data_path, json_path = sys.argv[1:3]
steps = []
with open(data_path, encoding="utf-8") as source:
    for raw_line in source:
        line = raw_line.rstrip("\n")
        if not line:
            continue
        parts = line.split("|", 3)
        while len(parts) < 4:
            parts.append("")
        name, status, message, log_path = parts
        steps.append(
            {
                "name": name,
                "status": status,
                "message": message,
                "log_path": log_path or None,
            }
        )

summary = {
    "started_at": os.environ.get("BOOTSTRAP_SUMMARY_STARTED_AT", ""),
    "finished_at": os.environ.get("BOOTSTRAP_SUMMARY_FINISHED_AT", ""),
    "overall_status": os.environ.get("BOOTSTRAP_SUMMARY_STATUS", ""),
    "steps": steps,
}

with open(json_path, "w", encoding="utf-8") as target:
    json.dump(summary, target, ensure_ascii=False, indent=2)
PY
  fi
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
  local name="$1" status="$2" message="$3" log_path="${4:-}"
  STEP_RESULTS+=("$name|$status|$message|$log_path")
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
  local log_root="${TMP_DIR}"
  if [[ "${SESSION_LOG_INITIALIZED}" == true && -n "${STEP_LOG_DIR}" ]]; then
    log_root="${STEP_LOG_DIR}"
  else
    mkdir -p "${TMP_DIR}"
  fi
  mkdir -p "${log_root}"
  local log_file="${log_root}/$(printf '%02d' "$index")_${safe_name}.log"
  local display_log="${log_file}"
  if [[ -n "${display_log}" && "${display_log}" == "${ROOT_DIR}/"* ]]; then
    display_log="./${display_log#"${ROOT_DIR}/"}"
  fi
  log_info "→ ${name}"
  if "$func" > >(tee "$log_file") 2> >(tee -a "$log_file" >&2); then
    add_result "$name" "OK" "Лог: ${display_log}" "$log_file"
    return 0
  else
    local exit_code=$?
    add_result "$name" "FAIL" "Код ${exit_code}. Лог: ${display_log}" "$log_file"
    log_error "Шаг '${name}' завершился с кодом ${exit_code}. См. лог: ${display_log}"
    return $exit_code
  fi
}

run_step_skip() {
  local name="$1" reason="$2"
  log_warn "Пропускаем шаг '${name}': ${reason}"
  add_result "$name" "SKIP" "$reason" ""
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
  if [[ -n "${PYTHON_CMD:-}" ]]; then
    log_info "Используем интерпретатор Python: ${PYTHON_CMD}"
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
    "${COMPOSE_CMD[@]}" --profile backend up -d
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
      ((attempt++))
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
      echo "docker compose --profile backend wait completed successfully"
      return 0
    fi

    echo "Command docker compose --profile backend wait is unavailable; polling statuses manually"
    local attempt=0
    local max_attempts=60
    local sleep_seconds=3
    local status_output="" state="" health=""

    while (( attempt < max_attempts )); do
      ((attempt++))
      local status_msg=""
      if status_msg=$(check_backend_services); then
        "${COMPOSE_CMD[@]}" --profile backend ps
        echo "Backend services are ready."
        return 0
      fi

      local check_rc=$?
      if [[ "${check_rc}" -eq 2 ]]; then
        "${COMPOSE_CMD[@]}" --profile backend ps
        echo "Backend services reported unhealthy state: ${status_msg}" >&2
        return 1
      fi

      if [[ -n "${status_msg}" ]]; then
        echo "${status_msg}"
      fi
      sleep "${sleep_seconds}"
    done

    echo "Timed out while waiting for backend services" >&2
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

step_start_local_backend() {
  (cd "${ROOT_DIR}" && ./scripts/start-backend.sh)
}

main() {
  parse_args "$@"

  if ! detect_python_cmd; then
    local joined_candidates
    joined_candidates=$(printf '%s, ' "${PYTHON_CANDIDATES[@]}")
    joined_candidates=${joined_candidates%, }
    log_error "Не удалось найти рабочий Python 3. Проверены команды: ${joined_candidates}."
    log_error "Установите Python 3 (например, через пакетный менеджер ОС или Microsoft Store) и повторите запуск."
    exit 1
  fi

  initialize_log_storage

  if ! is_truthy "${SAVE_LOGS_FLAG}"; then
    log_warn "Сохранение логов отключено (--discard-logs). Каталог будет удалён при завершении."
  fi

  run_step "Проверка зависимостей" step_check_dependencies
  run_step "Синхронизация .env" step_sync_env

  if [[ -f "${ENV_FILE}" ]]; then
    add_result "Проверка .env" "OK" "Файл найден" ""
  else
    log_error "Файл .env не найден после синхронизации."
    add_result "Проверка .env" "FAIL" "Файл .env отсутствует после sync-env" ""
  fi

  run_step "Проверка портов .env" step_check_ports
  run_step "docker compose up -d" step_compose_up
  run_step "Ожидание готовности docker compose" step_wait_infra
  run_step "Bootstrap RabbitMQ" step_rabbitmq_bootstrap
  run_step "Миграции CRM/Auth" step_migrate
  run_step "Smoke-проверка BACKUP_*" step_check_backup_env
  run_step "Smoke-проверка backup без S3" step_smoke_backup_dummy_storage
  local skip_backend=false
  if is_truthy "${BOOTSTRAP_SKIP_BACKEND_FLAG}"; then
    skip_backend=true
  fi

  local skip_backend_wait=false
  if is_truthy "${BOOTSTRAP_SKIP_BACKEND_WAIT_FLAG}"; then
    skip_backend_wait=true
  fi

  if [[ "${skip_backend}" == true ]]; then
    run_step_skip "Запуск backend-профиля" "передан флаг пропуска backend-профиля"
  else
    run_step "Запуск backend-профиля" step_compose_backend_up
  fi

  if [[ "${skip_backend}" == true ]]; then
    run_step_skip "Ожидание готовности backend-сервисов" "backend-профиль пропущен"
  elif [[ "${skip_backend_wait}" == true ]]; then
    run_step_skip "Ожидание готовности backend-сервисов" "передан флаг пропуска ожидания backend-сервисов"
  else
    run_step "Ожидание готовности backend-сервисов" step_wait_backend
  fi
  if is_truthy "${BOOTSTRAP_WITH_BACKEND_FLAG}"; then
    if ! is_truthy "${BOOTSTRAP_SKIP_BACKEND_FLAG}"; then
      log_warn "Флаг --with-backend не отключает docker compose профиль backend. При необходимости добавьте --skip-backend."
    fi
    if [[ -x "${ROOT_DIR}/scripts/start-backend.sh" ]]; then
      run_step "Запуск локальных backend-процессов" step_start_local_backend
    else
      run_step_skip "Запуск локальных backend-процессов" "скрипт start-backend.sh отсутствует или не исполняем"
    fi
  else
    run_step_skip "Запуск локальных backend-процессов" "флаг --with-backend не передан"
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
    IFS='|' read -r name status message log_path <<<"$entry"
    printf "%-38s | %-4s | %s\n" "$name" "$status" "$message"
  done

  BOOTSTRAP_FINISHED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  write_summary_report

  if (( FAIL_COUNT > 0 )); then
    log_error "Bootstrap завершился с ошибками (${FAIL_COUNT}). См. таблицу выше."
    return 1
  else
    log_info "Bootstrap завершён успешно. Все обязательные шаги выполнены."
    return 0
  fi
}

main "$@"
