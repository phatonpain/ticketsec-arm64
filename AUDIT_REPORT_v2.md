# TicketSec Arm64 — Phase A Audit Report V2

**Date:** 2026-07-16  
**Auditor:** QA Lead (Kimi Code CLI + Kimi WebBridge)  
**Scope:** `src/App.tsx`, `src/components/*`, `src/hooks/*`, `src/styles/tokens.css`  
**Method:** Live render test at `http://localhost:5174/` (Vite dev, API offline) via browser automation. DevTools evidence: computed styles, bounding rects, screenshots.

---

## Summary

| Severity | Count | Confirmed | Not Reproduced |
|---|---|---|---|
| Critical | 4 | 4 (N-01→N-04) | 0 |
| Major | 4 | 3 (N-06, N-07, N-08) | 1 (N-05) |
| Minor / Polish | 4 | 3 (N-09, N-10, N-11) | 1 (N-12 already correct) |

**Overall:** 10 confirmed findings, 2 not reproduced / already correct.

---

## Evidence Files

| File | What it shows |
|---|---|
| `D:\ticketsec_phaseA_top.png` | Top of dashboard: KPIs, "Checking API…", header, sidebar, Threat chart (top), Model Health donut. |
| `D:\ticketsec_phaseA_perfchart.png` | Performance line chart with dark series + header bleed-through + System Monitor + empty table. |
| `D:\ticketsec_phaseA_table.png` | Empty classification table with "API Offline — Displaying cached data" badge + active pagination + Event Log. |
| `D:\ticketsec_phaseA_donut.png` | Model Health donut with confusing duplicate-value labels + visible Threat chart colors. |

---

## Findings

| ID | Severity | Status | Root Cause (file:line) | Evidence | Planned Fix |
|---|---|---|---|---|---|
| **N-01** | Critical | **NOT REPRODUCED** | `KpiCard.tsx` tooltip is rendered conditionally (`showTooltip` state) and only inserted into the DOM on hover/focus. At load, no tooltip element exists and no overlapping text is visible over the page title. | DOM query for `[role="tooltip"]` or text containing "Latency data comes from" returned `[]`. Screenshot `ticketsec_phaseA_top.png`: page title area is clean. | No fix required for permanent visibility. Ensure hover/focus behavior stays bounded to the card in Phase B. |
| **N-02** | Critical | **CONFIRMED** | `PerformanceLineChart.tsx:91-110` maps series colors to semantic tokens (`var(--text-muted)`, `var(--accent-cyan)`, `var(--accent-violet)`). The cyan/violet tokens resolve to dark values against the `#1E293B` card background, making the lines nearly black. | Screenshot `ticketsec_phaseA_perfchart.png`: only faint dark shapes are visible for Baseline/ONNX/INT8 lines; legend is readable but line colors do not contrast. | Define dedicated chart-series tokens in `tokens.css` (`--chart-series-baseline`, `--chart-series-onnx`, `--chart-series-int8`) with explicit light hex values and bind ECharts to them. |
| **N-03** | Critical | **CONFIRMED** | `ClassificationTable.tsx:156-161` renders empty state when `tickets.length === 0`, while `ClassificationTable.tsx:129-140` always shows the "API Offline — Displaying cached data" badge when `status !== 'live'`. There is no offline snapshot to hydrate the store. | Screenshot `ticketsec_phaseA_table.png`: "No classifications yet. Submit a ticket to begin." + "Showing 0 of 0" + "API Offline — Displaying cached data" badge simultaneously. | Create `public/cache/tickets-snapshot.json` with 6 cached tickets. Hydrate `useTickets` from the snapshot when `status !== 'live'`. Change badge to "API Offline — no cached data available" only if snapshot also fails. |
| **N-04** | Critical | **CONFIRMED** | `Header.tsx:68-80` sets `background: 'var(--bg-body)'` but the computed value resolves to `rgba(0, 0, 0, 0)` (token issue or missing base layer) and `isolation: auto`, so the sticky header does not occlude scrolled content. | Computed style from live DOM: `backgroundColor: "rgba(0, 0, 0, 0)"`, `isolation: "auto"`, `position: "sticky"`. Screenshot `ticketsec_phaseA_perfchart.png`: "System Monitor / ARM64 infrastructure resources" and CACHED badge are visible through the header band. | Fix `tokens.css` so `--bg-body` is opaque (`#0B0F19`) or add an opaque solid fallback in `Header.tsx`. Add `isolation: 'isolate'` and keep `zIndex: 90`. Add bottom border/shadow when `scrollY > 0`. |
| **N-05** | Major | **NOT REPRODUCED** | Both `PerformanceLineChart.tsx:59-66` and `ModelHealthDonut.tsx:24-35` legends render fully within the card content box at the tested viewport widths. | Screenshot `ticketsec_phaseA_perfchart.png`: legend reads "Baseline / ONNX Runtime / INT8 Quantized" with no truncation. Screenshot `ticketsec_phaseA_donut.png`: legend reads "ONNX Runtime 8.73MB / INT8 Quantized 8.73MB / Baseline 14.34MB" fully. Tested at innerWidth ≈ 1272 px. | No fix required for clipping. Continue monitoring during Phase E at 1280 px and 1920 px. |
| **N-06** | Major | **CONFIRMED** | `Sidebar.tsx:59-73` uses `position: fixed` with no `overflowY` on the nav region and no scroll container; the user card is pushed below the viewport and inaccessible at 700 px height. | Computed style: `aside.overflowY === "visible"`, `aside.height === 541 px` (full viewport). Screenshot `ticketsec_phaseA_top.png`: only "Dashboard…Model Registry" visible; SYSTEM section and user card are below the fold. | Add `overflowY: 'auto'` to a dedicated nav scroll region inside the sidebar, keep the brand/user card pinned at the bottom outside the scroll region. |
| **N-07** | Major | **CONFIRMED** | `KpiCard.tsx:156-167` detail line lacks `minWidth: 0` and does not truncate gracefully; `App.tsx` passes unsourced dynamic text ("Peak: 8,920") while offline. | Screenshot `ticketsec_phaseA_top.png`: Latency detail reads "ONNX INT8 · Model latency en…" (cut mid-word). Throughput detail shows "Requests / sec · Peak: 8,920" while status is offline. | Add `minWidth: 0`, `overflow: 'hidden'`, `textOverflow: 'ellipsis'`, `whiteSpace: 'nowrap'` and `title={detail}` to the detail line. When `status !== 'live'`, replace dynamic/peak claims with a neutral cache-status detail or `—`. |
| **N-08** | Major | **CONFIRMED** | `SystemMonitor.tsx:92-123` treats CPU/Memory differently from API Latency/Requests. CPU/Memory show sub-caption `"t4g.micro"` instead of the unified offline caption. | Screenshot `ticketsec_phaseA_perfchart.png`: CPU/Memory show value `—` + sub `t4g.micro`; API Latency/Requests show value `—` + sub `"Unavailable — API offline"`. | Make all four tiles render value `—`, sub `"Unavailable — API offline"`, bar width 0, muted fill. Keep static facts (Neoverse N1, 2 vCPUs, t4g.micro, 1GB) as gray labels only. |
| **N-09** | Minor | **CONFIRMED** | `App.tsx` renders `lastSync ? ... : 'Checking API…'` in the page-title row, creating a floating raw status text in the content area. | Screenshot `ticketsec_phaseA_top.png`: "Checking API…" appears at the right side of the page-title row. | Move the probing state into the header status pill: gray spinner + "Checking…" while `lastSync` is null, then Online/Offline/Cached. Remove the loose text from `App.tsx`. |
| **N-10** | Minor | **CONFIRMED** | `ClassificationTable.tsx:216-251` always renders the pagination bar, including when `totalCount === 0`. | Screenshot `ticketsec_phaseA_table.png`: pagination bar shows "Previous / Page 1 / Next" below "Showing 0 of 0". | Hide the entire pagination bar when `totalCount === 0`. Ensure Previous/Next buttons use `disabled` + `aria-disabled` when no prev/next page. |
| **N-11** | Minor | **CONFIRMED** | `ModelHealthDonut.tsx:7-11` labels two equal segments as "ONNX Runtime 8.73MB" and "INT8 Quantized 8.73MB", which is semantically confusing because they represent the same size. | Screenshot `ticketsec_phaseA_donut.png`: donut center "8.73MB", legend lists ONNX Runtime 8.73MB and INT8 Quantized 8.73MB side-by-side. | Relabel to honest segments (e.g., "Model (INT8) 8.73MB", "Baseline (FP32) 14.34MB", "Tokenizer+Config ~0.5MB") or retitle the card to "Model Footprint Comparison". |
| **N-12** | Minor | **ALREADY CORRECT** | `Header.tsx:107-117` renders a 6px colored dot inside the status pill for all states. | Screenshot `ticketsec_phaseA_top.png` / `ticketsec_phaseA_perfchart.png`: red dot visible in "System Offline" pill. | No fix required. |

---

## Cross-Cutting Observations

1. **Header opacity bug is the most severe visual regression.** The sticky header is fully transparent (`rgba(0,0,0,0)`), causing every scrolled card to paint through it. This is likely a token resolution problem rather than an intentional design choice.
2. **Performance chart color regression** stems from binding ECharts to semantic tokens that were not designed for data-series contrast. A dedicated chart-series token layer is required.
3. **Empty cached table** makes the offline demo look broken. An honest labeled snapshot (cache data) is required per the prompt's hard rules.
4. **EventLog duplication** (duplicate "Health probe started" / "Dashboard initialized" lines) was observed but is not a listed finding; it is consistent with React Strict Mode double-mount and should be considered during Phase B if it affects the audit narrative.

---

## Phase B Engineering Plan

1. **N-04** — Fix header opaque background (`--bg-body` token or solid fallback) + `isolation: isolate` + scroll shadow.
2. **N-02** — Add chart-series tokens and re-bind `PerformanceLineChart` colors.
3. **N-03** — Create `public/cache/tickets-snapshot.json` and hydrate `useTickets` on offline load.
4. **N-06** — Refactor sidebar into scrollable nav region + pinned footer user card.
5. **N-07** — Harden KPI detail truncation and remove unsourced offline details.
6. **N-08** — Unify System Monitor offline captions across all four tiles.
7. **N-09** — Move "Checking API…" into the header status pill.
8. **N-10** — Hide pagination bar at zero rows and harden disabled states.
9. **N-11** — Re-label donut chart segments honestly.
10. **Regression guard** — re-run build/lint and capture before/after screenshots for N-02, N-03, N-04, N-06.
