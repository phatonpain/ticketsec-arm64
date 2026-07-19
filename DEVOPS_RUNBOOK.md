# TicketSec Arm64 — DevOps Runbook

**Mission:** Keep the FastAPI + ONNX Runtime INT8 classifier reachable and self-healing on AWS Graviton `t4g.micro` (ARM64, 2 vCPU, 1 GB RAM) at `http://3.23.60.61:8000`. Every claim about service state is backed by a UTC-timestamped log line — never by assertion.

**Target instance:** `3.23.60.61`
**Service name:** `ticketsec.service`
**Backend path on server:** `/opt/ticketsec/backend`
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

**Current finding (F-04):** external TCP probe to `3.23.60.61:8000` times out; ports 22 (SSH) and 3000 (Grafana) are open. The Security Group likely lacks a rule for TCP 8000 from `0.0.0.0/0`.

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
WorkingDirectory=/opt/ticketsec/backend
Environment="PYTHONUNBUFFERED=1"
Environment="PATH=/opt/ticketsec/backend/.venv/bin"
ExecStart=/opt/ticketsec/backend/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
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

## 4. Security Group rule for port 8000

Replace `sg-xxxxxxxxxxxxxxxxx` with the instance's actual Security Group ID.

```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxxxxxxxxxx \
  --protocol tcp \
  --port 8000 \
  --cidr 0.0.0.0/0 \
  --description "TicketSec FastAPI HTTP"
```

Confirm:

```bash
aws ec2 describe-security-groups \
  --group-ids sg-xxxxxxxxxxxxxxxxx \
  --query 'SecurityGroups[0].IpPermissions[]'
```

> **Boundary note:** the Security Group scoping is implemented by DevOps and reviewed by `security-engineer.md`. Document the final rule (source CIDR, port, description) in the runbook after review.

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
cd D:\ComfyUI\ticketsec-arm64-dashboard
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
# D:\ComfyUI\ticketsec-arm64-dashboard\.env
VITE_API_BASE_URL=http://3.23.60.61:8000
```

Then start the dev server:

```powershell
cd D:\ComfyUI\ticketsec-arm64-dashboard
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

- [ ] `DEVOPS_RUNBOOK.md` is complete and aligned with this version.
- [ ] `ops/` scripts are present and executable.
- [ ] `ticketsec.service` unit is committed/installed with `Restart=always` + `MemoryMax=700M`.
- [ ] External `curl -s http://3.23.60.61:8000/health` returns HTTP 200, logged in `ops/logs/verification.log`.
- [ ] Reboot survival test passed with zero manual intervention, evidence logged.
- [ ] Rollback rehearsed once with previous artifact + re-verify, evidence logged.
- [ ] Security Group rule for port 8000 is documented and reviewed by `security-engineer.md`.
- [ ] `public/cache/tickets-snapshot.json` refreshed from live responses at least once, provenance logged.

---

## 13. Evidence log sample

```text
# ops/logs/verification.log
2026-07-17T12:00:01Z | health-check | exit=0 | {"status":"ok"}
2026-07-17T12:05:12Z | deploy | service status=active health exit=0 output={"status":"ok"}
2026-07-17T12:10:33Z | snapshot-refresh | OK: snapshot refreshed from http://3.23.60.61:8000/predict at 2026-07-17T12:10:33Z
2026-07-17T12:30:00Z | rollback | service status=active health exit=0 output={"status":"ok"}
```
