# 08 — Orchestrator final sign-off (next-cycle prompt)

> **Do NOT execute this prompt now.** Use it as the final checklist before
> declaring TicketSec Arm64 v4 ready to merge or submit.

## Trigger

All phases complete; final merge to `master` or Devpost submission.

## Required reads

- `AGENTS.md`
- `audit/FINAL_REPORT_v4.md`
- `audit/RETRO_v4.md`
- `audit/RUBRIC_SCORES_v4.md`
- Latest `audit/HANDOFF_P*.md`

## Exact steps

1. Verify branch is `mission/v4` and tree is clean:
   ```bash
   git status --short
   ```
2. Run `bash scripts/gates.sh` one final time.
3. Confirm all handoff open items are either done or explicitly deferred.
4. Confirm `LICENSE` is at root and `.gitignore` covers secrets/logs/dist.
5. Confirm the final commit hash is recorded in the latest handoff.
6. Tag the release commit:
   ```bash
   git tag v4-final <commit-hash>
   ```

## Acceptance criteria

- [ ] Tree clean.
- [ ] gates.sh 11/11 PASS.
- [ ] Mean rubric score ≥4.0, no dimension <3.
- [ ] All open items have owners.
- [ ] Honesty Contract intact.
