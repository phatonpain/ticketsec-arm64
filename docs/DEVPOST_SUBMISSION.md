# TicketSec Arm64 — Hackathon Submissions

Two submission drafts for the two hackathons this project targets. Part A is
the Arm Create AI Optimization Challenge (Cloud AI track); Part B is
NeuralSprint. Every number below traces to a committed artifact — see the
metrics tables and the claim ledger in [`MODEL_CARD.md`](../MODEL_CARD.md).

---

# Part A — Arm Create AI Optimization Challenge (Cloud AI track)

**Deadline:** 2026-08-23 · **Prizes:** $1k–$8k

## Inspiration

A security operations center drowns in tickets, and the first hour of every
incident is spent sorting noise from real threats. We wanted a triage
classifier that runs on the cheapest Arm64 cloud instance available — and a
dashboard that never lies about whether its data is live.

## What it does

TicketSec Arm64 classifies IT/security tickets into six categories — Phishing,
Malware, Unauthorized Access, Data Breach, DDoS, False Positive — using an
INT8-quantized ONNX model served by FastAPI on an AWS Graviton `t4g.micro`
(Arm64, 2 vCPU, 1 GB RAM). A React 19 dashboard shows threat distribution,
model health, a live prediction panel, and an event log, all driven by the
real API.

## Why this is an Arm optimization story

The whole project is an exercise in making a real ML workload fit the smallest
Graviton instance:

- **INT8 dynamic quantization + ONNX Runtime.** The sklearn TF-IDF +
  LogisticRegression pipeline was exported via skl2onnx and quantized with
  `onnxruntime.quantization.quantize_dynamic`. The same artifact runs
  unchanged on x86 dev machines and the Arm64 Graviton host — one runtime, no
  per-architecture model builds.
- **Cost point.** The `t4g.micro` costs ~$0.0084/hour on-demand in `us-east-2`
  (≈ $6/month). The 0.38 MB model fits trivially under the 700 MB systemd
  memory cap (`MemoryMax=700M` in `ops/ticketsec.service`).
- **Measured, not claimed.** Server-side inference on the Graviton host:
  **p50 0.237 ms, p95 0.286 ms** (n=100 sequential requests, 2026-07-20;
  `processing_time_ms` reported by `/predict`, excludes network RTT).
- **Honest quantization accounting.** INT8 did not shrink this artifact at all
  (401,872 bytes vs 401,864 FP32 — +8 bytes, +0.002%, effectively the same
  size) because the model is dominated by the TF-IDF vocabulary, not weights.
  The win is runtime portability — one ONNX Runtime binary path from x86 dev
  to arm64 Graviton — plus the 0.38 MB memory footprint, not file size. We
  report that instead of a fictional size win — and we document *why* in the
  migration guide.
- **The C2→C1 decision.** The ablation accuracy winner (93.60%) used
  `char_wb` TF-IDF features, which skl2onnx cannot export. We deployed the
  best exportable candidate (92.94%) instead: **commit the model that runs,
  not the model that scores highest.**

## Reusable artifact — migration guide

[`docs/MIGRATION_GUIDE.md`](./MIGRATION_GUIDE.md) is a step-by-step playbook
for moving any sklearn text classifier to optimized ONNX on Arm64: the export
and quantization code, the pitfalls (char_wb export, vocabulary-dominated
artifacts, calibration, grouped splits), the verification protocol, and a
10-point checklist. It is written to be reused by any team doing the same
migration — that is the "Potential Impact" deliverable.

## Measurable improvements (all artifact-backed)

| Metric | Value | Source |
|---|---|---|
| Accuracy, sklearn → INT8 ONNX | 0.9278 → 0.9294 (**+0.16 pp**) | [`model/quantization.md`](../model/quantization.md) |
| Deployed held-out accuracy | 92.94% (`C1_word_1-2_LR_C2.0`, N=3,058, 2,449/609 split, GroupShuffleSplit by seed_id, seed 42 — synthetic demo data) | [`model/eval_results.json`](../model/eval_results.json) |
| Accuracy winner (not exportable) | 93.60% (`C2_char3-5_word1-2_LR_C2.0`) | [`model/eval_results.json`](../model/eval_results.json) |
| INT8 artifact size | 0.38 MB (401,872 bytes), same size as FP32 (401,864 bytes; +8 bytes) — portability, not shrinkage | [`model/quantization.md`](../model/quantization.md) |
| Calibration (ECE / Brier) | ECE 0.3946 → 0.0172, Brier 0.3194 → 0.1089, T=0.271, `WELL_CALIBRATED` | [`model/calibration.json`](../model/calibration.json) |
| Latency on t4g.micro | p50 0.237 ms / p95 0.286 ms (n=100, 2026-07-20, server-side) | [`model/latency_t4g_micro.json`](../model/latency_t4g_micro.json) |
| Adversarial probes | 14/14 valid, 0 mismatches, 0 HTTP 5xx | [`model/probe_results.json`](../model/probe_results.json) |
| Host cost | ~$0.0084/hour on-demand, us-east-2 (≈ $6/month) | AWS public pricing |
| Quality gates | 8/8 PASS (build+chunk<600KB, lint 0/0, 178 vitest tests, axe 0, honesty H1–H8, secrets scan, number traceability, clean tree) | [`scripts/gates.sh`](../scripts/gates.sh) |

## v5: tiered inference with honest degradation

`POST /predict/tiered` runs the ONNX INT8 model first; if confidence falls
below `TIERED_CONFIDENCE_THRESHOLD` (default 0.70) or ONNX fails, it falls
back to a local quantized LLM via Ollama (default `qwen3:4b-instruct-q4_K_M`,
env-configurable). Every response carries the honesty field `inference_tier`
(`onnx_int8` | `local_llm_q4` | `unavailable`) — with Ollama down the endpoint
returns `unavailable` with a null category, never a fabricated guess. The
endpoint has its own rate limit (default 20 RPM), per-tier latency stats
(`GET /api/v1/stats/latency-tiers`, committed to
[`model/latency_tiers.json`](../model/latency_tiers.json)), a burst test that
asserts 429 + `Retry-After` with no 5xx
([`scripts/burst_test_tiered.py`](../scripts/burst_test_tiered.py)), and six
prompt-injection probes delivered through ticket text — 6/6 contract-clean
([`model/run_tiered_probes.py`](../model/run_tiered_probes.py)).

## The demo WOW: the honesty drill

During the live demo we kill the API on stage. The dashboard flips from the
green `LIVE` badge to the amber `CACHED` badge (served from
[`public/cache/tickets-snapshot.json`](../public/cache/tickets-snapshot.json)),
then to "Unavailable — API offline". The prediction panel disables itself. The
Event Log — which records only real events — stays silent. Nothing is
fabricated. A 60-second offline silence test proves zero invented log entries
([`scripts/qa_honesty_matrix.mjs`](../scripts/qa_honesty_matrix.mjs),
[`tests/flows/offline-silence.test.tsx`](../tests/flows/offline-silence.test.tsx)).
On a hackathon stage, a dashboard that survives its own backend dying —
honestly — is the demo.

---

# Part B — NeuralSprint

**Deadline:** 2026-08-24 · **Prize:** $150

## The problem

Security teams get flooded with alerts and support tickets. Analysts burn
their first hour triaging — deciding what is a real incident and what is noise
— before any actual work begins. That triage bottleneck is alert fatigue, and
it is where mistakes happen.

## What we built

TicketSec Arm64 is a security-operations dashboard that automatically
classifies incoming tickets into six categories (Phishing, Malware,
Unauthorized Access, Data Breach, DDoS, False Positive) with a confidence
score, so an analyst sees a prioritized queue instead of a wall of text. It
shows live KPIs, threat distribution, model health, and a prediction panel
where you can paste a ticket and get a real classification from the live API
in under a millisecond of server time. It runs on a ~$6/month Arm64 cloud
instance.

## The originality angle: the Honesty Contract

Most demo dashboards quietly fake it when the backend hiccups. This one is
built around the opposite rule, enforced in code: every number on screen is
either **live** (green `LIVE` badge), **cached** (amber `CACHED` badge from a
committed snapshot), or explicitly **"Unavailable — API offline"**. The Event
Log records only real events; an automated 60-second offline test proves it
never invents a single entry. When the model is uncertain or its fallback LLM
is down, the API says `unavailable` instead of guessing. Trust is the feature.

## See it

- `screenshots/current-full.png` — dashboard overview: KPIs, threat distribution, ticket table
- `screenshots/model-registry-live.png` — model registry: artifact metadata, per-class metrics, latency
- `screenshots/detections-live.png` — detections view with cached snapshot and `CACHED` badge

---

# Links (both submissions)

- Model card: [`MODEL_CARD.md`](../MODEL_CARD.md)
- Security review: [`SECURITY_REVIEW.md`](../SECURITY_REVIEW.md)
- Demo script: [`DEMO_SCRIPT.md`](../DEMO_SCRIPT.md)
- Migration guide (reusable artifact): [`docs/MIGRATION_GUIDE.md`](./MIGRATION_GUIDE.md)
- Live demo endpoint: `http://3.23.60.61:8000/health` (up during the hackathon period)
- DEMO video: TBD — recorded after final deploy
