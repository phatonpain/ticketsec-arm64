# STATE MAP v4 — Phase 0 Read-Only Audit

> Produced per the MASTER MISSION v2 Constitution (Part A) and Operating Protocol (Part B).
> No code changes were made in Phase 0.
>
> **Phase 0 close-out note (2026-07-19):** the documentation contradictions
> identified in §4 (model-size 0.22 MB vs 0.38 MB, stale `[PENDING]` metric labels,
> stale SHA-256 hashes, stale API badge, and incorrect repo paths) were resolved
> before Phase 1. This STATE MAP preserves the original Phase 0 observations for
> traceability; see the subsequent commits for the fixes.

## 1. Repository snapshot

| Field | Value |
|---|---|
| Path | `D:\Git\ticketsec-arm64-dashboard` |
| Branch | `mission/v4` |
| HEAD | `9449322` — `docs(audit): v4 handoff and refreshed gate evidence` |
| Audit date | 2026-07-19 01:55:32 -03:00 |
| Gate status | **All 11 checks PASS** (latest run 2026-07-19 04:47:12Z) — see `TEST_RESULTS_v4.md` |
| Vite dev server | Running on `localhost:5173` for G4 axe checks |

## 2. Constitution compliance (Part A)

| Article | Status | Evidence / Notes |
|---|---|---|
| A1 — DESIGN_BRIEF.md + tokens.css + Honesty Contract override everything | ✅ | `AGENTS.md` codifies this; all major stores (`useApi`, `useTickets`, `useEventLog`) implement live/cached/offline states honestly. |
| A2 — No new deps without justification; surgical diffs only | ✅ | Recent commits are minimal and scoped; no `package.json` changes in v4 stabilization. |
| A3 — Every UI number traces to artifact or store source | ⚠️ | Most numbers trace correctly, but documentation contains contradictory model-size claims (0.22 MB vs 0.38 MB) and hash mismatches (see §4). |
| A4 — No guessing; mark UNKNOWN | ✅ | Phase 0 is read-only and based on `ReadFile`/`Glob`/`Grep`/`Shell` probing. |
| A5 — Gates are machine-checkable | ✅ | `scripts/gates.sh` defines G1, G2, G3, G4, G6, G8 with commands + expected output + evidence path (`TEST_RESULTS_v4.md`). |
| A6 — Never lower/skip/reinterpret a gate | ✅ | All red gates were fixed, not reinterpreted. G3 flakiness fixed via test stabilization; G8 race fixed via evidence-flush ordering. |
| A7 — Writer ≠ Reviewer | ⚠️ | Not exercised yet; no behavior-changing artifact has been produced in Phase 0. Future phases must use isolated reviewer sub-agents. |
| A8 — Statistical honesty | ✅ | `model/eval.py` uses seed 42 + stratified 80/20 split; probe suite and latency measurement protocols are committed. |
| A9 — Reversibility before boldness | ✅ | Every gate fix was committed incrementally; `git log` shows clear rollback points. |
| A10 — No empty victory claims | ✅ | `HANDOFF_v4.md` explicitly lists open P0 items. |

## 3. Operating Protocol readiness (Part B)

| Protocol | Status | Notes |
|---|---|---|
| B1 — Session hygiene, compact at ~70% context | ✅ | Context was compacted earlier; current session started with preserved focus: gates green, G3/G8 stabilization, evidence commit. |
| B2 — HANDOFF contract | ✅ | `audit/HANDOFF_v4.md` exists with done/open/warnings/context sections. `audit/HANDOFF_TEMPLATE.md` exists for future phases. |
| B3 — Git checkpoints | ✅ | Branch `mission/v4` exists; baseline tag not yet created (per protocol, before Phase 1). Commit history is incremental and conventional. |
| B4 — Permission policy | ✅ | Phase 0 is read-only. No `ops/`, deploy, deletion, or `package.json` changes. |
| B5 — Phase budgets | N/A | Phase 0 budget not enforced; deliverable is this STATE MAP. |

## 4. Doc ↔ code cross-check (contradictions & gaps)

| # | Finding | Severity | Evidence |
|---|---|---|---|
| F1 | **Model size claim inconsistent** | Medium | `DEVPOST_SUBMISSION.md` and `DEMO_SCRIPT.md` say "~0.22 MB"; `MODEL_CARD.md`, `README.md` stack table, and `model/artifact.onnx` (401,770 bytes) say **0.38 MB**. `STRATEGY.md` also says "~0.22 MB". |
| F2 | **Metrics status inconsistent** | Medium | `DEVPOST_SUBMISSION.md` marks accuracy, P/R/F1, latency, probes as `[PENDING]`, but `model/eval_results.json`, `model/confusion_matrix.json`, `model/probe_results.json`, and `model/latency_t4g_micro.json` all report `status: OK` with real numbers. `README.md` project layout still labels these files as `(PENDING)`. |
| F3 | **Claim-ledger SHA-256/date mismatches** | Medium | `DEVPOST_SUBMISSION.md` lists `model/eval_results.json` SHA `8bc522da…` and latency SHA `addc0f2f…` dated 2026-07-17; actual committed hashes are `e5079248…` and `12af0641…` dated 2026-07-18 (per `MODEL_CARD.md` and filesystem). |
| F4 | **README links to missing files** | Low | `README.md` links to `PERF_BUDGET.md` and `A11Y_REPORT.md` — neither exists. |
| F5 | **`RUBRIC.md` links to missing file** | Low | References `audit/RUBRIC_SCORES.md` — does not exist. |
| F6 | **`DEMO_SCRIPT.md` / `STRATEGY.md` cite missing file** | Low | Reference `00_SHARED_CONTEXT.md` — does not exist. |
| F7 | **`DEVOPS_RUNBOOK.md` wrong repo path** | Low | Sections 7 and 10 use `D:\ComfyUI\ticketsec-arm64-dashboard`; actual repo is `D:\Git\ticketsec-arm64-dashboard`. |
| F8 | **`README.md` API badge stale** | Low | Badge reads "API offline (PENDING)" red, but `curl http://3.23.60.61:8000/health` returned HTTP 200 `{"status":"ok"}` during Phase 0. |
| F9 | **DESIGN_BRIEF violations spotted** | Low | `SettingsDrawer.tsx:289` uses banned word "Guardian"; several components use raw `rgba()` fallbacks or hardcoded `#fff`/`12px` defaults (full list in §6). |
| F10 | **Placeholder screenshots** | Low | `README.md` explicitly notes screenshots are placeholders pending final UI polish / live API. |

## 5. Codebase map

### Frontend (`src/`)

| Area | Key files |
|---|---|
| App shell & routing | `App.tsx`, `main.tsx`, `components/Views.tsx` |
| Views | `components/Dashboard.tsx`, `DetectionsView`, `PredictionsView`, `ThreatAnalyticsView`, `ModelRegistryView`, `SystemHealthView` |
| Core table | `components/ClassificationTable.tsx`, `ExpandedRow.tsx`, `DetectionFilters.tsx` |
| Honest stores | `hooks/useApi.ts`, `hooks/useTickets.ts`, `hooks/useEventLog.ts`, `hooks/useTicketQuery.ts`, `hooks/useSettings.ts`, `hooks/useTimeRange.ts` |
| Charts | `components/ThreatBarChart.tsx`, `SeverityMixDonut.tsx`, `ModelHealthDonut.tsx`, `PerformanceLineChart.tsx`, `TimelineChart.tsx`, `CategoryCountBlocks.tsx`, `ECharts.tsx` |
| UI chrome | `components/Header.tsx`, `Sidebar.tsx`, `Footer.tsx`, `KpiCard.tsx`, `ProvenanceBadge.tsx`, `SnapshotFooter.tsx`, `EventLog.tsx`, `CommandPalette.tsx`, `SettingsDrawer.tsx`, `HelpModal.tsx` |
| Design system | `styles/tokens.css`, `lib/chartTokens.ts`, `lib/utils.ts` |
| Utilities | `lib/exportCsv.ts`, `lib/formatRelativeTime.ts`, `lib/paginate.ts`, `lib/timeRange.ts`, `lib/backoff.ts` |

### Backend / Model

| Area | Key files |
|---|---|
| FastAPI service | `app/main.py`, `app/requirements.txt` |
| Model artifacts | `model/artifact.onnx` (INT8, 401,770 bytes), `model/artifact_fp32.onnx` |
| Evaluation | `model/eval.py`, `model/eval_results.json`, `model/confusion_matrix.json` |
| Probes / latency | `model/run_probe_suite.py`, `model/probe_results.json`, `model/measure_latency.py`, `model/latency_t4g_micro.json`, `model/latency_local.json` |
| Training / export | `model/train.py`, `model/export_onnx.py`, `model/quantization.md` |
| Dataset | `data/tickets_dataset.jsonl`, `data/seeds.py`, `data/expand.py` |
| Cached snapshot | `public/cache/tickets-snapshot.json` |

### Operations

| Script | Purpose |
|---|---|
| `ops/deploy.sh` | Systemd deploy (has placeholder copy step; path mismatch with service) |
| `ops/rollback.sh` | Swap current ↔ `.prev` backend and restart |
| `ops/health-check.sh` | One-shot remote health curl logger |
| `ops/snapshot-refresh.sh` | Refresh `public/cache/tickets-snapshot.json` from live API |
| `ops/ticketsec.service` | systemd unit (`MemoryMax=700M`, `Restart=always`) |

### Tests

- 20 test files across `tests/components/`, `tests/flows/`, `tests/hooks/`, `tests/lib/`.
- Latest run: **20 passed (20)**, **146 tests passed**, 0 `it.fails`, 0 skips.

## 6. DESIGN_BRIEF quick-scan findings

| Violation | Location | Detail |
|---|---|---|
| Banned word "Guardian" | `SettingsDrawer.tsx:289` | Footer text `"TicketSec Arm64 Guardian v0.0.1"`. |
| Raw `rgba()` overlays | `CommandPalette.tsx:287`, `HelpModal.tsx:42`, `SettingsDrawer.tsx:65` | Hardcoded backdrop alphas. |
| Raw `rgba()` / hex fallbacks | `ClassificationTable.tsx`, `ExpandedRow.tsx`, `ChartSkeleton.tsx`, `SettingsDrawer.tsx` | Inline style fallbacks bypass tokens. |
| Hardcoded `#fff` | `SettingsDrawer.tsx:261` | Reduced-motion toggle knob. |
| Hardcoded `12px` radius default | `HelpModal.tsx:54` | Overrides `--radius-md: 8px`. |
| Hardcoded API endpoint duplicated | `useSettings.ts:4`, `Footer.tsx:43`, `SettingsDrawer.tsx:121` | `http://3.23.60.61:8000` repeated. |
| Empty states without next step | `ThreatDistributionDonut.tsx`, `SeverityMixDonut.tsx` | Missing `nextStep` action. |

> None of these are blockers for Phase 0, but they should be triaged before Phase 1 UI work.

## 7. Quality gates baseline

`bash scripts/gates.sh` (latest run 2026-07-19 04:47:12Z):

| Gate | Result |
|---|---|
| G1 build | PASS |
| G1 chunk 301.39 KB < 600 KB | PASS |
| G2 lint 0/0 | PASS |
| G3 vitest green, 0 it.fails/skips | PASS |
| G4 axe dashboard | PASS |
| G4 axe detections | PASS |
| G4 axe analytics | PASS |
| G4 axe registry | PASS |
| G4 axe health | PASS |
| G6 secrets scan clean | PASS |
| G8 tree clean | PASS |

## 8. Open blockers / risks

From `STRATEGY.md`, `audit/HANDOFF_v4.md`, and Phase 0 probing:

| # | Blocker / Risk | Owner | Priority | Status |
|---|---|---|---|---|
| 1 | Resolve doc contradictions (model size, metric status, hashes) | tech-writer.md | P0 | Open |
| 2 | Align `ops/deploy.sh` path with `ops/ticketsec.service` | devops-sre.md | P0 | Open |
| 3 | Verify live `POST /predict` on Graviton (health is 200, but classify path not yet exercised) | devops-sre.md / qa-engineer.md | P0 | Open |
| 4 | Record demo video (Branch A or B) | tech-writer.md + qa-engineer.md | P0 | Open |
| 5 | Final Orchestrator sign-off | 01_ORCHESTRATOR.md | P0 | Open |
| 6 | Deliver `A11Y_REPORT.md` and `PERF_BUDGET.md` if required | a11y-specialist.md / performance-engineer.md | P1 | Open |
| 7 | Replace placeholder screenshots in `README.md` | tech-writer.md | P1 | Open |
| 8 | Measure / commit `model_load_s` for latency JSONs | ml-engineer.md | P1 | Open |
| 9 | Fix DESIGN_BRIEF violations listed in §6 | frontend-engineer.md + design-engineer.md | P1 | Open |

## 9. Phase readiness verdict

- **Phase 0 complete.** The repository state is inventoried, the gate baseline is green, and contradictions are documented.
- **Recommended before Phase 1:** Resolve F1–F3 documentation contradictions and create the `baseline-v4` tag (per B3).
- **No code changes were made.** Awaiting human review.
