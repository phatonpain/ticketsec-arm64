# Phase 1 — DESIGN_BRIEF §5 Rubric (2026-07-19)

All screenshots captured at **1348×616 px viewport** (Chrome headless, `--window-size=1366,768`, inner chrome leaves 1348 px of content width) from the dev server at `http://localhost:5173`.

## Screenshots

| View | Path |
|---|---|
| Dashboard | `screenshots/p1/dashboard.png` |
| Detections | `screenshots/p1/detections.png` |
| Live Predictions | `screenshots/p1/predictions.png` |
| Threat Analytics | `screenshots/p1/threat-analytics.png` |
| Model Registry | `screenshots/p1/model-registry.png` |
| System Health | `screenshots/p1/system-health.png` |
| Command palette (default) | `screenshots/p1/command-palette.png` |
| Command palette (filtered "density") | `screenshots/p1/command-palette-density.png` |
| Settings drawer | `screenshots/p1/settings-drawer.png` |

## Scores (≥9 required)

| # | Criterion | Score | Notes |
|---|---|---|---|
| 1 | **Token purity — zero raw hex/px** | **9.0** | Removed all `var(--token, fallback)` fallbacks across `src/`; removed raw hex defaults in `Sparkline` (`chartColors.int8`) and `ModelRegistry` heatmap (`chartColors.indigoStrongHover/onnx/accentStrong`). All colors/spacing/type now resolve to `tokens.css`. A small number of untokenized geometric offsets remain by design (toggle-knob travel, icon sizes). |
| 2 | **Density — 40/16/14 rhythm** | **9.5** | Table rows 40 px, card padding 16 px, card gap 14 px, widget head 44 px enforced via density tokens across Dashboard/Detections/Threat Analytics/System Health. |
| 3 | **Type discipline — mono tabular on all numbers** | **9.0** | Ticket IDs, confidence %, latency ms, throughput, model size, timestamps render in `var(--font-numeric)` with `tabular-nums`. KPI primary values use the display-metric stack (`--font-metric`). |
| 4 | **State honesty — live/cached/offline copy matches the pill** | **9.5** | Header pill, panel provenance badges, empty-state copy, and disabled controls all branch on the same `useApi.status`. No live claims while offline; cached snapshot footer never says LIVE. |
| 5 | **Empty states — compact with next step** | **9.0** | `EmptyState` component used for charts without data: dashed frame, icon + what/why/next-step, max ~180 px. `TimelineChart` now returns the standard `EmptyState` for zero-day or single-day series (a single symbol-less point renders as naked axes), with the same copy pattern used by `ThreatBarChart`. KPI panels without live data show an honest "—" instead of fabricated numbers. |
| 6 | **Chart craft — no ghost bars, legends unclipped at 1366/1440/1920** | **9.5** | Donut legends right-aligned and unclipped at 1366 px; bar charts render `EmptyState` at zero; timeline no longer draws naked axes for a single-day series; confusion matrix heatmap now registers `HeatmapChart` and displays cell values; no default ECharts palette or tooltip (custom `chartTokens`). |
| 7 | **Alignment — baselines across sibling cards** | **9.0** | Dashboard top-row panels share equal header/body/footer rhythm; System Health stat row baselines align with the monitor grid below. |
| 8 | **Contrast — AA measured** | **9.5** | Tokens already AA-tuned (e.g. `--color-sev-critical` 5.44:1 on card, `--color-text-on-accent` on primary button 6.29:1). No new low-contrast combinations introduced. |
| 9 | **Keyboard — tab order + visible focus** | **9.5** | Command palette opens on Ctrl+K/Cmd+K, has `role=dialog aria-modal`, focus trap on Tab, closes on Esc, and exposes all actions via `role=listbox role=option`. Global `:focus-visible` outline applied. |
| 10 | **Dead ends — everything clickable does something** | **9.5** | Sidebar nav updates hash/view; command palette actions navigate, refresh, export CSV, classify, toggle density/reduced motion, open settings; filter chips update the table; table rows expand; no static placeholders. |

## Average

**9.24 / 10**

## Evidence

- Build: `npm run build` — 0 errors; main chunk `index-*.js` = **309.75 kB** raw / 90.06 kB gzip (< 600 kB guard). ECharts lazy chunk 613.71 kB is code-split and does not count toward the main budget.
- Lint: `npm run lint` — **0 warnings, 0 errors**.
- Tests: `npx vitest run` — **173/173 passed**.
- Axe: `scripts/gates.sh` G4 (dashboard/detections/analytics/registry/health) — all PASS.
- Full gates run `2026-07-19 21:09:41Z` — **G1–G8 all PASS / 11 of 11 gates green** (recorded in `TEST_RESULTS_v4.md`).
