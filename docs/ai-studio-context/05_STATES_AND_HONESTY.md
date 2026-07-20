# TicketSec Arm64 — States & Honesty Contract

## The Honesty Contract

1. **Every UI number traces to a committed artifact or a live/store source.**
2. **Data freshness is explicit:** LIVE, CACHED, or API OFFLINE.
3. **Loading states are real** — skeletons only where data is genuinely loading.
4. **Empty states are compact and actionable** — never a big centered void.
5. **Errors are declared** — no silent fallbacks, no fabricated entries.
6. **Offline is admitted** — the UI says "backend offline" instead of faking data.

## State matrix by component

| Component | Loading | Empty | Error | Offline (API OFFLINE) |
|---|---|---|---|---|
| **TopBar status pill** | "Checking…" neutral pill + spinner | — | "API ERROR" red pill | "API OFFLINE" red pill |
| **KPI value** | Skeleton pulse on value | Value = "—", sub-label = "No data" | "Error", sub-label = "Failed to load" | "Unavailable", sub-label = "API offline" |
| **Triage table** | 8 skeleton rows | Compact EmptyState in body | "Error loading tickets" | "Unavailable — API offline", no rows |
| **Ticket detail** | Skeleton subject + text | "No ticket selected" | "Failed to load detail" | "Ticket detail unavailable — backend offline" |
| **Charts** | Fixed-height skeleton | Compact EmptyState with next step | "Chart error" | "Chart unavailable — backend offline" |
| **Event Log** | "Loading events…" | "No events recorded" | "Event log error" | Stops updating; last known events stay with stale timestamp |
| **Command Palette** | — | "No commands match" | — | Commands that require API are disabled |

## Loading rules

- Skeletons must match the real layout dimensions (no generic shimmer blocks).
- KPI skeleton: 28px value bar + 12px sub-label bar.
- Table skeleton: 40px rows, same column widths as real table.
- Chart skeleton: same height as the chart canvas.

## Empty rules

- Use the EmptyState component spec:
  - Dashed 1px border.
  - 20px muted icon.
  - 13px title.
  - 12px body max 48ch.
  - Optional action link.
- Examples:
  - "No open tickets — all alerts resolved or auto-closed."
  - "No performance history — data collection starts on next live probe."
  - "No events recorded — the log updates only when the API is called."

## Error rules

- Display a concise error message.
- Provide a retry action when applicable.
- Do not show stack traces or internal paths.
- Do not auto-retry invisibly.

## Offline rules

- The status pill must read "API OFFLINE" with red/error styling.
- Data surfaces must not show stale numbers as if they were live.
- Cached data is allowed only if explicitly tagged "CACHED · HH:MM:SS".
- The Event Log must not fabricate new entries to make the dashboard look active.

## State consistency

- The same `status` field drives the pill, the copy, and the component state.
- Never show "API is offline" copy while the pill says "LIVE".
- Never show a green "LIVE" badge over cached data.

## Demo scenario (Branch B — chaos drill)

1. Dashboard shows LIVE data.
2. Operator disables backend (or network).
3. Status pill switches to API OFFLINE.
4. KPIs show "Unavailable".
5. Table shows "Unavailable — API offline".
6. Charts show "Chart unavailable — backend offline".
7. Operator re-enables backend.
8. Status pill returns to LIVE; data refreshes.

This drill is the product differentiator.
