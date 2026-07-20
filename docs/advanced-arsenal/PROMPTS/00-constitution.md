# 00 — Constitution & context load (next-cycle prompt)

> **Do NOT execute this prompt now.** It is a reusable entry point for future
> cycles and regression work on TicketSec Arm64 v4.

## Trigger

Start of any new task, phase, or bug-fix cycle on `mission/v4`.

## Required reads

1. [`AGENTS.md`](../../AGENTS.md) — permanent laws and learned rules.
2. Latest handoff in `audit/HANDOFF_P*.md` chain.
3. [`audit/STATE_MAP_v4.md`](../../audit/STATE_MAP_v4.md) for baseline snapshot.
4. [`RUBRIC.md`](../../RUBRIC.md) for scoring threshold (mean ≥4.0, none <3).

## First action

```bash
bash scripts/gates.sh
```

If any gate is red, fix it before starting the new task. Max 3 attempts; then
stop and present root-cause + two options.

## Constraints

- DESIGN_BRIEF.md + tokens.css + Honesty Contract override everything.
- Every UI number traces to a committed artifact or store source.
- Surgical diffs only. No new dependency without justification.
- Conventional commits. Green-gate checkpoints only.
