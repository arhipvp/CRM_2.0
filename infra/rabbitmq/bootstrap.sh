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
source "${ENV_FILE}"
set +a

if [[ -z "${RABBITMQ_DEFAULT_USER:-}" || -z "${RABBITMQ_DEFAULT_PASS:-}" || -z "${RABBITMQ_DEFAULT_VHOST:-}" ]]; then
  echo "[Ошибка] В '${ENV_FILE}' должны быть заданы RABBITMQ_DEFAULT_USER, RABBITMQ_DEFAULT_PASS и RABBITMQ_DEFAULT_VHOST." >&2
  exit 1
fi

compose_rabbitmqctl() {
  docker compose -f "${COMPOSE_FILE}" exec -T rabbitmq rabbitmqctl "$@"
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

