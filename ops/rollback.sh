#!/usr/bin/env bash
# TicketSec Arm64 — rollback to the previous retained artifact
# Usage (on the Graviton host): ./ops/rollback.sh

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="${APP_DIR}/ops/logs/verification.log"
BACKEND_DIR="/opt/ticketsec/backend"
SERVICE="ticketsec.service"

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log() {
  mkdir -p "$(dirname "${LOG_FILE}")"
  echo "$(ts) | rollback | $1" >> "${LOG_FILE}"
}

if [[ ! -d "${BACKEND_DIR}.prev" ]]; then
  log "FAIL: previous artifact ${BACKEND_DIR}.prev not found"
  echo "FAIL: no previous artifact to roll back to"
  exit 1
fi

log "restoring previous artifact"
rm -rf "${BACKEND_DIR}.rolling"
mv "${BACKEND_DIR}" "${BACKEND_DIR}.rolling"
mv "${BACKEND_DIR}.prev" "${BACKEND_DIR}"

log "restarting service"
sudo systemctl daemon-reload
sudo systemctl restart "${SERVICE}"
sleep 2

status=$(sudo systemctl is-active "${SERVICE}" || true)
health_output=$(curl -s http://3.23.60.61:8000/health || true)
health_exit=$?
log "service status=${status} health exit=${health_exit} output=${health_output}"

if [[ "${status}" != "active" || ${health_exit} -ne 0 ]]; then
  log "FAIL: rollback verification failed; manual recovery required"
  echo "FAIL: rollback did not reach healthy state"
  exit 1
fi

echo "OK: rollback successful and healthy"
