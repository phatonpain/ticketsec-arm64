# Defect Report D1–D7 — TicketSec ARM64 Dashboard

**Branch:** `mission/v4`  
**Repo:** `D:\Git\ticketsec-arm64-dashboard`  
**Production backend:** AWS Graviton `t4g.micro` at `http://3.23.60.61:8000`  
**Report date:** 2026-07-19  
**Final gate run:** `2026-07-19 18:40:15Z` — **11/11 PASS**

---

## Summary

| ID | Defect | Root cause | Fix | Verification | Status |
|---|---|---|---|---|---|
| D1 | Shared artifact loader missing; Model Registry / Performance Panel showed inconsistent data | Ad-hoc JSON imports and heterogeneous `status` strings (`COMPLETE`/`OK`/`complete`) | Created `src/lib/artifacts.ts` with `isArtifactReady`, `loadEvalArtifact`, `loadLatencyArtifact`, `loadArtifactMeta`; normalized all status values; wired into `ModelRegistry` and `ModelPerformancePanel` | 12 new tests; Model Card shows size/SHA/target/quantization delta; Dashboard accuracy = 92.94% from `eval_results.json` | ✅ Fixed |
| D2 | Donut center label collided with headroom line | Two-line center graphic in `ModelHealthDonut` | Moved headroom detail to legend; center is now one clamped mono line (`30%`/`50%`) | Visual inspection + axe registry gate | ✅ Fixed |
| D3 | SOURCE badge truncated as `Cach…` | Column width too narrow (`72 px`) | Widened `ClassificationTable` SOURCE column to `96 px`; badge white-space nowrap | Screenshot `d3-detections-1366.png` | ✅ Fixed |
| D4 | Empty Threat Analytics timeline rendered naked axes | `TimelineChart` had no empty state | Return `EmptyState` when `tickets.length === 0` | Screenshot `d4-threat-analytics-empty-1366.png` + flow test | ✅ Fixed |
| D5 | Duplicate status/filter rail on Dashboard | Same probe latency / last-sync items rendered in-page and in global `Header` | Removed the 40px Dashboard rail; unique status info now lives in global `Header` tooltip | `Dashboard.test.tsx` asserts rail is gone; screenshot `d5-dashboard-1366.png` | ✅ Fixed |
| D6 | Snapshot cache stale and lacked provenance | `public/cache/tickets-snapshot.json` was old; rows had no `generatedAt` | Ran `ops/snapshot-refresh.sh` against live `/predict`; refreshed all 6 canonical rows; added `generatedAt` per row | Snapshot updated; logged in `ops/logs/verification.log` | ✅ Fixed |
| D7 | Stray files at `D:\` root | Old build output and misplaced governance file left outside repo | Removed both items after user approval | `Test-Path` confirms neither exists | ✅ Removed |

---

## Quality-gate evidence

Latest `bash scripts/gates.sh` output (appended to `TEST_RESULTS_v4.md`):

```text
## Gate run — 2026-07-19 18:40:15Z
- [PASS] G1 build (2026-07-19 18:40:15Z)
- [PASS] G1 chunk 309.71KB<600KB (2026-07-19 18:40:15Z)
- [PASS] G2 lint 0/0 (2026-07-19 18:40:15Z)
- [PASS] G3 vitest green, 0 it.fails/skips (2026-07-19 18:40:15Z)
- [PASS] G4 axe dashboard (2026-07-19 18:40:15Z)
- [PASS] G4 axe detections (2026-07-19 18:40:15Z)
- [PASS] G4 axe analytics (2026-07-19 18:40:15Z)
- [PASS] G4 axe registry (2026-07-19 18:40:15Z)
- [PASS] G4 axe health (2026-07-19 18:40:15Z)
- [PASS] G6 secrets scan clean (2026-07-19 18:40:15Z)
- [PASS] G8 tree clean (2026-07-19 18:40:15Z)
```

Test metrics:

- **25 test files** passed
- **170/170 tests** passed
- **0 `it.fails` / 0 skipped**
- Vitest duration: ~110 s

---

## Commits on `mission/v4`

```text
026fbd0 docs: record 11/11 green gate run with D1-D6 fixes
2f0e3ab docs: append latest gate evidence to TEST_RESULTS_v4.md
b33b584 docs(screenshots): add 1366px evidence for D1/D3/D4/D5 fixes
d8159a4 fix(d6): refresh tickets-snapshot.json from live API and add generatedAt per row
540368e fix(d5): remove duplicate Dashboard status rail; fold probe/sync into global Header
9da7349 fix(d4): render EmptyState in TimelineChart when no detections
5400cc3 fix(d3): widen ClassificationTable SOURCE column so Cached badge never truncates
132e011 fix(d2): move donut headroom line to legend; clamp center label to one line
0ce5357 fix(d1): add shared artifact loader and wire ModelRegistry/ModelPerformancePanel
```

---

## D7 hygiene — completed

Both stray items at `D:\` root were removed on 2026-07-19 after user approval:

1. `D:\AGENTS.md` — deleted.
2. `D:\ticketsec-arm64-dashboard-dist\` — recursively deleted.

Verification with `Test-Path` confirms neither path exists anymore.

---

## Notes

- Honesty contract remains intact: pending UI only appears when artifacts are truly `PENDING`/missing; snapshot data is sourced from real `/predict` responses and timestamped.
- The earlier 18:30:20Z gate failure was a transient Vitest flake (standalone `npx vitest run` passed 170/170); it cleared on the next clean run.
- The 18:25:09Z gate failure was only G8 (uncommitted `TEST_RESULTS_v4.md`); this was resolved by committing the evidence log.
