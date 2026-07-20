---
name: qa-gates
description: Executa e interpreta os gates machine-checkable G1–G8 (scripts/gates.sh) com protocolo de falha
whenToUse: Quando rodar gates, investigar gate vermelho, ou validar fechamento de fase
---

# qa-gates

## Purpose

Provide a single source of truth for the machine-checkable quality gates. The
local gate script is `scripts/gates.sh`; the CI mirror is
`.github/workflows/quality-gates.yml`. Both must stay in parity.

## When to use

- At the end of every phase before writing a handoff.
- After any change to `scripts/gates.sh` or `.github/workflows/quality-gates.yml`.
- After modifying source code that could affect build, tests, axe, or secrets.
- When investigating a red gate.

## Exact steps

1. Ensure the Vite dev server is **not** already running on `:5173`, then start
   it:
   ```bash
   npm run dev -- --port 5173
   ```
2. In another terminal, run gates:
   ```bash
   bash scripts/gates.sh
   ```
3. If a gate fails:
   - Read the failure reason from `TEST_RESULTS_v4.md` or the terminal output.
   - Fix the root cause; do not reinterpret the gate.
   - Re-run `bash scripts/gates.sh`. Limit to 3 attempts per gate; then stop and
     write a root-cause hypothesis plus two options (minimal fix vs. escalation).
4. When all gates pass, commit `TEST_RESULTS_v4.md` separately as the
   gate-evidence commit.

## Negative constraints

- **Never** lower, skip, or reinterpret a gate.
- **Never** commit a gate run that used a temporarily modified threshold.
- **Never** run axe against a stale build; always start `npm run dev` fresh.
- **Never** suppress a test failure with `.skip`, `.only`, or `it.fails` without
  documenting the reason.

## Verifiable acceptance criteria

- [ ] `bash scripts/gates.sh` reports 11/11 PASS.
- [ ] `TEST_RESULTS_v4.md` contains the latest run block with timestamp.
- [ ] `git status --porcelain` is empty after the gate-evidence commit (G8).
- [ ] No `it.fails` or `.skip` in the Vitest output.
- [ ] Main JS chunk is <600 KB.
