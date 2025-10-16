#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
START_SCRIPT="${ROOT_DIR}/scripts/start-backend.sh"
ENV_FILE="${ROOT_DIR}/.env"
ENV_CREATED=false

TMP_DIR="$(mktemp -d)"
cleanup() {
  if [[ -f "${TMP_DIR}/run/pids/gateway.pid" ]]; then
    local gateway_pid
    gateway_pid=$(<"${TMP_DIR}/run/pids/gateway.pid")
    if [[ -n "${gateway_pid}" ]]; then
      kill "${gateway_pid}" 2>/dev/null || true
      wait "${gateway_pid}" 2>/dev/null || true
    fi
  fi
  rm -rf "${TMP_DIR}"
  if [[ "${ENV_CREATED}" == true ]]; then
    rm -f "${ENV_FILE}"
  fi
}
trap 'status=$?; cleanup; exit $status' EXIT

BIN_DIR="${TMP_DIR}/bin"
mkdir -p "${BIN_DIR}"

if [[ ! -f "${ENV_FILE}" ]]; then
  touch "${ENV_FILE}"
  ENV_CREATED=true
fi

cat <<'STUB' > "${BIN_DIR}/pnpm"
#!/usr/bin/env bash
if [[ "$1" == "start:dev" ]]; then
  while true; do
    sleep 1
  done
else
  exit 0
fi
STUB
chmod +x "${BIN_DIR}/pnpm"

cat <<'STUB' > "${BIN_DIR}/poetry"
#!/usr/bin/env bash
if [[ "$1" == "env" && "$2" == "info" && "$3" == "--path" ]]; then
  echo "/tmp/fake-poetry-env"
  exit 0
fi
if [[ "$1" == "install" ]]; then
  exit 0
fi
if [[ "$1" == "run" ]]; then
  shift
  exec "$@"
fi
exit 0
STUB
chmod +x "${BIN_DIR}/poetry"

cat <<'STUB' > "${BIN_DIR}/java"
#!/usr/bin/env bash
exit 0
STUB
chmod +x "${BIN_DIR}/java"

RUN_DIR="${TMP_DIR}/run"
PATH="${BIN_DIR}:${PATH}" "${START_SCRIPT}" --run-dir "${RUN_DIR}" --service gateway

if [[ ! -f "${RUN_DIR}/pids/gateway.pid" ]]; then
  echo "Ожидался PID-файл gateway" >&2
  exit 1
fi

for pid_file in auth crm-api crm-worker; do
  if [[ -e "${RUN_DIR}/pids/${pid_file}.pid" ]]; then
    echo "Неожиданный PID-файл для ${pid_file}" >&2
    exit 1
  fi
done

if [[ ! -f "${RUN_DIR}/logs/gateway.log" ]]; then
  echo "Ожидался лог-файл gateway" >&2
  exit 1
fi

for log_file in auth crm-api crm-worker; do
  if [[ -e "${RUN_DIR}/logs/${log_file}.log" ]]; then
    echo "Неожиданный лог-файл для ${log_file}" >&2
    exit 1
  fi
done

echo "OK"
