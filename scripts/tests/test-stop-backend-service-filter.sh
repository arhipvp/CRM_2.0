#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
STOP_SCRIPT="${ROOT_DIR}/scripts/stop-backend.sh"

TMP_DIR="$(mktemp -d)"
RUN_DIR="${TMP_DIR}/backend"
PID_DIR="${RUN_DIR}/pids"
LOG_DIR="${RUN_DIR}/logs"
START_LOG="${RUN_DIR}/start-backend.log"

cleanup() {
  local status=$?
  if [[ -n "${sleep_pid:-}" ]]; then
    if kill -0 "${sleep_pid}" >/dev/null 2>&1; then
      kill "${sleep_pid}" >/dev/null 2>&1 || true
      wait "${sleep_pid}" >/dev/null 2>&1 || true
    fi
  fi
  rm -rf "${TMP_DIR}"
  exit ${status}
}
trap cleanup EXIT

mkdir -p "${PID_DIR}" "${LOG_DIR}"

touch "${LOG_DIR}/gateway.log"
echo "backend start log" >"${START_LOG}"

sleep 60 &
sleep_pid=$!
echo "${sleep_pid}" >"${PID_DIR}/crm-api.pid"
touch "${LOG_DIR}/crm-api.log"

output="$(${STOP_SCRIPT} --run-dir "${RUN_DIR}" --service crm-api --clean-logs)"

if grep -q "\[предупреждение]" <<<"${output}"; then
  echo "Ожидалось отсутствие предупреждений, но они найдены:" >&2
  echo "${output}" >&2
  exit 1
fi

if [[ -f "${PID_DIR}/crm-api.pid" ]]; then
  echo "PID-файл crm-api.pid не был удалён" >&2
  exit 1
fi

if kill -0 "${sleep_pid}" >/dev/null 2>&1; then
  echo "Процесс crm-api (PID ${sleep_pid}) всё ещё работает" >&2
  exit 1
fi

if [[ -f "${LOG_DIR}/crm-api.log" ]]; then
  echo "Лог-файл crm-api.log не был удалён" >&2
  exit 1
fi

if [[ ! -f "${LOG_DIR}/gateway.log" ]]; then
  echo "Лог-файл gateway.log не должен удаляться при частичной остановке" >&2
  exit 1
fi

if [[ ! -f "${START_LOG}" ]]; then
  echo "Журнал запуска не должен удаляться при частичной остановке" >&2
  exit 1
fi

echo "OK"
