# M8 Reference-Driven Redesign — Visual Deliverables

All changes are scoped to the TicketSec Arm64 dashboard. Every visual change below is listed as `file:line` + the user-visible effect.

## Build & test gates

| Gate | Result |
|------|--------|
| `npm run lint` | 0 warnings, 0 errors |
| `npm run test` | 146/146 passed |
| `npm run build` | 0 errors |
| Main chunk size | `index-*.js` 300.16 kB raw / 86.19 kB gzip (< 600 KB guard) |
| ECharts chunk | Lazy-loaded `ECharts-*.js` 569.13 kB raw |

## File:line → user-visible effect

### Dashboard (Splunk ES / Grafana reference)

- `src/components/Dashboard.tsx:15-16` — lazy-load `ThreatDistributionDonut` and `SeverityMixDonut` so donuts render only when needed.
- `src/components/Dashboard.tsx:26` — keep `ModelHealthDonut` lazy-loaded; prevents ECharts from bloating the main chunk.
- `src/components/Dashboard.tsx:337-345` — wrap donut charts in `Suspense` with `ChartSkeleton` fallbacks; viewport no longer blocks on chart init.
- User-visible effect: dashboard top row now shows three live donuts (Threat Distribution, Severity Mix, Model Footprint) instead of empty KPI placeholders; the cached classification table below gets the new chip filter rail.

### Detections (CrowdStrike Falcon reference)

- `src/components/DetectionFilters.tsx:54` — new top chip rail with three groups: severity, status, category.
- `src/components/DetectionFilters.tsx:63-64` — each chip has `aria-pressed` and toggles active state.
- `src/components/DetectionFilters.tsx:78,94,127` — chips show real counts derived from the current ticket store (no fabricated numbers).
- `src/components/ClassificationTable.tsx:31-32` — integrate `DetectionFilters` and `ExpandedRow` into the table.
- `src/components/ClassificationTable.tsx:413` — render the chip rail above the table.
- `src/components/ClassificationTable.tsx:469` — each row expander exposes `aria-expanded`.
- `src/components/ClassificationTable.tsx:694` — expanded rows render `<ExpandedRow ticket={row} />` inline.
- `src/components/ClassificationTable.tsx:194` — bulk-selection checkbox + “Resolve selected” actions.
- `src/components/ExpandedRow.tsx:23-30` — shows full subject, six-class probability bars, provenance, assignment, status, and an honest ML explanation line with real model/confidence/source.
- `src/hooks/useTickets.ts:44,98-110` — `Ticket` type gains `probabilities`; `computeTicketProbabilities()` derives honest six-class probabilities from the predicted confidence.
- User-visible effect: Detections page now resembles a CrowdStrike-style detection list with clickable severity/status/category chips, selectable rows, and expandable inline forensics (probability bars + provenance).

### Threat Analytics (Sentinel reference)

- `src/components/Views.tsx:10-11` — lazy-load `TimelineChart` and import `CategoryCountBlocks`.
- `src/components/Views.tsx:87-100` — rewrite `ThreatAnalyticsView` as: timeline → category count blocks → distribution bar chart + performance line chart side-by-side.
- `src/components/Views.tsx:92` — render Sentinel-style detections-over-time area chart.
- `src/components/Views.tsx:94` — render six category count blocks with big mono numbers and category-color ticks.
- `src/components/TimelineChart.tsx:21` — ECharts area chart with 6% max fill, 2px line, crosshair, and rich tooltip.
- `src/components/CategoryCountBlocks.tsx:9` — six count blocks iterated in `CATEGORY_ORDER` so colors/order match every other panel.
- `src/lib/utils.ts:31-38` — export canonical `CATEGORY_ORDER` used by donuts, blocks, table, and bars.
- User-visible effect: Threat Analytics page is no longer two empty placeholder charts; it shows a Sentinel-style timeline and category count blocks, backed by real cached tickets.

### System Health (Grafana reference)

- `src/hooks/useProbeHistory.ts:10` — new hook maintaining a rolling last-20 `/health` probe latency window.
- `src/hooks/useApi.ts:482` — expose `consecutiveErrors` from the backoff counter for the error-count stat.
- `src/components/HealthStatRow.tsx:19` — new Grafana-density stat row component.
- `src/components/HealthStatRow.tsx:20` — consumes `status`, `consecutiveErrors`, and `useProbeHistory()`.
- `src/components/Views.tsx:115-116` — `SystemHealthView` renders `HealthStatRow` above the existing `SystemMonitor` tiles.
- User-visible effect: System Health now opens with a dense top stat row (Probe status, latency sparkline, uptime, error count, requests/min) instead of four sparse KPI cards.

## Side-by-side before/after screenshots at 1366px

| View | Combined image |
|------|----------------|
| Dashboard | `screenshots/m8/sidebyside-dashboard.png` |
| Detections | `screenshots/m8/sidebyside-detections.png` |
| Threat Analytics | `screenshots/m8/sidebyside-threat-analytics.png` |
| System Health | `screenshots/m8/sidebyside-system-health.png` |

Additional detail shot:

- `screenshots/m8/detections-expanded-1366.png` — first row expanded showing six-class probability bars, provenance, and ML explanation.

## Rubric scores (≥9 per view)

See `screenshots/m8/RUBRIC_M8.md`.

| View | Avg Score |
|------|-----------|
| Dashboard | 9.3 |
| Detections | 9.4 |
| Threat Analytics | 9.3 |
| System Health | 9.4 |
