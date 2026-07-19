# STATE MAP v4 — Phase 0 Read-Only Audit

> Produced per the MASTER MISSION v2 Constitution (Part A) and Operating Protocol (Part B).
> Phase 0 changed **no code**. A baseline `bash scripts/gates.sh` was run to establish the
> starting metric set; the resulting evidence was committed to `TEST_RESULTS_v4.md`.

## 1. Repository snapshot

| Field | Value |
|---|---|
| Path | `D:\Git\ticketsec-arm64-dashboard` |
| Branch | `mission/v4` |
| HEAD | `d5fbcc5` — `docs: record Phase 0 baseline gate run (11/11 PASS)` |
| Audit date | 2026-07-19 19:50 UTC-3 |
| Gate status | **11/11 PASS** (latest run 2026-07-19 19:43:59Z) — see `TEST_RESULTS_v4.md` |
| Tree status | clean |

## 2. Constitution compliance (Part A)

| Article | Status | Evidence / Notes |
|---|---|---|
| A1 — DESIGN_BRIEF.md + tokens.css + Honesty Contract override everything | ✅ | `AGENTS.md` codifies this; `useApi` store has `live \| cached \| offline`; honesty matrix tests cover all 5 views. |
| A2 — No new deps without justification; surgical diffs only | ✅ | `package.json` unchanged during v4 stabilization; no new dependencies introduced. |
| A3 — Every UI number traces to artifact or store source | ⚠️ | Most numbers trace correctly, but `ModelHealthDonut.tsx` still hardcodes `MODEL_INT8_MB = 0.38` and `MEMORY_MAX_MB = 700` instead of loading `model/artifact_meta.json`. Root `MODEL_CARD.md` hash table is stale. |
| A4 — No guessing; mark UNKNOWN | ✅ | Phase 0 observations are from `ReadFile`/`Glob`/`Grep`/`Shell` and verified against committed files. Unknowns are marked. |
| A5 — Gates are machine-checkable | ✅ | `scripts/gates.sh` defines G1, G2, G3, G4, G6, G8 with commands, expected outputs, and evidence path (`TEST_RESULTS_v4.md`). |
| A6 — Never lower/skip/reinterpret a gate | ✅ | No gate was lowered. The only recent failures (G3 flake, G8 dirty tree) were root-caused and fixed. |
| A7 — Writer ≠ Reviewer | ⚠️ | Not exercised in Phase 0 (no behavior-changing artifact produced). Future phases must use isolated reviewer sub-agents or `/fork`. |
| A8 — Statistical honesty | ✅ | `model/eval.py` uses seed 42 + GroupShuffleSplit; calibration, probe suite, and latency measurement protocols are committed. |
| A9 — Reversibility before boldness | ✅ | Baseline checkpoint `d5fbcc5` is committed and green; rollback/rollback scripts exist in `ops/`. |
| A10 — No empty victory claims | ✅ | This map explicitly lists unresolved blockers and partial items. |

## 3. Operating Protocol readiness (Part B)

| Protocol | Status | Notes |
|---|---|---|
| B1 — Session hygiene, compact at ~70% context | ✅ | Context preserved across compaction; session focus = finalize D1–D7, run master mission Phase 0. |
| B2 — HANDOFF contract | ✅ | `audit/HANDOFF_v4.md` exists; `audit/HANDOFF_TEMPLATE.md` is available for Phase 1+. |
| B3 — Git checkpoints | ✅ | Baseline green commit `d5fbcc5` on `mission/v4`; recommend tagging `baseline-v4` before Phase 1. |
| B4 — Permission policy | ✅ | Phase 0 read-only. No `ops/`, deploy, deletion, or `package.json` changes. |
| B5 — Phase budgets | N/A | Phase 0 budget not enforced; deliverable is this STATE MAP. |

## 4. Mission/artifact inventory

| Artifact | Status | Owner persona | Notes |
|---|---|---|---|
| `DESIGN_BRIEF.md` | ✅ APPLIED | Product Designer | Current, referenced by AGENTS.md; §4 anatomy specs implemented in components. |
| `src/styles/tokens.css` | ✅ APPLIED | UI Analyst | Single token source; rgba values defined here, consumed via CSS vars. |
| `AGENTS.md` | ✅ APPLIED | Tech Lead | Current rules including v4 retrospective additions. One stale convention: says views live in `src/views/`, actual views are in `components/Views.tsx`. |
| `RUBRIC.md` | ✅ APPLIED | Tech Lead | 6 dimensions, threshold mean ≥4.0; `audit/RUBRIC_SCORES_v4.md` exists. |
| `.github/workflows/quality-gates.yml` | ⚠️ PARTIAL | SRE/DevOps | Runs G1, G2, G3, G6; skips G4 axe and G8 tree-clean; uses weaker secrets regex than local `gates.sh`. |
| `README.md` | ✅ APPLIED | Technical Writer | Architecture diagram, honest metrics table, live screenshots, MIT badge. |
| `MODEL_CARD.md` (root) | ⚠️ PARTIAL | ML Engineer | Accurate narrative, but "Current Artifact Hashes" table is dated 2026-07-18 with stale SHAs; latency p50/p95 rounded to 0.230/0.310 ms vs artifact 0.224/0.296 ms. |
| `model/MODEL_CARD.md` | ✅ APPLIED | ML Engineer | Synced to current eval/quantization/calibration/latency/probe artifacts. |
| `DEVPOST_SUBMISSION.md` | ⚠️ PARTIAL | Technical Writer | Claims trace to artifacts; main JS chunk size claims 299.37 KB (stale; current 309.71 KB). |
| `DEMO_SCRIPT.md` | ✅ APPLIED | Technical Writer | Branch A/B runbook, 60–90 s shot list, traceability ledger. |
| `STRATEGY.md` | ✅ APPLIED | Tech Lead/PM | Criteria mapping, backlog, timeline. References `A11Y_REPORT.md` and `PERF_BUDGET.md` which do not exist. |
| `SECURITY_REVIEW.md` | ✅ APPLIED | AppSec/Red Team | Findings register, false-positive register, CORS plan, npm audit triage. Open: CORS wildcard, Redis rate limiter (post-demo). |
| `DEVOPS_RUNBOOK.md` | ✅ APPLIED | SRE/DevOps | systemd unit, SG rules, external verification. Last status timestamp 2026-07-19T07:34:50Z. |
| `M8_VISUAL_DELIVERABLES.md` | ✅ APPLIED | Product Designer | Side-by-side screenshots exist in `screenshots/m8/`; rubric scores ≥9/10 reported. |
| `TEST_RESULTS_v4.md` | ✅ APPLIED | QA Lead | Current; latest run appended by Phase 0 baseline. |
| `TEST_RESULTS_v2.md`, `TEST_RESULTS_v3.md` | 🗑️ OBSOLETE | QA Lead | Historical; kept for traceability but no longer the evidence file. |
| `audit/DEFECT_REPORT_D1_D7.md` | ✅ APPLIED | Tech Lead | D1–D6 fixed; D7 removed after user approval. |
| `audit/FINAL_REPORT_v4.md` | ✅ APPLIED | Tech Lead | Part F metrics table and close-out evidence. |
| `audit/HANDOFF_v4.md` | ✅ APPLIED | Tech Lead | Done/open/warnings; open items feed this map. |
| `audit/ML_TRACEABILITY.md` | ✅ APPLIED | ML Engineer | Maps every ML claim to artifact and verification command. |
| `audit/PHASE4_QA_EVIDENCE.md` | ✅ APPLIED | QA Lead | Vitest, axe, contrast, honesty matrix evidence. |
| `audit/RETRO_v4.md` | ✅ APPLIED | Tech Lead | Retrospective and learned rules. |
| `audit/RUBRIC_SCORES_v4.md` | ✅ APPLIED | Tech Lead | Adversarial review: mean 4.2, no dimension <3. |
| `screenshots/**` | ✅ APPLIED | QA Lead / Tech Writer | Live screenshots and D1–D5 1366px evidence present. |
| `FIX_PACK*` / `fixpack*/` | 🗑️ OBSOLETE / not found | — | No FIX_PACK files remain in repo root; fixes have been committed and documented. |
| `KIMICODE.md` | ❓ UNKNOWN | — | Not found in repo root. |

## 5. Doc ↔ code cross-check (contradictions & gaps)

| # | Finding | Severity | Evidence |
|---|---|---|---|
| F1 | Root `MODEL_CARD.md` hash table is stale (dated 2026-07-18) | Medium | `model/eval_results.json` SHA in card = `e5079248…`; actual = `74adeac8…`; `model/probe_results.json` SHA in card = `bca44440…`; actual = `833975a3…` |
| F2 | Root `MODEL_CARD.md` latency rounding mismatch | Low | Card reports 0.230/0.310 ms; `model/latency_t4g_micro.json` records 0.224/0.296 ms |
| F3 | `DEVPOST_SUBMISSION.md` main-chunk size stale | Low | Claims 299.37 KB; current baseline = 309.71 KB |
| F4 | `AGENTS.md` view-directory convention vs. code | Low | AGENTS.md says `src/views/<Name>/`; actual views are in `src/components/Views.tsx` and per-view components |
| F5 | Missing `A11Y_REPORT.md` / `PERF_BUDGET.md` | Low | `STRATEGY.md` and README links reference them; files do not exist (not required by gates, but linked) |
| F6 | No per-view error boundaries | Medium | `AGENTS.md` convention: "one error boundary per view root"; grep finds zero `ErrorBoundary` usage in `src/` |
| F7 | Tracked scratch/output files at repo root | Medium | `test_*.txt`, `tmp_*.py`, `test_results*.json`, debug logs are committed and not gitignored; should be quarantined/deleted in Phase 2 |
| F8 | CI workflow weaker than local gates | Medium | Skips G4 axe, G8 tree-clean; weaker G6 regex; no comment/benign-file exclusions |
| F9 | `ModelHealthDonut` hardcodes model size / budget | Low | `MODEL_INT8_MB = 0.38`, `MEMORY_MAX_MB = 700` in source; values match `model/artifact_meta.json` but are not loaded dynamically |
| F10 | `model/calibration.json` not surfaced in UI | Low | ECE 0.3946 exists only in documentation; no UI component consumes it |

## 6. Codebase map

### Frontend (`src/`)

| Area | Key files |
|---|---|
| App shell & routing | `App.tsx`, `main.tsx`, `components/Views.tsx` |
| Views | `components/Dashboard.tsx`, `DetectionsView`, `PredictionsView`, `ThreatAnalyticsView`, `ModelRegistryView`, `SystemHealthView` in `Views.tsx` |
| Core table | `components/ClassificationTable.tsx`, `ExpandedRow.tsx`, `DetectionFilters.tsx` |
| Honest stores | `hooks/useApi.ts`, `hooks/useTickets.ts`, `hooks/useEventLog.ts`, `hooks/useTicketQuery.ts`, `hooks/useSettings.ts`, `hooks/useTimeRange.ts`, `hooks/useProbeHistory.ts` |
| Charts | `components/ThreatBarChart.tsx`, `SeverityMixDonut.tsx`, `ModelHealthDonut.tsx`, `PerformanceLineChart.tsx`, `TimelineChart.tsx`, `CategoryCountBlocks.tsx`, `ThreatDistributionDonut.tsx`, `ECharts.tsx` |
| UI chrome | `components/Header.tsx`, `Sidebar.tsx`, `Footer.tsx`, `KpiCard.tsx`, `ProvenanceBadge.tsx`, `SnapshotFooter.tsx`, `EventLog.tsx`, `CommandPalette.tsx`, `SettingsDrawer.tsx`, `HelpModal.tsx`, `HealthStatRow.tsx`, `SystemMonitor.tsx` |
| Design system | `styles/tokens.css`, `lib/chartTokens.ts`, `lib/utils.ts` |
| Utilities | `lib/exportCsv.ts`, `lib/formatRelativeTime.ts`, `lib/paginate.ts`, `lib/timeRange.ts`, `lib/backoff.ts`, `lib/artifacts.ts` |

### Backend / Model

| Area | Key files |
|---|---|
| FastAPI service | `app/main.py`, `app/requirements.txt` |
| Model artifacts | `model/artifact.onnx` (INT8, 401,770 bytes), `model/artifact_fp32.onnx` |
| Evaluation | `model/eval.py`, `model/eval_results.json`, `model/confusion_matrix.json`, `model/calibration.json` |
| Probes / latency | `model/run_probe_suite.py`, `model/probe_results.json`, `model/measure_latency.py`, `model/latency_t4g_micro.json`, `model/latency_local.json` |
| Training / export | `model/train.py`, `model/export_onnx.py`, `model/quantization.md`, `model/artifact_meta.json` |
| Dataset | `data/tickets_dataset.jsonl`, `data/seeds.py`, `data/expand.py` |
| Cached snapshot | `public/cache/tickets-snapshot.json` |

### Operations

| Script | Purpose |
|---|---|
| `ops/deploy.sh` | Systemd deploy (has placeholder copy step) |
| `ops/rollback.sh` | Swap current ↔ `.prev` backend and restart |
| `ops/health-check.sh` | One-shot remote health curl logger |
| `ops/snapshot-refresh.sh` | Refresh `public/cache/tickets-snapshot.json` from live API |
| `ops/ticketsec.service` | systemd unit (`MemoryMax=700M`, `Restart=always`) |

### Tests

- 25 test files across `tests/components/`, `tests/flows/`, `tests/hooks/`, `tests/lib/`.
- Latest baseline: **25 passed (25)**, **170 tests passed**, 0 failed, 0 skipped, 0 `it.fails`.

## 7. DESIGN_BRIEF quick-scan findings

| Violation | Location | Detail |
|---|---|---|
| No error boundaries | `src/` (global) | AGENTS.md convention says one per view root; none implemented. |
| Tracked scratch files | repo root | `test_*.txt`, `tmp_*.py`, debug logs are not production code. |
| Stale model-card hashes | `MODEL_CARD.md` | Hash table does not match current artifact SHAs. |

> No banned words ("Guardian", "blazing", etc.) found in `src/`. No `dangerouslySetInnerHTML` usage. No raw `#fff`/`12px` defaults detected in current components.

## 8. Quality gates baseline

`bash scripts/gates.sh` (run 2026-07-19 19:43:59Z):

| Gate | Result | Evidence |
|---|---|---|
| G1 build | PASS | `npm run build` exit 0 |
| G1 chunk | PASS | 309.71 KB < 600 KB |
| G2 lint | PASS | 0 errors / 0 warnings |
| G3 vitest | PASS | 25 files, 170 passed, 0 `it.fails`, 0 skips |
| G4 axe dashboard | PASS | 0 violations |
| G4 axe detections | PASS | 0 violations |
| G4 axe analytics | PASS | 0 violations |
| G4 axe registry | PASS | 0 violations |
| G4 axe health | PASS | 0 violations |
| G6 secrets scan | PASS | clean; `ticketsec-key.pem` not found |
| G8 tree clean | PASS | `git status --porcelain` empty |

Additional metrics:

- Contrast: 23/23 AA (`contrast_report.py` / `contrast-report.json`)
- npm audit: 3 high findings, all dev-only `@axe-core/cli` → `chromedriver` → `adm-zip` (triaged)

## 9. Open blockers / prioritized work list

### P0 — must resolve before submission

| # | Item | Owner | Evidence gate |
|---|---|---|---|
| 1 | Update root `MODEL_CARD.md` hash table and latency values to match current artifacts | ML Engineer / Tech Writer | Hash table dates/SHAs match `model/eval_results.json`, `model/latency_t4g_micro.json`, etc. |
| 2 | Verify live `POST /predict` on Graviton and log output | DevOps/SRE + QA | `ops/logs/verification.log` timestamped entry |
| 3 | Quarantine/remove tracked scratch files at repo root (`test_*.txt`, `tmp_*.py`, debug logs) | Staff Engineer + Tech Lead | Tree clean after deletion; human approval per B4 |
| 4 | Add per-view error boundaries (or update AGENTS.md convention) | Staff Engineer | No `ErrorBoundary` usage becomes bounded error UI; or convention revised |
| 5 | Record demo video against runbook Branch A or B | Tech Writer + QA | Video file + DEVPOST_SUBMISSION.md gallery link |
| 6 | Final Orchestrator sign-off | Orchestrator | All P0 items closed |

### P1 — should resolve if time permits

| # | Item | Owner | Evidence gate |
|---|---|---|---|
| 7 | Deliver `A11Y_REPORT.md` and `PERF_BUDGET.md` or remove dead links | a11y-specialist / performance-engineer / tech-writer | Files exist OR links removed from README/STRATEGY |
| 8 | Wire `ModelHealthDonut` to `model/artifact_meta.json` instead of hardcoded size/budget | Staff Engineer | Source code imports artifact meta; no hardcoded MB values |
| 9 | Harden `.github/workflows/quality-gates.yml` to match local gates (G4, G8, G6 exclusions) | SRE/DevOps | CI run includes axe per route and tree-clean check |
| 10 | Post-demo CORS wildcard hardening plan execution | AppSec | `ALLOW_ORIGINS` env var set to explicit list |
| 11 | Replace in-memory rate limiter with Redis/API Gateway | AppSec | Architecture doc + implementation plan |

### P2 — future improvements

| # | Item | Owner |
|---|---|---|
| 12 | Containerize backend (`Dockerfile` + `docker-compose.yml`) | SRE/DevOps |
| 13 | Expand adversarial probe suite beyond 14 probes | ML Engineer / QA |
| 14 | Admin view for retraining triggers and model-version tracking | Backend Engineer |
| 15 | Surface calibration (ECE) in Model Registry if judged relevant | ML Engineer / Product Designer |

## 10. Phase readiness verdict

- **Phase 0 is complete.** The repository state is inventoried, the baseline gate run is green, documentation status is mapped, and contradictions/gaps are recorded.
- **Recommended before Phase 1:** Create a `baseline-v4` tag at `d5fbcc5`, then resolve F1–F3 documentation drifts and the error-boundary gap.
- **No behavior-changing code was written in Phase 0.**

**STOP for human review before Phase 1.**
