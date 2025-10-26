#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
INFRA_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
COMPOSE_FILE="${INFRA_DIR}/docker-compose.yml"

declare -a PYTHON_CMD=()
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

usage() {
  cat <<'USAGE'
Использование: infra/rabbitmq/bootstrap.sh [путь_к_env]

Скрипт читает переменные из указанного `.env` (по умолчанию корневой `.env`) и
создаёт vhost-ы и пользователей RabbitMQ через `docker compose exec rabbitmq rabbitmqctl`.
USAGE
}

format_command() {
  local part
  local formatted=""
  for part in "$@"; do
    if [[ -n "${formatted}" ]]; then
      formatted+=" "
    fi
    formatted+="$(printf '%q' "${part}")"
  done
  printf '%s' "${formatted}"
}

format_python_candidates() {
  local candidate
  local -a candidate_parts=()
  local -a formatted=()

  for candidate in "${PYTHON_CANDIDATES[@]}"; do
    candidate_parts=()
    IFS=' ' read -r -a candidate_parts <<<"${candidate}"
    if (( ${#candidate_parts[@]} == 0 )); then
      continue
    fi
    formatted+=("$(format_command "${candidate_parts[@]}")")
  done

  if (( ${#formatted[@]} == 0 )); then
    printf '%s' ""
    return 0
  fi

  local IFS=', '
  printf '%s' "${formatted[*]}"
}

detect_python_cmd() {
  local candidate
  local -a candidate_parts=()
  for candidate in "${PYTHON_CANDIDATES[@]}"; do
    candidate_parts=()
    IFS=' ' read -r -a candidate_parts <<<"${candidate}"
    if (( ${#candidate_parts[@]} == 0 )); then
      continue
    fi
    if "${candidate_parts[@]}" --version >/dev/null 2>&1; then
      PYTHON_CMD=("${candidate_parts[@]}")
      return 0
    fi
  done
  return 1
}

ENV_FILE=${1:-${ENV_FILE:-.env}}

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[Ошибка] Файл переменных окружения '${ENV_FILE}' не найден." >&2
  usage >&2
  exit 1
fi

ENV_FILE="$(cd "$(dirname "${ENV_FILE}")" && pwd)/$(basename "${ENV_FILE}")"
DOCKER_COMPOSE_CMD=(docker compose --env-file "${ENV_FILE}")
DOCKER_COMPOSE_DISPLAY="${DOCKER_COMPOSE_CMD[*]}"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "[Ошибка] Не найден docker-compose файл: ${COMPOSE_FILE}" >&2
  exit 1
fi

if ! detect_python_cmd; then
  joined_candidates=$(format_python_candidates)
  echo "[Ошибка] Не удалось найти рабочий Python 3. Проверены команды: ${joined_candidates}." >&2
  echo "[Ошибка] Установите Python 3 (например, через пакетный менеджер ОС, Microsoft Store или py launcher) и повторите запуск." >&2
  exit 1
fi

set -a
nounset_was_set=0
if [[ $- == *u* ]]; then
  nounset_was_set=1
  set +u
fi
source "${ENV_FILE}"
if (( nounset_was_set )); then
  set -u
fi
set +a

strip_cr() {
  # docker compose под Git Bash завершает строки символом \r; убираем его перед сравнением/ключами
  local value="$1"
  printf '%s' "${value//$'\r'/}"
}

if [[ -z "${RABBITMQ_DEFAULT_USER:-}" || -z "${RABBITMQ_DEFAULT_PASS:-}" || -z "${RABBITMQ_DEFAULT_VHOST:-}" ]]; then
  echo "[Ошибка] В '${ENV_FILE}' должны быть заданы RABBITMQ_DEFAULT_USER, RABBITMQ_DEFAULT_PASS и RABBITMQ_DEFAULT_VHOST." >&2
  exit 1
fi

format_rabbitmqctl_cmd() {
  format_command "$@"
}

compose_rabbitmqctl_exec() {
  "${DOCKER_COMPOSE_CMD[@]}" -f "${COMPOSE_FILE}" exec -T rabbitmq rabbitmqctl "$@"
}

compose_rabbitmqctl_retry() {
  local max_attempts="$1"
  shift
  local delay_seconds="$1"
  shift

  local attempt=0
  local exit_code=0
  local cmd_display
  cmd_display="$(format_rabbitmqctl_cmd "$@")"

  while (( attempt < max_attempts )); do
    ((++attempt))
    if compose_rabbitmqctl_exec "$@"; then
      return 0
    fi
    exit_code=$?

    if (( attempt >= max_attempts )); then
      echo "[Ошибка] Команда 'rabbitmqctl ${cmd_display}' не удалась после ${max_attempts} попыток." >&2
      return "${exit_code}"
    fi

    echo "[Предупреждение] Команда 'rabbitmqctl ${cmd_display}' не удалась (попытка ${attempt}/${max_attempts}). Повтор через ${delay_seconds} с." >&2
    sleep "${delay_seconds}"
  done

  return "${exit_code}"
}

compose_rabbitmqctl() {
  local max_attempts="${COMPOSE_RABBITMQCTL_MAX_ATTEMPTS:-5}"
  local delay_seconds="${COMPOSE_RABBITMQCTL_RETRY_DELAY_SECONDS:-2}"
  compose_rabbitmqctl_retry "${max_attempts}" "${delay_seconds}" "$@"
}

rabbitmq_status() {
  local container_id=""
  if ! container_id=$("${DOCKER_COMPOSE_CMD[@]}" -f "${COMPOSE_FILE}" ps -q rabbitmq 2>/dev/null); then
    return 1
  fi

  container_id=$(strip_cr "${container_id}")

  if [[ -z "${container_id}" ]]; then
    echo "absent"
    echo ""
    return 0
  fi

  if ! docker inspect "${container_id}" >/dev/null 2>&1; then
    echo "absent"
    echo ""
    return 0
  fi

  docker inspect -f '{{.State.Status}}{{printf "\n"}}{{if .State.Health}}{{.State.Health.Status}}{{end}}' "${container_id}"
}
wait_for_rabbitmq_ready() {
  echo "[Инфо] Ожидаем готовность RabbitMQ (healthcheck)..."
  local status_output=""
  local -a status_lines=()
  local state="" health="" attempt=0
  local max_attempts=30
  local delay_seconds=2

  while (( attempt < max_attempts )); do
    ((++attempt))
    if ! status_output=$(rabbitmq_status); then
      echo "[Ошибка] Не удалось получить статус RabbitMQ. Прерываем ожидание." >&2
      return 1
    fi

    mapfile -t status_lines <<<"${status_output}"$'\n'
    state=$(strip_cr "${status_lines[0]:-unknown}")
    health=$(strip_cr "${status_lines[1]:-}")

    if [[ "${state}" == "running" && ( -z "${health}" || "${health}" == "healthy" ) ]]; then
      echo "[Инфо] RabbitMQ готов (state='${state}', health='${health:-n/a}')."
      return 0
    fi

    if [[ "${state}" == "exited" || "${state}" == "dead" ]]; then
      echo "[Ошибка] Контейнер RabbitMQ завершился (state='${state}', health='${health:-n/a}'). Проверьте логи: ${DOCKER_COMPOSE_DISPLAY} -f '${COMPOSE_FILE}' logs rabbitmq" >&2
      return 1
    fi

    if (( attempt < max_attempts )); then
      sleep "${delay_seconds}"
    fi
  done

  local waited_seconds=$((max_attempts * delay_seconds))
  echo "[Ошибка] RabbitMQ не перешёл в состояние 'running/healthy' за ${waited_seconds} секунд (state='${state:-unknown}', health='${health:-n/a}'). Проверьте логи: ${DOCKER_COMPOSE_DISPLAY} -f '${COMPOSE_FILE}' logs -f rabbitmq" >&2
  return 1
}
ensure_rabbitmq_ready() {
  local status_output=""
  local -a status_lines=()

  if ! status_output=$(rabbitmq_status); then
    echo "[Ошибка] Не удалось получить статус RabbitMQ перед запуском." >&2
    exit 1
  fi

  mapfile -t status_lines <<<"${status_output}"$'\n'
  local state="${status_lines[0]:-}"
  state=$(strip_cr "${state}")

  if [[ "${state}" != "running" ]]; then
    echo "[Инфо] Контейнер RabbitMQ не запущен (state='${state:-unknown}'). Пытаемся стартовать..."
    if ! "${DOCKER_COMPOSE_CMD[@]}" -f "${COMPOSE_FILE}" up -d rabbitmq; then
      echo "[Ошибка] Не удалось автоматически запустить контейнер RabbitMQ." >&2
      exit 1
    fi
  else
    echo "[Инфо] Контейнер RabbitMQ уже запущен."
  fi

  if ! wait_for_rabbitmq_ready; then
    echo "[Ошибка] RabbitMQ не готов к выполнению команд rabbitmqctl. Проверьте логи: ${DOCKER_COMPOSE_DISPLAY} -f '${COMPOSE_FILE}' logs -f rabbitmq" >&2
    exit 1
  fi
}

await_rabbitmq_startup() {
  echo "[Инфо] Проверяем запуск узла RabbitMQ (rabbitmqctl await_startup)..."
  local max_attempts="${RABBITMQ_AWAIT_STARTUP_ATTEMPTS:-10}"
  local delay_seconds="${RABBITMQ_AWAIT_STARTUP_DELAY_SECONDS:-3}"
  if compose_rabbitmqctl_retry "${max_attempts}" "${delay_seconds}" await_startup --timeout 60; then
    echo "[Инфо] Узел RabbitMQ готов к выполнению команд rabbitmqctl (await_startup)."
  else
    echo "[Ошибка] Не удалось дождаться запуска узла RabbitMQ через rabbitmqctl await_startup." >&2
    exit 1
  fi
}

ensure_vhost() {
  local vhost="$1"
  if compose_rabbitmqctl list_vhosts -q | grep -Fxq -- "${vhost}"; then
    echo "  • vhost '${vhost}' уже существует"
  else
    compose_rabbitmqctl add_vhost "${vhost}"
    echo "  • создан vhost '${vhost}'"
  fi
}

ensure_user() {
  local user="$1" password="$2"
  if compose_rabbitmqctl list_users -q | awk '{print $1}' | grep -Fxq -- "${user}"; then
    compose_rabbitmqctl change_password "${user}" "${password}"
    echo "  • обновлён пароль пользователя '${user}'"
  else
    compose_rabbitmqctl add_user "${user}" "${password}"
    echo "  • создан пользователь '${user}'"
  fi
}

ensure_permissions() {
  local vhost="$1" user="$2"
  compose_rabbitmqctl set_permissions -p "${vhost}" "${user}" ".*" ".*" ".*"
  echo "  • подтверждены права '${user}' на vhost '${vhost}'"
}

parse_amqp_url() {
  local url="$1"
  "${PYTHON_CMD[@]}" - "$url" <<'PY'
import sys
from urllib.parse import urlparse, unquote

url = sys.argv[1]
parsed = urlparse(url)
if parsed.scheme not in {"amqp", "amqps"}:
    sys.exit(f"Неподдерживаемая схема в URL: {url}")
username = unquote(parsed.username or "")
password = unquote(parsed.password or "")
path = parsed.path or ""
if path.startswith('/'):
    path = path[1:]
vhost = unquote(path or "")
print(username)
print(password)
print(vhost)
PY
}

declare -A USER_COMBOS=()
declare -A USER_SOURCES=()

USER_COMBOS["${RABBITMQ_DEFAULT_USER}@${RABBITMQ_DEFAULT_VHOST}"]="${RABBITMQ_DEFAULT_PASS}"
USER_SOURCES["${RABBITMQ_DEFAULT_USER}@${RABBITMQ_DEFAULT_VHOST}"]="RABBITMQ_DEFAULT_USER"

mapfile -t rabbitmq_url_vars < <(compgen -v | grep -E '_RABBITMQ_(URL|URI)$' | sort -u)

for var_name in "${rabbitmq_url_vars[@]}"; do
  url_value="${!var_name}"
  if [[ -z "${url_value}" ]]; then
    continue
  fi
  mapfile -t parsed <<<"$(parse_amqp_url "${url_value}")"
  local_user=$(strip_cr "${parsed[0]-}")
  local_password=$(strip_cr "${parsed[1]-}")
  local_vhost=$(strip_cr "${parsed[2]-}")
  if [[ -z "${local_user}" || -z "${local_vhost}" ]]; then
    echo "[Предупреждение] Пропускаем переменную ${var_name}: пользователь или vhost не определены в URL '${url_value}'." >&2
    continue
  fi
  combo_key="${local_user}@${local_vhost}"
  if [[ -v USER_COMBOS["${combo_key}"] ]]; then
    existing_source="${USER_SOURCES["${combo_key}"]}"
    if [[ "${USER_COMBOS["${combo_key}"]}" != "${local_password}" ]]; then
      echo "[Предупреждение] Пропускаем переменную ${var_name}: комбинация ${combo_key} уже получена из ${existing_source} с другим паролем." >&2
    else
      echo "[Инфо] Пропускаем переменную ${var_name}: комбинация ${combo_key} уже получена из ${existing_source}." >&2
    fi
    continue
  fi
  USER_COMBOS["${combo_key}"]="${local_password}"
  USER_SOURCES["${combo_key}"]="${var_name}"
done

if [[ ${#USER_COMBOS[@]} -eq 0 ]]; then
  echo "[Инфо] Не найдено ни одной переменной *_RABBITMQ_URL или *_RABBITMQ_URI. Нечего делать." >&2
  exit 0
fi

echo "[Инфо] Найдены комбинации пользователей RabbitMQ и vhost:" >&2
for combo_key in "${!USER_COMBOS[@]}"; do
  if [[ -v USER_SOURCES["${combo_key}"] ]]; then
    source_var="${USER_SOURCES["${combo_key}"]}"
  else
    source_var="RABBITMQ_DEFAULT_USER"
  fi
  echo "  ${source_var} -> ${combo_key}" >&2
done

ensure_rabbitmq_ready

await_rabbitmq_startup

for key in "${!USER_COMBOS[@]}"; do
  user="${key%@*}"
  vhost="${key#*@}"
  password="${USER_COMBOS[${key}]}"
  echo "==> Обработка пользователя '${user}' и vhost '${vhost}'"
  ensure_vhost "${vhost}"
  ensure_user "${user}" "${password}"
  ensure_permissions "${vhost}" "${user}"
done

echo "\nГотово: проверено ${#USER_COMBOS[@]} комбинаций пользователь/vhost."




