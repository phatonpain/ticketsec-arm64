# Final Report — TicketSec Arm64 v4

**Date:** 2026-07-19  
**Branch:** `mission/v4`  
**Status:** Phase 1–8 complete. All gates green.

---

## Part F — Final Metrics

| Métrica | Baseline (Phase 0) | Final | Evidência |
|---|---|---|---|
| Testes (pass/fail/it.fails) | 0 / — / — | 150 / 0 / 0 | `TEST_RESULTS_v4.md` §2026-07-19 |
| Main chunk (KB) | — | 299.37 KB | `scripts/gates.sh` G1 |
| Lint (err/warn) | — | 0 / 0 | `scripts/gates.sh` G2 |
| Acurácia (protocolo: seed/split/n) | — | 92.94% — GroupShuffleSplit(test_size=0.2, groups=seed_id), seed 42, n=3,058 (609 test) | `model/eval_results.json` |
| ECE (calibração) | — | 0.3946 / under-confident | `model/calibration.json` |
| Latência p50/p95 t4g.micro (ms) | — | 0.224 / 0.296 | `model/latency_t4g_micro.json` |
| axe violations (5 rotas) | — | 0 | `TEST_RESULTS_v4.md` / `audit/PHASE4_QA_EVIDENCE.md` |
| Contraste AA (x/23) | — | 23/23 | `audit/PHASE4_QA_EVIDENCE.md` |
| Probes adversariais (pass/total) | — | 14 / 14, 0 HTTP 5xx | `model/probe_results.json` |
| Findings segurança P0/P1 abertos | — | 0 P0 / 2 P1 (CORS wildcard, Redis-backed rate limiter) | `SECURITY_REVIEW.md` |
| Rollback ensaiado (tempo) | — | < 30 s (restore previous main.py + restart + verify) | `ops/logs/verification.log` |

---

## Phase Handoffs & Key Artifacts

| Phase | Focus | Key deliverables | Handoff / evidence |
|---|---|---|---|
| Phase 1 | UI/UX & a11y fixes | `ClassificationTable`, `Header`, command palette, gate green | `audit/HANDOFF_P1.md`, `audit/RUBRIC_P1.md` |
| Phase 2 | Token purity & command palette | Token-only styling, `CommandPalette.tsx` fixes | committed in earlier commits |
| Phase 3 | ML Engineer | `MODEL_CARD.md`, `audit/ML_TRACEABILITY.md`, `model/calibration.json`, regenerated eval/latency/probe artifacts | `audit/HANDOFF_v4.md` |
| Phase 4 | QA | `audit/PHASE4_QA_EVIDENCE.md`, honesty matrix tests, offline silence test | `TEST_RESULTS_v4.md` |
| Phase 5 | Security | `SECURITY_REVIEW.md`, rate limiter, input sanitization, safe error shapes | `app/main.py`, `SECURITY_REVIEW.md` |
| Phase 6 | DevOps/SRE | `ops/logs/verification.log`, reboot survival, rollback rehearsal, SG rules | `DEVOPS_RUNBOOK.md` |
| Phase 7 | Docs & Submission | `README.md`, `DEVPOST_SUBMISSION.md`, `DEMO_SCRIPT.md`, `LICENSE`, live screenshots | committed |
| Phase 8 | Retrospective | `audit/RETRO_v4.md`, updated `AGENTS.md`, this report | committed |

---

## Top-3 things a judge will notice first

1. **The dashboard is live.** The header shows a green `LIVE` badge, the Model Registry displays real eval metrics, and the external Graviton endpoint (`3.23.60.61:8000`) responds to `/predict`.
2. **Honesty is built in.** If the API drops, the badge flips to `CACHED`/`API OFFLINE`, cached data is clearly labeled, and the Event Log stays silent — no fabricated entries.
3. **Every claim is traceable.** Accuracy, latency, model size, memory budget, and probe results all link to committed JSON/Markdown artifacts with SHA-256 hashes.

---

## Remaining open items (with owners)

| Item | Owner | Priority |
|---|---|---|
| Refresh `public/cache/tickets-snapshot.json` from live responses and log provenance | devops-sre.md | P1 |
| Replace CORS wildcard with explicit origin list after demo period | security-engineer.md | P1 |
| Replace in-memory rate limiter with Redis or API Gateway throttling | security-engineer.md | P1 |
| Deliver `A11Y_REPORT.md` and `PERF_BUDGET.md` if required by judging | a11y-specialist.md / performance-engineer.md | P2 |
| Final Orchestrator sign-off | 01_ORCHESTRATOR.md | P0 |

---

## Honesty Contract

Every metric, screenshot, and log line in this report is backed by a committed artifact or a live command output. Nothing was fabricated.
