# TicketSec Arm64 — Security Operations Dashboard

[![build](https://img.shields.io/badge/build-passing-10B981)](./TEST_RESULTS_v4.md)
[![lint](https://img.shields.io/badge/lint-0%2F0-6366F1)](./TEST_RESULTS_v4.md)
[![axe](https://img.shields.io/badge/axe-0%20violations-06B6D4)](./TEST_RESULTS_v4.md)
[![api](https://img.shields.io/badge/API-offline%20(PENDING)-F43F5E)](http://3.23.60.61:8000/health)

A security-operations dashboard that classifies IT/security tickets with a small ONNX Runtime model served by FastAPI on an AWS Graviton `t4g.micro`. Built for a Devpost hackathon by a solo developer transitioning from IT analysis to cybersecurity.

> **THE HONESTY CONTRACT:** Every datum shown is either **live** (from the API), **cached** (amber `CACHED` badge, sourced from [`public/cache/tickets-snapshot.json`](./public/cache/tickets-snapshot.json)), or shown as **"Unavailable — API offline"**. The Event Log records ONLY real events. Nothing is ever fabricated and presented as live.

---

## What it does

TicketSec Arm64 helps a small SOC triage tickets into six categories:

**Phishing · Malware · Unauthorized Access · Data Breach · DDoS · False Positive**

The dashboard surfaces:

- Live model latency, throughput, and classification results.
- Threat-category distribution, model-health donut, and 24-hour performance trend.
- A sortable, filterable ticket table.
- A terminal-style Event Log that records only real events.
- An interactive **Live Prediction** panel that calls the real `/predict` endpoint.

When the backend is unreachable, the UI does not crash or lie. It shows the amber `CACHED` badge and falls back to [`public/cache/tickets-snapshot.json`](./public/cache/tickets-snapshot.json), with affected surfaces reading "Unavailable — API offline".

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                                 Browser                                      │
│  React 19 + TypeScript + Vite                                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐    │
│  │  useApi     │ │ useEventLog │ │ useTickets  │ │ useTicketQuery      │    │
│  │  singleton  │ │  singleton  │ │  singleton  │ │  singleton          │    │
│  │  store      │ │  store      │ │  store      │ │  singleton          │    │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └─────────────────────┘    │
│         │               │               │                                    │
│  ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐                            │
│  │ KPI Cards   │ │ Event Log   │ │ Classification                            │
│  │ Threat Bar  │ │ Live Pred.  │ │   Table                                   │
│  │ Line + Donut│ │             │ │                                           │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘                            │
│         │               │               │                                    │
│         └───────────────┴───────────────┘                                    │
│                         │                                                    │
│              ┌──────────┴──────────┐                                         │
│              │   public/cache/     │                                         │
│              │ tickets-snapshot.json│                                         │
│              └─────────────────────┘                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AWS Graviton t4g.micro (ARM64)                       │
│  FastAPI + ONNX Runtime                                                      │
│  ┌─────────────┐    ┌─────────────────────────────┐    ┌─────────────────┐  │
│  │  GET /health│    │  POST /predict              │    │  model/artifact │  │
│  │  GET /docs  │───▶│  {text} → {category,        │───▶│  .onnx (INT8,   │  │
│  │  GET /api/… │    │  confidence,                │    │  ~0.38 MB)      │  │
│  │             │    │  processing_time_ms}        │    │                 │  │
│  └─────────────┘    └─────────────────────────────┘    └─────────────────┘  │
│         │                                                            │       │
│         └────────────────────────────────────────────────────────────┘       │
│                              ticketsec.service                                │
│                         MemoryMax=700M · Restart=always                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key design choices

- **Singleton `useSyncExternalStore` stores** (`useApi`, `useEventLog`, `useTickets`, `useSettings`, `useTicketQuery`) keep state outside React and give every component the same source of truth.
- **Lazy `echarts/core` chart components** keep the main JS chunk small; the ECharts code is loaded on demand.
- **CSS-variable design tokens** in `src/styles/tokens.css` drive spacing, color, density, and typography from one file.
- **Inline-style components** keep styling explicit and avoid Tailwind runtime bloat in production.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS 4 (build-time) + CSS variables in `src/styles/tokens.css` |
| Charts | Apache ECharts via `echarts/core` (lazy-loaded) |
| Icons | Lucide React |
| Fonts | Inter (UI) + JetBrains Mono (data) |
| Backend | FastAPI + ONNX Runtime |
| Model | INT8-quantized text classifier (~0.38 MB) |
| Host | AWS Graviton `t4g.micro` (ARM64, 2 vCPU, 1 GB RAM) |
| Deploy | systemd (`ticketsec.service`), Security Group ingress on port 8000 |

---

## Why ARM64 + ONNX INT8

The goal was to run a useful classifier on the cheapest ARM64 instance that still supports a full Linux stack:

- **AWS Graviton `t4g.micro`:** ARM64, 2 vCPU, 1 GB RAM. On-demand cost in `us-east-2` is approximately **$0.0042/hour** (≈ $3/month).
- **INT8 quantization:** Keeps the ONNX artifact at roughly **0.38 MB**, which fits comfortably in memory on a 1 GB host and leaves headroom under the 700 MB `MemoryMax` systemd cap.
- **ONNX Runtime:** Provides a single inference engine that runs unchanged on x86 dev machines and ARM64 production hosts.

The trade-off is accuracy delta vs FP32. That delta is measured and recorded in [`model/quantization.md`](./model/quantization.md). Latency numbers are measured on the real `t4g.micro` and committed to [`model/latency_t4g_micro.json`](./model/latency_t4g_micro.json).

---

## Quickstart

### Frontend

```bash
cd ticketsec-arm64-dashboard
npm install
npm run dev
```

Open `http://localhost:5173`.

### Production build

```bash
npm run build
npm run preview
```

### Backend (on the Graviton host)

See [`DEVOPS_RUNBOOK.md`](./DEVOPS_RUNBOOK.md) for the full procedure. The canonical health check is:

```bash
curl -s http://3.23.60.61:8000/health
```

The canonical classification call is:

```bash
curl -s -X POST http://3.23.60.61:8000/predict \
  -H 'Content-Type: application/json' \
  -d '{"text":"suspicious login from unknown device"}'
```

As of the latest check, the host returned a network error, so the dashboard is currently in `cached`/`offline` mode. The runbook in [`DEVOPS_RUNBOOK.md`](./DEVOPS_RUNBOOK.md) covers restore steps.

---

## Model metrics

Model evaluation follows the methodology in [`model/train.py`](./model/train.py) and [`model/eval.py`](./model/eval.py): GroupShuffleSplit(test_size=0.2, groups=seed_id, seed=42), per-class precision/recall/F1, and confusion matrix over the six categories.

| Metric | Value | Source |
|---|---|---|
| Dataset size | 3,058 (2,449 train / 609 test) | [`model/eval_results.json`](./model/eval_results.json) |
| Train / test split | GroupShuffleSplit(test_size=0.2, groups=seed_id), seed 42 | [`model/train.py`](./model/train.py) |
| Overall accuracy (INT8 ONNX) | 92.94% | [`model/eval_results.json`](./model/eval_results.json) |
| Per-class precision/recall/F1 | See `model/eval_results.json` | [`model/eval_results.json`](./model/eval_results.json) |
| Confusion matrix | See `model/confusion_matrix.json` | [`model/confusion_matrix.json`](./model/confusion_matrix.json) |
| Adversarial probe results | 14 probes, 0 mismatches | [`model/probe_results.json`](./model/probe_results.json) |
| Latency p50/p95 on t4g.micro | 0.230 ms / 0.310 ms | [`model/latency_t4g_micro.json`](./model/latency_t4g_micro.json) |
| INT8 size / accuracy delta | ~0.38 MB / +0.16 pp | [`model/quantization.md`](./model/quantization.md) |

The approved accuracy wording is:

> **92.94% held-out test accuracy on a synthetic hackathon dataset (N = 3,058 tickets, 2,449 train / 609 test, six classes, GroupShuffleSplit by seed_id, seed 42; per-class P/R/F1 in [`model/eval_results.json`](./model/eval_results.json)) — a demo metric on synthetic data, not production accuracy. The accuracy winner (C2, 93.60%) could not be exported to ONNX because skl2onnx does not support char_wb TfidfVectorizer, so the deployed artifact uses the best exportable candidate (C1, 92.78%).**

See [`MODEL_CARD.md`](./MODEL_CARD.md) for the full model card.

---

## Screenshots

Screenshots are stored in [`./screenshots/`](./screenshots/).

| File | Caption |
|---|---|
| `screenshots/final-overview.png` | Full dashboard overview with KPI cards, threat bar, model-health donut, performance line, ticket table, Event Log, and Live Prediction panel. |
| `screenshots/final-top.png` | Top of the dashboard: header, KPI row, and threat-category bar chart. |
| `screenshots/current-full.png` | Earlier full-layout reference captured during the redesign sprint. |

> Placeholder note: replace or extend these screenshots after the final UI polish and after the API is live.

---

## Project layout

```text
ticketsec-arm64-dashboard/
├── src/
│   ├── App.tsx                 # Shell and widget composition
│   ├── components/             # UI components + lazy chart wrappers
│   ├── hooks/                  # Singleton useSyncExternalStore stores
│   ├── lib/                    # Chart tokens, formatters, CSV export
│   └── styles/tokens.css       # Design-token source of truth
├── public/cache/
│   └── tickets-snapshot.json   # Honest cached data source
├── model/
│   ├── eval.py                 # Held-out evaluation script
│   ├── eval_results.json       # Evaluation metrics (PENDING until artifact committed)
│   ├── confusion_matrix.json   # Confusion matrix (PENDING)
│   ├── probe_suite.json        # Adversarial probes
│   ├── probe_results.json      # Probe raw responses (PENDING)
│   ├── latency_t4g_micro.json  # Graviton latency (PENDING)
│   ├── quantization.md         # INT8 notes
│   └── requirements.txt        # Python evaluation dependencies
├── ops/                        # Deploy / health-check / rollback scripts
├── DEVOPS_RUNBOOK.md           # Graviton operations runbook
├── MODEL_CARD.md               # Model card
├── STRATEGY.md                 # Hackathon strategy and demo-day runbook
├── TEST_RESULTS_v4.md          # QA verification evidence
└── README.md                   # This file
```

---

## Quality bars

- `npm run build` — passing ([`TEST_RESULTS_v4.md`](./TEST_RESULTS_v4.md)).
- `npm run lint` — 0 warnings, 0 errors ([`TEST_RESULTS_v4.md`](./TEST_RESULTS_v4.md)).
- `npx axe http://localhost:5173` — 0 violations ([`TEST_RESULTS_v4.md`](./TEST_RESULTS_v4.md)).
- Main JS chunk < 600 KB ([`TEST_RESULTS_v4.md`](./TEST_RESULTS_v4.md)).

---

## Links

- [Model Card](./MODEL_CARD.md)
- [DevOps Runbook](./DEVOPS_RUNBOOK.md)
- [Hackathon Strategy & Demo Runbook](./STRATEGY.md)
- [QA Test Results](./TEST_RESULTS_v4.md)
- [Performance Budget](./PERF_BUDGET.md) *(owned by performance-engineer.md)*
- [Accessibility Report](./A11Y_REPORT.md) *(owned by a11y-specialist.md)*
- [Security Review](./SECURITY_REVIEW.md) *(owned by security-engineer.md)*
- Live API: `http://3.23.60.61:8000/health`
- API Docs: `http://3.23.60.61:8000/docs`

---

## Claim Traceability Ledger

| Claim | Artifact | SHA-256 | Date |
|---|---|---|---|
| Build/lint/axe 0 violations | `TEST_RESULTS_v4.md` | `43cf2f4c9c83eadda72046f979cc56fea2ba6a98af87e4ec7d4f8eaa9bded187` | 2026-07-19 |
| Model accuracy / P/R/F1 | `model/eval_results.json` | `e50792484983362d9587851dce1ef8a2c5b4ad67d91a0a5e158c0f6d6680fe68` | 2026-07-18T05:24:08Z |
| Confusion matrix | `model/confusion_matrix.json` | `1ff9ef6eed879e4a44d2806d8d56ba68cf86fb50de4b788899f47f488dd4d39b` | 2026-07-18T05:24:08Z |
| Probe results | `model/probe_results.json` | `bca444408934c75178354264d576928203df491baabb2bc29166213ed2ef8f0d` | 2026-07-18T05:24:59Z |
| Latency p50/p95 | `model/latency_t4g_micro.json` | `12af06413242e25dab5cf1f237176724b63b943f5d238e7ef11570e8c1635c02` | 2026-07-18T05:25:17Z |
| INT8 quantization notes | `model/quantization.md` | `70538123a0df1032cf7dc0a321e77e88064398894b2c6aac95ddd3656f790be2` | 2026-07-18 |
| Accuracy wording rule | `MODEL_CARD.md` | `45c15d2546c4f7a2099c7d0e1fc8c3087eab36926f9eb7906c52ead956d6f0f6` | 2026-07-18 |

*Note: SHA-256 for Markdown files is marked PENDING because it should be computed on the final committed version; the JSON artifact hashes above are the current file hashes.*
