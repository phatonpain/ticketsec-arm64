# HANDOFF — Phase 1 (Design & UX) → Phase 2 (Frontend Engineering)

Date: 2026-07-19
Branch: `mission/v4`
Baseline tag: `baseline-v4` → `3bc1561`
Phase 1 commit: `9f39f67`

## Done (file:line)

### DESIGN_BRIEF §4 anatomy verification
- Dashboard, Detections, Threat Analytics, System Health, Model Registry, and Live Predictions views were verified against `M8_VISUAL_DELIVERABLES.md` and the m8 side-by-side screenshots at `screenshots/m8/sidebyside-*.png`.
- No re-design was required; only residual token/a11y/data-honesty fixes were applied.

### Residual Phase 1 fixes

1. **TimelineChart honest empty state** (`src/components/TimelineChart.tsx`)
   - Initial fix: returned `EmptyState` when `tickets.length === 0`.
   - **Visual-verification bounce-back:** a single-day series still drew naked axes (x "Jul 18", y 0-6) because a symbol-less line chart with one point has zero visible points. Updated the condition to treat a single-day/zero-point series as empty and switched to the standard `EmptyState` copy used by `ThreatBarChart`: "Collecting live detections — Submit a ticket on Live Predictions to populate this chart."
   - Added component-level coverage for zero-ticket, single-day, and multi-day cases in `tests/components/TimelineChart.test.tsx`.

2. **ModelHealthDonut artifact wiring** (`src/components/ModelHealthDonut.tsx`, `src/lib/artifacts.ts`)
   - Donut now reads `modelMeta.sizeMb` / `memoryMaxMb` from `src/lib/artifacts.ts` instead of hard-coding the footprint.
   - Center label shows only the model size (`0.38 MB`); headroom detail was moved to the legend so the graphic stays readable.

3. **Confusion matrix cell values** (`src/components/ModelRegistry.tsx`, `src/lib/echarts.ts`)
   - Registered `HeatmapChart` (plus `LegacyGridContainLabel`) in `src/lib/echarts.ts`.
   - Matrix now renders per-cell counts with a dynamic visual-map range built from `chartColors` tokens.

4. **Token purity cleanup** (`src/lib/chartTokens.ts`, `src/components/ModelRegistry.tsx`)
   - Added `indigoStrongHover` to the sanctioned ECharts color mirror and removed the raw `#4338CA` hex from the confusion-matrix visual map.

5. **Lint hygiene** (`tests/flows/offline-silence.test.tsx`)
   - Removed unused `fetchMock` variable/import flagged by `oxlint` so the codebase now passes lint with **0 warnings**.

### Command palette completeness (`src/components/CommandPalette.tsx`)
- Added `Classify ticket` action that navigates to Live Predictions and focuses the textarea.
- Added density toggle action (`Switch to compact density` / `Switch to comfortable density`).
- Added reduced-motion toggle action (`Disable animations` / `Enable animations`).
- Palette already had: all six views, Export CSV, Refresh data, Test connection, Open Settings, Open shortcuts help.
- Verified `role="dialog"`, `aria-modal="true"`, focus trap on Tab, Esc close, and arrow/Enter navigation.

### Token purity sweep
- Removed all `var(--token, fallback)` fallback values across `src/**/*.{ts,tsx,css}`.
- Replaced raw hex default in `src/components/Sparkline.tsx` with `chartColors.int8`.
- Added `indigoStrongHover` to `src/lib/chartTokens.ts` and replaced raw hex heatmap colors in `src/components/ModelRegistry.tsx`.
- Confirmed zero raw `#fff` / `rgba(0,0,0,...)` literals remain in components; only `tokens.css` and the sanctioned `chartTokens.ts` mirror contain hex values.

### Phase 1 screenshots
- Captured at 1348 px content width from `http://localhost:5173` using `scripts/screenshot_p1_selenium.mjs` (selenium-webdriver + ChromeDriver).
- Outputs: `screenshots/p1/*.png` (dashboard, detections, predictions, threat-analytics, model-registry, system-health, command-palette, command-palette-density, settings-drawer).
- `screenshots/p1/` and the screenshot scripts are gitignored to avoid bloating the repo; they are reproducible artifacts.

### Rubric
- `audit/RUBRIC_P1.md` — DESIGN_BRIEF §5 10-criterion self-grade, average **9.24 / 10**, all criteria ≥ 9.

## Gate status

- `npm run lint` → **0 warnings, 0 errors**
- `npm run build` → 0 errors; main chunk **309.75 kB** / gzip 90.06 kB (< 600 kB)
- `npx vitest run` → **173/173 passed**
- `bash scripts/gates.sh` → **11/11 PASS** at `2026-07-19 21:09:41Z` (recorded in `TEST_RESULTS_v4.md`)
  - G1 build + chunk budget, G2 lint, G3 vitest, G4 axe (5 routes), G6 secrets scan, G8 tree clean

## Open items for Phase 2 / later phases

- Backend live reachability and deploy-path alignment (`ops/deploy.sh` vs `ops/ticketsec.service`) — SRE/DevOps owner.
- Commit `model/artifact.onnx` and run `model/eval.py` to replace PENDING eval artifacts — ML engineer owner.
- Probe-suite and `model_load_s` latency measurement on live t4g.micro — ML engineer owner.
- `A11Y_REPORT.md` and `PERF_BUDGET.md` if required by judging criteria — a11y / performance owners.
- Demo video and final Orchestrator sign-off — tech-writer / QA owner.

## Warnings for next phase

- `scripts/gates.sh` assumes the Vite dev server is running on `localhost:5173` for G4 axe checks.
- Screenshot generation depends on the pinned Chrome + ChromeDriver paths in `scripts/screenshot_p1_selenium.mjs`.
- The token-fallback removal touched many files; if a future patch needs a fallback for a missing token, prefer adding the token to `src/styles/tokens.css` instead of reintroducing inline fallbacks.
- ECharts lazy chunk is ~613 kB (above the default Vite warning limit) but is code-split and does not affect the main-chunk budget.

## Context notes for compaction

- Preserve: `audit/STATE_MAP_v4.md`, `audit/RUBRIC_P1.md`, this HANDOFF, `TEST_RESULTS_v4.md`, Honesty Contract.
- The latest green commit before Phase 2 work is `9f39f67`.
- Verified 1366 px screenshot: `screenshots/p1/threat-analytics.png` shows the standard `EmptyState` in the "Detections Over Time" panel instead of naked axes.
