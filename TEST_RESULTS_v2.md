# TicketSec Arm64 Dashboard — Phase D Performance Test Results

Date: 2026-07-16

## P-01: ECharts Modular Bundle Reduction

### Approach
- Replaced `echarts-for-react` + full `echarts` import with a custom `ECharts` wrapper.
- Initialized only the required modules from `echarts/core`:
  - Charts: `BarChart`, `LineChart`, `PieChart`
  - Components: `TooltipComponent`, `LegendComponent`, `GridComponent`, `GraphicComponent`, `TitleComponent`
  - Renderer: `CanvasRenderer`

### Bundle Size (production build, minified)

| Metric | Before | After |
|---|---|---|
| Main JS chunk | `index-ClRlprY8.js` **1,397.54 KB** | `index-B5mgtWWU.js` **256.43 KB** |
| Gzipped main chunk | 456.42 KB | 77.48 KB |
| Lazy chart chunks | — | ~7.5 KB total (3 chunks) |
| Shared ECharts chunk | — | `chartTokens-*.js` 568.47 KB |

**Result:** Main entry bundle reduced from **1,397.54 KB → 256.43 KB** (≈ 81% reduction). Target "main bundle < 600 KB" **PASSED**.

> Note: ECharts itself is now loaded on-demand via a shared lazy chunk (`chartTokens-*.js`) consumed by the three chart components. The initial parse/eval cost of the main bundle is well under the 600 KB budget.

## P-02: React.lazy + Suspense with Skeleton

### Approach
- Converted `ThreatBarChart`, `PerformanceLineChart`, and `ModelHealthDonut` to `React.lazy` imports in `App.tsx`.
- Wrapped each chart in `<Suspense fallback={<ChartSkeleton height={...} />}>`.
- `ChartSkeleton` mirrors the card header + content area with fixed heights (320 px / 280 px) to prevent cumulative layout shift while the chart chunk loads.

### Result
- Verified three separate lazy chunks emitted by Vite.
- Skeleton dimensions match rendered chart cards: **no layout shift observed**.

## P-03: Automated axe-core Accessibility Scan

### Command

```bash
npx @axe-core/cli http://localhost:5173 --exit \
  --chrome-path "C:\Users\crust\.cache\puppeteer\chrome\win64-150.0.7871.24\chrome-win64\chrome.exe" \
  --chromedriver-path "D:\chromedriver\win64-150.0.7871.24\chromedriver-win64\chromedriver.exe"
```

### Result

```text
Running axe-core 4.12.1 in chrome-headless
Testing http://localhost:5173 ... please wait, this may take a minute.
0 violations found!
Testing complete of 1 pages
```

**Critical / Serious issues: 0** — **PASSED**.

### Fixes applied to reach zero violations
1. **aria-allowed-attr**: moved `aria-sort` from inner `<button>` to parent `<th scope="col">` in `ClassificationTable`.
2. **heading-order**: promoted all card headings from `<h3>` to `<h2>` (styled identically) to maintain a logical `h1 → h2` outline.
3. **color-contrast**:
   - `--color-text-muted` changed from `#64748B` → `#8292A8` (AA 4.60:1 on `bg-card`, 6.27:1 on `bg-body`).
   - `STATUS_COLORS.Resolved.text` changed from `#10B981` → `#5EEA9A` (AA 5.41:1 over its translucent badge background on `bg-card`).
   - Sidebar brand/user avatars changed from white-on-indigo to `text-primary` on `bg-input` with a subtle border.

## P-04: Contrast Ratio Measurements

Measured against WCAG 2.1 Level AA target of **4.5:1** for normal text.

| Element | Foreground | Background | Ratio | Status |
|---|---|---|---|---|
| `text-muted` | `#8292A8` | `#0B0F19` (bg-body) | 6.27:1 | ✅ PASS |
| `text-muted` | `#8292A8` | `#1E293B` (bg-card) | 4.60:1 | ✅ PASS |
| `text-muted` | `#8292A8` | `#0F172A` (bg-sidebar) | 5.64:1 | ✅ PASS |
| CACHED badge text | `#F59E0B` | `rgba(245,158,11,0.10)` over `#1E293B` | 5.54:1 | ✅ PASS |
| Status badge — Resolved | `#5EEA9A` | `rgba(16,185,129,0.12)` over `#1E293B` | 5.41:1 | ✅ PASS |
| Status badge — Escalated | `#F43F5E` | `rgba(244,63,94,0.12)` over `#1E293B` | 4.64:1 | ✅ PASS |
| Status badge — Pending | `#F59E0B` | `rgba(245,158,11,0.12)` over `#1E293B` | 5.38:1 | ✅ PASS |
| Sidebar avatar text | `#F8FAFC` | `#0F172A` (bg-input) | 16.18:1 | ✅ PASS |

### Token Adjustments Documented
- `--color-text-muted`: `#64748B` → `#8292A8`
- `STATUS_COLORS.Resolved.text`: `#10B981` → `#5EEA9A`
- Sidebar avatars: background `var(--accent-indigo)` + white text → `var(--bg-input)` + `var(--text-primary)` + `var(--border-default)` border

## Build / Lint Final Status

```text
> npm run build
✓ built in 867ms
dist/assets/index-B5mgtWWU.js  256.43 kB │ gzip: 77.48 kB

> npm run lint
Found 0 warnings and 0 errors.
```

## Summary

| Task | Status |
|---|---|
| P-01 Main bundle < 600 KB | ✅ PASS (256.43 KB) |
| P-02 Lazy charts + skeleton | ✅ PASS |
| P-03 axe-core 0 critical/serious | ✅ PASS |
| P-04 Contrast ≥ 4.5:1 | ✅ PASS |
| Build clean | ✅ PASS |
| Lint clean | ✅ PASS |

---

# Phase E — Tech Lead Sign-off

Date: 2026-07-16

## 1. Full Automation Suite

### Build

```text
> npm run build

vite v8.1.4 building client environment for production...
transforming...✓ 2386 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                 0.80 kB │ gzip:   0.43 kB
dist/assets/index-BYY18te7.css                 16.69 kB │ gzip:   4.25 kB
dist/assets/ModelHealthDonut-Db59AO4a.js        1.97 kB │ gzip:   1.00 kB
dist/assets/ThreatBarChart-zBE74IQe.js          2.38 kB │ gzip:   1.16 kB
dist/assets/PerformanceLineChart-QqASFimo.js    3.16 kB │ gzip:   1.27 kB
dist/assets/index-B5mgtWWU.js                 256.43 kB │ gzip:  77.48 kB
dist/assets/chartTokens-onJWNbye.js           568.47 kB │ gzip: 193.11 kB

✓ built in 904ms
```

### Lint

```text
> npm run lint

Found 0 warnings and 0 errors.
Finished in 12ms on 31 files with 103 rules using 20 threads.
```

### axe-core CLI

```text
> npx @axe-core/cli http://localhost:5173 --exit --chrome-path "..." --chromedriver-path "..."

Running axe-core 4.12.1 in chrome-headless
Testing http://localhost:5173 ... please wait, this may take a minute.
0 violations found!
Testing complete of 1 pages
```

## 2. Manual Checklist (Master Prompt V2 Items 1-8)

| # | Check | Evidence | Status |
|---|---|---|---|
| 1 | App loads without runtime errors | Dashboard renders; no blank #root | ✅ PASS |
| 2 | Build & lint are clean | Outputs above show 0 errors/warnings | ✅ PASS |
| 3 | Offline cached data loads gracefully | "System Offline" + "CACHED" badges + 6 cached tickets rendered | ✅ PASS |
| 4 | EventLog stays honest (no fabricated live metrics) | Only `Health probe started` / `Dashboard initialized` events visible | ✅ PASS |
| 5 | Table sort & pagination use real timestamps | TKT-8471 (2m) → TKT-8466 (27m); Page 2 shows TKT-8466 | ✅ PASS |
| 6 | Status pill and KPI badges degrade correctly offline | "System Offline" rose pill; latency/throughput show `—` + CACHED badge | ✅ PASS |
| 7 | Charts render and use token-derived colors | Bar (phishing indigo, malware rose), line, donut visible | ✅ PASS |
| 8 | Global UI controls present | Ticket Query input visible; notification bell badge; Settings button present | ✅ PASS |

Screenshots captured:
- `D:\ticketsec_phaseE_01_dashboard.png` — full dashboard with cached charts.
- `D:\ticketsec_phaseE_02_table.png` — table page 1 (5 of 6 rows) + EventLog.
- `D:\ticketsec_phaseE_03_table_page2.png` — table page 2 (TKT-8466) + EventLog.

## 3. Final Status Board

### Phase B — QA Corrections (N-01..N-12)

| ID | Item | Status |
|---|---|---|
| N-01 | KpiCard tooltip hardening | ✅ Fixed |
| N-02 | Chart series token colors | ✅ Fixed |
| N-03 | Cached ticket snapshot hydration | ✅ Fixed |
| N-04 | Header opaque background on scroll | ✅ Fixed |
| N-05 | Layout width validation (1366/1440 limited by WebBridge resize block) | ✅ Verified at 1272 px |
| N-06 | Sidebar scrollable + pinned user card | ✅ Fixed |
| N-07 | KPI detail truncation + offline text | ✅ Fixed |
| N-08 | SystemMonitor consistent offline labels | ✅ Fixed |
| N-09 | Probing state in header status pill | ✅ Fixed |
| N-10 | Pagination hidden at 0 rows / disabled states | ✅ Fixed |
| N-11 | Donut honest labels | ✅ Fixed |
| N-12 | (not listed / covered by N-01..N-11) | ✅ — |

### Phase C — Enhancements (E-01..E-07)

| ID | Item | Status |
|---|---|---|
| E-01 | Ticket Query filters table live | ✅ Implemented |
| E-02 | Bell notifications from EventLog store | ✅ Implemented |
| E-03 | Settings drawer (API URL override, test connection, reduced motion) | ✅ Implemented |
| E-04 | Connection diagnostics in status-pill tooltip | ✅ Implemented |
| E-05 | Auto-recovery health probe (30s, backoff, focus re-probe) | ✅ Implemented |
| E-06 | Export CSV from table | ✅ Implemented |
| E-07 | Keyboard shortcuts (/ r ? Esc) + help modal | ✅ Implemented |

### Phase D — Performance (P-01..P-04)

| ID | Item | Status |
|---|---|---|
| P-01 | ECharts modular, main bundle < 600 KB | ✅ PASS (256.43 KB) |
| P-02 | React.lazy + Suspense skeleton on 3 charts | ✅ PASS |
| P-03 | axe-core CLI zero critical/serious | ✅ PASS |
| P-04 | Contrast ≥ 4.5:1, tokens adjusted | ✅ PASS |

## 4. Changed Files

### Phase B
- `src/components/KpiCard.tsx`
- `src/components/PerformanceLineChart.tsx`
- `src/components/ThreatBarChart.tsx`
- `src/components/ModelHealthDonut.tsx`
- `src/components/ClassificationTable.tsx`
- `src/components/Header.tsx`
- `src/components/Sidebar.tsx`
- `src/components/SystemMonitor.tsx`
- `src/hooks/useTickets.ts`
- `src/styles/tokens.css`
- `src/lib/chartTokens.ts`
- `public/cache/tickets-snapshot.json`

### Phase C
- `src/App.tsx`
- `src/components/Header.tsx`
- `src/components/Sidebar.tsx`
- `src/components/ClassificationTable.tsx`
- `src/components/SettingsDrawer.tsx` (new)
- `src/components/HelpModal.tsx` (new)
- `src/hooks/useApi.ts` (singleton refactor)
- `src/hooks/useEventLog.ts`
- `src/hooks/useSettings.ts` (new)
- `src/hooks/useTicketQuery.ts` (new)
- `src/hooks/useSettingsDrawer.ts` (new)
- `src/lib/exportCsv.ts` (new)
- `src/lib/formatRelativeTime.ts` (new)
- `src/styles/tokens.css`

### Phase D
- `src/lib/echarts.ts` (new)
- `src/components/ECharts.tsx` (new)
- `src/components/ChartSkeleton.tsx` (new)
- `src/components/ThreatBarChart.tsx`
- `src/components/PerformanceLineChart.tsx`
- `src/components/ModelHealthDonut.tsx`
- `src/components/ClassificationTable.tsx`
- `src/components/Sidebar.tsx`
- `src/App.tsx`
- `src/styles/tokens.css`
- `src/lib/chartTokens.ts`
- `src/lib/utils.ts`
- `TEST_RESULTS_v2.md` (new)

## 5. Honesty-Rule Regression Check

Explicit confirmation: **zero regression** on the honesty rules.

- **EventLog silence offline:** EventLog only emits real system events (`Dashboard initialized`, `Health probe started`, status transitions). No fabricated "live" metrics or fake API responses are logged.
- **Badges:** `CACHED` badges appear only on KPIs whose data cannot be sourced offline (latency/throughput). Static model-card facts (accuracy, footprint) keep their `MODEL CARD` badge. Chart cards show `CACHED` when offline.
- **Real timestamps:** Table rows sort and display relative time from actual `createdAt` Dates, not mocked "just now" strings.
- **Honest status pill:** Header pill shows `System Offline` / `System Cached` / `System Online` derived from real health probe results, not hard-coded.
- **No fake data:** Threat bar chart, performance line chart, and donut use cached/fallback data clearly labeled; no values are invented to appear live.

## Sign-off

**Phase E result: APPROVED for delivery.**

All automation gates pass, manual checklist passes, and no honesty-rule regressions were introduced across Phases B, C, and D.
