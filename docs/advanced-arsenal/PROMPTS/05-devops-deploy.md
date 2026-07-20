# 05 — DevOps deploy / rollback drill (next-cycle prompt)

> **Do NOT execute this prompt now.** Use it for future Graviton deployment work
> on TicketSec Arm64 v4.

## Trigger

Deploying a new artifact, changing `app/main.py`, rehearsing rollback, or
reviewing Security Group rules.

## Required reads

- `DEVOPS_RUNBOOK.md`
- `ops/deploy.sh`
- `ops/rollback.sh`
- `ops/ticketsec.service`

## Exact steps

1. Verify local artifact SHA-256 matches the target:
   ```bash
   sha256sum model/artifact.onnx
   ```
2. Copy backend to the Graviton host and run `./ops/deploy.sh`.
3. Confirm `/health` returns `{"status":"ok"}`.
4. Run a rollback rehearsal with `./ops/rollback.sh`; measure restore-to-healthy
   time.
5. Restore the new artifact and verify again.
6. Refresh `model/latency_t4g_micro.json` from the live endpoint and update
   README/Devpost metrics.
7. Append evidence to `ops/logs/verification.log`.

## Acceptance criteria

- [ ] Host artifact SHA-256 matches local committed artifact.
- [ ] `/health` 200 after deploy, reboot, and rollback.
- [ ] Latency artifact refreshed from live endpoint.
- [ ] Evidence logged.
- [ ] gates.sh 11/11 PASS after docs update.
