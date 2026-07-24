# SUBMISSIONS — Hackathon tracker (mission/v5)

Status date: 2026-07-23. **Nothing has been submitted yet.** Submission is a
manual user action on third-party platforms (accounts required), gated on the
user's explicit approval of the final text (FASE 5 rule) and the blockers
below.

## Hard blockers (must clear BEFORE any submission)

| # | Blocker | Status | Owner |
|---|---|---|---|
| B1 | Repo not public — no git remote configured; GitHub repo must be created public with LICENSE visible (FASE 0 stop condition, still open) | **CLEARED 2026-07-23** — `github.com/phatonpain/ticketsec-arm64` public, default branch `mission/v5`, LICENSE MIT detected by GitHub | user |
| B2 | DEMO video not recorded/uploaded — FASE 3 script + 2 rehearsals done (`docs/DEMO_SCRIPT.md`, `qa/proof/`), but OBS recording + YouTube unlisted upload are manual | **PLACEHOLDER accepted by user 2026-07-23** — submissions ship with the TBD line until the video exists | user |
| B3 | `docker build` never executed — no Docker on the dev machine; quickstart claims it works (statically reviewed only) | **CLEARED 2026-07-23** — README Docker section now explicitly marked untested | user (any Docker host) |
| B4 | Author name for the solo team field — not known to the agent | **CLEARED 2026-07-23** — Felipe Inacio | user |
| B5 | Production chaos drill on Graviton (`systemctl stop ticketsec`) for the video — outward-facing, needs explicit authorization + maintenance window (public endpoint goes down) | **OPEN** | user (or authorize agent) |

## Submission 1 — NeuralSprint (submit first, deadline 2026-08-24)

- **Project name:** TicketSec — Honest AI Triage for Security Teams
- **Description:** `docs/DEVPOST_SUBMISSION.md` Part B (problem → what we
  built → Honesty Contract originality). Approved wording, all numbers
  artifact-backed.
- **Screenshots:** the 6 route shots from FASE 4:
  `screenshots/v5/after/{dashboard,detections,predictions,threat-analytics,model-registry,system-health}.png`
  (1366×768, live backend, 2026-07-23). Optional 7th:
  `screenshots/v5/after/empty-state-art.png` (honest offline state).
- **Video:** TBD — YouTube unlisted URL (B2).
- **Repo:** TBD — public GitHub URL (B1).
- **Team:** solo — Felipe Inacio

## Submission 2 — Arm Create AI Optimization Challenge, Cloud AI track (deadline 2026-08-23)

- **Project name:** TicketSec: Honest AI Inference on Arm64
- **Track:** Cloud AI
- **Description:** `docs/DEVPOST_SUBMISSION.md` Part A (Arm optimization
  story, measured p50 0.237 ms / p95 0.286 ms on t4g.micro, C2→C1
  exportability decision, honest size-parity accounting, tiered inference,
  honesty drill as demo WOW).
- **Reusable artifact:** `docs/MIGRATION_GUIDE.md` (Potential Impact).
- **Setup instructions:** README Quickstart (Docker all-in-one + local dev).
- **Repo:** public, MIT LICENSE at root — ready once B1 clears.
- **Video:** same YouTube URL (B2).

## Process rules (from FASE 5 spec)

1. Code freeze 4h before each submission — docs-only changes after freeze.
2. Submit ≥30 min before deadline (Arm: 2026-08-23; NeuralSprint: 2026-08-24).
3. Final text requires explicit user approval before submission.

## Confirmation (fill after submitting)

| Hackathon | Submitted at | Confirmation URL / screenshot | Status |
|---|---|---|---|
| Arm Create AI Optimization Challenge | — | — | NOT SUBMITTED |
| NeuralSprint | — | — | NOT SUBMITTED |
