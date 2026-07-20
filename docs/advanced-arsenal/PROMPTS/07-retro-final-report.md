# 07 — Retrospective + final report (next-cycle prompt)

> **Do NOT execute this prompt now.** Use it for the final close-out of a future
> release cycle on TicketSec Arm64 v4.

## Trigger

End of a release cycle; before merging `mission/v4` to `master`.

## Required reads

- All `audit/HANDOFF_P*.md` files.
- `RUBRIC.md`
- `audit/RUBRIC_SCORES_v4.md`
- `audit/FINAL_REPORT_v4.md`

## Exact steps

1. Write `audit/RETRO_v4.md`:
   - Timeline of what broke and bounced back.
   - Root causes (OK/COMPLETE bug, CRLF, bc/awk, surface-guard, YOLO dismiss, etc.).
   - What the gates caught vs. what the agent got wrong.
2. Update `audit/FINAL_REPORT_v4.md` Part F table with baseline → final metrics.
3. Update `audit/RUBRIC_SCORES_v4.md` with D1–D6 scores and evidence.
4. Append any new learned rules to `AGENTS.md` (surgical edit, never regenerate).
5. Run `bash scripts/gates.sh`.

## Acceptance criteria

- [ ] `audit/RETRO_v4.md` committed.
- [ ] `audit/FINAL_REPORT_v4.md` Part F table updated.
- [ ] `audit/RUBRIC_SCORES_v4.md` mean ≥4.0, none <3.
- [ ] `AGENTS.md` appended with new rules only.
- [ ] gates.sh 11/11 PASS.
