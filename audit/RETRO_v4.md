# Retrospective — TicketSec Arm64 v4 (Phases 0–8)

**Date:** 2026-07-20  
**Branch:** `mission/v4`  
**Scope:** Close-out retrospective covering every phase from the baseline STATE MAP
through Phase 8 skill activation and final reporting.

---

## 1. What broke and bounced back

| Phase | Symptom | Root cause | Fix | Evidence |
|---|---|---|---|---|
| Phase 1 | Stale hardcoded accuracy in KPI card | `src/App.tsx` showed static "100%" before eval artifacts existed | Bound accuracy to `model/eval_results.json`; show `PENDING VALIDATION` when missing | `audit/HANDOFF_P1.md`, `src/App.tsx` |
| Phase 2 | Hex literals and token violations | Developers used `rgba(...)` directly in components instead of `tokens.css` | Audited and replaced with CSS variables; added contrast sweep | `audit/DEFECT_REPORT_D1_D7.md`, `src/styles/tokens.css` |
| Phase 3 | Root `MODEL_CARD.md` hash table stale | Artifact regenerated but claim ledger not updated | Recomputed SHA-256 hashes and refreshed latency numbers | `model/MODEL_CARD.md`, `audit/ML_TRACEABILITY.md` |
| Phase 3 | `OK` vs `COMPLETE` artifact status mismatch | `src/lib/artifacts.ts` only accepted `OK`; eval/latency artifacts emit `COMPLETE` | Updated `isArtifactReady()` to accept `OK` and `COMPLETE` identically | `src/lib/artifacts.ts:143-222` |
| Phase 4 | Empty chart states crashed on `[x]` | Components handled `[]` but not single-point series | Added zero-and-single-point guards across charts | `audit/PHASE4_QA_EVIDENCE.md` |
| Phase 5 | Rate limiter default 120 RPM contradicted docstring | Default changed to 60 RPM to match docs and security posture | `PREDICT_RATE_LIMIT_RPM=60` in `app/main.py`; verified 70 req → 60×200/10×429 | `SECURITY_REVIEW.md` F-01, `app/main.py` |
| Phase 6 | `scripts/gates.sh` failed on Windows Git Bash | Script used `bc` which is not installed; also CRLF line endings broke shell parsing | Replaced `bc` with `awk`; normalized line endings; used semicolons in PowerShell where needed | `scripts/gates.sh:30`, `ops/logs/verification.log` |
| Phase 6 | G8 tree-clean failed after gate run | `TEST_RESULTS_v4.md` was appended *before* the tree check | Flushed evidence to `TEST_RESULTS_v4.md` only **after** G8 passes | `scripts/gates.sh:83-85` |
| Phase 7 | Vitest failures after latency refresh | Tests expected old rounded values (`0.22ms`/`0.30ms`) from stale latency artifact | Updated `ModelPerformancePanel.test.tsx` and `ModelRegistry.test.tsx` to `0.24ms`/`0.29ms` | `tests/components/ModelPerformancePanel.test.tsx:43`, `tests/components/ModelRegistry.test.tsx:55` |
| Phase 7 | Vite dev server grabbed port 5174 | A stale process held `:5173`, so `npm run dev` used 5174 and axe failed | Killed stale process; restarted server explicitly on `--port 5173` | gate run log 2026-07-20 00:55:48Z |
| Phase 8 | `.github/workflows/quality-gates.yml` skipped G4/G8 and used weaker G6 regex | CI was written before local gates matured | Brought workflow to parity with `scripts/gates.sh`: optional axe, G6 allowlist, G8 tree check | `.github/workflows/quality-gates.yml` |

---

## 2. What the gates caught

- **G1 chunk budget:** caught a build-time size regression early in Phase 1.
- **G2 lint:** prevented unused imports and `console.log` leaks across every phase.
- **G3 vitest:** caught stale latency expectations in Phase 7 and the offline-
  silence regression in Phase 4.
- **G4 axe:** caught missing focus rings and heading-order issues in Phase 1.
- **G6 secrets scan:** caught benign but risky keyword matches in design-token
  files; led to the allowlist/exclude list.
- **G8 tree clean:** caught uncommitted `TEST_RESULTS_v4.md` appends and stray
  scratch files before they could be merged.

The gates changed from a late checklist into a design tool: if a phase ended
without a green gate, the phase was not done.

---

## 3. What the agent got wrong

- **YOLO auto-dismiss:** In early phases the agent occasionally interpreted a
  red gate as "informational" and moved on after narrative fixes rather than
  measurable ones. The 3-attempt rule in `AGENTS.md` was added to prevent this.
- **Surface-guard accidents:** A Windows-only `surface-guard` helper once
  interfered with git status parsing, causing a false dirty-tree failure. We
  switched to raw `git status --porcelain` checks.
- **CRLF assumptions:** Editing JSONL files on Windows introduced CRLF
  line endings that broke Linux-side parsing. We now let Git normalize text files
  and verify with `sha256sum`.
- **Latency rounding drift:** The agent updated `model/latency_t4g_micro.json`
  but did not immediately sync tests, causing a G3 failure in Phase 7. The fix
  was to grep for the old rounded values before committing a latency refresh.
- **CI drift:** The GitHub workflow was not kept in parity with local gates
  after `scripts/gates.sh` gained the G6 allowlist and G8 flush. Phase 8 closed
  this gap.

---

## 4. Rules mined from the pain (now in AGENTS.md)

1. Empty-state conditions must cover zero AND single-point series.
2. Artifact status parsing is centralized in `src/lib/artifacts.ts` and accepts
   `OK|COMPLETE`.
3. `scripts/gates.sh` uses `awk` (no `bc`) and the G6 allowlist.
4. Evidence flushes AFTER the G8 tree check.
5. Never trust a phase report without before/after screenshots or command output.

---

## 5. Honesty Contract retrospective

The contract was never intentionally violated, but it was stress-tested:

- Cached mode was triggered intentionally and during accidental API outages.
- The Event Log stayed silent in cached/offline mode in every test and manual
  drill.
- No screenshot was presented as "live" unless captured with a green `LIVE`
  badge.
- Every final metric in `README.md` and `DEVPOST_SUBMISSION.md` links to a
  committed artifact with SHA-256.

---

## 6. What to do differently next time

- Keep CI parity as a required sub-task of any gate change, not a follow-up.
- Add a `grep` pre-check for old rounded values before refreshing latency or
  accuracy artifacts.
- Run the WebBridge screenshot flow as part of any UI phase, not just at the
  end.
- Treat `.github/workflows/quality-gates.yml` as a first-class deliverable.
