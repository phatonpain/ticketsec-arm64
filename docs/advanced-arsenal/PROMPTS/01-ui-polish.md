# 01 — UI/UX polish or new widget (next-cycle prompt)

> **Do NOT execute this prompt now.** Use it for future UI work on TicketSec
> Arm64 v4.

## Trigger

Any change to layout, spacing, color, typography, charts, or a new view/widget.

## Skill

Invoke `/skill:ui-splunk-dashboard`.

## Required reads

- `src/styles/tokens.css`
- `src/lib/artifacts.ts` (if showing model metrics)
- `audit/PHASE4_QA_EVIDENCE.md` (contrast and axe evidence)

## Exact steps

1. Confirm the needed token exists in `tokens.css`; add only if missing.
2. Make the smallest possible change; no hex literals, no magic numbers.
3. Preserve the Honesty Contract: `live | cached | offline` states.
4. Run:
   ```bash
   npm run build
   npm run lint
   bash scripts/gates.sh
   ```
5. Capture 1366 px screenshots of every changed route.

## Acceptance criteria

- [ ] Main JS chunk <600 KB.
- [ ] Lint 0/0.
- [ ] axe 0 violations per route.
- [ ] Contrast 23/23 AA.
- [ ] No hardcoded metrics in JSX.
