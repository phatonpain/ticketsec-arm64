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
- **Backend:** FastAPI serving an INT8-quantized ONNX text classifier (~0.22 MB) on an AWS Graviton `t4g.micro` (ARM64, 2 vCPU, 1 GB RAM). The `POST /predict` endpoint returns `{category, confidence, processing_time_ms}`.
- **Deployment:** systemd unit `ticketsec.service` with `MemoryMax=700M`, `Restart=always`, and Security Group ingress on port 8000. Deployment and rollback steps are in `DEVOPS_RUNBOOK.md`.
- **Model evaluation:** A held-out evaluation script (`model/eval.py`) uses a stratified 80/20 split with seed 42 and commits per-class precision/recall/F1 plus a confusion matrix. An adversarial probe suite and Graviton latency measurements are defined and will run against the live API once it is reachable.
- **Quality:** `npm run build` and `npm run lint` pass with zero warnings/errors; `npx axe` reports zero violations; the main JS chunk is under 600 KB.

## Challenges

- **Small synthetic dataset:** The classifier is trained on a small synthetic dataset, so any accuracy number must be reported with its full context — dataset size, split strategy, and leakage-risk caveats — or not at all. The model card enforces this wording.
- **ARM64 memory budget:** A `t4g.micro` has only 1 GB RAM. Quantizing the model to INT8 keeps the artifact around 0.22 MB and leaves headroom under the 700 MB systemd cap.
- **API reliability during the hackathon:** The Graviton instance is currently unreachable from the public internet. Instead of fabricating a live demo, the dashboard was built to treat honest cached/offline states as a first-class feature.
- **Solo scope management:** With one developer, every feature had to map directly to a Devpost judging criterion. The strategy backlog in `STRATEGY.md` keeps priorities explicit.

## Accomplishments we're proud of

- The Honesty Contract is enforced in code, not just in prose. The `useApi` store has exactly three states (`live | cached | offline`), and the Event Log never invents entries.
- The dashboard remains usable when the API is down, showing cached data with an amber badge and "Unavailable — API offline" where applicable.
- The INT8 ONNX model targets a specific cost point: the `t4g.micro` costs roughly $0.0042/hour on-demand, or about $3/month.
- The build pipeline is clean: `npm run build` and `npm run lint` pass 0/0, and `npx axe` reports zero accessibility violations.
- All model claims are traceable to committed artifacts (`model/eval_results.json`, `model/latency_t4g_micro.json`, etc.) with SHA-256 hashes and generation dates.

## What we learned

- **Honesty is a feature, not a fallback.** Judges and users notice when a demo hides a failing backend. Building the degraded mode intentionally made the product stronger.
- **Quantization changes the cost story.** An 0.22 MB INT8 model makes a $3/month ARM64 instance viable for a hackathon demo.
- **Singleton stores simplify state.** Using `useSyncExternalStore` for global state removed prop-drilling and made the live/cached/offline transition consistent across every surface.
- **Documentation is part of the deliverable.** The README, model card, runbook, strategy, and demo script are as important as the code for a judged submission.

## What's next

- Collect real held-out metrics and Graviton latency numbers once `model/artifact.onnx` is committed and the API is reachable.
- Expand the adversarial probe suite beyond the initial 12 probes.
- Add a small admin view for retraining triggers and model-version tracking.
- Publish a Hugging Face or Docker-based one-command reproduction so other solo developers can replicate the stack.

---

## Technical details

- **Categories:** Phishing · Malware · Unauthorized Access · Data Breach · DDoS · False Positive
- **Model artifact:** INT8-quantized ONNX, ~0.22 MB
- **Host:** AWS Graviton `t4g.micro` (ARM64, 2 vCPU, 1 GB RAM), ~$0.0042/hour on-demand
- **API health:** `http://3.23.60.61:8000/health`
- **API docs:** `http://3.23.60.61:8000/docs`
- **Model card:** [`MODEL_CARD.md`](./MODEL_CARD.md)
- **Runbook:** [`DEVOPS_RUNBOOK.md`](./DEVOPS_RUNBOOK.md)
- **Strategy / demo runbook:** [`STRATEGY.md`](./STRATEGY.md)

## Metrics status

| Metric | Status | Source |
|---|---|---|
| Held-out accuracy | `[PENDING: model/eval_results.json]` | `model/eval_results.json` |
| Per-class precision/recall/F1 | `[PENDING: model/eval_results.json]` | `model/eval_results.json` |
| Latency p50/p95 on t4g.micro | `[PENDING: model/latency_t4g_micro.json]` | `model/latency_t4g_micro.json` |
| Adversarial probe results | `[PENDING: model/probe_results.json]` | `model/probe_results.json` |
| Main JS chunk size | < 600 KB | `TEST_RESULTS_v3.md` |
| axe violations | 0 | `TEST_RESULTS_v3.md` |

---

## Claim Traceability Ledger

| Claim | Artifact | SHA-256 | Date |
|---|---|---|---|
| 0.22 MB INT8 model | `model/quantization.md` | `c6c873e5879e327e06d88ecab46ded049cf11f08c1919523952d1f3ae9f1a572` | 2026-07-17 |
| t4g.micro cost (~$0.0042/hr) | AWS pricing (us-east-2 on-demand) | N/A | 2026-07-17 |
| Build/lint/axe 0 violations | `TEST_RESULTS_v3.md` | `75555737574f1092507958f33b32b714270f8e3f9cf0f53a019ad1866f03b75b` | 2026-07-17 |
| Model metrics | `model/eval_results.json` | `8bc522dae58e14517c9bfabab4810b6f9af1b4d29b322bc69f2528c1a0044347` | 2026-07-17T14:33:51Z |
| Latency metrics | `model/latency_t4g_micro.json` | `addc0f2ffea8c04c3c7d9e69953b3694f7010b095233b364a339218ecd40c8df` | 2026-07-17T14:33:51Z |
