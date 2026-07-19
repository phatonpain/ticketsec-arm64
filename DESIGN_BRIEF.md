# TicketSec Arm64 (ANTI-GENERIC CONSTITUTION)

Every UI prompt to the CLI MUST start with:
"Read DESIGN_BRIEF.md and src/styles/tokens.css first. Follow them exactly."
This file overrides any generic instinct. Violating the BANNED list = rejected work.

## 1. REFERENCE CLASS (steal these specific traits — not "vibes")

- **Splunk Enterprise Security:** dense triage tables; severity rails (3px colored left border per row); muted status chips; section headers with right-aligned actions; nothing decorative.
- **Datadog dark mode:** panel anatomy = header (title 13px/600 + subtitle 12px muted + actions right) / body (16px padding) / footer (provenance, 11px muted); flat surfaces separated by 1px borders, no shadows; charts with subtle crosshair + rich tooltip.
- **CrowdStrike Falcon:** KPI stat blocks = 11px caps label (0.6px tracking) / 28px tabular value / 12px sub-label with delta or context; icons in neutral 32px wells, never pastel chips.
- **Linear:** typography discipline — one sans (Inter), one mono (JetBrains Mono for numbers/IDs/timestamps), no third voice; generous letter-spacing only on caps labels.
- **Grafana:** every chart has explicit states: loading (fixed-height skeleton), empty (what/why/next-step), error (honest), data. Never render axes with zero/ghost data.

## 2. HARD CONSTRAINTS (already in tokens.css — use, never bypass)

- Dark slate surfaces: body `#0B0F19` / sidebar `#0F172A` / card `#1E293B` / elevated above card.
- 1px `rgba(255,255,255,0.06)` borders.
- No gradients, no glows, no neon, no pastel, no shadows above 8px blur.
- Density: rows 40px · card padding 16px · card gap 14px · widget head 36–44px.
- Type: Inter (UI) + JetBrains Mono (`font-variant-numeric: tabular-nums`) for ALL numbers, IDs, percentages, timestamps. Floor 11px (10px absolute max for badges).
- Palettes: categorical `--cat-1..6` (muted), severity `--sev-*`, status tones ≥4.5:1. False Positive = slate.
- English UI. WCAG 2.2 AA.
- Honesty Contract: live / cached (amber badge + timestamp) / "Unavailable — API offline".

## 3. THE BANNED LIST (patterns that read "generic template" — never ship)

- Big centered void panels with one line of text — empty states are compact (max ~180px tall) with icon + what + why + NEXT STEP.
- Charts rendering zero-value ghost bars or naked axes without data — use the EmptyState component; a live-but-accumulating chart says "Collecting live detections — N so far" with a real counter.
- Pastel icon chips on KPI cards; consumer-purple oversized primary buttons (primary = 32px, `--color-accent-indigo-strong`, right-aligned).
- Copy that contradicts state (e.g. "API is offline" while pill says LIVE) — copy must branch on the SAME status field the pill uses.
- Marketing tone: "Guardian", "blazing", "cutting-edge", exclamation marks. SOC voice: terse, factual, units always present.
- Truncated category names or values without `title`; wrapped KPI values; text below 10px.
- Nav items, buttons or links that do nothing (dead ends = #1 generic smell).
- Mixed badge geometries/typography across panels; mixed date/time formats.
- Default ECharts palette or default tooltip — always `chartTokens` + panel-styled tooltip (12px, mono values).
- Any number on screen that doesn't trace to a store or a committed artifact.

## 4. COMPONENT ANATOMY SPECS (exact — do not improvise)

### Panel
- Header 44px (title 13px/600, subtitle 12px `--text-muted`, actions right 28px icon buttons, provenance badge)
- Body padding 16px
- Footer 32px provenance line ("Cached snapshot from HH:MM:SS" / "Health probe · every 30s")

### Table
- Head 36px caps 11px `--text-muted`
- Rows 40px
- Severity = 3px left rail + dot + label
- Category = badge (token bg+fg, ellipsis max 100%, `title`)
- Confidence = mono % + 48px track bar (sev-colored)
- Hover = `bg-card-hover`
- Sort icons 12px
- Zebra off

### KPI stat block
- Fixed height 128px
- Label 11px caps
- Value 28px mono tabular single-line (`whiteSpace:nowrap`, clamp)
- Sub-label 12px muted with real context (e.g. "Precision 0.94 · F1 0.93")
- Icon in 32px neutral well top-right
- Info tooltip on hover/focus with Esc dismiss

### Donut
- Value only in center (one line, clamp)
- Legend right-side list with dot + name + value + %, never clipped
- Emphasis on the data slice (accent cyan), remainder quiet baseline

### Bar chart (categories)
- Horizontal bars, category color per class
- Value label mono at bar end
- Gridlines `rgba(255,255,255,0.04)`
- No ghost track when 0 → EmptyState

### EmptyState
- Dashed 1px border frame
- Icon 20px muted
- Title 13px/600
- Body 12px max 48ch
- Optional action/link
- NOT centered in a 600px void — panel shrinks to fit

### Event Log
- Mono timestamps
- Level chips (INFO slate / DEBUG muted / ERROR rose)
- Dedup ×N counter
- Filter chips with `aria-pressed`
- `role=log`

## 5. THE CRITIQUE LOOP (mandatory after every UI change — do not skip)

`npm run build` + `npm run lint` must be 0/0 first.

Run the app (preview or dev) and screenshot EVERY affected view at 1366px (use the WebBridge/browser tool).

Self-grade against this rubric (1–10 each):

1. Token purity — zero raw hex/px
2. Density — 40/16/14 rhythm
3. Type discipline — mono tabular on all numbers
4. State honesty — live/cached/offline copy matches the pill
5. Empty states — compact with next step
6. Chart craft — no ghost bars, legends unclipped at 1366/1440/1920
7. Alignment — baselines across sibling cards
8. Contrast — AA measured
9. Keyboard — tab order + visible focus
10. Dead ends — everything clickable does something

ANY score <9 → fix and re-screenshot BEFORE reporting. Report includes the 10 scores + screenshots.

## 6. HOW TO PROMPT THE CLI (doctrine — 5 rules)

1. **Reference-first:** always name the class ("in the Splunk ES / Datadog dark class per DESIGN_BRIEF.md"), never adjectives.
2. **Constraints-second:** point to tokens.css + BANNED list explicitly.
3. **Spec-third:** exact values per component (§4), not "improve X".
4. **Critique-fourth:** demand the §5 loop with rubric scores in the report.
5. **One component surface per prompt:** panel-by-panel missions beat "redesign the dashboard" every time.
