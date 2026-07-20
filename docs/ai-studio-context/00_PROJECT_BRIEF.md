# TicketSec Arm64 — Project Brief

## One-sentence

TicketSec Arm64 is a SOC ticket-triage dashboard: a dark, dense, Splunk-class
interface that helps SOC operators decide which security alerts to escalate,
resolve, or auto-close — honestly, even when the backend is offline.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS 4 |
| Charts | ECharts 6 (lazy-chunked) |
| Icons | lucide-react |
| Lint / test | oxlint, vitest |
| Backend | FastAPI |
| Model | ONNX INT8 classifier served on AWS Graviton arm64 (systemd unit `ticketsec`) |
| Public endpoint | `http://3.23.60.61:8000` during hackathon/demo period |

## Target user

SOC operators (L1/L2 analysts, incident responders). They need:

- Density: many tickets visible at once.
- Speed: severity rail, confidence bars, category badges at a glance.
- Trust: the UI never lies about data freshness.

## Core differentiator — The Honesty Contract

Most dashboards hide outages behind spinners or stale data pretending to be live.
TicketSec admits state:

- **LIVE** — green pill, data from the API.
- **CACHED** — amber pill + timestamp, data from `public/cache/tickets-snapshot.json`.
- **API OFFLINE** — explicit "Unavailable — API offline" message, no fabricated entries.

If the backend goes down during a demo, the UI says so. That is the feature.

## Backend endpoints the UI consumes

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Backend alive check |
| POST | `/predict` | Classify raw ticket text |
| GET | `/api/v1/stats/categories` | Category counts from test set |
| GET | `/api/v1/performance/history` | Performance history (currently empty → triggers empty state) |
| GET | `/api/v1/classifications` | List of synthetic classifications with status/assignee |

## What this package is for

This folder (`docs/ai-studio-context/`) is a self-contained design brief for
external prototyping tools (Google AI Studio, Figma-to-code, Stitch, etc.).

Read in this order:

1. `00_PROJECT_BRIEF.md` (this file)
2. `01_DESIGN_TOKENS.md`
3. `02_COMPONENT_SPECS.md`
4. `03_DATA_MODEL.md`
5. `04_VIEW_SPECS.md`
6. `05_STATES_AND_HONESTY.md`
7. `06_PROTOTYPE_PROMPT.md`
8. `MANIFEST.md`

## Hard constraints for any prototype

- Use only colors/spacing/type from `01_DESIGN_TOKENS.md`.
- No hex literals invented outside those tokens.
- Every number must trace to a data source listed in `03_DATA_MODEL.md`.
- Every state must be honest per `05_STATES_AND_HONESTY.md`.
- No generic marketing visuals, no pastel badges, no decorative skeletons.
