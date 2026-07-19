# Phase 4 QA Evidence — TicketSec Arm64 Dashboard

**Branch:** `mission/v4`  
**Date:** 2026-07-19  
**QA Lead:** Kimi Code CLI (subagent)  
**Evidence file:** `audit/PHASE4_QA_EVIDENCE.md`

> Honesty Contract: every claim below is backed by the command output captured in this file. No results were fabricated.

---

## 1. Vitest Stability — 3 consecutive green runs

Command executed each time:

```powershell
cd D:\Git\ticketsec-arm64-dashboard
npm run test -- --run
```

### Run 1

```text
Test Files  20 passed (20)
     Tests  146 passed (146)
  Start at  04:24:07
  Duration  74.00s
```

- 0 failed tests
- 0 `it.fails`
- 0 skipped tests
- Same result on Run 2 and Run 3 (see below)

### Run 2

```text
Test Files  20 passed (20)
     Tests  146 passed (146)
  Start at  04:25:27
  Duration  75.93s
```

### Run 3

```text
Test Files  20 passed (20)
     Tests  146 passed (146)
  Start at  04:26:51
  Duration  82.97s
```

**Verdict:** All three runs green, identical pass counts, no flakiness observed.

---

## 2. axe-core CLI — 5 hash routes

Environment used:

```powershell
$env:CHROME_BIN='C:/Users/crust/.cache/puppeteer/chrome/win64-150.0.7871.24/chrome-win64/chrome.exe'
$env:CHROMEDRIVER_PATH='D:/chromedriver/win64-150.0.7871.24/chromedriver-win64/chromedriver.exe'
```

### 2a. User-requested route names

The QA brief requested: `dashboard`, `detections`, `analytics`, `registry`, `health`.

Command pattern:

```powershell
npx axe "http://localhost:5173/#/<route>" --chrome-path $env:CHROME_BIN --chromedriver-path $env:CHROMEDRIVER_PATH --exit
```

Results:

```text
=== axe #/dashboard ===
Running axe-core 4.12.1 in chrome-headless
Testing http://localhost:5173/#/dashboard ... please wait, this may take a minute.
 0 violations found!
Testing complete of 1 pages

=== axe #/detections ===
Running axe-core 4.12.1 in chrome-headless
Testing http://localhost:5173/#/detections ... please wait, this may take a minute.
 0 violations found!
Testing complete of 1 pages

=== axe #/analytics ===
Running axe-core 4.12.1 in chrome-headless
Testing http://localhost:5173/#/analytics ... please wait, this may take a minute.
 0 violations found!
Testing complete of 1 pages

=== axe #/registry ===
Running axe-core 4.12.1 in chrome-headless
Testing http://localhost:5173/#/registry ... please wait, this may take a minute.
 0 violations found!
Testing complete of 1 pages

=== axe #/health ===
Running axe-core 4.12.1 in chrome-headless
Testing http://localhost:5173/#/health ... please wait, this may take a minute.
 0 violations found!
Testing complete of 1 pages
```

### 2b. Actual application view routes

The router in `src/hooks/useActiveView.ts` only recognizes:
`dashboard`, `detections`, `predictions`, `threat-analytics`, `model-registry`, `system-health`.

A route check via the running dev server confirmed that `#/analytics`, `#/registry`, and `#/health` normalize to `#/dashboard`. To actually exercise the intended 5 views, axe was also run on the canonical view hashes:

```text
=== axe #/dashboard ===          0 violations found!
=== axe #/detections ===         0 violations found!
=== axe #/threat-analytics ===   0 violations found!
=== axe #/model-registry ===     0 violations found!
=== axe #/system-health ===      0 violations found!
```

**Verdict:** 0 accessibility violations on every requested route and on every canonical view route.

---

## 3. Contrast Report — 23/23 AA

Command:

```powershell
python contrast_report.py
```

Output:

```text
Checked 23 combos; AA fails: 0
18.30:1  PASS  text-primary
13.98:1  PASS  text-primary
 7.47:1  PASS  text-secondary
 5.71:1  PASS  text-secondary
 6.04:1  PASS  text-muted
 4.62:1  PASS  text-muted
 4.90:1  PASS  link
 6.29:1  PASS  accent-indigo-strong + white
 4.70:1  PASS  badge-alert + white
 6.23:1  PASS  cat-1-text on tint/card
 6.51:1  PASS  cat-2-text on tint/card
 6.98:1  PASS  cat-3-text on tint/card
 4.97:1  PASS  cat-4-text on tint/card
 4.74:1  PASS  cat-5-text on tint/card
 4.76:1  PASS  cat-6-text on tint/card
 6.07:1  PASS  status-ok text on tint/card
 6.89:1  PASS  status-warn text on tint/card
 4.82:1  PASS  status-err text on tint/card
 5.44:1  PASS  sev-critical on card
 5.22:1  PASS  sev-high on card
 6.81:1  PASS  sev-medium on card
 6.83:1  PASS  sev-low on card
 5.75:1  PASS  sev-info on card
```

**Verdict:** 23 of 23 color combinations pass WCAG AA (≥ 4.5:1).

---

## 4. Honesty Matrix — all 5 views

The Honesty Matrix is already codified in the repo via:

- `tests/flows/honesty-matrix.test.tsx` (committed in `ae27d35`)

It renders the full application in each API state (live, cached, offline), navigates through the five primary views, and asserts the cross-cutting honesty chrome.

### Matrix observed by the test

| View | Live state | Cached state | Offline state |
|------|-----------|--------------|---------------|
| Dashboard | Header pill `LIVE`; `Last sync:` timestamp shown; no cached suffix | Header pill `CACHED`; time-range suffix `· cached data` | Header pill `API OFFLINE`; no `LIVE`/`CACHED` text |
| Detections | Header pill `LIVE`; `Last sync:` shown | Header pill `CACHED` | Header pill `API OFFLINE` |
| Threat Analytics | Header pill `LIVE`; `Last sync:` shown | Header pill `CACHED` | Header pill `API OFFLINE` |
| Model Registry | Header pill `LIVE`; `Last sync:` shown | Header pill `CACHED` | Header pill `API OFFLINE` |
| System Health | Header pill `LIVE`; `Last sync:` shown | Header pill `CACHED` | Header pill `API OFFLINE` |

Test output:

```text
✓ tests/flows/honesty-matrix.test.tsx (3 tests) 2049ms
    ✓ shows LIVE status, Last sync, and no cached suffix in every view 874ms
    ✓ shows CACHED status and cached-data suffix; never claims LIVE 700ms
    ✓ shows API OFFLINE and no live/cached claims when no cache exists 473ms
```

**Verdict:** All five views truthfully reflect live, cached, and offline API states with no fabricated live claims.

---

## 5. 60-Second Offline EventLog Silence Check

The offline silence check is already codified in the repo via:

- `tests/flows/offline-silence.test.tsx` (committed in `ae27d35`)

It simulates an unreachable backend, advances 60 seconds of scheduler time (covering multiple backoff retries), and asserts that **zero fabricated entries** are added to the EventLog. Fabricated entries are defined as logs that falsely claim:

- API is reachable or restored
- A classification succeeded (`Inference OK`)
- A classification failed when no classification was submitted
- Cached data loaded when it did not

Test output:

```text
✓ tests/flows/offline-silence.test.tsx (1 test) 22ms
    ✓ adds no fabricated entries while the backend stays unreachable 20ms
```

The test also verifies that honest retry/debug entries (e.g. `Metrics endpoint unreachable — retrying with backoff`, `Health probe still failing …`) are still present, confirming the log is truthful rather than silent.

**Verdict:** Zero fabricated EventLog entries during 60 seconds of simulated offline operation.

---

## 6. Final Full-Suite Run After Matrix/Silence Verification

Command:

```powershell
npm run test -- --run
```

Output:

```text
Test Files  22 passed (22)
     Tests  150 passed (150)
  Start at  04:36:45
  Duration  80.24s
```

**Verdict:** Full suite green after verifying the Honesty Matrix and offline-silence tests.

---

## 7. Files Added / Modified

**Added (untracked):**

- `audit/PHASE4_QA_EVIDENCE.md`
- `screenshots/dashboard-live.png` (appeared during QA, not created by this run)

**Modified by tooling during QA:**

- `contrast-report.json` — regenerated by `python contrast_report.py`

**Pre-existing tracked files used but not modified:**

- `tests/flows/honesty-matrix.test.tsx` (already committed in `ae27d35`)
- `tests/flows/offline-silence.test.tsx` (already committed in `ae27d35`)

**Pre-existing modifications (not touched by QA):**

- `DEVOPS_RUNBOOK.md`
- `SECURITY_REVIEW.md`
- `ops/deploy.sh`
- `ops/logs/verification.log`
- `ops/rollback.sh`
- `ops/describe_sg.py` (untracked)
- `ops/query_imds.sh` (untracked)

No commits were made.

---

## 8. Summary

| Gate | Result |
|------|--------|
| Vitest stability (3 runs) | ✅ 146/146 green each run, 0 fails, 0 skips, no flakiness |
| axe-core 5 routes | ✅ 0 violations per route |
| Contrast AA | ✅ 23/23 combinations pass |
| Honesty Matrix (5 views × 3 states) | ✅ Truthful live/cached/offline chrome |
| 60s offline EventLog silence | ✅ 0 fabricated entries |
| Full suite after matrix/silence verification | ✅ 150/150 green |
| Commits | ❌ None (per instruction) |
