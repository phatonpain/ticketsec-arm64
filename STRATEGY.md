# TicketSec Arm64 — Hackathon Strategy & Demo-Day Runbook

> **THE HONESTY CONTRACT (non-negotiable):** Every datum shown is either **live**
> (from the API), **cached** (amber `CACHED` badge, sourced from
> `public/cache/tickets-snapshot.json`), or shown as **"Unavailable — API offline"**.
> The Event Log records ONLY real events. Nothing is ever fabricated and presented
> as live.

## 1. Devpost Judging-Criteria Mapping

| Devpost criterion | TicketSec strength (the story) | Evidence artifact (committed) | Backing agent files |
|---|---|---|---|
| **Innovation/Impact** | Honesty Contract as differentiator: truthful LIVE / amber `CACHED` / "Unavailable — API offline" states plus a real-only Event Log — honesty by design in a SOC tool. | Badge states verified in `TEST_RESULTS_v3.md`; `MODEL_CARD.md` accuracy caveat; demo runbook (this file) | tech-writer.md, qa-engineer.md, hackathon-strategist.md |
| **Technical Execution** | INT8-quantized ONNX classifier (~0.22 MB) served by FastAPI on an AWS Graviton `t4g.micro` (ARM64, 2 vCPU, 1 GB RAM); React 19 + TypeScript + Vite frontend with lazy `echarts/core` chunks; singleton `useSyncExternalStore` stores. | `model/eval_results.json`, `model/latency_t4g_micro.json`, `model/probe_results.json`, `model/quantization.md`, `DEVOPS_RUNBOOK.md` | ml-engineer.md, backend-engineer.md, devops-sre.md |
| **Design/UX** | Enterprise SOC density (Splunk ES / CrowdStrike Falcon / Datadog class): design tokens in `src/styles/tokens.css`, 40 px table rows, 16 px card padding, Inter + JetBrains Mono, tabular numerals, WCAG 2.2 AA. | `A11Y_REPORT.md` (to be delivered by a11y-specialist.md); `TEST_RESULTS_v3.md` axe-clean evidence | design-engineer.md, a11y-specialist.md, frontend-engineer.md |
| **Completeness/Polish** | Working honest dashboard + live API path + cached degraded mode + full submission package (`README.md`, `DEVPOST_SUBMISSION.md`, `DEMO_SCRIPT.md`, `MODEL_CARD.md`, tests, runbook). | `TEST_RESULTS_v3.md`, `README.md`, `DEVPOST_SUBMISSION.md`, `DEMO_SCRIPT.md`, `DEVOPS_RUNBOOK.md` | qa-engineer.md, tech-writer.md, devops-sre.md |

## 2. Priority Backlog (P0 / P1 / P2)

Every item maps to at least one judging criterion. No orphan items.

| Pri | Item | Owning agent file | Criterion | Evidence gate |
|---|---|---|---|---|
| P0 | Backend live and reachable on Graviton (`ticketsec.service`, Security Group ingress, `uvicorn --host 0.0.0.0`) | devops-sre.md | Technical Execution + Completeness/Polish | `curl -s http://3.23.60.61:8000/health` returns 200; logged in `ops/logs/verification.log` |
| P0 | Commit `model/artifact.onnx` and run `model/eval.py` to replace PENDING eval artifacts with real held-out metrics | ml-engineer.md | Technical Execution | `model/eval_results.json` status = OK with sha256 + date; `model/confusion_matrix.json` OK |
| P0 | Run probe suite and latency measurement on live t4g.micro | ml-engineer.md | Technical Execution | `model/probe_results.json` and `model/latency_t4g_micro.json` status = OK |
| P0 | Submission package: `README.md`, `DEVPOST_SUBMISSION.md`, `DEMO_SCRIPT.md` | tech-writer.md | Completeness/Polish + Innovation/Impact | All three files committed; banned-phrase check = 0 matches; claim ledger complete |
| P0 | Demo-path verification: run both Branch A and Branch B of the demo-day runbook | qa-engineer.md | Completeness/Polish | `TEST_RESULTS_*.md` records both branches with screenshots/command output |
| P0 | This strategy artifact: `STRATEGY.md` with criteria mapping, backlog, timeline, and runbook | hackathon-strategist.md | All four (narrative coherence) | Committed; zero orphan items; ladder-consistent priorities |
| P1 | Finish enterprise-density redesign (`src/styles/tokens.css`, 40 px rows, 16 px card padding) | design-engineer.md + frontend-engineer.md | Design/UX | `npm run build` + `npm run lint` 0/0; visual screenshots in `TEST_RESULTS_*.md` |
| P1 | Accessibility report and axe verification (`A11Y_REPORT.md`) | a11y-specialist.md | Design/UX | `npx axe http://localhost:5173` = 0 violations; keyboard shortcuts documented and functional |
| P1 | Performance budget evidence (`PERF_BUDGET.md`) | performance-engineer.md | Technical Execution | Main JS chunk < 600 KB; lazy ECharts chunk documented; LCP/INP numbers if measured |
| P1 | Security review (`SECURITY_REVIEW.md`) | security-engineer.md | Completeness/Polish | `/predict` input handling, headers, secrets, CORS reviewed |
| P2 | Model card polish + extended probe coverage (>12 probes) | ml-engineer.md | Technical Execution | `MODEL_CARD.md` updated; probe suite expanded |
| P2 | Chart/dataviz polish while keeping lazy `echarts/core` chunks | dataviz-engineer.md | Design/UX | No regression in bundle budget; charts remain lazy-loaded |
| P2 | Demo-video retakes / extra screenshots for Devpost gallery | tech-writer.md | Completeness/Polish | Screenshots referenced in `README.md` and `DEVPOST_SUBMISSION.md` |

## 3. Submission Timeline / Checklist

| Deliverable | Owning agent file | Evidence gate | Status |
|---|---|---|---|
| `MODEL_CARD.md` | ml-engineer.md | All metrics traceable to `model/eval_results.json` etc.; accuracy wording with caveats | ✅ Draft committed (PENDING values honest) |
| `README.md` | tech-writer.md | Architecture ASCII, stack, quickstart, metrics slots, claim ledger | 🔄 This mission |
| `DEVPOST_SUBMISSION.md` | tech-writer.md | Banned-phrase check = 0; every number cited | 🔄 This mission |
| `DEMO_SCRIPT.md` | tech-writer.md | 60–90 s shot list; Branch A + Branch B per scene | 🔄 This mission |
| `STRATEGY.md` | hackathon-strategist.md | Criteria mapping, backlog, runbook, timeline | 🔄 This mission |
| `TEST_RESULTS_*.md` | qa-engineer.md | Build/lint 0/0, axe 0 violations, live/cached/offline matrix | ✅ v3 committed |
| Demo video recorded | tech-writer.md + qa-engineer.md | Recorded against runbook Branch A or B, with honest status badge visible | ⏳ Blocked on API status or final UI polish |
| Final Orchestrator sign-off | 01_ORCHESTRATOR.md | All gates above; Honesty Contract intact; no unmapped items | ⏳ Pending deliverables |

## 4. Demo-Day Runbook

Decision signal (only source allowed):

```bash
curl -s http://3.23.60.61:8000/health
```

- **Branch A — API live:** command returns HTTP 200 and valid JSON.
- **Branch B — API down:** command returns non-200, empty body, or times out.

### Branch A — API live (preferred)

1. Open dashboard at `http://localhost:5173`.
2. Confirm header shows green `LIVE` badge and last-sync timestamp.
3. Run the canonical classification curl:
   ```bash
   curl -s -X POST http://3.23.60.61:8000/predict -H 'Content-Type: application/json' -d '{"text":"suspicious login from unknown device"}'
   ```
4. In the UI, paste the same text into the **Live Prediction** panel and submit.
5. Show the returned `{category, confidence, processing_time_ms}` and the new real Event Log entry.
6. Switch to the **Recent Classifications** table and confirm the new row appears.
7. Narrate the ARM64/INT8 cost story using numbers from `model/latency_t4g_micro.json` and `model/quantization.md`.
8. End with Devpost submission link.

### Branch B — API down (honest degraded mode)

1. Open dashboard at `http://localhost:5173`.
2. Confirm header shows amber `CACHED` badge (sourced from `public/cache/tickets-snapshot.json`).
3. State on camera that the backend is currently unreachable and that the dashboard is designed to keep working honestly.
4. Point to the amber badge and the "Unavailable — API offline" surfaces (KPIs, live prediction panel).
5. Show the Event Log: it is silent — no synthetic entries are fabricated.
6. Explain that this is not a fallback excuse; it is a deliberate product feature for SOC environments where intermittent connectivity happens.
7. Still narrate the architecture and cost story, citing the committed (but PENDING) model artifacts and the intended `t4g.micro` target.
8. End with Devpost submission link.

**Rules for both branches:**
- Never hide the badge. The Honesty Contract is the demo.
- Never hand-edit `public/cache/tickets-snapshot.json` mid-demo.
- Never fabricate an Event Log entry.
- Every number spoken must trace to a committed artifact.

## 5. 60–90 Second Narrative Arc

This arc is the spine of `DEMO_SCRIPT.md`:

| Seconds | Beat | Branch A content | Branch B content |
|---|---|---|---|
| 0–5 | Hook | "SOC analysts drown in tickets." | Same hook |
| 5–15 | Problem | Six categories (Phishing · Malware · Unauthorized Access · Data Breach · DDoS · False Positive) and the need for fast triage. | Same problem framing |
| 15–45 | Core demo | Live classify one ticket via `/predict`; show `processing_time_ms`, LIVE badge, real Event Log entry. | Show amber `CACHED` badge and explain honest degraded mode; demonstrate that the UI never lies about data freshness. |
| 45–60 | Why ARM64/INT8 | 0.22 MB INT8 model on a `t4g.micro` (~$0.004/hour on-demand) — cite `model/quantization.md` and `model/latency_t4g_micro.json`. | Same cost story, with values marked PENDING until API returns. |
| 60–75 | Design/UX | Enterprise density, design tokens, keyboard shortcuts, `npx axe` = 0 — cite `A11Y_REPORT.md` / `TEST_RESULTS_v3.md`. | Same design evidence |
| 75–90 | CTA | "Vote for TicketSec Arm64 on Devpost." + URL. | Same CTA |

## 6. Conflict-Resolution Ladder Applied

**Honesty > Accessibility > Performance > Aesthetics > Speed.**

- If the UI team suggests hiding the `CACHED` badge to make Branch B "look more live," reject it — Honesty wins.
- If a heavier animation improves Aesthetics but risks the 600 KB main-chunk budget, keep the animation only if Performance evidence permits — Performance wins over Aesthetics.
- If adding a keyboard shortcut delays the submission by an hour, keep the shortcut — Accessibility wins over Speed.

## 7. Risks & Blockers

| Risk | Impact | Mitigation | Unblocks |
|---|---|---|---|
| `t4g.micro` stays unreachable | Cannot collect live latency/probe metrics; demo forced to Branch B | Already prepared Branch B runbook; PENDING artifacts are honest | devops-sre.md must restore service or confirm timeline |
| `model/artifact.onnx` not committed | `model/eval_results.json` stays PENDING | eval.py + test_set committed; README/Devpost use PENDING slots | ml-engineer.md / Felipe provides artifact |
| Hardcoded "100%" accuracy in `src/App.tsx` KPI card | Violates accuracy wording rule and Honesty Contract | Route to frontend-engineer.md to bind KPI to `model/eval_results.json` or show PENDING | 01_ORCHESTRATOR.md |
| Missing `A11Y_REPORT.md` / `PERF_BUDGET.md` / `SECURITY_REVIEW.md` | README links point to files that do not yet exist | Links are marked as owned by sibling agents; timeline reserves time for them | a11y-specialist.md, performance-engineer.md, security-engineer.md |

## 8. Drift vs `00_SHARED_CONTEXT.md`

- **React version:** SHARED_CONTEXT states React 18; `package.json` uses React 19. The frontend runs and builds cleanly. This drift is noted for the Orchestrator but does not block docs.
- **Stack fact — inline styles:** Confirmed; components use inline styles with CSS variables from `src/styles/tokens.css`.
- **Stack fact — stores:** Confirmed; `useApi`, `useEventLog`, `useTickets`, `useSettings`, `useTicketQuery` are singleton `useSyncExternalStore` stores.
- **Hardcoded accuracy in UI:** `src/App.tsx` KPI card previously showed static "100%" and "F1-Score: 0.98 · Precision: 0.97". This was corrected: the accuracy KPI now reads from `model/eval_results.json` and displays "—" with a gray `PENDING VALIDATION` chip while the artifact is pending. Related placeholder data in `src/lib/performanceSnapshot.ts` was removed and `ModelHealthDonut.tsx` now only shows verifiable sizes (INT8 artifact 0.22 MB vs the 700 MB systemd `MemoryMax`).
