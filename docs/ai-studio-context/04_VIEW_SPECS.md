# TicketSec Arm64 — View Specs

> Style target: Splunk ES / Datadog dark / CrowdStrike Falcon — dense, flat,
> no decoration, everything actionable. All values from `01_DESIGN_TOKENS.md`.

## View A — SOC Command Center / Triagem

### Purpose
Primary operator view: see open tickets, decide escalation, triage by severity.

### Above the fold (first 1366px)
1. **TopBar** with status pill.
2. **KPI row** (4 stat blocks): Open Tickets, MTTR, Auto-Close Rate, SLA Met.
3. **Triage table** first 8–10 rows.
4. **Mini severity donut** + **volume bar chart** side-by-side.

### Grid layout
```
+-------------------------------------------------------------+
| TopBar                                                      |
+----------+--------------------------------------------------+
| Sidebar  | KPI | KPI | KPI | KPI                           |
| (240px)  +--------------------------------------------------+
|          | Table (2/3 width) | Charts (1/3 width)          |
|          |                   | - Severity donut            |
|          |                   | - Volume bar                |
|          +--------------------------------------------------+
|          | Event Log (full width, 160px)                    |
+----------+--------------------------------------------------+
```

### Density
- Sidebar width: 240px (`--layout-sidebar-w`).
- KPI row height: 128px (`--density-kpi-h`).
- Table row height: 40px (`--density-row-h`).
- Card gap: 14px (`--density-card-gap`).
- Page padding: 24px (`--layout-page-px`).

### Interactions
- Row click / chevron expands ticket detail panel.
- Sortable table headers.
- Command palette (`Ctrl+K`) to switch views.

---

## View B — Overview / Analytics

### Purpose
Manager / analyst view: trends, model performance, category distribution.

### Above the fold
1. **TopBar**.
2. **KPI row**: Total Classified, Accuracy, p50 Latency, p95 Latency.
3. **Line chart**: response-time history (or empty state).
4. **Bar chart**: category volume.
5. **Donut**: severity mix.
6. **Model registry mini-card**: artifact hash, size, memory budget.

### Grid layout
```
+-------------------------------------------------------------+
| TopBar                                                      |
+----------+--------------------------------------------------+
| Sidebar  | KPI | KPI | KPI | KPI                           |
| (240px)  +--------------------------------------------------+
|          | Line chart (2/3)        | Donut (1/3)          |
|          +--------------------------------------------------+
|          | Bar chart (1/2)         | Model registry (1/2) |
|          +--------------------------------------------------+
|          | Event Log (full width)                           |
+----------+--------------------------------------------------+
```

### KPI data sources
- Total Classified: count from `/api/v1/classifications`.
- Accuracy: `model/eval_results.json` accuracy.
- p50 / p95 Latency: `model/latency_t4g_micro.json`.
- When offline: KPIs show "Unavailable".

---

## View C — Ticket Detail

### Purpose
Deep-dive a single ticket: full text, model prediction, probabilities, status trail.

### Layout options
- **Drawer**: slides from right on top of Command Center.
- **Full page**: replaces table when a row is selected.

### Sections (top to bottom)
1. **Header**: back button + ticket ID + severity badge + status badge.
2. **Subject**: full ticket subject line.
3. **Full text**: body of the ticket (`text` field).
4. **Prediction card**:
   - Predicted category badge (large).
   - Confidence bar.
   - Probability table (all 6 categories, mono %).
5. **Assignment card**: assignedTo, createdAt, status.
6. **Model provenance**: artifact hash snippet, processing_time_ms.

### Tokens
- Background: `--color-bg-card`.
- Border: 1px `--color-border-default`.
- Padding: `--density-card-pad`.
- Text: `--font-size-lg` for subject, `--font-size-base` for body, `--font-family-mono` for IDs/timestamps/percentages.

---

## Navigation

Sidebar items (vertical, 240px):

| Icon + Label | Route | Active state |
|---|---|---|
| LayoutDashboard + Dashboard | `#/dashboard` | `--color-accent-indigo-bg`, left border accent |
| ShieldAlert + Detections | `#/detections` | same |
| BarChart3 + Analytics | `#/analytics` | same |
| Cpu + Registry | `#/registry` | same |
| Activity + Health | `#/health` | same |

Active item: background `--color-accent-indigo-bg`, text `--color-text-primary`, left 3px accent indigo.
Inactive item: text `--color-text-secondary`, hover `--color-bg-card-hover`.

---

## Responsive notes

- Minimum prototype width: 1366px.
- Sidebar collapses to icon-only below 1280px (optional).
- Charts keep legends unclipped at 1366/1440/1920.
- Table horizontal scroll never truncates severity/id columns.
