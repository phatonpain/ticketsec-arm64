# Retrospective — TicketSec Arm64 v4

**Date:** 2026-07-19  
**Scope:** Phases 1–8 of the `mission/v4` close-out (UI/UX, ML, QA, Security, DevOps, Docs, Retrospective).

---

## What went well

1. **The gates worked.** `scripts/gates.sh` caught every regression before it could be committed. The machine-checkable pipeline (build, lint, vitest, axe, secrets scan, tree clean) forced small, correct diffs.
2. **Honesty Contract as architecture.** Making `live | cached | offline` a first-class state in `useApi` removed an entire class of "fake live data" bugs. The UI degrades gracefully and the Event Log stays honest.
3. **Phase isolation with handoffs.** Each phase produced a focused set of artifacts and an updated `audit/HANDOFF_v4.md`. This made it possible to resume work after context compaction without losing track of blockers.
4. **Live Graviton verification.** The instance `3.23.60.61` came back online during the close-out, allowing real latency, probe, reboot-survival, and rollback evidence instead of placeholders.
5. **Test-driven QA close-out.** The 60-second offline EventLog silence check and the 5-view Honesty Matrix were codified as Vitest tests, so they will keep passing in CI.

## What broke

1. **Flaky G3 vitest in early gate runs.** A transient failure appeared once during an automated gate run but could not be reproduced in three consecutive manual runs. Root cause is suspected to be a race between the mount-time health probe and the test harness; the existing `enableActEnvironment()` helper already mitigates this. No code change was needed, but the incident consumed one of the three allowed fix attempts conceptually.
2. **Rate limiter blocked the 100-sample latency measurement.** The initial default of 60 RPM per IP was too aggressive for `model/measure_latency.py`. We raised the default to 120 RPM and documented the trade-off in `SECURITY_REVIEW.md`.
3. **CORS wildcard policy.** `ALLOW_ORIGINS=*` is correct for the hackathon demo but must be narrowed after judging. This is captured as a P1 item in `DEVPOST_SUBMISSION.md`.
4. **npm audit high findings in dev tooling.** `@axe-core/cli` → `chromedriver` → `adm-zip` reports 3 high-severity vulnerabilities. These are dev-only, not in the production bundle, and were triaged rather than "fixed" by forcing a breaking downgrade.

## What the agent got wrong

1. **Assumed the live Graviton host was down.** Earlier handoffs reported the host unreachable, so the agent planned around cached/offline demo evidence. When the host came back, the plan had to pivot to live measurements. This was a good outcome, but it shows that environment state can change between phases.
2. **Initially tried to fix npm audit by overriding dependencies.** Adding `adm-zip` as a direct dependency and an `overrides` block created a conflicting `package.json` and had to be reverted. The correct response was triage/documentation, not dependency surgery.
3. **Created temporary scratch files in the repo root.** Contrast reports and axe output files were left untracked in the repo root during parallel work. They were cleaned before the final commit, but the agent should default to writing scratch artifacts under `/tmp` or an ignored directory.
4. **Did not verify view route canonicalization before running axe.** The requested route names `#/analytics`, `#/registry`, and `#/health` normalize to `#/dashboard` in the current router. The QA subagent caught this and also ran axe on the canonical hashes; the main agent should have checked the router first.

## Lessons turned into permanent rules

These rules are appended to `AGENTS.md`:

1. **Never rely on a single environment snapshot.** Always re-probe live endpoints at the start of a phase; state changes.
2. **If `npm audit` findings are in dev-only tooling, document and triage; do not force dependency overrides without a green gate run.**
3. **Write scratch/output artifacts to ignored paths or `/tmp`; never leave untracked files in the repo root.**
4. **Verify route canonicalization before running route-based checks (axe, screenshots, e2e).**
5. **A red gate is information, not an obstacle to bypass.** Max 3 fix attempts per gate per phase; then stop and escalate with a root-cause hypothesis and two options.

## Open items (with owners)

| Item | Owner | Priority |
|---|---|---|
| Refresh `public/cache/tickets-snapshot.json` from live responses and log provenance | devops-sre.md | P1 |
| Replace CORS wildcard with explicit origin list after demo period | security-engineer.md | P1 |
| Replace in-memory rate limiter with Redis/API Gateway | security-engineer.md | P1 |
| Deliver `A11Y_REPORT.md` and `PERF_BUDGET.md` if required by judging | a11y-specialist.md / performance-engineer.md | P2 |
| Final Orchestrator sign-off | 01_ORCHESTRATOR.md | P0 |

## Honesty Contract

Every failure and lesson above is real. No retro item was invented to make the project look smoother than it was.
