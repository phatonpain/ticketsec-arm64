#!/usr/bin/env bash
# TicketSec Arm64 — deploy new backend artifact and restart service
# Usage (on the Graviton host): ./ops/deploy.sh
# Assumes: backend lives at /opt/ticketsec/backend, model artifact is pinned.

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="${APP_DIR}/ops/logs/verification.log"
BACKEND_DIR="/opt/ticketsec/backend"
SERVICE="ticketsec.service"

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log() {
  mkdir -p "$(dirname "${LOG_FILE}")"
  echo "$(ts) | deploy | $1" >> "${LOG_FILE}"
}

# 1. Verify the new artifact exists before touching the running service
if [[ ! -f "${BACKEND_DIR}/main.py" ]]; then
  log "FAIL: ${BACKEND_DIR}/main.py not found"
  echo "FAIL: backend entrypoint missing"
  exit 1
fi

# 2. Retain previous artifact for rollback
log "retaining previous artifact"
rm -rf "${BACKEND_DIR}.prev"
cp -a "${BACKEND_DIR}" "${BACKEND_DIR}.prev"

# 3. (Optional) Stage new artifact here if deploying from CI; placeholder for the actual copy step.
#    Example: rsync -a --delete ${CI_ARTIFACT}/backend/ ${BACKEND_DIR}/

# 4. Reload systemd and restart service
sudo systemctl daemon-reload
sudo systemctl restart "${SERVICE}"
sleep 2

# 5. Verify
status=$(sudo systemctl is-active "${SERVICE}" || true)
log "service status=${status}"

health_output=$(curl -s http://3.23.60.61:8000/health || true)
health_exit=$?
log "health-check exit=${health_exit} output=${health_output}"

if [[ "${status}" != "active" || ${health_exit} -ne 0 ]]; then
  log "FAIL: deploy verification failed; consider ./ops/rollback.sh"
  echo "FAIL: deploy did not reach healthy state"
  exit 1
fi

echo "OK: deployed and healthy"
