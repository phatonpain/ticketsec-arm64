# HANDOFF — Phase 6 (DevOps / SRE) → Close-out

Date: 2026-07-20  
Branch: `mission/v4`  
Phase 5 final commit: `0dca304`  
Phase 6 final commit: `54c3e7a`

## Done

### 1. Redeploy calibrated artifact to Graviton

- Copied local `model/artifact.onnx` (SHA-256 `ed10c403...`) to
  `/home/ubuntu/ticketsec/model/artifact.onnx`.
- Copied updated `app/main.py` (default 60 RPM rate limit) to
  `/home/ubuntu/ticketsec/app/main.py`.
- Copied `model/calibration.json` to `/home/ubuntu/ticketsec/model/calibration.json`
  for traceability (serving layer does not read it at runtime).
- Restarted `ticketsec.service`.
- Verified host artifact SHA-256 matches local:
  `ed10c4031405e3ab7e8767031a6c38d24d9c2f5075955ab08f1fdd2359a58713`.

### 2. External verification

- `curl http://3.23.60.61:8000/health` → `{"status":"ok"}`.
- Live `/predict` for all six canonical samples returned expected categories
  with calibrated confidences:

| Category | Confidence | processing_time_ms |
|---|---|---:|
| Phishing | 0.7945 | 0.6284 |
| Malware | 0.9997 | 0.2709 |
| Unauthorized Access | 0.9890 | 0.2304 |
| Data Breach | 0.9669 | 0.2383 |
| DDoS | 0.6941 | 0.2613 |
| False Positive | 0.9920 | 0.2646 |

- Rate limiter test: 70 rapid POSTs → 60× HTTP 200, 10× HTTP 429.

### 3. Live latency re-measurement

- Command:
  ```bash
  TICKETSEC_API_URL=http://3.23.60.61:8000/predict python -m model.measure_latency \
    --samples 100 --output model/latency_t4g_micro.json --host "AWS Graviton t4g.micro"
  ```
- Result: **p50 = 0.237 ms**, **p95 = 0.286 ms**.
- Committed `model/latency_t4g_micro.json` (new SHA-256 and timestamp).
- Note: the server-side rate limiter was temporarily raised to 500 RPM during
  measurement to avoid throttling the 100 sequential requests; it was restored
  to 60 RPM immediately afterwards and re-verified.

### 4. Reboot survival

- Restarted `ticketsec.service` remotely via SSH.
- `/health` returned HTTP 200 after **2.72 seconds** (restart command latency
  1.69s).
- Logged to `ops/logs/verification.log`:
  ```
  2026-07-20T00:29:46Z | reboot-survival | restart_cmd=ssh ubuntu@3.23.60.61 sudo systemctl restart ticketsec restart_seconds=1.69 healthy_seconds=2.72 health={"status":"ok"}
  ```

### 5. Security Group review

- Instance: `3.23.60.61`
- Security Group: `sg-0293de1eace5d362c` (`launch-wizard-1`)
- Operator public IP observed during this phase: `179.87.223.68`
- External port probe (2026-07-20):
  - Port 22 (SSH): open
  - Port 8000 (FastAPI): open
  - Port 3000 (Grafana): closed/dropped
  - Port 5173 (Vite): closed/dropped
- Review conclusion and recommendations recorded in `DEVOPS_RUNBOOK.md` §4:
  - Port 22 should remain scoped to the operator IP (`My IP`).
  - Port 8000 is intentionally `0.0.0.0/0` during the hackathon demo period.
  - Port 3000 and other non-essential ports should remain closed.

### 6. Rollback rehearsal

- Kept previous artifact on host as `/home/ubuntu/ticketsec/model/artifact.onnx.prev`
  and `/home/ubuntu/ticketsec/app/main.py.prev`.
- Documented rollback command in `DEVOPS_RUNBOOK.md` §14.5.
- Measured rollback time: **3.81 seconds** from command invocation to healthy
  `/health` response.
- After verification, the calibrated artifact was restored and the service
  returned to the new artifact hash.

### 7. Documentation updates

- `DEVOPS_RUNBOOK.md` updated with Phase 6 evidence, corrected backend path
  (`/home/ubuntu/ticketsec`), SG review, latency, and rollback metrics.
- `MODEL_CARD.md` and `model/MODEL_CARD.md` updated with refreshed Graviton
  latency numbers.
- `audit/ML_TRACEABILITY.md` updated with the new `latency_t4g_micro.json`
  SHA-256.
- `public/cache/tickets-snapshot.json` refreshed from live `/predict` responses.

## Gate Status

- `bash scripts/gates.sh` → **PENDING** (run after commit).

## Open Items

- Replace CORS wildcard with explicit origin list post-demo (see
  `SECURITY_REVIEW.md` §4).
- Add authentication/authorization before production anonymous exposure.
- Replace in-memory rate limiter with Redis or API-gateway throttling
  post-hackathon.
- Enable HTTPS/TLS termination on the production load balancer.
- Record the final Phase 6 commit hash at the top of this file after
  `git commit`.

## Warnings / Honesty Notes

- Live latency measurement temporarily raised the server-side rate limit to
  avoid throttling; this was documented and the limit was restored and
  re-verified.
- The public `/predict` endpoint remains anonymous and CORS-wildcarded for the
  demo period.

## Context Notes for Compaction

- Preserve: `audit/HANDOFF_P1.md`, `audit/HANDOFF_P2.md`,
  `audit/HANDOFF_P3.md`, `audit/HANDOFF_P4.md`, `audit/HANDOFF_P5.md`, this
  file, `audit/ML_TRACEABILITY.md`, `SECURITY_REVIEW.md`, `DEVOPS_RUNBOOK.md`,
  `model/MODEL_CARD.md`, root `MODEL_CARD.md`, `TEST_RESULTS_v4.md`, Honesty
  Contract.
