#!/usr/bin/env bash
# TicketSec Arm64 — external health verification
# Usage: ./ops/health-check.sh
# Appends one UTC-timestamped line to ops/logs/verification.log

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="${APP_DIR}/ops/logs/verification.log"
API_URL="http://3.23.60.61:8000"

cmd="curl -s ${API_URL}/health"
output=$(eval "${cmd}" || true)
exit_code=$?
ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

mkdir -p "$(dirname "${LOG_FILE}")"
echo "${ts} | health-check | exit=${exit_code} | ${output}" >> "${LOG_FILE}"

if [[ ${exit_code} -ne 0 ]]; then
  echo "FAIL: health check unreachable (exit ${exit_code})"
  exit 1
fi

echo "OK: ${output}"
