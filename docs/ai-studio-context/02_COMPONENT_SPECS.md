# TicketSec Arm64 — Component Specs

> These specs are derived from `DESIGN_BRIEF.md` §4 and the actual component
> inventory in `src/`. Every value maps to a token in `01_DESIGN_TOKENS.md`.

## 1. TopBar

### Layout
- Fixed height: `var(--density-header-h)` (56px).
- Background: `var(--color-bg-sidebar)` (`#0F172A`).
- Left: logo mark + "TicketSec" wordmark (`--font-size-lg`, `--color-text-primary`).
- Center: view breadcrumb / title.
- Right: status pill + bell icon + command palette trigger (`Ctrl+K` / `Cmd+K`).

### Status pill
The pill is the single source of truth for data freshness:

| State | Pill text | Pill style |
|---|---|---|
| Checking | "Checking…" | `--pill-neutral-bg`, `--pill-neutral-border`, spinner |
| LIVE | "LIVE" | `--color-status-ok-bg`, `--color-status-ok-text`, green dot |
| CACHED | "CACHED · HH:MM:SS" | `--badge-cached-bg`, `--badge-cached-fg`, amber dot |
| API OFFLINE | "API OFFLINE" | `--color-status-err-bg`, `--color-status-err-text`, red dot |

### Interactions
- Command palette trigger opens `CommandPalette` overlay.
- Bell icon shows notification count badge on `--color-badge-alert-bg`.

### Tokens used
`--density-header-h`, `--color-bg-sidebar`, `--color-text-primary`, `--color-text-muted`, `--pill-neutral-*`, `--color-status-*`, `--badge-cached-*`, `--color-badge-alert-bg`, `--radius-pill`.

---

## 2. KPI stat blocks

### Layout
- Fixed height: `var(--density-kpi-h)` (128px).
- Background: `var(--color-bg-card)` (`#1E293B`).
- Border: 1px `var(--color-border-default)`.
- Radius: `var(--radius-md)` (8px).
- Padding: `var(--density-card-pad)` (16px).

### Anatomy
- Top-right: icon in 32px neutral well (`--color-icon-chip-bg`).
- Label: 11px caps, `--font-size-label`, `--tracking-caps`, `--color-text-muted`.
- Value: 28px mono tabular single-line (`--font-size-kpi`, `--font-numeric`, `--tracking-kpi`).
- Sub-label: 12px muted with real context (`--font-size-sm`, `--color-text-secondary`).
- Info tooltip on hover/focus (Esc dismiss).

### KPIs and data sources

| KPI | Label | Value source | Sub-label example |
|---|---|---|---|
| Tickets abertos | "OPEN TICKETS" | `/api/v1/classifications` filtered by status ≠ Resolved | "12 escalated · 8 pending" |
| MTTR | "MTTR" | `model/latency_t4g_micro.json` p95 or UNKNOWN if offline | "p95 0.296 ms · Graviton" |
| Taxa de automação | "AUTO-CLOSE RATE" | Computed from `/api/v1/classifications` status = Resolved & assignedTo = Auto | "Precision 0.94 · F1 0.93" |
| SLA % | "SLA MET" | UNKNOWN until live SLA data exists; show "No SLA source" | — |

### States
- **Loading**: fixed-height skeleton pulse on value area only.
- **Empty**: value = "—", sub-label = "No data".
- **Offline**: value = "Unavailable", sub-label = "API offline", status pill = API OFFLINE.

### Tokens used
`--density-kpi-h`, `--color-bg-card`, `--color-border-default`, `--radius-md`, `--density-card-pad`, `--font-size-label`, `--font-size-kpi`, `--font-size-sm`, `--font-numeric`, `--tracking-caps`, `--tracking-kpi`, `--color-text-muted`, `--color-text-primary`, `--color-text-secondary`, `--color-icon-chip-bg`.

---

## 3. Triage table (ClassificationTable)

### Layout
- Head height: `var(--density-table-head-h)` (32px).
- Row height: `var(--density-row-h)` (40px).
- Head text: 11px caps, `--tracking-th`, `--color-text-muted`.
- Body background: `var(--color-bg-card)`.
- Zebra: off.

### Columns

| Column | Content | Width behavior |
|---|---|---|
| Severity | 3px left rail + dot + label | ~110px |
| ID | `TKT-8501` mono | ~90px |
| Subject | Truncated with `title` | flex-grow |
| Category | Badge with cat color + tint | ~130px |
| Confidence | Mono % + 48px track bar (sev-colored) | ~120px |
| Status | Badge (Resolved/Escalated/Pending) | ~110px |
| Assigned | Owner name | ~130px |
| Created | ISO timestamp, mono | ~140px |

### Severity rail
- 3px left border using `--color-sev-critical`, `--color-sev-high`, `--color-sev-medium`, `--color-sev-low`.
- Dot 6px (`--badge-dot-size`) same color.
- Label 11px badge.

### Interactions
- Row hover: `var(--color-bg-card-hover)`.
- Sortable headers show 12px sort icon.
- Expandable row: chevron left of severity rail; click reveals ticket detail panel.
- Row keyboard focus: 2px indigo outline.

### States
- **Loading**: 8 skeleton rows at full row height.
- **Empty**: compact EmptyState inside table body.
- **Offline**: table body shows "Unavailable — API offline" with no rows.

### Tokens used
`--density-table-head-h`, `--density-row-h`, `--color-bg-card`, `--color-bg-card-hover`, `--color-text-muted`, `--color-text-primary`, `--color-text-secondary`, `--color-sev-*`, `--color-cat-*-text`, `--color-cat-*-bg`, `--color-status-*-text`, `--color-status-*-bg`, `--font-family-mono`, `--radius-badge`, `--tracking-th`.

---

## 4. Ticket detail panel

### Layout
- Drawer or expanded row panel.
- Background: `var(--color-bg-card)`.
- Border-left: 1px `var(--color-border-default)`.
- Padding: `var(--density-card-pad)`.

### Sections
- Header: ticket ID + severity badge + close button.
- Subject: 15px `--font-size-lg` `--color-text-primary`.
- Full text: 13px body text, max 80ch.
- Model prediction: category badge + confidence bar + probability mini-table.
- Status + assigned: editable-looking badges (read-only in prototype).
- Event log mini: last 3 API events, mono timestamps.

### States
- **Loading**: skeleton for subject and full text.
- **Error**: "Failed to load ticket detail" + retry.
- **Offline**: "Ticket detail unavailable — backend offline".

### Tokens used
`--color-bg-card`, `--color-border-default`, `--density-card-pad`, `--font-size-lg`, `--font-size-base`, `--font-family-mono`, `--color-text-primary`, `--color-text-secondary`, `--color-sev-*`, `--color-cat-*`.

---

## 5. Charts (ECharts)

### 5.1 Volume por severidade — horizontal bar
- Bars colored by severity (`--color-sev-*`).
- Value label mono at bar end.
- Gridlines: `--chart-grid`.
- No ghost track when 0 → EmptyState.

### 5.2 Tempo de resposta — line chart
- Series: ONNX / INT8 / baseline from `model/latency_*.json`.
- Colors: `--chart-series-onnx`, `--chart-series-int8`, `--chart-series-baseline`.
- Crosshair + rich tooltip (`--chart-tooltip-bg`, `--chart-tooltip-border`).
- Empty state when `performance/history` returns `[]`.

### 5.3 Severity mix donut
- Center value only (one line, clamp).
- Data slices: severity colors.
- Remainder/headroom: `--chart-donut-track` (`#334155`).
- Right-side legend: dot + name + value + %, never clipped.

### States (all charts)
- **Loading**: fixed-height skeleton pulse.
- **Empty**: compact EmptyState with what/why/next-step.
- **Error**: honest error message.
- **Offline**: "Chart unavailable — backend offline".

### Tokens used
`--color-sev-*`, `--chart-series-*`, `--chart-grid`, `--chart-axis`, `--chart-axis-line`, `--chart-tooltip-bg`, `--chart-tooltip-border`, `--chart-donut-track`, `--color-bg-card`, `--color-text-primary`, `--color-text-muted`, `--font-family-mono`.

---

## 6. Command Palette

### Layout
- Overlay backdrop: `--color-overlay-backdrop`.
- Centered floating panel: `--color-bg-elevated`, radius `--radius-lg`, shadow `--shadow-popover`.
- Width: ~560px max.
- Input at top with search icon.
- Results list: keyboard navigable, active item highlighted with `--color-accent-indigo-bg`.

### Commands
- Switch view: Dashboard, Detections, Analytics, Registry, Health.
- Refresh data (honest: triggers live fetch).
- Toggle density: Default / Compact.
- Open Settings drawer.

### Tokens used
`--color-overlay-backdrop`, `--color-bg-elevated`, `--radius-lg`, `--shadow-popover`, `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-accent-indigo-bg`, `--color-border-default`, `--font-size-base`, `--font-size-sm`.

---

## 7. EmptyState component

### Layout
- Dashed 1px border frame (`--color-border-default`).
- Icon 20px muted (`--color-text-muted`).
- Title 13px/600 (`--font-size-base`, `--color-text-primary`).
- Body 12px max 48ch (`--font-size-sm`, `--color-text-secondary`).
- Optional action/link (`--color-link`).
- NOT centered in a 600px void — panel shrinks to fit.

### Tokens used
`--color-border-default`, `--radius-md`, `--color-text-muted`, `--color-text-primary`, `--color-text-secondary`, `--color-link`, `--font-size-base`, `--font-size-sm`.

---

## 8. Event Log

### Layout
- Monospace timestamps.
- Level chips: INFO slate, DEBUG muted, ERROR rose.
- Dedup ×N counter.
- Filter chips with `aria-pressed`.
- `role=log`.

### Tokens used
`--font-family-mono`, `--color-text-muted`, `--color-text-secondary`, `--color-status-err-text`, `--color-status-err-bg`, `--color-status-neutral-text`, `--color-status-neutral-bg`, `--radius-badge`.
