---
name: ui-splunk-dashboard
description: |
  Apply the TicketSec Arm64 enterprise SOC density design language (Splunk ES /
  CrowdStrike Falcon class). Use this skill for any UI change that affects layout,
  spacing, color, typography, charts, or component structure. It enforces the
  token-driven system and the Honesty Contract for live/cached/offline states.
---

# ui-splunk-dashboard

## Purpose

Keep the React dashboard visually consistent with an enterprise SOC density bar:
40 px table rows, 16 px card padding, Inter + JetBrains Mono fonts, tabular
numerals, WCAG 2.2 AA contrast, and lazy-loaded ECharts. Every UI number must
trace to a committed artifact or an honest store state.

## When to use

- Adding, removing, or resizing a widget/card/chart.
- Changing colors, spacing, typography, or density.
- Adding a new view or route.
- Fixing axe/contrast findings.
- Any change that could affect the main JS chunk size.

## Exact steps

1. Read `src/styles/tokens.css` and confirm the token exists before inventing a
   value. If a token is missing, add it to `tokens.css` first with a one-line
   justification in the commit message.
2. Read the relevant component(s) and `src/lib/artifacts.ts` if the surface
   displays model metrics.
3. Make the smallest possible change using CSS variables from `tokens.css`. No
   hex literals in components; no magic numbers.
4. If the surface displays data, decide its honesty state:
   - `live` → green `LIVE` badge, data from the API.
   - `cached` → amber `CACHED` badge, data from `public/cache/tickets-snapshot.json`.
   - `offline` → "Unavailable — API offline" and no fabricated entries.
5. Run the verification stack:
   ```bash
   npm run build        # must pass, main chunk <600 KB
   npm run lint         # 0 errors / 0 warnings
   npx axe http://localhost:5173/#/<route>  # 0 violations per route
   ```
6. Capture a screenshot at 1366 px width if the change is visible.

## Negative constraints

- **Never** use `dangerouslySetInnerHTML`.
- **Never** hardcode a metric in JSX. Load it from `model/*.json` via
  `src/lib/artifacts.ts` or mark it `PENDING`/`Unavailable`.
- **Never** invent a live Event Log entry. The log records only real API events.
- **Never** add a new dependency without a one-line justification.
- **Never** leave unused imports or console logs.

## Verifiable acceptance criteria

- [ ] `npm run build` passes and `scripts/gates.sh` G1 chunk size <600 KB.
- [ ] `npm run lint` reports 0 errors and 0 warnings.
- [ ] `npx axe` reports 0 violations on every changed route.
- [ ] Contrast sweep (`scripts/contrast_sweep.py` or equivalent) is 23/23 AA.
- [ ] No hex literals or magic spacing numbers outside `tokens.css`.
- [ ] Screenshots at 1366 px show the intended change.
