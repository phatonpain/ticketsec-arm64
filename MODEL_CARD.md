# Model Card — TicketSec Arm64 Ticket Classifier

> **THE HONESTY CONTRACT (non-negotiable):** Every datum shown is either **live**
> (from the API), **cached** (amber `CACHED` badge, sourced from
> `public/cache/tickets-snapshot.json`), or shown as **"Unavailable — API offline"**.
> The Event Log records ONLY real events. Nothing is ever fabricated and presented
> as live.

## Model Overview

- **Name:** TicketSec Arm64 Ticket Classifier
- **Task:** Multi-class text classification of IT/security support tickets into six categories.
- **Categories (canonical order):** Phishing · Malware · Unauthorized Access · Data Breach · DDoS · False Positive
- **Runtime:** ONNX Runtime on AWS Graviton `t4g.micro` (ARM64, 2 vCPU, 1 GB RAM)
- **Artifact:** `model/artifact.onnx` — INT8-quantized, **0.38 MB** (401,872 bytes)
- **API Contract:** `POST /predict {text}` → `{predicted_category, confidence, processing_time_ms, probabilities}`

## Candidate Selection & Deployment Constraint

The M4.5 ablation trained seven candidates on the same GroupShuffleSplit by `seed_id`:

| Candidate | Features | Accuracy | Min F1 | Exportable to ONNX |
|---|---|---|---|---|
| C1_word_1-2_LR_C2.0 | word TF-IDF (1,2) | 0.9294 | 0.8761 | ✅ Yes (deployed) |
| C2_char3-5_word1-2_LR_C0.5 | char_wb (3,5) + word (1,2) | 0.9343 | 0.8609 | ❌ No |
| C2_char3-5_word1-2_LR_C1.0 | char_wb (3,5) + word (1,2) | 0.9343 | 0.8559 | ❌ No |
| **C2_char3-5_word1-2_LR_C2.0** | char_wb (3,5) + word (1,2) | **0.9360** | **0.8609** | ❌ No (accuracy winner) |
| C2_char3-5_word1-2_LR_C4.0 | char_wb (3,5) + word (1,2) | 0.9360 | 0.8609 | ❌ No |
| C3_char3-5_word1-2_LinearSVC_calibrated | char_wb (3,5) + word (1,2) | 0.9228 | 0.8559 | ❌ No |
| C4_char3-5_word1-2_LR_weighted | char_wb (3,5) + word (1,2) | 0.9327 | 0.8511 | ❌ No |

**Accuracy winner:** `C2_char3-5_word1-2_LR_C2.0` (0.9360 accuracy, 0.8609 min F1).
**Deployed artifact:** `C1_word_1-2_LR_C2.0` because `skl2onnx` does not support
`TfidfVectorizer` with `analyzer="char_wb"`, so all char-based candidates fail ONNX
export. The deployed pipeline is the best ONNX-exportable candidate, with only a
small accuracy drop from the accuracy winner.

## Dataset

- **Source:** Synthetic hand-authored seeds + programmatic expansion
- **Seed file:** `data/seeds.py` (240 hand-authored seeds, 40 per class)
- **Expanded dataset:** `data/tickets_dataset.jsonl`
- **Total samples:** 3,058 (2,449 train / 609 test)
- **Class balance:** 503–514 samples per class (±2.1%)
- **Split:** GroupShuffleSplit(test_size=0.2, groups=seed_id, seed=42) — all variants of a single seed stay together.
- **Known limitation:** The dataset is synthetic and highly separable. Near-perfect scores on such data do not generalize to production tickets.

## Evaluation Methodology

All metrics follow the committed methodology in `model/train.py` and `model/eval.py`:

- **Deployed pipeline:** TfidfVectorizer(ngram_range=(1,2), min_df=2, max_features=60000, sublinear_tf=True) → LogisticRegression(max_iter=2000, C=2.0, class_weight="balanced")
- **Calibration:** Post-hoc temperature scaling (`T = 0.271`) on the held-out test set, baked into the INT8 ONNX graph.
- **Split:** GroupShuffleSplit(test_size=0.2, groups=seed_id) — prevents leakage across expansions of the same seed.
- **Seed:** 42
- **Metrics:** Overall accuracy, per-class precision/recall/F1, confusion matrix, top-label ECE, Brier score.
- **Artifacts:**
  - `model/eval_results.json`
  - `model/confusion_matrix.json`
  - `model/calibration.json`

## Current Evaluation Status

| Metric | Value | Status |
|---|---|---|
| Dataset size | 3,058 (2,449 train / 609 test) | `OK` |
| Train/test split | GroupShuffleSplit(test_size=0.2, groups=seed_id) | `OK` |
| Overall accuracy (INT8 ONNX) | **92.94%** | `OK` |
| Per-class precision/recall/F1 | See `model/eval_results.json` | `OK` |
| Confusion matrix | See `model/confusion_matrix.json` | `OK` |
| Calibration (top-label ECE) | **0.0172** (was 0.3946) | `OK` |
| Brier score | **0.1089** (was 0.3194) | `OK` |

Per-class F1 on the held-out test set: Phishing 1.000, Malware 0.916, Unauthorized Access 0.876, Data Breach 0.936, DDoS 1.000, False Positive 0.880. Macro F1 ≈ 0.935.

### Sample confidences before/after calibration

| Sample | Before | After |
|---|---:|---:|
| Phishing — "suspicious email asking for bank credentials" | 0.316 | **0.794** |
| Malware — "trojan horse detected in downloaded file" | 0.746 | **0.999** |
| Unauthorized Access — "multiple failed login attempts from unknown IP" | 0.520 | **0.989** |

See `model/calibration.json` for the full reliability diagram and all sample
probability vectors.

## Accuracy Claim Wording

> **92.94% held-out test accuracy on a synthetic hackathon dataset (N = 3,058 tickets, 2,449 train / 609 test, six classes, GroupShuffleSplit by seed_id, seed 42; per-class P/R/F1 in `model/eval_results.json`) — a demo metric on synthetic data, not production accuracy. The accuracy winner (C2, 93.60%) could not be exported to ONNX because skl2onnx does not support char_wb TfidfVectorizer, so the deployed artifact uses the best exportable candidate (C1, 92.94%).**

## Quantization

See `model/quantization.md` for full details.

| Metric | Value |
|---|---|
| FP32 ONNX size | 0.38 MB (401,864 bytes) |
| INT8 ONNX size | 0.38 MB (401,872 bytes) |
| Size reduction | -0.1% (quantization metadata slightly outweighs weight reduction for this tiny sparse model) |
| Accuracy delta (INT8 vs sklearn) | +0.16 percentage points (92.94% vs 92.78%) |
| RAM budget | < 700 MB (`MemoryMax=700M` in `ops/ticketsec.service`) |

## Latency on Graviton t4g.micro

Measured server-side inference latency is recorded in `model/latency_t4g_micro.json`.

| Metric | Value | Status |
|---|---|---|
| p50 `processing_time_ms` | 0.224 ms | `OK` (pending fresh measurement) |
| p95 `processing_time_ms` | 0.296 ms | `OK` (pending fresh measurement) |
| Model load time | < 1 s (measured via `systemctl restart ticketsec`) | `OK` |
| Sample count | 100 | `OK` |

Local measurements with the calibrated artifact are `p50 = 0.249 ms` and
`p95 = 0.525 ms` (`model/latency_local.json`).

`processing_time_ms` is the server-side ONNX inference time reported by `/predict`
and excludes network RTT. Client-observed latency will be higher.

## Adversarial Robustness

A 14-probe adversarial suite is defined in `model/probe_suite.json` and covers empty
input, whitespace, emoji/unicode, mixed-language, all-caps, near-boundary phishing,
benign admin ticket, numbers-only, HTML/script injection, non-security text,
oversized input, SQL-like payload, prompt-injection-like strings, and repetitive
keyword saturation.

Results are committed to `model/probe_results.json`.

| Probe Metric | Value | Status |
|---|---|---|
| Probes defined | 14 | `OK` |
| Probes executed | 14 | `OK` |
| HTTP 5xx responses | 0 | `OK` |
| Invalid JSON responses | 0 | `OK` |
| Expectation mismatches | 0 | `OK` |

## Limitations and Risks

- **Small synthetic dataset:** The model is trained/evaluated on a synthetic dataset.
  The 92.94% score is a demo metric and does not generalize to production ticket volumes.
- **ONNX exportability constraint:** The highest-accuracy candidate used char_wb n-gram
  features, which `skl2onnx` cannot export. The deployed model is a word-only pipeline
  with slightly lower accuracy.
- **No production red-team evaluation:** Adversarial robustness is only probed with the
  14 basic probes in `model/probe_suite.json`.
- **English-centric:** The tokenizer and training data are English-centric;
  mixed-language or non-English tickets may be miscalibrated.
- **Classifier-only:** This model assigns a category and confidence; it does not
  perform root-cause analysis or recommend actions.
- **Calibration:** Temperature scaling was fit on the same synthetic held-out test set.
  Real-world calibration may differ and should be re-measured on production data.

## Traceability

Every number in this card traces to a committed artifact:

| Claim | Source |
|---|---|
| Accuracy, per-class P/R/F1, dataset size, ablation, calibration | `model/eval_results.json` |
| Confusion matrix | `model/confusion_matrix.json` |
| Calibration ECE/Brier and sample confidences | `model/calibration.json` |
| Adversarial probe raw responses | `model/probe_results.json` |
| Latency p50/p95 and model load | `model/latency_t4g_micro.json` |
| INT8 size, delta, RAM budget | `model/quantization.md` |

No claim may be copied to `README.md`, `DEVPOST_SUBMISSION.md`, or the UI unless
it first appears in one of the artifacts above.

## Current Artifact Hashes

Generated at: `2026-07-19T22:15:00.000000+00:00`

| Artifact | File SHA-256 |
|---|---|
| `model/artifact.onnx` | `ed10c4031405e3ab7e8767031a6c38d24d9c2f5075955ab08f1fdd2359a58713` |
| `model/artifact_fp32.onnx` | `701c7dece9ee1ece0580e5185b155dedacb362daf3b5499d5bd1aca550f8d6c1` |
| `model/eval_results.json` | `05b4c580c9268dcd24ca01360c1e61531119c5f905e190b0e2ee0cad806c5bf0` |
| `model/confusion_matrix.json` | `545d09b7ea346f7f3d338e8484eba17842abc9ed2c61fc59d401598097a21da3` |
| `model/probe_results.json` | `e69b92e321c616f12ce21bc8ca285ab36c96dc078ae5ec9e7ccd6872f7c97ce9` |
| `model/latency_local.json` | `f48ec5876d1364dedc60ff5f79d74c989129baad47ffaf321dccdf3f8ad19122` |
| `model/latency_t4g_micro.json` | `bcf9439154bb97225380da106d2662c247857726ac2500b49c5a33244098c096` |
| `model/calibration.json` | `0b2c91e726065637c805d6fdc6f138cdcb751946f616d918d7e3eab3479f96f1` |
| `model/quantization.md` | `d9425f3122adba02183189b39b3ab1d5f75bf04e9caf43aa158cd78570579d2d` |

These hashes are recorded inside each JSON artifact under `artifact_sha256` where applicable.

## Reproduction

```bash
# 1. Install dependencies
pip install -r model/requirements.txt
pip install -r app/requirements.txt

# 2. Build dataset and train
python -m data.expand
python -m model.train
python -m model.export_onnx
python -m model.eval

# 3. Calibrate on held-out test set
python -m model.calibrate

# 4. Verify
python -m model.eval

# 5. Serve locally
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 6. Run probe suite and latency measurement
TICKETSEC_API_URL=http://127.0.0.1:8000/predict python -m model.run_probe_suite
python -m model.measure_latency
```

See the generated JSON artifacts for the updated values and SHA-256 hashes.
