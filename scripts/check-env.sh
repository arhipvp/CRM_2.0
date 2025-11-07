#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_EXAMPLE_FILE="${ROOT_DIR}/env.example"
DEFAULT_TARGETS=(
  "."
  "backend/gateway"
  "backend/auth"
  "backend/crm"
  "backend/documents"
  "backend/reports"
)

print_usage() {
  cat <<'USAGE'
Использование: scripts/check-env.sh [ОПЦИИ] [КАТАЛОГ ...]

Проверяет заполненность .env-файлов по шаблону env.example и находит плейсхолдеры
(например, change_me). По умолчанию валидируется корневой .env.

Опции:
  --env-file PATH   Проверить конкретный .env по указанному пути.
  --all             Проверить те же каталоги, что и scripts/sync-env.sh
                    (. и backend/{gateway,auth,crm,documents,reports}).
  -h, --help        Показать эту справку.

Если указаны каталоги, скрипт ищет .env внутри каждого каталога (аналогично
scripts/sync-env.sh). Путь можно задавать относительно корня репозитория или
как абсолютный.
USAGE
}

resolve_path() {
  local input_path="$1"
  python3 - "$ROOT_DIR" "$input_path" <<'PY'
import os
import sys
root = sys.argv[1]
value = sys.argv[2]
if os.path.isabs(value):
    print(os.path.normpath(value))
else:
    print(os.path.normpath(os.path.join(root, value)))
PY
}

declare -a TARGETS=()
CUSTOM_ENV_FILE=""
USE_ALL=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      if [[ -z "${2:-}" ]]; then
        echo "[Ошибка] Для --env-file требуется путь" >&2
        exit 1
      fi
      if [[ -n "$CUSTOM_ENV_FILE" ]]; then
        echo "[Ошибка] Опция --env-file может быть указана только один раз" >&2
        exit 1
      fi
      CUSTOM_ENV_FILE="$(resolve_path "$2")"
      shift 2
      ;;
    --env-file=*)
      if [[ -n "$CUSTOM_ENV_FILE" ]]; then
        echo "[Ошибка] Опция --env-file может быть указана только один раз" >&2
        exit 1
      fi
      CUSTOM_ENV_FILE="$(resolve_path "${1#*=}")"
      shift
      ;;
    --all)
      USE_ALL=true
      shift
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    --*)
      echo "[Ошибка] Неизвестный флаг $1" >&2
      exit 1
      ;;
    *)
      TARGETS+=("$1")
      shift
      ;;
  esac
done

declare -a ENV_FILES=()
declare -A SEEN_PATHS=()

add_env_file() {
  local file_path="$1"
  if [[ -z "$file_path" ]]; then
    return
  fi
  if [[ -n "${SEEN_PATHS["$file_path"]:-}" ]]; then
    return
  fi
  ENV_FILES+=("$file_path")
  SEEN_PATHS["$file_path"]=1
}

if [[ -n "$CUSTOM_ENV_FILE" ]]; then
  add_env_file "$CUSTOM_ENV_FILE"
fi

if [[ "$USE_ALL" == true ]]; then
  local target
  for target in "${DEFAULT_TARGETS[@]}"; do
    if [[ "$target" == "." ]]; then
      add_env_file "${ROOT_DIR}/.env"
    else
      add_env_file "$(resolve_path "$target/.env")"
    fi
  done
fi

if (( ${#TARGETS[@]} > 0 )); then
  local target
  for target in "${TARGETS[@]}"; do
    if [[ "$target" == "." ]]; then
      add_env_file "${ROOT_DIR}/.env"
    elif [[ "$target" == *".env" ]]; then
      add_env_file "$(resolve_path "$target")"
    else
      add_env_file "$(resolve_path "$target/.env")"
    fi
  done
fi

if (( ${#ENV_FILES[@]} == 0 )); then
  add_env_file "${ROOT_DIR}/.env"
fi

if [[ ! -f "$ENV_EXAMPLE_FILE" ]]; then
  echo "[Ошибка] Не найден env.example по пути $ENV_EXAMPLE_FILE" >&2
  exit 1
fi

python - "$ROOT_DIR" "$ENV_EXAMPLE_FILE" "${ENV_FILES[@]}" <<'PY'
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Set, Tuple

root = Path(sys.argv[1])
example_path = Path(sys.argv[2])
env_paths = [Path(p) for p in sys.argv[3:]]

if not env_paths:
    print("[Ошибка] Не указаны .env-файлы для проверки", file=sys.stderr)
    sys.exit(1)

if not example_path.exists():
    print(f"[Ошибка] env.example не найден: {example_path}", file=sys.stderr)
    sys.exit(1)

_line_comment_pattern = re.compile(r"\s+#")
_var_pattern = re.compile(r"\$\{([A-Za-z0-9_]+)\}")
_placeholder_pattern = re.compile(r"change[_-]?me", re.IGNORECASE)

def parse_env(path: Path) -> Dict[str, str]:
    data: Dict[str, str] = {}
    if not path.exists():
        return data
    with path.open("r", encoding="utf-8") as fh:
        for raw_line in fh:
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, raw_value = raw_line.split("=", 1)
            key = key.strip()
            value = raw_value.strip()
            if not value:
                data[key] = ""
                continue
            if value[0] in {'"', "'"}:
                quote = value[0]
                escaped = False
                collected: List[str] = []
                idx = 1
                while idx < len(value):
                    ch = value[idx]
                    if escaped:
                        collected.append(ch)
                        escaped = False
                    elif ch == "\\":
                        escaped = True
                    elif ch == quote:
                        idx += 1
                        break
                    else:
                        collected.append(ch)
                    idx += 1
                parsed = "".join(collected)
                remainder = value[idx:]
                if remainder:
                    hash_pos = remainder.find("#")
                    if hash_pos != -1:
                        remainder = remainder[:hash_pos]
                data[key] = parsed
            else:
                parts = _line_comment_pattern.split(value, 1)
                parsed = parts[0].strip()
                data[key] = parsed
    return data

example_values = parse_env(example_path)
expected_keys = set(example_values.keys())

SENSITIVE_WARNINGS: Dict[str, str] = {
    "TELEGRAM_BOT_BOT_TOKEN": "dev-mock-token",
    "TELEGRAM_BOT_WEBHOOK_SECRET": "dev-webhook-secret",
    "TELEGRAM_BOT_AUTH_SERVICE_TOKEN": "change_me",
    "TELEGRAM_BOT_CRM_SERVICE_TOKEN": "change_me",
    "TELEGRAM_BOT_HEALTHCHECK_TOKEN": "bot-health-token",
}

REQUIRED_KEY_PREFIXES = (
    "POSTGRES_",
    "RABBITMQ_",
    "REDIS_",
    "CONSUL_",
)

REQUIRED_KEY_SUFFIXES = (
    "_DATABASE_URL",
    "_DATABASE_URL_INTERNAL",
)

REQUIRED_EXACT_KEYS = {
    "AUTH_DB_USER",
    "AUTH_DB_PASSWORD",
    "CRM_DB_USER",
    "CRM_DB_PASSWORD",
    "DOCUMENTS_DB_USER",
    "DOCUMENTS_DB_PASSWORD",
    "BACKUP_DB_USER",
    "BACKUP_DB_PASSWORD",
    "REPORTS_DB_USER",
    "REPORTS_DB_PASSWORD",
    "GATEWAY_BASE_URL",
    "AUTH_BASE_URL",
    "CRM_BASE_URL",
    "DOCUMENTS_BASE_URL",
    "REPORTS_BASE_URL",
    "BACKUP_BASE_URL",
    "BACKUP_RABBITMQ_ADMIN_USER",
    "BACKUP_RABBITMQ_ADMIN_PASSWORD",
}

results: List[Dict[str, str]] = []
has_fail = False

def resolve_values(data: Dict[str, str]):
    resolved: Dict[str, str] = {}
    undefined: Set[Tuple[str, str]] = set()

    def _resolve(key: str, stack: Tuple[str, ...]):
        if key in resolved:
            return resolved[key]
        if key not in data:
            return ""
        raw_value = data[key]

        def replace(match: re.Match[str]):
            var_name = match.group(1)
            if var_name == key or var_name in stack:
                undefined.add((key, var_name))
                return match.group(0)
            if var_name not in data:
                undefined.add((key, var_name))
                return match.group(0)
            return _resolve(var_name, stack + (key,))

        value = _var_pattern.sub(replace, raw_value)
        resolved[key] = value
        return value

    for key in data:
        _resolve(key, tuple())

    return resolved, undefined

for path in env_paths:
    display_path = None
    try:
        display_path = path.relative_to(root)
        display_str = f"./{display_path}" if display_path.parts[0] != "" else str(display_path)
    except ValueError:
        display_str = str(path)

    if not path.exists():
        results.append({
            "file": display_str,
            "status": "FAIL",
            "message": "Файл не найден",
        })
        has_fail = True
        continue

    values = parse_env(path)
    resolved_values, undefined_refs = resolve_values(values)

    missing = sorted(expected_keys - values.keys())
    for key in missing:
        results.append({
            "file": display_str,
            "status": "FAIL",
            "message": f"Отсутствует ключ {key} (сравнение с env.example)",
        })
        has_fail = True

    for key, var_name in sorted(undefined_refs):
        results.append({
            "file": display_str,
            "status": "FAIL",
            "message": f"Не удалось раскрыть ссылку ${'{' }{var_name}{'}'} в {key}",
        })
        has_fail = True

    for key, value in resolved_values.items():
        if not value:
            needs_check = False
            if key in REQUIRED_EXACT_KEYS:
                needs_check = True
            elif key.startswith(REQUIRED_KEY_PREFIXES):
                needs_check = True
            else:
                for suffix in REQUIRED_KEY_SUFFIXES:
                    if key.endswith(suffix):
                        needs_check = True
                        break
            if needs_check:
                results.append({
                    "file": display_str,
                    "status": "FAIL",
                    "message": f"Пустое значение {key}",
                })
                has_fail = True

    for key, value in resolved_values.items():
        if not value:
            continue
        if _placeholder_pattern.search(value):
            results.append({
                "file": display_str,
                "status": "WARN",
                "message": f"Обнаружен плейсхолдер в {key}: {value}",
            })
        elif key in SENSITIVE_WARNINGS and value == SENSITIVE_WARNINGS[key]:
            results.append({
                "file": display_str,
                "status": "WARN",
                "message": f"Замените значение {key} (сейчас {value})",
            })
        elif key.startswith("TELEGRAM_BOT_") and value.startswith("dev-"):
            results.append({
                "file": display_str,
                "status": "WARN",
                "message": f"Проверьте локальный секрет {key}: текущее значение {value}",
            })

    unresolved_leftovers = {
        (key, match.group(1))
        for key, value in resolved_values.items()
        for match in _var_pattern.finditer(value)
    } - set(undefined_refs)
    for key, var_name in sorted(unresolved_leftovers):
        results.append({
            "file": display_str,
            "status": "FAIL",
            "message": f"В {key} осталось нераскрытое выражение ${'{' }{var_name}{'}'}",
        })
        has_fail = True

    if not any(r["file"] == display_str and r["status"] in {"FAIL", "WARN"} for r in results):
        results.append({
            "file": display_str,
            "status": "OK",
            "message": "Все проверки пройдены",
        })

if not results:
    print("[Ошибка] Не удалось сформировать отчёт", file=sys.stderr)
    sys.exit(1)

file_width = max(len("Файл"), max(len(r["file"]) for r in results))
status_width = max(len("Статус"), max(len(r["status"]) for r in results))

header = f"{ 'Файл':<{file_width}} | { 'Статус':<{status_width}} | Комментарий"
separator = "-" * len(header)
print(header)
print(separator)
for entry in results:
    print(f"{entry['file']:<{file_width}} | {entry['status']:<{status_width}} | {entry['message']}")

if has_fail:
    sys.exit(1)
PY
