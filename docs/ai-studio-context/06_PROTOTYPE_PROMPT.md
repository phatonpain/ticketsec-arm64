# TicketSec Arm64 — Prototype Prompt

> Copy-paste the block below into Google AI Studio (or any prototyping tool) to
> generate the TicketSec triage dashboard from scratch.

---

## PROMPT (copy from here)

You are a UI prototyping assistant. Build a high-fidelity static prototype of
**TicketSec Arm64**, a SOC ticket-triage dashboard, using only the constraints
below.

### Project context

- Product: SOC ticket-triage dashboard for security operators.
- Stack look-and-feel: React 19 + Vite + TypeScript + Tailwind CSS 4 — but you
  are producing a standalone HTML/CSS/JS prototype.
- Reference class: Splunk Enterprise Security + Datadog dark mode + CrowdStrike
  Falcon. Dense, flat, no decoration, no pastel, no gradients.
- Core differentiator: **Honesty Contract** — the UI explicitly admits when the
  backend is offline instead of faking data.

### Design tokens (use EXACTLY these values)

Read `01_DESIGN_TOKENS.md` in this package. Hard rules:

- Background body: `#0B0F19`
- Sidebar: `#0F172A`
- Cards/panels/tables: `#1E293B`
- Primary text: `#F8FAFC`
- Secondary text: `#94A3B8`
- Muted text: `#8292A8`
- Borders: 1px `rgba(255,255,255,0.06)`
- Inter for UI; JetBrains Mono for ALL numbers, IDs, timestamps, percentages.
- Tabular numerals everywhere.
- No hex codes invented. No pastel fills. No shadows above 8px blur.

### Components to build

Use `02_COMPONENT_SPECS.md` for exact anatomy:

1. **TopBar** — 56px, logo, view title, status pill (LIVE/CACHED/API OFFLINE).
2. **Sidebar** — 240px, 5 nav items, active state with indigo bg.
3. **KPI stat blocks** — 4 cards, 128px height:
   - Open Tickets
   - MTTR
   - Auto-Close Rate
   - SLA Met
4. **Triage table** — 40px rows, severity rail (3px left + dot + label), columns:
   Severity, ID, Subject, Category, Confidence %, Status, Assigned, Created.
5. **Charts** (use ECharts or SVG):
   - Severity mix donut
   - Volume by severity horizontal bar chart
6. **Event Log** — monospace timestamps, level chips.
7. **Command Palette** — triggered by Ctrl+K, lists views and actions.

### Data to render

Use the 5 real tickets from `03_DATA_MODEL.md`. Transform them into the
`/api/v1/classifications` shape:

- id: TKT-8501 … TKT-8505
- subject: first sentence of each ticket text
- category: from the JSON
- confidence: a value between 0.75 and 0.99
- status: mix of Resolved, Escalated, Pending
- assignedTo: mix of Auto, Security Team, SOC L1, SOC L2
- createdAt: ISO timestamp

### Views

Use `04_VIEW_SPECS.md`. Build these three views with hash-route-like navigation:

1. **Dashboard / Triagem** — KPI row + table + charts + event log.
2. **Analytics / Overview** — KPI row + line chart placeholder + bar chart + donut.
3. **Ticket Detail** — drawer or full page for TKT-8501.

### Honest states

Use `05_STATES_AND_HONESTY.md`. Implement toggles in the prototype:

- **LIVE**: all data renders normally, pill green.
- **CACHED**: pill amber with timestamp, KPIs show cached values.
- **API OFFLINE**: pill red, KPIs show "Unavailable", table shows
  "Unavailable — API offline", charts show "Chart unavailable — backend offline".

Add a small "Simulate outage" button in the header to demo the Honesty Contract.

### Strict prohibitions

- No hex literals outside `01_DESIGN_TOKENS.md`.
- No generic marketing copy ("Guardian", "blazing", "cutting-edge").
- No big centered empty voids — empty states must be compact with icon + title + body.
- No ghost bars or naked chart axes without data.
- No fake-live data.
- No skeletons where data is not actually loading.

### Output

Produce a single self-contained `index.html` with embedded CSS and JS (or
separate files in a zip). The prototype must be viewable at 1366px width and
look like a professional SOC dashboard, not a generic admin template.

## PROMPT (copy until here)

---

## Follow-up checks

After the tool returns the prototype, validate against this checklist:

1. Are all colors from `01_DESIGN_TOKENS.md`?
2. Are numbers in JetBrains Mono with tabular numerals?
3. Does the outage simulation change the status pill and data surfaces correctly?
4. Is the table row height 40px and KPI height 128px?
5. Are empty/error/offline states compact and honest?
6. Is there any hardcoded hex not in the token list?

If any answer is no, ask the tool to fix it before accepting the prototype.
