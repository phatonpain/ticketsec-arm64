# TicketSec Arm64 — Devpost Submission

> **THE HONESTY CONTRACT:** Every datum shown is either **live** (from the API), **cached** (amber `CACHED` badge, sourced from `public/cache/tickets-snapshot.json`), or shown as **"Unavailable — API offline"**. The Event Log records ONLY real events. Nothing is ever fabricated and presented as live.

---

## Inspiration

I work as an IT analyst and am moving into cybersecurity. Most days I see the same problem: a security team gets flooded with alerts and support tickets, and the first hour is spent sorting noise from real incidents. I wanted to build a small, honest SOC dashboard that classifies tickets automatically and never lies about whether the data is live or cached. If the backend goes down during a demo — or in production — the UI should say so, not hide it.

## What it does

TicketSec Arm64 is a security-operations dashboard that classifies IT/security tickets into six categories:

**Phishing · Malware · Unauthorized Access · Data Breach · DDoS · False Positive**

It shows KPI cards, a threat-category bar chart, a model-health donut, a 24-hour performance line, a sortable ticket table, a terminal-style Event Log, and a Live Prediction panel where you can paste ticket text and call the real `/predict` endpoint.

The distinguishing feature is the Honesty Contract: every surface shows one of three states — a green `LIVE` badge when the API responds, an amber `CACHED` badge when the API is down but a snapshot exists, or "Unavailable — API offline" when there is no data. The Event Log records only real events; it stays silent when the API is unreachable.

## How we built it

- **Frontend:** React 19 + TypeScript + Vite. State lives in singleton `useSyncExternalStore` stores (`useApi`, `useEventLog`, `useTickets`, `useSettings`, `useTicketQuery`) so every component shares one source of truth. Charts use Apache ECharts loaded lazily through `echarts/core` to keep the main bundle small. Styling is done with inline styles plus CSS variables in `src/styles/tokens.css`.
- **Backend:** FastAPI serving an INT8-quantized ONNX text classifier (~0.38 MB) on an AWS Graviton `t4g.micro` (ARM64, 2 vCPU, 1 GB RAM). The `POST /predict` endpoint returns `{predicted_category, confidence, processing_time_ms, probabilities}`.
- **Deployment:** systemd unit `ticketsec.service` with `MemoryMax=700M`, `Restart=always`, and Security Group ingress on port 8000. Deployment, rollback, and reboot-survival steps are in [`DEVOPS_RUNBOOK.md`](./DEVOPS_RUNBOOK.md).
- **Model evaluation:** A held-out evaluation script (`model/eval.py`) uses `GroupShuffleSplit(test_size=0.2, groups=seed_id, random_state=42)` and commits per-class precision/recall/F1 plus a confusion matrix. Temperature scaling was fit on the same held-out test set; ECE dropped from 0.3946 to 0.0172. Adversarial probe results and live Graviton latency measurements are committed in `model/probe_results.json` and `model/latency_t4g_micro.json`.
- **Security:** `/predict` is rate-limited (60 RPM per IP), input is sanitized, error responses never leak stack traces, and CORS is configurable via `ALLOW_ORIGINS`. Details are in [`SECURITY_REVIEW.md`](./SECURITY_REVIEW.md).
- **Quality:** `npm run build` and `npm run lint` pass with zero warnings/errors; `npx vitest run` passes with 178 tests and zero skips; `npx axe` reports zero violations per route; the main JS chunk is 315.86 KB; contrast sweep is 23/23 AA; `bash scripts/gates.sh` is 11/11 PASS.

## Engineering story — why the deployed model is not the accuracy winner

The ablation study found a stronger candidate (`C2_char3-5_word1-2_LR_C2.0`) at **93.60%** accuracy. That candidate combines word and character n-grams. Unfortunately, `skl2onnx` does not export `TfidfVectorizer` with `analyzer="char_wb"`, so C2 cannot be converted to ONNX. Rather than ship a prettier accuracy number that cannot run on Graviton, we deployed the best ONNX-exportable candidate (`C1_word_1-2_LR_C2.0`) at **92.94%**. The trade-off is logged in `model/eval_results.json` (`winner_candidate_id` vs `deployed_candidate_id`) and in [`MODEL_CARD.md`](./MODEL_CARD.md).

This is the central engineering decision of the project: **ship the model that runs on the target hardware, not the one that scores highest in the lab.**

## Challenges

- **Small synthetic dataset:** The classifier is trained on a synthetic dataset, so any accuracy number must be reported with its full context — dataset size, split strategy, and leakage-risk caveats — or not at all. The model card enforces this wording.
- **ARM64 memory budget:** A `t4g.micro` has only 1 GB RAM. Quantizing the model to INT8 keeps the artifact at 0.38 MB and leaves headroom under the 700 MB systemd cap.
- **API reliability during the hackathon:** The Graviton instance was unreachable from the public internet during parts of the hackathon. Instead of fabricating a live demo, the dashboard was built to treat honest cached/offline states as a first-class feature.
- **Solo scope management:** With one developer, every feature had to map directly to a Devpost judging criterion. The strategy backlog in `STRATEGY.md` keeps priorities explicit.

## Accomplishments we're proud of

- The Honesty Contract is enforced in code, not just in prose. The `useApi` store has exactly three states (`live | cached | offline`), and the Event Log never invents entries.
- The dashboard remains usable when the API is down, showing cached data with an amber badge and "Unavailable — API offline" where applicable.
- The INT8 ONNX model targets a specific cost point: the `t4g.micro` costs roughly $0.0042/hour on-demand, or about $3/month.
- The build pipeline is clean: `npm run build` and `npm run lint` pass 0/0, `npx vitest run` passes all tests, `npx axe` reports zero violations, and contrast is 23/23 AA.
- All model claims are traceable to committed artifacts with SHA-256 hashes and generation dates.
- The deployed model is the one that can actually run on Graviton, not the one with the prettier accuracy number.

## What we learned

- **Honesty is a feature, not a fallback.** Judges and users notice when a demo hides a failing backend. Building the degraded mode intentionally made the product stronger.
- **Quantization changes the cost story.** A 0.38 MB INT8 model makes a $3/month ARM64 instance viable for a hackathon demo.
- **Singleton stores simplify state.** Using `useSyncExternalStore` for global state removed prop-drilling and made the live/cached/offline transition consistent across every surface.
- **Documentation is part of the deliverable.** The README, model card, runbook, strategy, security review, and demo script are as important as the code for a judged submission.
- **Ship what runs.** The accuracy winner that cannot be exported is a research result; the exportable candidate is the product.

## What's next (roadmap)

| Priority | Item | Owner | Evidence gate |
|---|---|---|---|
| P1 | Local LLM explainer: add a small on-device or self-hosted LLM that explains why a ticket was classified into a given category, without sending data to third-party APIs | ml-engineer.md / backend-engineer.md | Feature flag + latency budget; output marked as "generated explanation" distinct from model prediction |
| P1 | Multi-Arm matrix: validate the same ONNX artifact on additional ARM64 hosts (e.g., t4g.small, Raspberry Pi 5, Apple Silicon) and commit cross-device latency numbers | devops-sre.md | New `model/latency_*.json` artifacts; gates still pass |
| P1 | Replace the in-memory rate limiter with Redis or API Gateway throttling | security-engineer.md | `PREDICT_RATE_LIMIT_RPM` still enforced; no regression in probe suite |
| P1 | Lock down CORS from `*` to an explicit origin list after the demo period | security-engineer.md | `SECURITY_REVIEW.md` §4 updated; `ALLOW_ORIGINS` env var tested |
| P2 | Expand the adversarial probe suite beyond the initial 14 probes | qa-engineer.md | `model/probe_suite.json` expanded; `model/probe_results.json` still 0 mismatches |
| P2 | Add a small admin view for retraining triggers and model-version tracking | backend-engineer.md | New view gated behind planned auth |
| P2 | Containerize the backend (`Dockerfile` + `docker-compose.yml`) for one-command reproduction | devops-sre.md | `docker compose up` reaches `/health` 200 |
| P3 | Enable HTTPS/TLS termination on the production load balancer | security-engineer.md | TLS cert in place; HTTP redirects to HTTPS |
| P3 | Publish a Hugging Face Space or GitHub Pages static build | tech-writer.md | Static build passes axe; demo mode works offline |

---

## Technical details

- **Categories:** Phishing · Malware · Unauthorized Access · Data Breach · DDoS · False Positive
- **Model artifact:** INT8-quantized ONNX, 0.38 MB
- **Host:** AWS Graviton `t4g.micro` (ARM64, 2 vCPU, 1 GB RAM), ~$0.0042/hour on-demand
- **API health:** `http://3.23.60.61:8000/health`
- **API docs:** `http://3.23.60.61:8000/docs`
- **Model card:** [`MODEL_CARD.md`](./MODEL_CARD.md)
- **Runbook:** [`DEVOPS_RUNBOOK.md`](./DEVOPS_RUNBOOK.md)
- **Security review:** [`SECURITY_REVIEW.md`](./SECURITY_REVIEW.md)
- **Strategy / demo runbook:** [`STRATEGY.md`](./STRATEGY.md)
- **Demo script:** [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md)

## Metrics status

| Metric | Value | Source |
|---|---|---|
| Held-out accuracy | 92.94% | [`model/eval_results.json`](./model/eval_results.json) |
| Accuracy winner (non-exportable) | 93.60% (`C2_char3-5_word1-2_LR_C2.0`) | [`model/eval_results.json`](./model/eval_results.json) |
| Deployed artifact accuracy | 92.94% (`C1_word_1-2_LR_C2.0`) | [`model/eval_results.json`](./model/eval_results.json) |
| Per-class precision/recall/F1 | see source | [`model/eval_results.json`](./model/eval_results.json) |
| Latency p50/p95 on t4g.micro | 0.237 ms / 0.286 ms (n=100, 2026-07-20) | [`model/latency_t4g_micro.json`](./model/latency_t4g_micro.json) |
| Adversarial probe results | 14 probes, 0 mismatches, 0 HTTP 5xx | [`model/probe_results.json`](./model/probe_results.json) |
| Main JS chunk size | 315.86 KB | [`TEST_RESULTS_v4.md`](./TEST_RESULTS_v4.md) |
| axe violations (5 routes) | 0 | [`TEST_RESULTS_v4.md`](./TEST_RESULTS_v4.md) |
| Contrast AA | 23/23 | `audit/PHASE4_QA_EVIDENCE.md` |
| Calibration (ECE before / after) | 0.3946 / 0.0172 | [`model/calibration.json`](./model/calibration.json) |
| Calibration assessment | `WELL_CALIBRATED` | [`model/calibration.json`](./model/calibration.json) |
| Rate limit | 60 RPM per IP | [`app/main.py`](./app/main.py) |

---

## Claim Traceability Ledger

| Claim | Artifact | SHA-256 | Date |
|---|---|---|---|
| 0.38 MB INT8 model | `model/quantization.md` | `d9425f31...` | 2026-07-20 |
| t4g.micro cost (~$0.0042/hr) | AWS pricing (us-east-2 on-demand) | N/A | 2026-07-20 |
| Build/lint/axe 0 violations | `TEST_RESULTS_v4.md` | `52bc513e...` | 2026-07-20 |
| Model metrics | `model/eval_results.json` | `05b4c580...` | 2026-07-20 |
| Latency metrics | `model/latency_t4g_micro.json` | `835355a1...` | 2026-07-20 |
| Probe results | `model/probe_results.json` | `e69b92e3...` | 2026-07-20 |
| Contrast AA 23/23 | `audit/PHASE4_QA_EVIDENCE.md` | N/A | 2026-07-20 |
| Calibration | `model/calibration.json` | `0b2c91e7...` | 2026-07-20 |
| Rate limit 60 RPM | `app/main.py` | `8b927288...` | 2026-07-20 |

*SHA-256 values are computed on the committed files.*
