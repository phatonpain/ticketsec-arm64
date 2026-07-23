# Performance — methodology and results

Every number on this page traces to a committed artifact (linked in each
table) or to a measurement protocol described here. Nothing is estimated.

## 1. How latency is measured

Script: [`model/measure_latency.py`](../model/measure_latency.py) → artifact
[`model/latency_t4g_micro.json`](../model/latency_t4g_micro.json).

- **n = 100** sequential canonical `POST /predict` calls, payloads spanning
  the six categories, against the production Graviton host.
- The recorded value is the server's own `processing_time_ms` — ONNX
  inference time reported by the API. **Network RTT is excluded** by design.
- p50 = median; p95 = nearest-rank over the 100 samples.
- Measurement date: 2026-07-20. Host: AWS Graviton `t4g.micro` (arm64,
  2 vCPU, 1 GB RAM, `us-east-2`, ≈ $0.0084/hour ≈ $6/month on-demand).

## 2. Results — ONNX INT8 on Graviton

| Metric | Value | Source |
|---|---|---|
| Latency p50 | 0.237 ms | [`model/latency_t4g_micro.json`](../model/latency_t4g_micro.json) |
| Latency p95 | 0.286 ms | [`model/latency_t4g_micro.json`](../model/latency_t4g_micro.json) |
| Artifact size (INT8) | 0.38 MB (401,872 bytes) | [`model/quantization.md`](../model/quantization.md) |
| Memory budget | `MemoryMax=700M` (systemd) | [`ops/ticketsec.service`](../ops/ticketsec.service) |
| Held-out accuracy (INT8 ONNX) | 92.94% (Wilson 95% CI [90.63%, 94.72%], n=609 — derived) | [`model/eval_results.json`](../model/eval_results.json) |

## 3. INT8 vs FP32/sklearn baseline — the honest delta

| Metric | sklearn baseline | INT8 ONNX | Delta | Source |
|---|---|---|---|---|
| Accuracy (held-out, n=609) | 0.9278 | 0.9294 | **+0.16 pp** | [`model/quantization.md`](../model/quantization.md) |
| Artifact size | 401,864 bytes (FP32) | 401,872 bytes (INT8) | **same size** (+8 bytes) | [`model/quantization.md`](../model/quantization.md) |

Two honesty notes:

- The +0.16 pp "improvement" is quantization noise on a 609-sample test
  set, not a real gain — the correct reading is **parity** (no accuracy
  cost), well inside the ±2.05 pp Wilson interval.
- Quantization does **not** shrink this artifact (+8 bytes): it is
  dominated by the TF-IDF vocabulary (strings), and dynamic quantization
  only touches the logistic-regression weight matrix. The win of INT8 here
  is a single portable runtime and a tiny memory footprint, not file size.

## 4. Multi-tier inference (implemented in v5)

`POST /predict/tiered` — the original `/predict` is unchanged.

```text
ticket text
   │
   ▼
Tier 1: ONNX INT8 ──confidence ≥ TIERED_CONFIDENCE_THRESHOLD (env, default 0.70)──► answer
   │ below threshold or ONNX error
   ▼
Tier 2: local LLM via Ollama (env OLLAMA_MODEL, default qwen3:4b-instruct-q4_K_M)
   │ unreachable, timeout, or invalid envelope
   ▼
"unavailable" — predicted_category: null, never a fabricated guess
```

Every response declares `inference_tier` (`onnx_int8` | `local_llm_q4` |
`unavailable`); the UI badges it green/amber/red and, for the LLM tier,
shows the explanation with the disclaimer "classificação por LLM local
quantizado — precisão reduzida".

Per-tier limits and stats:

- Rate limits are separate per endpoint: `/predict` 60 RPM, tiered 20 RPM
  (env-configurable) — the LLM tier is far more expensive per request.
- Live stats: `GET /api/v1/stats/latency-tiers` (p50/p95/n per tier).
- Committed artifact: [`model/latency_tiers.json`](../model/latency_tiers.json),
  produced by [`model/measure_latency_tiers.py`](../model/measure_latency_tiers.py).

Measured locally (2026-07-23, dev machine, Ollama **not** running):

| Tier | n | p50 | Note |
|---|---|---|---|
| `onnx_int8` | 18 | 0.217 ms | same model as `/predict` |
| `local_llm_q4` | 0 | — | **not measured** — Ollama offline in this run |
| `unavailable` | 12 | ≈ 4,066 ms | dominated by the Ollama connection timeout, not inference |

The `unavailable` p50 is honest degradation cost: when the LLM tier is
down, a low-confidence ticket waits out the connection timeout
(`OLLAMA_TIMEOUT_S`, default 30 s cap) before the API answers
`unavailable`. LLM-tier latency will be committed to the same artifact
once measured with Ollama up — until then the cell stays empty, not
estimated.

## 5. Load and adversarial verification

| Check | Result | Evidence |
|---|---|---|
| Burst above tiered rate limit (40 concurrent vs 20 RPM) | limiter engaged, `Retry-After` present, throughput capped, 0 HTTP 5xx | [`audit/evidence/burst_tiered.json`](../audit/evidence/burst_tiered.json) |
| Prompt-injection probes via ticket text (6 payloads) | 6/6 contract-clean: enum-bounded category, confidence in [0,1], bounded explanation, honest `unavailable` | [`audit/evidence/tiered_injection_probes.json`](../audit/evidence/tiered_injection_probes.json) |
| Adversarial probe suite (`/predict`) | 14 probes, 0 mismatches, 0 HTTP 5xx | [`model/probe_results.json`](../model/probe_results.json) |

## 6. Reproduce

```bash
# Latency (local backend on :8000)
python -m model.measure_latency --samples 100

# Per-tier latency
python -m model.measure_latency_tiers --samples 30

# Rate-limit burst gate
python scripts/burst_test_tiered.py --limit 20 --burst 40

# Prompt-injection gate
python -m model.run_tiered_probes
```
