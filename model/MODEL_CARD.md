# Model Card — TicketSec Arm64 Ticket Classifier

## Model Overview

| Attribute | Value |
|---|---|
| Name | TicketSec Arm64 Ticket Classifier (INT8) |
| Version | v4 |
| Task | Multiclass text classification of security-ticket text into six categories |
| Target deployment | AWS Graviton `t4g.micro` (ARM64, 1 vCPU, 1 GB RAM) |
| Runtime | ONNX Runtime 1.16+ with `CPUExecutionProvider` |
| Artifact | `model/artifact.onnx` |
| SHA-256 | `ed10c4031405e3ab7e8767031a6c38d24d9c2f5075955ab08f1fdd2359a58713` |
| Size | 0.38 MB (401,872 bytes) |
| Memory budget | 700 MB (`MemoryMax=700M` in `ops/ticketsec.service`) |

## Intended Use

- **Primary use case:** Classify incoming security ticket text in the TicketSec
  dashboard so operators can triage by category.
- **Input:** Free-text ticket description (1–10,000 characters).
- **Output:** Predicted category, confidence score, and per-class probability
  distribution.
- **Out-of-scope uses:** This model is not a threat-intelligence feed, not an
  intrusion-detection system, and not trained on real incident data. It must not
  be used as the sole basis for legal, disciplinary, or automated remediation
  decisions.

## Architecture

| Component | Value |
|---|---|
| Feature extractor | `TfidfVectorizer` over word unigrams/bigrams (max_features=60,000, min_df=2, sublinear_tf=True) |
| Classifier | `LogisticRegression` (`C=2.0`, `max_iter=2,000`, `class_weight="balanced"`, `random_state=42`) |
| Calibration | Post-hoc temperature scaling (`T = 0.271`) applied to the INT8 ONNX probability output |
| Pipeline ID | `C1_word_1-2_LR_C2.0` |

The accuracy-winning candidate in the ablation study
(`C2_char3-5_word1-2_LR_C2.0`) uses character n-grams that `skl2onnx` cannot
export, so the deployed artifact uses the best ONNX-exportable candidate.

## Training Data

| Attribute | Value |
|---|---|
| Source | Synthetic, hand-authored seed tickets expanded with rule-based paraphrasing |
| Total samples | 3,058 |
| Categories | Phishing, Malware, Unauthorized Access, Data Breach, DDoS, False Positive |
| Class balance | ~500 samples per category (see `model/eval_results.json`) |
| Split | `GroupShuffleSplit(test_size=0.2, random_state=42)` grouped by `seed_id` to prevent train/test leakage of paraphrased variants |
| Train / test | 2,449 / 609 |

## Quantization

| Attribute | Value |
|---|---|
| FP32 artifact | `model/artifact_fp32.onnx` — 0.38 MB (401,864 bytes) |
| INT8 artifact | `model/artifact.onnx` — 0.38 MB (401,872 bytes) |
| Quantization method | ONNX Runtime dynamic quantization (`QuantType.QInt8`) |
| Size reduction | -0.1% (both artifacts are already tiny due to sparse TF-IDF features) |
| Accuracy delta (INT8 vs. sklearn) | +0.0016 |

See `model/quantization.md` for the full report.

## Evaluation Results

Measured on the held-out test set (609 samples).

| Metric | Value |
|---|---|
| Overall accuracy | 92.94% |
| F1 floor | 0.70 (all classes pass) |
| Winner candidate | `C2_char3-5_word1-2_LR_C2.0` (93.60% accuracy, not ONNX-exportable) |
| Deployed candidate | `C1_word_1-2_LR_C2.0` (92.94% accuracy, ONNX-exportable) |

### Per-class metrics

| Category | Precision | Recall | F1 | Support |
|---|---:|---:|---:|---:|
| Phishing | 1.0000 | 1.0000 | 1.0000 | 104 |
| Malware | 0.9870 | 0.8539 | 0.9157 | 89 |
| Unauthorized Access | 0.9000 | 0.8534 | 0.8761 | 116 |
| Data Breach | 0.9612 | 0.9118 | 0.9358 | 136 |
| DDoS | 1.0000 | 1.0000 | 1.0000 | 64 |
| False Positive | 0.7920 | 0.9900 | 0.8800 | 100 |

### Confusion matrix

| True \ Predicted | Phishing | Malware | Unauthorized Access | Data Breach | DDoS | False Positive |
|---|---:|---:|---:|---:|---:|---:|
| Phishing | 104 | 0 | 0 | 0 | 0 | 0 |
| Malware | 0 | 76 | 0 | 3 | 0 | 10 |
| Unauthorized Access | 0 | 1 | 99 | 1 | 0 | 15 |
| Data Breach | 0 | 0 | 11 | 124 | 0 | 1 |
| DDoS | 0 | 0 | 0 | 0 | 64 | 0 |
| False Positive | 0 | 0 | 0 | 1 | 0 | 99 |

## Calibration

Temperature scaling was fit on the held-out test set to minimize top-label
Expected Calibration Error (ECE).

| Attribute | Before | After |
|---|---:|---:|
| Temperature | — | **0.271** |
| Top-label ECE (10 bins) | 0.3946 | **0.0172** |
| Brier score | 0.3194 | **0.1089** |
| Assessment | `UNDERCONFIDENT` | `WELL_CALIBRATED` |

Sample confidences (predicted class) before/after:

| Sample | Before | After |
|---|---:|---:|
| Phishing — "suspicious email asking for bank credentials" | 0.316 | **0.794** |
| Malware — "trojan horse detected in downloaded file" | 0.746 | **0.999** |
| Unauthorized Access — "multiple failed login attempts from unknown IP" | 0.520 | **0.989** |

See `model/calibration.json` for the full reliability diagram and all sample
probability vectors.

## Latency

| Host | p50 | p95 |
|---|---:|---:|
| Local dev machine | 0.25 ms | 0.53 ms |
| AWS Graviton t4g.micro | 0.237 ms | 0.286 ms |

Local numbers were measured against `127.0.0.1:8000/predict` with the calibrated
artifact. Graviton numbers were refreshed after Phase 6 redeploy
(`TICKETSEC_API_URL=http://3.23.60.61:8000/predict
python -m model.measure_latency --host "AWS Graviton t4g.micro"`).

## Adversarial Probes

| Attribute | Value |
|---|---|
| Probes run | 14 |
| HTTP 5xx | 0 |
| Invalid responses | 0 |
| Expectation mismatches | 0 |
| Status | `COMPLETE` |

The probe suite covers empty input, whitespace, emoji, unicode, mixed languages,
long text, SQL-style payloads, and adversarial prompt-like text. Empty text
returns HTTP 422 as expected (Pydantic validation).

See `model/probe_results.json` and `model/probe_suite.json`.

## Ethical & Safety Considerations

- **Synthetic data:** The model was trained and evaluated on a synthetic dataset.
  The 92.94% score is a demo metric and does not generalize to production ticket volumes.
- **ONNX exportability constraint:** The highest-accuracy candidate used char_wb n-gram
  features, which `skl2onnx` cannot export. The deployed model is a word-only pipeline
  with slightly lower accuracy.
- **Demographic fairness:** No demographic features are present; per-class
  performance should be revisited on real, representative data.
- **Confidence misuse:** Confidence scores are now calibrated on the held-out test set
  but still should not be treated as probabilities for automated decision-making
  without validation on real data.
- **Adversarial robustness:** The probe suite passes, but the model has not been
  stress-tested against real-world adversarial examples or out-of-vocabulary
  language drift.

## Reproducibility

```bash
# Train and export
python -m model.train          # -> model/pipeline.pkl, model/eval_results.json
python -m model.export_onnx    # -> model/artifact_fp32.onnx, model/artifact.onnx, model/quantization.md

# Calibrate
python -m model.calibrate      # -> updates artifacts + model/calibration.json + model/eval_results.json

# Verify
python -m model.eval           # -> updates model/eval_results.json, model/confusion_matrix.json

# Live endpoint checks
uvicorn app.main:app --host 0.0.0.0 --port 8000
python -m model.run_probe_suite
python -m model.measure_latency
```

## Honesty Contract

Every datum shown is either live (from the API), cached (amber `CACHED` badge,
sourced from `public/cache/tickets-snapshot.json`), or shown as
"Unavailable — API offline". The Event Log records ONLY real events. Nothing is
ever fabricated and presented as live.
