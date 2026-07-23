# STATE_MAP v5 — TicketSec Arm64 (mission/v5)

Confirmed: 2026-07-23 · Branch: `mission/v5` · Baseline: tag `baseline-v5`
Remote: `https://github.com/phatonpain/ticketsec-arm64` (**public**, pushed
2026-07-23; default branch pending flip to `mission/v5` — user's web action).
License: MIT at repo root ([`LICENSE`](../LICENSE)).

This file is the FASE 0 deliverable, unblocked late because the repo had no
public remote until 2026-07-23. State below was re-verified, not assumed.

## Current state (verified)

- **Gates G1–G8: 8/8 PASS, all REAL** (no stubs): build + chunk 321.88KB<600KB,
  lint 0/0, vitest 178/178 (console-intercept flake fixed), axe 0 on 5 routes,
  G5 honesty H1–H8, G6 secrets, G7 traceability T1–T3 + allowlist, G8 clean
  tree. Evidence: `TEST_RESULTS_v4.md`, last full run 2026-07-23 15:12:07Z.
- **Backend:** FastAPI `/predict` (ONNX INT8, 60 RPM) + `/predict/tiered`
  (ONNX → Ollama fallback, 20 RPM, honesty field `inference_tier`) +
  `/api/v1/stats/latency-tiers`. Static `dist/` mount when present (Docker
  all-in-one). Production: systemd `ticketsec` on Graviton t4g.micro,
  `MemoryMax=700M`, public demo endpoint `http://3.23.60.61:8000`.
- **Model:** INT8 0.38 MB (401,872 B, sha256 `ed10c403…`), accuracy 92.94%
  (Wilson 95% CI [90.63%, 94.72%], n=609, GroupShuffleSplit seed 42),
  calibration WELL_CALIBRATED (ECE 0.0172), latency p50 0.237/p95 0.286 ms
  on t4g.micro (n=100), probes 14/14.
- **Docs pack:** README (quickstart Docker+local, metrics w/ CI),
  `docs/MIGRATION_GUIDE.md`, `docs/PERFORMANCE.md`,
  `docs/DEVPOST_SUBMISSION.md`, `docs/DEMO_SCRIPT.md` (3 min).
- **UI:** 6 views, ComfyUI assets integrated (hero 6%, registry 8%,
  empty-state art 40%), before/after shots in `screenshots/v5/`.
- **Submissions:** prepared, NOT submitted — tracker `audit/SUBMISSIONS.md`.

## Phases & exit criteria (status)

| Phase | Exit criteria | Status |
|---|---|---|
| P0 Setup & state | branch+tag, gates green, repo public+LICENSE, STATE_MAP | **DONE** (this file; repo public 2026-07-23) |
| P1 Real G5/G7 | real assertions, negative-tested, 8/8 green | **DONE** (`fcf83f6`, `0661c08`) |
| P2 Docs pack | 4 docs, verified numbers, A7 review, quickstart local tested | **DONE** (`26b2b23`) — docker build untested (no Docker locally) |
| P3 Demo video | script, drill rehearsed 2×, recorded+uploaded | **PARTIAL** — script + rehearsals done (`3344adb`, `5715cea`); recording/upload manual |
| P4 Visual polish | assets <200KB integrated, G1–G4 green, rubric scored | **DONE** (`2ede16d`) |
| P5 Submissions | both confirmed received | **BLOCKED** on B1✓/B2 video/B3 docker/B4 name/B5 prod drill |

## Top-5 risks for the two hackathons

1. **Video is the critical path** (deadlines 23/24-ago): recording + YouTube
   upload are manual and unrehearsed on the real Graviton host (B5). Without
   it both submissions ship incomplete.
2. **Docker quickstart unverified** — judges may try `docker build` first;
   if the Dockerfile fails, the <10-minute promise breaks. Test on any
   Docker host before submission (B3).
3. **Public endpoint is anonymous + CORS-wildcard** (demo period): a burst
   during judging is unmitigated beyond in-app rate limits; the SECURITY_REVIEW
   hardening plan (TLS, explicit origins) is post-hackathon.
4. **~~Repo default branch~~** — RESOLVED 2026-07-23: default is now
   `mission/v5` and GitHub detects LICENSE MIT. Remaining repo risk: none.
5. **LLM tier never measured live** — Ollama offline in all v5 runs; the
   `local_llm_q4` latency cell is honestly empty, but the demo should not
   promise LLM fallback behavior on camera unless rehearsed with Ollama up.

## Open items carried (from HANDOFF_P6)

- Backend `/api/v1/classifications` synthesizes RNG confidence rendered as
  "live" rows — decision pending (mark synthetic vs persist real scores).
- `/api/v1/performance/history` always `[]` — live performance surfaces
  never populate.
- LivePrediction 70% threshold mirrors backend default without a source
  (G7-allowlisted; `model/decision_threshold.json` is gitignored).
- Donut legend overlap at 1366px (pre-existing, FASE 4 rubric item 6).
