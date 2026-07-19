# TicketSec Arm64 — Phase 1 QA Audit Report

**Date:** 2026-07-16  
**Auditor:** QA Analyst (Kimi Code CLI)  
**Scope:** `src/App.tsx`, `src/components/*`, `src/hooks/*`, `src/styles/tokens.css`  
**Method:** Static code review + live render test at `http://127.0.0.1:4173/` (production build) via browser automation. API backend `http://3.23.60.61:8000` confirmed unreachable.

---

## Summary

| Severity | Count | Confirmed | To Verify / Not Reproduced |
|---|---|---|---|
| Critical | 6 | 5 (F-01..F-03, F-05, F-06) + 1 infra (F-04) | 0 |
| Major | 5 | 5 (F-07..F-11) | 0 |
| Minor | 5 | 3 (F-12, F-13, F-10) | 2 not reproduced (F-14, F-15) |
| Verify | 2 | — | F-16 partially confirmed (dot OK, legend OK) |

**Overall:** 13 confirmed findings, 3 not reproduced / already correct.

---

## Findings

| ID | Severity | Status | Root Cause | Evidence | Planned Fix |
|---|---|---|---|---|---|
| **F-01** | Critical | **CONFIRMED** | `EventLog.tsx` lines 22-36 contain a `setInterval` that synthesizes fake `Inference completed`, `WARN`, and `ERROR` entries every 3.5s. `INITIAL_LOGS` (lines 4-13) also seeds fabricated inference lines. | Live DOM: new log lines appear while header shows **System Offline**; source contains `addLog('INFO', \`Inference completed — ticket TKT-${Math.floor(...)}\`)`. | Delete autonomous log generator. Log only real events: mount, health transitions, user classification submit, API success/failure. |
| **F-02** | Critical | **CONFIRMED** | `SystemMonitor.tsx` lines 20-43 run a `setInterval` that invents CPU %, memory %, latency ms, and requests/min with `Math.random()`. It is not connected to `useApi` or any endpoint. | Screenshot shows 70% CPU / 389,733 req/min with a **LIVE** badge while API is offline. | Remove simulator. When `status !== 'live'`, render `—` for dynamic metrics and static labels for hardware facts (2 vCPUs, t4g.micro). |
| **F-03** | Critical | **CONFIRMED** | `App.tsx` lines 86-133 pass hardcoded KPI values (`0.16ms`, `6,384`, `100%`, `8.73MB`) as props with no provenance badge. The component has no access to API status. | KPIs render with trend badges (`-12%`, `+8%`) while Threat chart shows **CACHED**; inconsistent honesty. | Make `KpiCard`/`App` consume `useApi` status. Latency/Throughput show `—` + CACHED badge when offline; Accuracy/Footprint get a gray MODEL CARD chip. |
| **F-04** | Critical | **CONFIRMED (infra)** | External TCP probe to `3.23.60.61:8000` times out; port 22 (SSH) and 3000 (Grafana) are open. | `nc 3.23.60.61 8000` → timeout ×3; dashboard header flips to System Offline. | Frontend cannot fix. DevOps runbook must open SG inbound TCP 8000 and ensure uvicorn binds `--host 0.0.0.0`. |
| **F-05** | Critical | **CONFIRMED** | `ClassificationTable.tsx` line 110 hardcodes subtitle `"Live API predictions"`; `App.tsx` line 44 hardcodes `"Real-time ML ticket classification…"`. Neither is bound to API status. | Screenshot shows "Live API predictions" subtitle together with red "API Offline — Displaying cached data" badge. | Bind subtitle to status: "Live API predictions" when live, "Cached predictions — API offline" otherwise. Keep page subtitle as product description. |
| **F-06** | Critical | **CONFIRMED** | `useApi.ts` exposes only `status: { online: boolean }`. Each component invents its own offline logic (`ThreatBarChart`/`PerformanceLineChart` local `offline`, `SystemMonitor` local `cached`, KPIs none). | Charts show CACHED; KPIs do not; monitor toggles LIVE/CACHED independently; no unified `live \| cached \| offline` state. | Refactor `useApi` to return `status: 'live' \| 'cached' \| 'offline'` and `lastSync`. All components consume this single source of truth. |
| **F-07** | Major | **CONFIRMED** | `ClassificationTable.tsx` lines 51-69 sorts by formatted relative strings (`"2m ago"`, `"8m ago"`) via `localeCompare`. Default `time` desc produces order: 8469(8m), 8470(5m), 8471(2m), 8466(24m), 8467(18m). | Live DOM evaluation returned exactly that non-chronological order. | Store epoch `createdAt` on tickets; format to relative for display; sort on numeric timestamp. Default newest-first, cycle desc→asc. |
| **F-08** | Major | **CONFIRMED** | Mock data in `ClassificationTable.tsx` lines 5-12 mixes descending IDs with non-monotonic times (8471=2m, 8469=8m). `EventLog` simulator uses random IDs unrelated to the table. | IDs 8466-8471 do not map to consistent time order; logs reference TKT-6514, TKT-9423, etc. | Create one `useTickets` store with monotonically increasing IDs and strictly decreasing `createdAt`. Table and EventLog read from it. |
| **F-09** | Major | **CONFIRMED** | `App.tsx` line 32 applies `paddingTop: 16` to `<main>`, which contains the sticky `Header`. When content scrolls, a 16px ghost strip shows above the header. | Rendered DOM: `<main style="padding-top:16px">` wraps `<header style="position:sticky;top:0">`. | Remove `paddingTop` from `<main>`; apply top padding to the content container below the header. |
| **F-10** | Major | **CONFIRMED** | `EventLog.tsx` lines 86-90 use long em-dash format and `whiteSpace: 'nowrap'` (line 81), causing tokens to clip (e.g., "Unauthorize", "False Posit", "— 0"). | Previous screenshots show log lines truncated mid-token; container has `overflowX: auto` but UX forces scrolling. | Compact format `[HH:MM:SS] LEVEL message` at 11px, single spaces, `title` attr with full message; keep `overflowX: auto` as safety net. |
| **F-11** | Major | **CONFIRMED** | `App.tsx` lines 47-81 duplicates "Last 24 hours" dropdown and "Refresh" button that already exist in `Header.tsx` (lines 136-154 and 120-134). | Screenshot shows both header controls and page-title-row controls simultaneously. | Delete the duplicate controls from the page-title row in `App.tsx`; keep only the functional header controls. |
| **F-12** | Minor | **CONFIRMED** | `App.tsx` line 130 detail text `"ONNX quantized | Baseline: 14.34MB"` is truncated to `"ONNX quantized | Baseline: 14…"` at card width. | Screenshot shows ellipsis on the last KPI card. | Shorten to `"ONNX INT8 · Baseline 14.3MB"`; add `title` tooltip; keep single line. |
| **F-13** | Minor | **CONFIRMED** | `LivePrediction.tsx` line 81 placeholder `"Paste ticket subject or body here… (Ctrl+Enter to submit)"` is clipped in the textarea. | Screenshot placeholder reads `"Paste ticket subject or body here… (Ctrl+Enter to"`. | Change placeholder to `"Paste ticket subject or body here…"`; add 11px hint line below textarea: `"Ctrl+Enter to submit"`. |
| **F-14** | Minor | **NOT REPRODUCED** | No element overflows the viewport at 1272px width; `document.documentElement.scrollWidth === window.innerWidth` (1272). | Live evaluation returned equal widths. | No fix needed; may add `overflow-x: hidden` on body as final safety net if desired. |
| **F-15** | Minor | **NOT REPRODUCED** | No stray text node or period after the category badge in the rendered DOM. | Evaluated first row category cell: text content exactly `"Unauthorized Access"`, no trailing punctuation. | No fix needed. |
| **F-16** | Minor | **PARTIALLY CONFIRMED / FIXED** | Status dot renders (6×6px) in both online and offline states (Header.tsx lines 106-116). PerformanceLineChart legend is fully visible and not clipped. | Screenshot confirms green dot and complete legend "Baseline / ONNX Runtime / INT8 Quantized". | No fix needed for dot/legend; accessibility pass in Phase 2 should add `aria-label` to icon-only buttons. |

---

## Cross-Cutting Root Cause

The most severe pattern is **data fabrication without disclosure**: three independent simulators (`EventLog`, `SystemMonitor`, performance history) generate plausible-looking numbers and activity while the API is offline. The codebase lacks a unified `ApiStatus` enum, so each component independently decides whether to label data as live, cached, or simulated. For a hackathon judged by engineers, any fabricated metric presented as live is a disqualifying integrity risk.

---

## Phase 2 Engineering Plan

1. **useApi.ts** — introduce `ApiStatus = 'live' | 'cached' | 'offline'`, expose `lastSync`, derive status from probe result + cache availability. Read base URL from `import.meta.env.VITE_API_BASE_URL`.
2. **useTickets.ts (new)** — single source for classification rows: monotonic IDs, epoch `createdAt`, shared between table and log.
3. **EventLog.tsx / useEventLog.ts** — remove simulator; log only real events via global `useSyncExternalStore` store.
4. **SystemMonitor.tsx** — remove simulator; render `—` + "Unavailable — API offline" when not live; keep static hardware facts.
5. **KpiCard.tsx / App.tsx** — status-aware badges: CACHED amber for dynamic KPIs, gray MODEL CARD for static facts; remove duplicate page-title controls.
6. **ClassificationTable.tsx** — real timestamp sorting, status-bound subtitle, verify no stray period.
7. **App.tsx** — fix ghost strip padding; ensure all grids use `minmax(0, Xfr)`.
8. **LivePrediction.tsx** — shorten placeholder, add hint line.
9. **Accessibility** — `aria-label` on icon buttons, `<button>` for sidebar nav items, `aria-sort` on table headers, focus-visible ring preserved, reduced-motion support.
10. **tokens.css** — add any missing semantic tokens; keep hex values unchanged unless contrast fails.

---

## Files Expected to Change in Phase 2

- `src/hooks/useApi.ts`
- `src/hooks/useEventLog.ts`
- `src/hooks/useTickets.ts` (new)
- `src/components/EventLog.tsx`
- `src/components/SystemMonitor.tsx`
- `src/components/KpiCard.tsx`
- `src/components/ClassificationTable.tsx`
- `src/components/Header.tsx`
- `src/components/Sidebar.tsx`
- `src/components/LivePrediction.tsx`
- `src/components/PerformanceLineChart.tsx`
- `src/App.tsx`
- `src/styles/tokens.css`
- `.env.example` (new)
