# Rubric Scores — TicketSec Arm64 v4 Close-out (Phases 3–8)

**Reviewer:** Adversarial post-hoc review  
**Date:** 2026-07-19  
**Commit range reviewed:** `eab9cc9..45dc01b` (Phase 3 ML close-out through Phase 8 retrospective)  
**Threshold:** mean ≥ 4.0 AND no dimension < 3.

---

## Dimension scores

### D1 — Scope & file change (did it touch the right files, only them?)
**Score: 4 / 5**

- **Right files:** Security changes stayed in `app/main.py`; QA tests in `tests/flows/`; DevOps evidence in `ops/`; docs in `README.md`, `DEVPOST_SUBMISSION.md`, `DEMO_SCRIPT.md`, `DEVOPS_RUNBOOK.md`, `SECURITY_REVIEW.md`; audit artifacts in `audit/`.
- **Minor scope creep:** `ae27d35` bundles security, DevOps, and QA in one commit. While the files are correct, the commit mixes three phases. Helper scripts `ops/query_imds.sh` and `ops/describe_sg.py` are small but not strictly required by the spec.
- **Verdict:** justified scope, not minimal per commit.

### D2 — Spec alignment (does it do what the phase specified?)
**Score: 4 / 5**

- **Addressed:** Phase 4 QA evidence, Phase 5 rate limiting/input sanitization/error shapes, Phase 6 reboot survival/rollback/port probes, Phase 7 README/Devpost/demo script/LICENSE/screenshots, Phase 8 retro/final report/AGENTS.md rules.
- **Deferred with reason:**
  - Security Group *actual* rules could not be read from AWS (no credentials on host); only intended rules and external port probes are recorded.
  - `public/cache/tickets-snapshot.json` refresh from live responses was not performed; listed as P1 open item in `audit/FINAL_REPORT_v4.md`.
- **Verdict:** most items done, two explicitly deferred.

### D3 — Integrity (no shortcuts)
**Score: 4 / 5**

- **No hidden shortcuts:** Rate limiter is in-memory and disclosed in `SECURITY_REVIEW.md`. Calibration under-confidence is disclosed in `model/calibration.json` and `MODEL_CARD.md`. The C2→C1 ONNX-exportability trade-off is explicitly documented.
- **Remaining shortcut:** `/api/v1/classifications` still returns random placeholder confidence (`0.75 + 0.24 * rng.random()`) with a comment. This is pre-existing and disclosed, but it remains a shortcut vs. storing live scores.
- **Verdict:** honest about limitations, one disclosed but unresolved shortcut.

### D4 — Runtime correctness (does it actually run?)
**Score: 5 / 5**

- `bash scripts/gates.sh` is 11/11 green.
- Edge cases verified: empty input → HTTP 422; rate-limit burst → HTTP 429 with `Retry-After`; offline state → cached/offline UI and EventLog silence test pass.
- Live Graviton `/health` and `/predict` respond correctly after reboot survival and rollback rehearsal.
- **Verdict:** runs and passes gates + manual verification.

### D5 — Evidence quality (can a skeptic re-verify?)
**Score: 4 / 5**

- **Strong:** Every model metric links to a committed JSON artifact with SHA-256 and generation command. QA evidence file contains raw command output. DevOps evidence is timestamped in `ops/logs/verification.log`.
- **Weaker:** Security Group rule claims rely on external port probes and intended rules, not an actual `describe-security-groups` output (credentials unavailable). Snapshot refresh lacks a refreshed file + provenance log.
- **Verdict:** high evidence quality overall, two areas with incomplete re-verification chain.

### D6 — Design fidelity (Phase 1 only; DESIGN_BRIEF §5)
**Score: N/A for this close-out range**

- D6 is scoped to Phase 1. The close-out did not regress design fidelity; live screenshots at 1910×857px in `screenshots/*-live.png` show the UI remains faithful to tokens and layout.
- If forced to score: **5 / 5** based on screenshots and axe/contrast passing.

---

## Summary

| Dimension | Score |
|---|---|
| D1 Scope | 4 |
| D2 Spec alignment | 4 |
| D3 Integrity | 4 |
| D4 Runtime correctness | 5 |
| D5 Evidence quality | 4 |
| D6 Design fidelity | N/A (or 5) |

**Mean (D1–D5):** 4.2  
**No dimension < 3.**  
**Result:** PASS.

---

## Next fixes (in priority order)

1. **Refresh `public/cache/tickets-snapshot.json` from live `/predict` responses** and log provenance to `ops/logs/verification.log`.
2. **Obtain AWS credentials** and capture actual Security Group ingress rules via `aws ec2 describe-security-groups`.
3. **Replace placeholder confidence in `/api/v1/classifications`** with stored live inference scores or remove the endpoint from live claims.
4. **Post-demo:** narrow CORS wildcard and replace in-memory rate limiter (already P1 in `SECURITY_REVIEW.md`).

---

## Honesty note

This review was performed adversarially. The scores reflect real gaps, not cosmetic polish. All gaps are disclosed above and tracked as open items in `audit/FINAL_REPORT_v4.md`.
