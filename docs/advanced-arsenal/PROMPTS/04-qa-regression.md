# 04 — QA regression sweep (next-cycle prompt)

> **Do NOT execute this prompt now.** Use it for future QA validation on
> TicketSec Arm64 v4.

## Trigger

Before declaring any phase done, after test changes, or after a large refactor.

## Skill

Invoke `/skill:qa-gates` and `/skill:honesty-contract`.

## Required reads

- `scripts/gates.sh`
- `TEST_RESULTS_v4.md`
- `tests/flows/offline-silence.test.tsx`
- `tests/flows/classify-offline.test.tsx`

## Exact steps

1. Start a fresh Vite dev server on `:5173`.
2. Run `bash scripts/gates.sh`.
3. If red, root-cause and fix (max 3 attempts per gate).
4. Verify honesty tests explicitly:
   ```bash
   npx vitest run tests/flows/offline-silence.test.tsx tests/flows/classify-offline.test.tsx
   ```
5. Commit `TEST_RESULTS_v4.md` as the gate-evidence commit.

## Acceptance criteria

- [ ] `bash scripts/gates.sh` 11/11 PASS.
- [ ] `git status --porcelain` empty after evidence commit.
- [ ] No `it.fails` or `.skip` in test output.
- [ ] Honesty tests prove no fabricated rows or log entries.
