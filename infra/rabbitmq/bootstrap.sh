#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
INFRA_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
COMPOSE_FILE="${INFRA_DIR}/docker-compose.yml"

usage() {
  cat <<'USAGE'
Использование: infra/rabbitmq/bootstrap.sh [путь_к_env]

Скрипт читает переменные из указанного `.env` (по умолчанию корневой `.env`) и
создаёт vhost-ы и пользователей RabbitMQ через `docker compose exec rabbitmq rabbitmqctl`.
USAGE
}

ENV_FILE=${1:-${ENV_FILE:-.env}}

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[Ошибка] Файл переменных окружения '${ENV_FILE}' не найден." >&2
  usage >&2
  exit 1
fi

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "[Ошибка] Не найден docker-compose файл: ${COMPOSE_FILE}" >&2
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

if [[ -z "${RABBITMQ_DEFAULT_USER:-}" || -z "${RABBITMQ_DEFAULT_PASS:-}" || -z "${RABBITMQ_DEFAULT_VHOST:-}" ]]; then
  echo "[Ошибка] В '${ENV_FILE}' должны быть заданы RABBITMQ_DEFAULT_USER, RABBITMQ_DEFAULT_PASS и RABBITMQ_DEFAULT_VHOST." >&2
  exit 1
fi

compose_rabbitmqctl() {
  docker compose -f "${COMPOSE_FILE}" exec -T rabbitmq rabbitmqctl "$@"
}

rabbitmq_status() {
  local ps_output="" ps_status=0

  if ps_output=$(docker compose -f "${COMPOSE_FILE}" ps --format json rabbitmq 2>&1); then
    printf '%s\n' "${ps_output}" | python3 - <<'PY'
import json
import sys

raw = sys.stdin.read()

if not raw.strip():
    print("absent")
    print("")
    sys.exit(0)

first_bracket = raw.find('[')
last_bracket = raw.rfind(']')
first_brace = raw.find('{')
last_brace = raw.rfind('}')

payload = ""
warnings_text = ""

if first_bracket != -1 and last_bracket != -1 and last_bracket >= first_bracket:
    payload = raw[first_bracket:last_bracket + 1].strip()
    warnings_text = raw[:first_bracket] + raw[last_bracket + 1:]
elif first_brace != -1 and last_brace != -1 and last_brace >= first_brace:
    payload = raw[first_brace:last_brace + 1].strip()
    warnings_text = raw[:first_brace] + raw[last_brace + 1:]

if payload:
    for line in warnings_text.splitlines():
        if line.strip():
            print(line, file=sys.stderr)
else:
    for line in raw.splitlines():
        if line.strip():
            print(line, file=sys.stderr)
    print("[Предупреждение] docker compose ps не вернул JSON (получен только шум).", file=sys.stderr)
    print("absent")
    print("")
    sys.exit(0)

try:
    data = json.loads(payload)
except json.JSONDecodeError as exc:
    filtered_lines = payload.splitlines()
    error_line = filtered_lines[exc.lineno - 1] if 0 < exc.lineno <= len(filtered_lines) else payload
    print(
        f"[Ошибка] docker compose ps вернул невалидный JSON: строка {exc.lineno}: {error_line.strip()} ({exc.msg})",
        file=sys.stderr,
    )
    sys.exit(3)

if not data:
    print("absent")
    print("")
else:
    entry = data[0]
    print(entry.get("State") or "unknown")
    print(entry.get("Health") or "")
PY
    return 0
  else
    ps_status=$?
  fi

  local ps_output_lower="${ps_output,,}"
  if [[ "${ps_output_lower}" == *"unknown flag: --format"* || "${ps_output_lower}" == *"no such option: --format"* || "${ps_output_lower}" == *"no such option --format"* ]]; then
    local fallback_output="" fallback_status=0
    if fallback_output=$(docker compose -f "${COMPOSE_FILE}" ps rabbitmq 2>&1); then
      printf '%s\n' "${fallback_output}" | python3 - <<'PY'
import re
import sys

raw_output = sys.stdin.read()

if not raw_output.strip():
    print("absent")
    print("")
    sys.exit(0)

lines = raw_output.splitlines()
warnings = []
data_lines = []
header_lower = []
header_found = False

for line in lines:
    stripped = line.strip()
    if not stripped:
        continue

    if stripped.lower().startswith(("warning:", "warn")):
        warnings.append(line)
        continue

    if set(stripped) <= {"-", " "} or set(stripped) <= {"=", " "}:
        continue

    segments = [segment.strip() for segment in re.split(r"\s{2,}", stripped) if segment.strip()]
    segments_lower = [segment.lower() for segment in segments]

    if (not header_found and segments_lower and segments_lower[0] == "name"
            and any(col in {"status", "state"} for col in segments_lower[1:])):
        header_found = True
        header_lower = segments_lower
        continue

    if not header_found:
        warnings.append(line)
        continue

    data_lines.append(line)

for line in warnings:
    print(line, file=sys.stderr)

if not header_found:
    print("[Ошибка] docker compose ps (fallback) не вернул распознаваемый заголовок таблицы.", file=sys.stderr)
    sys.exit(4)

if not data_lines:
    print("absent")
    print("")
    sys.exit(0)

service_idx = header_lower.index("service") if "service" in header_lower else -1
status_idx = header_lower.index("status") if "status" in header_lower else -1
state_idx = header_lower.index("state") if "state" in header_lower else -1

selected_parts = None

for line in data_lines:
    stripped_line = line.strip()
    if set(stripped_line) <= {"-", " "} or set(stripped_line) <= {"=", " "}:
        continue

    parts = [segment.strip() for segment in re.split(r"\s{2,}", stripped_line) if segment.strip()]
    if not parts:
        continue

    service_name = None
    if service_idx != -1 and service_idx < len(parts):
        service_name = parts[service_idx].lower()

    if service_name and service_name != "rabbitmq":
        continue

    name_value = parts[0].lower()
    if service_name is None and "rabbitmq" not in name_value:
        continue

    selected_parts = parts
    break

if selected_parts is None:
    print("absent")
    print("")
    sys.exit(0)

status_text = ""
if status_idx != -1 and status_idx < len(selected_parts):
    status_text = selected_parts[status_idx]
elif state_idx != -1 and state_idx < len(selected_parts):
    status_text = selected_parts[state_idx]

status_text = status_text.strip()

if not status_text:
    print("unknown")
    print("")
    sys.exit(0)

state_word = status_text.split()[0].lower()

state_map = {
    "up": "running",
    "running": "running",
    "created": "created",
    "starting": "starting",
    "restarting": "restarting",
    "paused": "paused",
    "exit": "exited",
    "exited": "exited",
    "stopped": "exited",
    "down": "exited",
    "dead": "dead",
    "removing": "removing",
}

state = state_map.get(state_word, state_word or "unknown")

health = ""
match = re.search(r"\(([^)]+)\)", status_text)
if match:
    health = match.group(1).strip().lower()

print(state)
print(health)
PY
      return 0
    else
      fallback_status=$?
      printf '%s\n' "${fallback_output}" >&2
      return ${fallback_status}
    fi
  fi

  printf '%s\n' "${ps_output}" >&2
  return ${ps_status}
}

wait_for_rabbitmq_ready() {
  echo "[Инфо] Ожидаем готовность RabbitMQ (healthcheck)..."
  local status_output=""
  local -a status_lines=()
  local state="" health="" attempt=0
  local max_attempts=30
  local delay_seconds=2

  while (( attempt < max_attempts )); do
    ((attempt++))
    if ! status_output=$(rabbitmq_status); then
      echo "[Ошибка] Не удалось получить статус RabbitMQ. Прерываем ожидание." >&2
      return 1
    fi

    mapfile -t status_lines <<<"${status_output}"$'\n'
    state="${status_lines[0]:-unknown}"
    health="${status_lines[1]:-}"

    if [[ "${state}" == "running" && ( -z "${health}" || "${health}" == "healthy" ) ]]; then
      echo "[Инфо] RabbitMQ готов (state='${state}', health='${health:-n/a}')."
      return 0
    fi

    if [[ "${state}" == "exited" || "${state}" == "dead" ]]; then
      echo "[Ошибка] Контейнер RabbitMQ завершился (state='${state}', health='${health:-n/a}'). Проверьте логи: docker compose -f '${COMPOSE_FILE}' logs rabbitmq" >&2
      return 1
    fi

    if (( attempt < max_attempts )); then
      sleep "${delay_seconds}"
    fi
  done

  local waited_seconds=$((max_attempts * delay_seconds))
  echo "[Ошибка] RabbitMQ не перешёл в состояние 'running/healthy' за ${waited_seconds} секунд (state='${state:-unknown}', health='${health:-n/a}'). Проверьте логи: docker compose -f '${COMPOSE_FILE}' logs -f rabbitmq" >&2
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

  if [[ "${state}" != "running" ]]; then
    echo "[Инфо] Контейнер RabbitMQ не запущен (state='${state:-unknown}'). Пытаемся стартовать..."
    if ! docker compose -f "${COMPOSE_FILE}" up -d rabbitmq; then
      echo "[Ошибка] Не удалось автоматически запустить контейнер RabbitMQ." >&2
      exit 1
    fi
  else
    echo "[Инфо] Контейнер RabbitMQ уже запущен."
  fi

  if ! wait_for_rabbitmq_ready; then
    echo "[Ошибка] RabbitMQ не готов к выполнению команд rabbitmqctl. Проверьте логи: docker compose -f '${COMPOSE_FILE}' logs -f rabbitmq" >&2
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
  python3 - "$url" <<'PY'
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

USER_COMBOS["${RABBITMQ_DEFAULT_USER}@${RABBITMQ_DEFAULT_VHOST}"]="${RABBITMQ_DEFAULT_PASS}"

while IFS= read -r var_name; do
  url_value="${!var_name}"
  if [[ -z "${url_value}" ]]; then
    continue
  fi
  mapfile -t parsed <<<"$(parse_amqp_url "${url_value}")"
  local_user="${parsed[0]-}"
  local_password="${parsed[1]-}"
  local_vhost="${parsed[2]-}"
  if [[ -z "${local_user}" || -z "${local_vhost}" ]]; then
    echo "[Предупреждение] Пропускаем переменную ${var_name}: пользователь или vhost не определены в URL '${url_value}'." >&2
    continue
  fi
  USER_COMBOS["${local_user}@${local_vhost}"]="${local_password}"
done < <(compgen -v | grep -E '_RABBITMQ_URL$')

if [[ ${#USER_COMBOS[@]} -eq 0 ]]; then
  echo "[Инфо] Не найдено ни одной переменной *_RABBITMQ_URL. Нечего делать." >&2
  exit 0
fi

ensure_rabbitmq_ready

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

