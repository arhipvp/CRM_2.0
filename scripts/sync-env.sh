#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_FILE="$ROOT_DIR/env.example"
TARGET_FILE_NAME=".env"

DEFAULT_TARGETS=(
  "backend/gateway"
  "backend/auth"
  "backend/crm"
  "backend/payments"
  "backend/documents"
  "backend/notifications"
  "backend/tasks"
  "backend/reports"
  "backend/audit"
  "frontend"
)

usage() {
  cat <<USAGE
Использование: ${0##*/} [ДИРЕКТОРИЯ ...]

Без аргументов копирует env.example в основные сервисы:
${DEFAULT_TARGETS[*]}

Если указать аргументы, будут обработаны только перечисленные каталоги.
Скрипт создаёт или обновляет файл "$TARGET_FILE_NAME" в целевых директориях.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ ! -f "$SOURCE_FILE" ]]; then
  echo "[Ошибка] Не найден источник $SOURCE_FILE" >&2
  exit 1
fi

if [[ $# -gt 0 ]]; then
  TARGETS=("$@")
else
  TARGETS=("${DEFAULT_TARGETS[@]}")
fi

echo "Источник: $SOURCE_FILE"

for target in "${TARGETS[@]}"; do
  TARGET_DIR="$ROOT_DIR/$target"
  DEST_FILE="$TARGET_DIR/$TARGET_FILE_NAME"

  if [[ ! -d "$TARGET_DIR" ]]; then
    echo "[Пропуск] Каталог $target не найден" >&2
    continue
  fi

  if [[ -f "$DEST_FILE" ]]; then
    echo "[Внимание] $target/$TARGET_FILE_NAME уже существует. Перезаписать? [y/N/skip]"
    read -r answer
    case "${answer,,}" in
      y|yes)
        ;;
      s|skip)
        echo "[Пропуск] $target"
        continue
        ;;
      *)
        echo "[Пропуск] $target"
        continue
        ;;
    esac
  fi

  cp "$SOURCE_FILE" "$DEST_FILE"
  echo "[OK] Скопирован $target/$TARGET_FILE_NAME"
  echo "    Проверьте секреты и уникальные значения перед запуском сервиса."
done

echo "Готово. Не забудьте обновить чувствительные данные (пароли, токены) в скопированных файлах."
