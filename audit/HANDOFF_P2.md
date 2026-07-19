# HANDOFF — Phase 2 (Frontend Engineering) → Phase 3 / Close-out

Date: 2026-07-19
Branch: `mission/v4`
Baseline tag: `baseline-v4` → `3bc1561`
Phase 2 final commit: `bc7d948`

## Done

### 1. Scratch-file quarantine & deletion (B4 policy)

- Created `audit/PHASE2_SCRATCH_DELETE_PROPOSED.md` listing all root-level scratch/output candidates.
- Deleted **27 tracked files**:
  - 19 `test_*.txt` old test-run listings
  - 6 `tmp_*.py` temporary scripts
  - 1 `test_debug.log`
  - 1 `test_results.json`
- `vite-dev.log` remains at the repo root only because the running Vite dev server holds the file open; it is already covered by `*.log` in `.gitignore` and will not be re-committed.
- `ops/logs/verification.log` was intentionally preserved (live-endpoint verification evidence, not a scratch file).

### 2. Per-view error boundaries (AGENTS.md convention)

- New component: `src/components/ErrorBoundary.tsx`
  - Class-based boundary with `getDerivedStateFromError` and `componentDidCatch`.
  - Renders an accessible fallback card (`role="alert"`, `aria-live="assertive"`) with a "Try again" reset button.
  - Styled entirely with `tokens.css` variables.
- Wrapped each view root:
  - `src/components/Dashboard.tsx` — Dashboard
  - `src/components/Views.tsx` — DetectionsView, PredictionsView, ThreatAnalyticsView, ModelRegistryView, SystemHealthView
- Added coverage in `tests/components/ErrorBoundary.test.tsx`.

### 3. Logic-checklist residual verification

| Check | Status | Evidence |
|---|---|---|
| `getSnapshot` immutability | ✅ | `useTickets` returns `store.tickets` which is replaced on every mutation (`seedTickets`, `addTicket`, `updateStatus`). `useApi` and `useEventLog` replace their module-level `state` objects on every `setState`/mutation. |
| Subscription leak prevention | ✅ | All external stores use `useSyncExternalStore` with a cleanup-returning `subscribe`. `useApi` probe timers and `AbortController` are cleared on unmount/race. App no longer subscribes to the Event Log store (see below). |
| Chart memoization | ✅ | All chart option objects are built inside `useMemo` (`ThreatBarChart`, `TimelineChart`, `SeverityMixDonut`, `ModelHealthDonut`, `ThreatDistributionDonut`, `PerformanceLineChart`). ECharts component is lazy-loaded. |
| Pagination clamp | ✅ | `src/lib/paginate.ts` clamps `page` to `[1, pageCount]` and returns safe `from`/`to`. `ClassificationTable` resets `page` to 1 on `tickets.length` / query / range / filter changes and syncs state if the clamp result differs. |

### 4. Performance verification

- **Main chunk**: `index-*.js` = **311.71 kB** / gzip 90.87 kB (< 600 kB guard).
- **ECharts lazy chunk**: **613.71 kB** / gzip 207.12 kB, code-split and loaded on demand; not part of the main-chunk budget.
- **EventLog isolation**: `App.tsx` now imports `useEventLogActions()` instead of `useEventLog()`. The hook returns stable writer functions without subscribing to the log store, so every log append no longer re-renders the root `App` (and therefore no longer re-renders charts). Verified by `tests/hooks/useEventLogActions.test.ts`.

## Gate status

- `npm run lint` → **0 warnings, 0 errors**
- `npm run build` → 0 errors; main chunk **311.71 kB** / gzip 90.87 kB (< 600 kB)
- `npx vitest run` → **178/178 passed** (28 files)
- `bash scripts/gates.sh` → **11/11 PASS** at `2026-07-19 21:35:39Z` (recorded in `TEST_RESULTS_v4.md`)
  - G1 build + chunk budget, G2 lint, G3 vitest, G4 axe (5 routes), G6 secrets scan, G8 tree clean

## Open items for later phases

- Backend live reachability and deploy-path alignment (`ops/deploy.sh` vs `ops/ticketsec.service`) — SRE/DevOps owner.
- Commit `model/artifact.onnx` and run `model/eval.py` to replace PENDING eval artifacts — ML engineer owner.
- Probe-suite and `model_load_s` latency measurement on live t4g.micro — ML engineer owner.
- `A11Y_REPORT.md` and `PERF_BUDGET.md` if required by judging criteria — a11y / performance owners.
- Demo video and final Orchestrator sign-off — tech-writer / QA owner.

## Warnings for next phase

- `scripts/gates.sh` assumes the Vite dev server is running on `localhost:5173` for G4 axe checks.
- Error boundaries reset the local view but cannot recover from persistent runtime errors in the wrapped component; log errors via `componentDidCatch` when telemetry is added.
- The Event Log store is still subscribed to by `Header` (badge count) and `EventLog` panel; those components correctly re-render on new entries.
- ECharts lazy chunk remains above Vite's default 500 kB warning limit but is code-split and does not affect the main-chunk budget.

## Context notes for compaction

- Preserve: `audit/STATE_MAP_v4.md`, `audit/HANDOFF_P1.md`, this HANDOFF, `TEST_RESULTS_v4.md`, `audit/PHASE2_SCRATCH_DELETE_PROPOSED.md`, Honesty Contract.
- The latest green commit before any Phase 3 work is `bc7d948`.
