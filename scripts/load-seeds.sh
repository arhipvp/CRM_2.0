#!/usr/bin/env bash
set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SEEDS_DIR="$REPO_ROOT/backups/postgres/seeds"
DEFAULT_ENV_FILE="$REPO_ROOT/.env"

ENV_FILE="$DEFAULT_ENV_FILE"
ONLY_PATTERNS=""

log() {
  local level="$1"; shift
  printf '[%s] [%s] %s\n' "$SCRIPT_NAME" "$level" "$*"
}

usage() {
  cat <<USAGE
Использование: $SCRIPT_NAME [--env-file PATH] [--only pattern1,pattern2]

Параметры:
  --env-file PATH  Путь к файлу .env (по умолчанию $DEFAULT_ENV_FILE)
  --only PATTERNS  Применять только файлы, чьи имена содержат указанные подстроки
                   (через запятую). Например: --only auth,crm
  -h, --help       Показать эту справку и выйти
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      shift
      [[ $# -gt 0 ]] || { log ERROR "Отсутствует значение для --env-file"; exit 1; }
      ENV_FILE="$1"
      ;;
    --env-file=*)
      ENV_FILE="${1#*=}"
      ;;
    --only)
      shift
      [[ $# -gt 0 ]] || { log ERROR "Отсутствует значение для --only"; exit 1; }
      ONLY_PATTERNS="$1"
      ;;
    --only=*)
      ONLY_PATTERNS="${1#*=}"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      log ERROR "Неизвестный аргумент: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

if [[ ! -f "$ENV_FILE" ]]; then
  log ERROR "Файл окружения '$ENV_FILE' не найден. Создайте его из env.example."
  exit 1
fi

if [[ ! -d "$SEEDS_DIR" ]]; then
  log ERROR "Каталог с seed-файлами '$SEEDS_DIR' не найден."
  exit 1
fi

log INFO "Чтение переменных из $ENV_FILE"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

required_vars=(POSTGRES_HOST POSTGRES_PORT POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB)
missing_vars=()
for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    missing_vars+=("$var")
  fi
done

if (( ${#missing_vars[@]} > 0 )); then
  log ERROR "Не заданы переменные окружения: ${missing_vars[*]}. Обновите .env по образцу env.example."
  exit 1
fi

PSQL_MODE=""
DOCKER_COMPOSE_CMD=()

if command -v psql >/dev/null 2>&1; then
  PSQL_MODE="local"
  log INFO "Используется локальный psql ($(psql --version | head -n1))."
else
  if ! command -v docker >/dev/null 2>&1; then
    log ERROR "psql не найден, а Docker недоступен. Установите psql или запустите Docker Compose."
    exit 1
  fi

  if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD=(docker compose)
  elif command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD=(docker-compose)
  else
    log ERROR "Не удалось определить команду docker compose."
    exit 1
  fi

  if ! docker ps >/dev/null 2>&1; then
    log ERROR "Docker недоступен (daemon не запущен?). Запустите Docker и повторите попытку."
    exit 1
  fi

  if ! docker ps --filter "name=crm-postgres" --format '{{.Names}}' | grep -qx 'crm-postgres'; then
    log ERROR "Контейнер 'crm-postgres' не запущен. Выполните 'docker compose up -d' в каталоге infra/."
    exit 1
  fi

  PSQL_MODE="docker"
  log INFO "Локальный psql не найден. Будет использован docker exec (контейнер crm-postgres)."
fi

IFS=$'\n' read -r -d '' -a seed_files < <(find "$SEEDS_DIR" -maxdepth 1 -type f -name 'seed_*.sql' -print | sort && printf '\0')

if (( ${#seed_files[@]} == 0 )); then
  log ERROR "В каталоге $SEEDS_DIR нет файлов seed_*.sql."
  exit 1
fi

filters=()
if [[ -n "$ONLY_PATTERNS" ]]; then
  IFS=',' read -r -a filters <<< "$ONLY_PATTERNS"
  log INFO "Применение ограничено шаблонами: ${filters[*]}"
fi

run_seed_local() {
  local file="$1"
  PGPASSWORD="$POSTGRES_PASSWORD" psql \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -v ON_ERROR_STOP=1 \
    -f "$file"
}

run_seed_docker() {
  local file="$1"
  "${DOCKER_COMPOSE_CMD[@]}" -f "$REPO_ROOT/infra/docker-compose.yml" exec -T postgres \
    env PGPASSWORD="$POSTGRES_PASSWORD" \
    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$file"
}

apply_seed() {
  local file="$1"
  case "$PSQL_MODE" in
    local)
      run_seed_local "$file"
      ;;
    docker)
      run_seed_docker "$file"
      ;;
    *)
      log ERROR "Неизвестный режим выполнения: $PSQL_MODE"
      return 1
      ;;
  esac
}

for file in "${seed_files[@]}"; do
  base="$(basename "$file")"
  if (( ${#filters[@]} > 0 )); then
    match=0
    for pattern in "${filters[@]}"; do
      pattern_trimmed="${pattern//[[:space:]]/}"
      [[ -z "$pattern_trimmed" ]] && continue
      if [[ "$base" == *"$pattern_trimmed"* ]]; then
        match=1
        break
      fi
    done
    if (( match == 0 )); then
      log INFO "Пропуск $base (не совпадает с фильтром)"
      continue
    fi
  fi

  log INFO "Применение $base"
  if ! apply_seed "$file"; then
    log ERROR "Ошибка при применении $base"
    exit 1
  fi
  log INFO "Файл $base применён"

done

run_tasks_seed() {
  local tasks_dir="$REPO_ROOT/backend/tasks"
  if [[ ! -d "$tasks_dir" ]]; then
    return 0
  fi
  if ! command -v pnpm >/dev/null 2>&1; then
    log WARN "pnpm не найден, seed Tasks пропущен"
    return 0
  fi
  pushd "$tasks_dir" >/dev/null
  if [[ ! -d node_modules ]]; then
    log INFO "Устанавливаем зависимости Tasks (pnpm install)..."
    pnpm install --frozen-lockfile || {
      popd >/dev/null
      log ERROR "Не удалось установить зависимости Tasks"
      return 1
    }
  fi
  log INFO "Запуск pnpm seed:statuses для Tasks"
  if ! pnpm seed:statuses; then
    popd >/dev/null
    log ERROR "Ошибка при выполнении seed:statuses Tasks"
    return 1
  fi
  popd >/dev/null
  log INFO "Seed Tasks успешно выполнен"
}

run_tasks_seed || exit 1

log INFO "Готово."
