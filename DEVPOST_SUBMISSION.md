# TicketSec Arm64 — Devpost Submission Draft

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
- **Model evaluation:** A held-out evaluation script (`model/eval.py`) uses `GroupShuffleSplit(test_size=0.2, groups=seed_id, seed=42)` and commits per-class precision/recall/F1 plus a confusion matrix. An adversarial probe suite and live Graviton latency measurements are committed in `model/probe_results.json` and `model/latency_t4g_micro.json`.
- **Security:** `/predict` is rate-limited (120 RPM per IP), input is sanitized, error responses never leak stack traces, and CORS is configurable via `ALLOW_ORIGINS`. Details are in [`SECURITY_REVIEW.md`](./SECURITY_REVIEW.md).
- **Quality:** `npm run build` and `npm run lint` pass with zero warnings/errors; `npx axe` reports zero violations per route; the main JS chunk is under 600 KB; contrast sweep is 23/23 AA.

## Engineering story — why the deployed model is not the accuracy winner

The ablation study found a stronger candidate (`C2_char3-5_word1-2_LR_C2.0`) at **93.60%** accuracy. That candidate combines word and character n-grams. Unfortunately, `skl2onnx` does not export `TfidfVectorizer` with `analyzer="char_wb"`, so C2 cannot be converted to ONNX. Rather than ship a prettier accuracy number that cannot run on Graviton, we deployed the best ONNX-exportable candidate (`C1_word_1-2_LR_C2.0`) at **92.94%**. The trade-off is logged in `model/eval_results.json` (`winner_candidate_id` vs `deployed_candidate_id`) and in `MODEL_CARD.md`.

## Challenges

- **Small synthetic dataset:** The classifier is trained on a synthetic dataset, so any accuracy number must be reported with its full context — dataset size, split strategy, and leakage-risk caveats — or not at all. The model card enforces this wording.
- **ARM64 memory budget:** A `t4g.micro` has only 1 GB RAM. Quantizing the model to INT8 keeps the artifact at 0.38 MB and leaves headroom under the 700 MB systemd cap.
- **API reliability during the hackathon:** The Graviton instance was unreachable from the public internet during parts of the hackathon. Instead of fabricating a live demo, the dashboard was built to treat honest cached/offline states as a first-class feature.
- **Solo scope management:** With one developer, every feature had to map directly to a Devpost judging criterion. The strategy backlog in `STRATEGY.md` keeps priorities explicit.

## Accomplishments we're proud of

- The Honesty Contract is enforced in code, not just in prose. The `useApi` store has exactly three states (`live | cached | offline`), and the Event Log never invents entries.
- The dashboard remains usable when the API is down, showing cached data with an amber badge and "Unavailable — API offline" where applicable.
- The INT8 ONNX model targets a specific cost point: the `t4g.micro` costs roughly $0.0042/hour on-demand, or about $3/month.
- The build pipeline is clean: `npm run build` and `npm run lint` pass 0/0, `npx axe` reports zero violations, and contrast is 23/23 AA.
- All model claims are traceable to committed artifacts with SHA-256 hashes and generation dates.
- The deployed model is the one that can actually run on Graviton, not the one with the prettier accuracy number.

## What we learned

- **Honesty is a feature, not a fallback.** Judges and users notice when a demo hides a failing backend. Building the degraded mode intentionally made the product stronger.
- **Quantization changes the cost story.** A 0.38 MB INT8 model makes a $3/month ARM64 instance viable for a hackathon demo.
- **Singleton stores simplify state.** Using `useSyncExternalStore` for global state removed prop-drilling and made the live/cached/offline transition consistent across every surface.
- **Documentation is part of the deliverable.** The README, model card, runbook, strategy, security review, and demo script are as important as the code for a judged submission.
- **Ship what runs.** The accuracy winner that cannot be exported is a research result; the exportable candidate is the product.

## What's next (roadmap)

| Priority | Item | Owner |
|---|---|---|
| P1 | Collect real (non-synthetic) ticket samples and retrain | ml-engineer.md |
| P1 | Replace the in-memory rate limiter with Redis or API Gateway throttling | security-engineer.md |
| P1 | Lock down CORS from `*` to an explicit origin list after the demo period | security-engineer.md |
| P2 | Expand the adversarial probe suite beyond the initial 14 probes | qa-engineer.md |
| P2 | Add a small admin view for retraining triggers and model-version tracking | backend-engineer.md |
| P2 | Containerize the backend (`Dockerfile` + `docker-compose.yml`) for one-command reproduction | devops-sre.md |
| P3 | Publish a Hugging Face Space or GitHub Pages static build | tech-writer.md |

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

## Metrics status

| Metric | Value | Source |
|---|---|---|
| Held-out accuracy | 92.94% | [`model/eval_results.json`](./model/eval_results.json) |
| Accuracy winner (non-exportable) | 93.60% (`C2_char3-5_word1-2_LR_C2.0`) | [`model/eval_results.json`](./model/eval_results.json) |
| Deployed artifact accuracy | 92.94% (`C1_word_1-2_LR_C2.0`) | [`model/eval_results.json`](./model/eval_results.json) |
| Per-class precision/recall/F1 | see source | [`model/eval_results.json`](./model/eval_results.json) |
| Latency p50/p95 on t4g.micro | 0.224 ms / 0.296 ms | [`model/latency_t4g_micro.json`](./model/latency_t4g_micro.json) |
| Adversarial probe results | 14 probes, 0 mismatches, 0 HTTP 5xx | [`model/probe_results.json`](./model/probe_results.json) |
| Main JS chunk size | 299.37 KB | [`TEST_RESULTS_v4.md`](./TEST_RESULTS_v4.md) |
| axe violations (5 routes) | 0 | [`TEST_RESULTS_v4.md`](./TEST_RESULTS_v4.md) |
| Contrast AA | 23/23 | `contrast_report.py` |
| Calibration (ECE) | 0.3946 (under-confident) | [`model/calibration.json`](./model/calibration.json) |

---

## Claim Traceability Ledger

| Claim | Artifact | SHA-256 | Date |
|---|---|---|---|
| 0.38 MB INT8 model | `model/quantization.md` | `d9425f3122adba02183189b39b3ab1d5f75bf04e9caf43aa158cd78570579d2d` | 2026-07-19 |
| t4g.micro cost (~$0.0042/hr) | AWS pricing (us-east-2 on-demand) | N/A | 2026-07-19 |
| Build/lint/axe 0 violations | `TEST_RESULTS_v4.md` | `545d5b64aeccb0e8828f3963f8e986a755c8191642a3efc72e12e46506501c06` | 2026-07-19 |
| Model metrics | `model/eval_results.json` | `74adeac8c07735303dfe77beb39a3a1a2b5218c05f5e5f5dc23246e9d6fb4002` | 2026-07-19 |
| Latency metrics | `model/latency_t4g_micro.json` | `bcf9439154bb97225380da106d2662c247857726ac2500b49c5a33244098c096` | 2026-07-19 |
| Probe results | `model/probe_results.json` | `833975a34e0730e79eff11453a2c925bf1158d80d84f953840916338fff75380` | 2026-07-19 |
| Contrast AA 23/23 | `contrast-report.json` *(generated)* | computed at runtime | 2026-07-19 |
| Calibration | `model/calibration.json` | see file | 2026-07-19 |
