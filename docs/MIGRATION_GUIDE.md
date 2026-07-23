# Migrating a sklearn text classifier to optimized ONNX on Arm64

A reusable playbook distilled from the TicketSec Arm64 project: how a
scikit-learn TF-IDF + LogisticRegression pipeline was moved to an INT8 ONNX
artifact running on ONNX Runtime on an AWS Graviton `t4g.micro` (Arm64) —
with every step scripted, every number measured, and every failure mode
documented. Use it as a checklist for your own sklearn → ONNX → Arm64
migration.

## TL;DR

- **What we moved:** a sklearn `TfidfVectorizer` + `LogisticRegression` text
  classifier (six SOC ticket categories) to a single INT8 ONNX artifact served
  by ONNX Runtime's `CPUExecutionProvider`.
- **What it cost in accuracy:** nothing — INT8 ONNX scored **0.9294** vs
  **0.9278** for the sklearn pipeline on the held-out test set, a delta of
  **+0.16 percentage points** ([`model/quantization.md`](../model/quantization.md)).
  The bigger accuracy concession was elsewhere: the ablation winner (93.60%)
  could not be exported to ONNX at all, so the deployed candidate scores 92.94%.
- **What we gained:** one runtime that runs the same artifact unchanged on x86
  dev machines and Arm64 production, a **0.38 MB** (401,872 bytes) artifact,
  and server-side inference at **p50 0.237 ms / p95 0.286 ms** on a host that
  costs **~$0.0084/hour** (≈ $6/month) in `us-east-2`
  ([`model/latency_t4g_micro.json`](../model/latency_t4g_micro.json)).

## 1. The pipeline end-to-end

The full chain is five committed scripts, each producing a committed artifact:

```
data.expand → model.train → model.export_onnx → model.calibrate → model.eval
```

### 1.1 Train with a leakage-safe split — `model/train.py`

The dataset is 3,058 synthetic tickets expanded from hand-authored seeds, so
near-duplicates of one seed must never straddle the train/test boundary. The
split groups by `seed_id`:

```python
# model/train.py
gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED)
train_idx, test_idx = next(gss.split(texts, y, groups))
```

Result: 2,449 train / 609 test, six classes (Phishing, Malware, Unauthorized
Access, Data Breach, DDoS, False Positive), seed 42. Training runs an ablation
of candidates (C1 word TF-IDF + LR, C2 char+word TF-IDF + LR grid, C3
calibrated LinearSVC, C4 class-weighted LR) and persists the held-out test set
to `model/test_set.jsonl` so every later stage measures on the same 609 samples.

### 1.2 Export FP32 ONNX — `model/export_onnx.py`

```python
# model/export_onnx.py
initial_type = [("text_input", StringTensorType([None, 1]))]
onnx_model = convert_sklearn(
    pipeline,
    initial_types=initial_type,
    target_opset=15,
    options={LogisticRegression: {"zipmap": False}},
)
```

Two details matter: the input is a 2-D string tensor `[batch_size, 1]` (the
vectorizer consumes raw text inside the ONNX graph — no Python preprocessing at
inference time), and `zipmap=False` makes the classifier emit a plain
probability matrix instead of a sequence of maps.

### 1.3 Quantize to INT8 — `model/export_onnx.py`

```python
# model/export_onnx.py
quantize_dynamic(
    model_input=str(FP32_PATH),
    model_output=str(INT8_PATH),
    weight_type=QuantType.QInt8,
)
```

Dynamic quantization: weights are INT8, activations remain FP32. No calibration
dataset is required for this step.

### 1.4 Validate parity on the held-out test set — `model/export_onnx.py`

The same script immediately scores both the sklearn pipeline and the INT8 ONNX
session on `model/test_set.jsonl` and prints the delta. Measured result
([`model/quantization.md`](../model/quantization.md)):

| Metric | Value |
|---|---|
| sklearn pipeline accuracy | 0.9278 |
| INT8 ONNX accuracy | 0.9294 |
| Delta | +0.0016 (+0.16 pp) |
| FP32 size | 0.38 MB (401,864 bytes) |
| INT8 size | 0.38 MB (401,872 bytes) |
| Size delta | **+8 bytes (+0.002%) — effectively the same size** (see pitfall 2) |

The session runs on `CPUExecutionProvider` — the same provider used in
production on Graviton.

### 1.5 Calibrate as a separate step — `model/calibrate.py`

Post-hoc temperature scaling on the held-out test set. The script measures
top-label ECE and Brier score before and after, searches for the temperature
that minimizes ECE, and — only if ECE improves — rewrites the ONNX graph to
bake the temperature into the probability output. Measured result
([`model/calibration.json`](../model/calibration.json)):

| Metric | Before | After |
|---|---|---|
| Top-label ECE | 0.3946 | 0.0172 |
| Brier score | 0.3194 | 0.1089 |

Temperature `T = 0.271`; assessment `WELL_CALIBRATED`. The script has an
honesty guard: if calibration had not reduced ECE, the original artifact would
have been kept and the negative result documented.

### 1.6 Final evaluation — `model/eval.py`

`python -m model.eval` re-scores the deployed INT8 artifact on the held-out
test set and commits per-class precision/recall/F1 and the confusion matrix to
`model/eval_results.json` and `model/confusion_matrix.json`. If the artifact is
missing it emits PENDING artifacts instead of fabricating metrics.

## 2. Pitfalls found the hard way

### 2.1 skl2onnx cannot export `char_wb` — commit the model that runs

The accuracy winner of the ablation was `C2_char3-5_word1-2_LR_C2.0` at
**93.60%**, which unions word n-grams with `TfidfVectorizer(analyzer="char_wb",
ngram_range=(3,5))`. skl2onnx does not support the `char_wb` analyzer, so the
winner cannot be converted to ONNX. `model/train.py` encodes the decision rule
explicitly:

```python
# model/train.py
def is_exportable(candidate_id: str) -> bool:
    """Return True if the candidate can be exported to ONNX by skl2onnx.

    skl2onnx does not support CountVectorizer/TfidfVectorizer with
    analyzer='char_wb', so any candidate that uses char features is not
    directly exportable.
    """
    return not candidate_id.startswith(("C2_", "C3_", "C4_"))
```

The deployed artifact is the best exportable candidate, `C1_word_1-2_LR_C2.0`
at **92.94%**. Both IDs are committed side by side in
[`model/eval_results.json`](../model/eval_results.json)
(`winner_candidate_id` vs `deployed_candidate_id`). The rule we now follow:
**commit the model that runs, not the model that scores highest.** Check
exportability of every ablation candidate *before* selecting a winner, not
after.

### 2.2 Dynamic quantization does not shrink vocabulary-dominated artifacts

INT8 is effectively the **same size** as FP32 for this model — the quantized
artifact is 8 bytes larger (+0.002%). The reason: the artifact is mostly the
TF-IDF vocabulary (strings), which quantization does not touch; only the LR
weight matrix is quantized, and for a six-class linear model that matrix is
tiny compared to the vocabulary. Do not promise a size win for TF-IDF-style
models; measure it. The real wins here were single-runtime portability
(one ONNX Runtime path from x86 dev to arm64 Graviton) and the 0.38 MB memory
footprint, not file size.

### 2.3 Calibration is a separate, reversible step

Raw LR probabilities on a highly separable synthetic dataset were badly
miscalibrated (ECE 0.3946). Temperature scaling on the held-out set brought
ECE to 0.0172. Key practices: fit the temperature on held-out data, measure
ECE *and* Brier before and after, bake the result into the ONNX graph so
serving code stays unchanged, and keep the guard that keeps the original
artifact if calibration does not help.

### 2.4 Group the split by seed, or your synthetic data leaks

Synthetic datasets expanded from seeds contain near-duplicates. A random split
puts variants of the same ticket on both sides of the boundary and inflates
every metric. `GroupShuffleSplit(test_size=0.2, groups=seed_id,
random_state=42)` keeps all variants of one seed together. Report the split
strategy next to every accuracy number — an unqualified accuracy on synthetic
data is a leakage-risk number.

## 3. Verification protocol

Every claim about the deployed model is reproducible from committed artifacts:

| Check | How | Result | Source |
|---|---|---|---|
| INT8 parity | Score sklearn and INT8 ONNX on the same 609-sample held-out test set | 0.9278 → 0.9294 (+0.16 pp) | [`model/quantization.md`](../model/quantization.md) |
| Calibration | ECE/Brier before and after temperature scaling on held-out set | ECE 0.3946 → 0.0172; Brier 0.3194 → 0.1089; `WELL_CALIBRATED` | [`model/calibration.json`](../model/calibration.json) |
| Adversarial probes | 14-probe suite (empty, unicode, injection-like, oversized, …) against the live endpoint | 14 probes, 0 expectation mismatches, 0 HTTP 5xx | [`model/probe_results.json`](../model/probe_results.json) |
| Latency | 100 sequential `/predict` requests against the Graviton host, 2026-07-20; `processing_time_ms` is server-side ONNX time, excludes network RTT | p50 0.237 ms, p95 0.286 ms | [`model/latency_t4g_micro.json`](../model/latency_t4g_micro.json) |
| Tiered fallback (v5) | `POST /predict/tiered`: ONNX first, local LLM (Ollama) fallback below `TIERED_CONFIDENCE_THRESHOLD` (default 0.70); honesty field `inference_tier` (`onnx_int8` \| `local_llm_q4` \| `unavailable`) | per-tier latency committed; 6 prompt-injection probes 6/6 contract-clean | [`model/latency_tiers.json`](../model/latency_tiers.json), [`model/run_tiered_probes.py`](../model/run_tiered_probes.py), [`scripts/burst_test_tiered.py`](../scripts/burst_test_tiered.py) |

Latency measurement protocol, so numbers stay comparable: sequential requests
(no concurrency), report server-side `processing_time_ms` (never client RTT),
record the host, the date, and the sample count next to the numbers.

## 4. Reusable checklist

1. **Split with groups.** If your data has any duplication structure (seeds,
   users, sessions), use `GroupShuffleSplit` and persist the exact test set to
   disk for all later stages.
2. **Ablate, then check exportability before celebrating.** Verify that
   `skl2onnx.convert_sklearn` accepts every candidate. `char_wb` /
   `char` analyzers of `TfidfVectorizer` are not supported — if you need char
   n-grams, plan a custom tokenizer or a different exporter up front.
3. **Deploy the best exportable candidate** and record both
   `winner_candidate_id` and `deployed_candidate_id` in your eval artifact.
4. **Export FP32 with `zipmap=False`** and a `StringTensorType([None, 1])`
   input so raw text goes in and a clean probability matrix comes out.
5. **Quantize with `quantize_dynamic` (QInt8)** — then measure size and
   accuracy deltas. Vocabulary-dominated text models will not shrink; do not
   claim they will.
6. **Run parity on the exact held-out test set**, not a fresh sample, and
   commit both accuracies and the delta.
7. **Calibrate separately** (temperature on held-out data, ECE + Brier before
   and after) and bake the temperature into the graph only if it helps.
8. **Probe the served endpoint**, not just the model file: adversarial inputs,
   oversized payloads, rate-limit bursts (assert 429 + `Retry-After`, no 5xx).
9. **Measure latency on the real target host** with a stated protocol
   (sequential n, server-side timing, date, hardware, cost/hour).
10. **Commit every artifact** (eval JSON, confusion matrix, calibration JSON,
    probe results, latency JSON, quantization report) with hashes, and never
    type a metric into docs or UI that does not trace to one of them.

---

*All numbers in this guide trace to committed artifacts in the
[TicketSec Arm64 repository](../README.md); see
[`MODEL_CARD.md`](../MODEL_CARD.md) for the full model card and claim ledger.*
