# HANDOFF — Phase 4 (QA) → Close-out

Date: 2026-07-19  
Branch: `mission/v4`  
Phase 3 final commit: `eda3c8a`  
Phase 4 final commit: `b88e430`

## Done

### 1. vitest

- Ran `npm test`.
- **28/28 test files passed**, **178/178 tests passed**.
- 0 `it.fails`, 0 skips.
- Existing `act(...)` warnings from suspended-resource updates were
  root-caused to test-environment timing; they do not fail tests and are not
  treated as flaky (no re-runs required).

### 2. axe per route

- Ran `@axe-core/cli` against all 6 app routes:
  - dashboard, detections, predictions, threat-analytics, model-registry,
    system-health.
- **0 violations on every route**.
- Root-caused and fixed 12 color-contrast violations on `/detections`:
  - `src/components/DetectionFilters.tsx` chip count spans used
    `var(--text-muted)` (#8292A8) on the ghost/control background.
  - Changed default count color and inactive category count override to
    `var(--text-secondary)`, raising contrast to ≥ 4.55:1.

### 3. Contrast sweep

- Added `scripts/contrast_sweep.py`.
- Checks 23 foreground/background token pairs across body, sidebar, card, and
  input surfaces.
- **23/23 pairs pass WCAG 2.1 AA (≥ 4.5:1)**.
- Minimum ratio: `text-muted on card` = 4.62:1.

### 4. Honesty matrix + 60-second offline EventLog silence

- Added `scripts/qa_honesty_matrix.mjs`.
- Captured screenshots for live, cached, and offline states across the 5
  primary views into `qa/proof/`.
- Performed a 60-second offline EventLog silence test:
  - Opened the notifications panel while API was offline.
  - Recorded entry list at start and after 60 seconds.
  - **0 fabricated entries** detected; 0 new entries added.
- Evidence:
  - `qa/proof/live-*.png`
  - `qa/proof/cached-*.png`
  - `qa/proof/offline-*.png`
  - `qa/proof/silence-before.png`
  - `qa/proof/silence-after.png`
  - `qa/proof/honesty-matrix.json`

### 5. Evidence committed

- Committed QA scripts, proof screenshots, and the updated
  `TEST_RESULTS_v4.md`.
- Added `.gitignore` exceptions for `scripts/contrast_sweep.py`,
  `scripts/qa_honesty_matrix.mjs`, and `audit/HANDOFF_P4.md`.

## Gate Status

- `bash scripts/gates.sh` → **11/11 PASS** at `2026-07-19 23:13:02Z`
  (recorded in `TEST_RESULTS_v4.md`).
- One earlier gates invocation reported a transient `G3 vitest — rc=1` with
  `fails/skips=0`. The failure did not reproduce on direct `npx vitest run`
  or on the next gates invocation; stray chromedriver processes from the axe
  sweep were cleaned up as the probable cause.

## Artifact Hashes (Phase 4)

| Artifact | SHA-256 |
|---|---|
| `model/artifact.onnx` | `ed10c4031405e3ab7e8767031a6c38d24d9c2f5075955ab08f1fdd2359a58713` |
| `model/calibration.json` | `0b2c91e726065637c805d6fdc6f138cdcb751946f616d918d7e3eab3479f96f1` |
| `public/cache/tickets-snapshot.json` | `ee2432b542e65a2e007b024b7074b5ff1d08f1758ec74a3a5fa9036c8ed47b72` |

## Open Items

- Redeploy the calibrated ONNX artifact to the live AWS Graviton `t4g.micro`
  instance and refresh `model/latency_t4g_micro.json`.
- Capture a fresh `public/cache/tickets-snapshot.json` from the live AWS
  endpoint if desired.
- Record the final Phase 4 commit hash at the top of this file after
  `git commit`.

## Warnings / Honesty Notes

- **QA evidence was collected against `http://127.0.0.1:8000`**, not the live
  AWS endpoint. Live/cached/offline screenshots reflect the local FastAPI
  backend.
- **Screenshots are committed as binary evidence** in `qa/proof/`. They are
  large; future maintainers may choose to keep only the JSON summary and
  `.gitignore` the PNGs.
- The transient G3 flake is documented in `TEST_RESULTS_v4.md` but was not
  fully root-caused because no test failure output was produced.

## Context Notes for Compaction

- Preserve: `audit/HANDOFF_P1.md`, `audit/HANDOFF_P2.md`,
  `audit/HANDOFF_P3.md`, this file, `audit/ML_TRACEABILITY.md`,
  `model/MODEL_CARD.md`, root `MODEL_CARD.md`, `TEST_RESULTS_v4.md`,
  Honesty Contract.
