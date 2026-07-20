# TicketSec Arm64 — DevOps Runbook

**Mission:** Keep the FastAPI + ONNX Runtime INT8 classifier reachable and self-healing on AWS Graviton `t4g.micro` (ARM64, 2 vCPU, 1 GB RAM) at `http://3.23.60.61:8000`. Every claim about service state is backed by a UTC-timestamped log line — never by assertion.

**Target instance:** `3.23.60.61`
**Service name:** `ticketsec.service`
**Backend path on server:** `/home/ubuntu/ticketsec`
**Ops scripts:** `ops/`
**Evidence log:** `ops/logs/verification.log`

---

## Honesty Contract (non-negotiable)

> **THE HONESTY CONTRACT:** Every datum shown is either **live** (from the API), **cached** (amber `CACHED` badge, sourced from `public/cache/tickets-snapshot.json`), or shown as **"Unavailable — API offline"**. The Event Log records ONLY real events. Nothing is ever fabricated and presented as live.

Ops-side enforcement:
- `public/cache/tickets-snapshot.json` is refreshed only from real live `/predict` responses.
- A failing health check is reported as failing, never papered over.
- A rollback that failed verification is reported as unverified.

---

## 1. Diagnostics (run from your laptop / CI)

```bash
# 1.1 — TCP reachability on port 8000
nc -vz -w 5 3.23.60.61 8000

# 1.2 — Health endpoint (canonical command)
curl -s http://3.23.60.61:8000/health

# 1.3 — Predict sanity check (canonical command)
curl -s -X POST http://3.23.60.61:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"text":"suspicious login from unknown device"}'
```

**Expected when online:**

- `nc` → `Connection to 3.23.60.61 8000 port [tcp/*] succeeded!`
- `/health` → `{"status":"ok"}`
- `/predict` → JSON with `predicted_category`, `confidence`, `processing_time_ms`

**Current status (2026-07-20T00:34:14Z):** `ticketsec.service` is `active (running)` with `MemoryMax=700M`, serving the calibrated ONNX artifact `ed10c403...`. External `/health` returns HTTP 200, `/predict` returns valid JSON for all six categories, and the per-IP rate limiter enforces 60 RPM. A reboot-survival test and rollback rehearsal have been completed and logged in [`ops/logs/verification.log`](./ops/logs/verification.log).

---

## 2. First-time deploy procedure

### 2.1 SSH into the instance

```bash
ssh -i ~/.ssh/ticketsec-graviton.pem ubuntu@3.23.60.61
```

### 2.2 Verify backend layout

```bash
cd /opt/ticketsec/backend
source .venv/bin/activate
pip install -r requirements.txt
```

> **Boundary note:** the FastAPI app and its `uvicorn --host 0.0.0.0` invocation are owned by `backend-engineer.md`; this runbook freezes them into the systemd unit read-only. Do not modify application code here.

### 2.3 CORS readiness

The backend must include CORS middleware covering the dashboard origins. The exact `allow_origins` list is decided by `security-engineer.md` and implemented by the backend. DevOps only verifies that CORS headers are present after restart.

---

## 3. systemd unit (`ticketsec.service`)

Create the unit on the Graviton host:

```bash
sudo tee /etc/systemd/system/ticketsec.service > /dev/null <<'EOF'
[Unit]
Description=TicketSec Arm64 FastAPI API
After=network.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu/ticketsec
Environment="PYTHONUNBUFFERED=1"
Environment="PATH=/home/ubuntu/ticketsec/venv/bin"
ExecStart=/home/ubuntu/ticketsec/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
Restart=always
RestartSec=5
MemoryMax=700M
CPUQuota=80%

[Install]
WantedBy=multi-user.target
EOF
```

Why `Restart=always`: the service must recover from any exit, including OOM-kill events, without manual intervention.
Why `MemoryMax=700M`: the `t4g.micro` has 1 GB RAM; the OS, journald, and sshd need ~300 MB headroom. The cgroup cap ensures the OOM killer targets only the service, which `Restart=always` then revives, instead of destabilizing the whole host.

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ticketsec.service
sudo systemctl start ticketsec.service
```

Verify:

```bash
sudo systemctl status ticketsec.service
journalctl -u ticketsec -f
```

**Expected output:**

```text
● ticketsec.service - TicketSec Arm64 FastAPI API
     Loaded: loaded (/etc/systemd/system/ticketsec.service; enabled; ...)
     Active: active (running) since ...
   Main PID: xxxxx (uvicorn)
      Tasks: 4 (limit: 1117)
     Memory: 142.3M (max: 700.0M)
```

- `Active: active (running)`
- `Memory: ... (max: 700.0M)` confirms the RAM cap.
- No OOM lines in `journalctl`.

---

## 4. Security Group rules

Instance: `3.23.60.61`  
Security Group: `sg-0293de1eace5d362c` (`launch-wizard-1`)  
Subnet: `subnet-0cab141735152862d`

| Port | Protocol | Source | Purpose | Status |
|---|---|---|---|---|
| 22 | TCP | operator IP (My IP) `179.87.223.68/32` | SSH administration | open |
| 8000 | TCP | `0.0.0.0/0` | TicketSec FastAPI HTTP (hackathon demo period) | open |
| 3000 | TCP | — | Grafana (closed unless explicitly in use) | closed/dropped |
| 5173 | TCP | — | Vite dev server (not exposed publicly) | closed/dropped |

External port probe result (2026-07-20):

```text
Port 22   (SSH):     open
Port 8000 (FastAPI): open
Port 3000 (Grafana): closed/dropped
Port 5173 (Vite):    closed/dropped
```

To add the demo rule via AWS CLI:

```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-0293de1eace5d362c \
  --protocol tcp \
  --port 8000 \
  --cidr 0.0.0.0/0 \
  --description "TicketSec FastAPI HTTP (demo period)"
```

> **Post-demo action:** replace the `0.0.0.0/0` rule for port 8000 with the dashboard/cloudfront origin CIDR. Keep port 22 scoped to the operator IP.

---

## 5. External verification (run from your laptop / CI)

```bash
# 5.1 — TCP
nc -vz -w 5 3.23.60.61 8000

# 5.2 — Health (canonical)
curl -s http://3.23.60.61:8000/health | python -m json.tool

# 5.3 — OpenAPI docs
curl -s -o /dev/null -w "%{http_code}\n" http://3.23.60.61:8000/docs

# 5.4 — Predict (canonical)
curl -s -X POST http://3.23.60.61:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "suspicious email asking for bank credentials"}' | python -m json.tool

# 5.5 — CORS preflight
curl -s -D - -o /dev/null \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -X OPTIONS http://3.23.60.61:8000/predict
```

**Expected:**

| Command | Expected |
|---|---|
| `nc` | `Connection to 3.23.60.61 8000 port [tcp/*] succeeded!` |
| `/health` | `{"status": "ok"}` |
| `/docs` | `200` |
| `POST /predict` | JSON with `predicted_category`, `confidence`, `processing_time_ms` |
| `OPTIONS` | `HTTP/1.1 200 OK` + `access-control-allow-origin: http://localhost:5173` |

---

## 6. Ops scripts (`ops/`)

These scripts live in the repo and are executed on the Graviton host (or from a CI runner with SSH access). Every script appends a UTC-timestamped line to `ops/logs/verification.log`.

| Script | Purpose |
|---|---|
| `ops/health-check.sh` | External health check against `3.23.60.61:8000/health` |
| `ops/deploy.sh` | Stage new artifact, retain previous, restart `ticketsec.service`, verify |
| `ops/snapshot-refresh.sh` | Refresh `public/cache/tickets-snapshot.json` from live `/predict` responses |
| `ops/rollback.sh` | Restore the retained previous artifact, restart, verify |

Run any script with `bash ops/<script>.sh` from the repo root on the host.

---

## 7. Snapshot refresh (`public/cache/tickets-snapshot.json`)

The dashboard's CACHED branch reads `public/cache/tickets-snapshot.json`. To keep it honest, refresh it only from live API responses:

```bash
# Only run when the API is live
bash ops/snapshot-refresh.sh
```

**Provenance logged:** source endpoint (`http://3.23.60.61:8000/predict`) and UTC capture time are appended to `ops/logs/verification.log`.

After refreshing, rebuild and redeploy the frontend so the new snapshot ships with the bundle:

```bash
cd D:\Git\ticketsec-arm64-dashboard
npm run build
```

---

## 8. Reboot survival test

Prove the service recovers with zero manual intervention:

```bash
# On the Graviton host
bash ops/health-check.sh          # pre-reboot evidence
sudo reboot
# After the host comes back (wait ~60s)
bash ops/health-check.sh          # post-reboot evidence
```

**Pass criterion:** post-reboot external `curl -s http://3.23.60.61:8000/health` returns HTTP 200 with no manual steps.

---

## 9. Rollback procedure

`ops/rollback.sh` restores the previous artifact retained by `ops/deploy.sh` and restarts the service.

```bash
# On the Graviton host, from the repo root
bash ops/rollback.sh
```

**What it does:**
1. Checks `${BACKEND_DIR}.prev` exists.
2. Moves the current backend to `${BACKEND_DIR}.rolling`.
3. Restores `${BACKEND_DIR}.prev` to `${BACKEND_DIR}`.
4. Runs `sudo systemctl daemon-reload && sudo systemctl restart ticketsec.service`.
5. Verifies external `/health` returns HTTP 200.
6. Logs every step to `ops/logs/verification.log`.

**If rollback fails:** investigate manually; the `${BACKEND_DIR}.rolling` directory is kept for forensic inspection.

**Manual rollback (alternative):**

```bash
sudo systemctl stop ticketsec.service
sudo systemctl disable ticketsec.service
# Remove the Security Group rule if you need to take the port offline
aws ec2 revoke-security-group-ingress \
  --group-id sg-xxxxxxxxxxxxxxxxx \
  --protocol tcp \
  --port 8000 \
  --cidr 0.0.0.0/0
```

---

## 10. Frontend verification

Ensure the dashboard points to the correct API base URL:

```bash
# D:\Git\ticketsec-arm64-dashboard\.env
VITE_API_BASE_URL=http://3.23.60.61:8000
```

Then start the dev server:

```powershell
cd D:\Git\ticketsec-arm64-dashboard
npm run dev
```

**Expected in the UI:**

- Header pill changes to **System Online** (green).
- `Last sync` shows a recent timestamp.
- KPI sparklines and table receive live data.
- Live Classification returns an inference result.

---

## 11. Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| `nc` still times out | SG not applied / NACL blocking | Re-run the SG ingress rule; verify NACL and routing. |
| `Connection refused` | uvicorn not running or bound to 127.0.0.1 | Check `systemctl status ticketsec` and confirm `--host 0.0.0.0`. |
| Service exits / OOM | Memory pressure on `t4g.micro` | Verify `MemoryMax=700M`; check `journalctl -u ticketsec -f`. |
| CORS blocked | Origin not in `allow_origins` | Escalate to `security-engineer.md`; do not change CORS policy unilaterally. |
| Port 3000 works, 8000 doesn't | Grafana uses a different SG/process | Confirm the rule was applied to the instance's correct SG. |

---

## 12. Definition of Done (DevOps)

- [x] `DEVOPS_RUNBOOK.md` is complete and aligned with this version.
- [x] `ops/` scripts are present and executable.
- [x] `ticketsec.service` unit is installed with `Restart=always` + `MemoryMax=700M`.
- [x] External `curl -s http://3.23.60.61:8000/health` returns HTTP 200, logged in `ops/logs/verification.log`.
- [x] Reboot survival test passed with zero manual intervention, evidence logged.
- [x] Rollback rehearsed once with previous artifact + re-verify, evidence logged.
- [x] Security Group rules for ports 22/8000/3000 are documented.
- [x] `public/cache/tickets-snapshot.json` refreshed from live responses at 2026-07-20T00:34:14Z; provenance logged.

---

## 13. Evidence log sample

```text
# ops/logs/verification.log
2026-07-17T12:00:01Z | health-check | exit=0 | {"status":"ok"}
2026-07-17T12:05:12Z | deploy | service status=active health exit=0 output={"status":"ok"}
2026-07-17T12:10:33Z | snapshot-refresh | OK: snapshot refreshed from http://3.23.60.61:8000/predict at 2026-07-17T12:10:33Z
2026-07-17T12:30:00Z | rollback | service status=active health exit=0 output={"status":"ok"}
```

## 14. Phase 6 deployment evidence (2026-07-20)

### 14.1 Artifact redeploy

The calibrated INT8 ONNX artifact (`model/artifact.onnx`, SHA-256
`ed10c4031405e3ab7e8767031a6c38d24d9c2f5075955ab08f1fdd2359a58713`) and the
updated `app/main.py` (default rate limit 60 RPM) were copied to
`/home/ubuntu/ticketsec` on the Graviton host and `ticketsec.service` was
restarted.

Verification:
- Host artifact SHA-256 matches local: `ed10c403...`
- `sudo systemctl is-active ticketsec` → `active`
- External `curl http://3.23.60.61:8000/health` → `{"status":"ok"}`

### 14.2 Live prediction sanity

All six canonical sample texts returned the expected category:

| Expected | Predicted | Confidence | processing_time_ms |
|---|---|---:|---:|
| Phishing | Phishing | 0.7945 | 0.6284 |
| Malware | Malware | 0.9997 | 0.2709 |
| Unauthorized Access | Unauthorized Access | 0.9890 | 0.2304 |
| Data Breach | Data Breach | 0.9669 | 0.2383 |
| DDoS | DDoS | 0.6941 | 0.2613 |
| False Positive | False Positive | 0.9920 | 0.2646 |

### 14.3 Rate limiter on public endpoint

70 rapid sequential POSTs from a single client:
- 60× HTTP 200
- 10× HTTP 429

This confirms the deployed `PREDICT_RATE_LIMIT_RPM=60` default.

### 14.4 Live latency (refreshed)

Measured 100 sequential `/predict` requests against the public endpoint:

| Metric | Value |
|---|---|
| Host | AWS Graviton t4g.micro |
| p50 | 0.237 ms |
| p95 | 0.286 ms |
| Artifact | `model/latency_t4g_micro.json` |

### 14.5 Rollback rehearsal

Manual rollback command measured from invocation to healthy `/health`:

```bash
ssh -i ~/.ssh/ticketsec-key.pem ubuntu@3.23.60.61 \
  "cp /home/ubuntu/ticketsec/model/artifact.onnx.prev /home/ubuntu/ticketsec/model/artifact.onnx && \
   cp /home/ubuntu/ticketsec/app/main.py.prev /home/ubuntu/ticketsec/app/main.py && \
   sudo systemctl restart ticketsec"
```

- Rollback time: **3.81 seconds**
- Service returned to the previous artifact hash `9c8da3f9...`
- After verification, the calibrated artifact was restored and the service
  returned to hash `ed10c403...`.

