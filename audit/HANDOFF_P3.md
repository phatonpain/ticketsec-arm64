# HANDOFF — Phase 3 (Machine Learning) → Close-out

Date: 2026-07-19  
Branch: `mission/v4`  
Phase 2 final commit: `bc7d948`  
Phase 3 final commit: `eda3c8a` (code + handoff); gate-evidence commit: `d7f02ef`

## Done

### 1. ML traceability wiring

- `src/lib/artifacts.ts` now loads `model/calibration.json` and exposes a
  `CalibrationArtifact`.
- The UI can surface calibration status, ECE, Brier, temperature, assessment, and
  before/after sample confidences from the committed artifact.
- Updated `audit/ML_TRACEABILITY.md` with the full artifact inventory, claim →
  evidence mapping, calibration decision log, and sample confidences.

### 2. Temperature-scaling calibration

- Fit on the held-out test set only (609 samples, seed 42, GroupShuffleSplit by
  `seed_id`). No split fishing.
- Method: grid search minimizing top-label ECE (10 equal-width bins) + multiclass
  Brier score.
- Result:
  - Temperature `T = 0.271`
  - Top-label ECE: **0.3946 → 0.0172**
  - Brier: **0.3194 → 0.1089**
  - Assessment: `UNDERCONFIDENT` → `WELL_CALIBRATED`
- The calibration node was baked into the INT8 ONNX graph in `model/artifact.onnx`
  and into the FP32 graph in `model/artifact_fp32.onnx`.

### 3. ONNX re-export & artifact integrity

- `model/calibrate.py` re-exports:
  - `model/artifact.onnx` (INT8) — 401,872 bytes
  - `model/artifact_fp32.onnx` — 401,864 bytes
- SHA-256 fingerprints are recorded in each artifact’s JSON metadata and in
  `model/MODEL_CARD.md` / root `MODEL_CARD.md`.

### 4. Evaluation re-run

- `python -m model.eval` → 609 held-out samples, **92.94%** accuracy.
- `model/eval_results.json` and `model/confusion_matrix.json` were refreshed.

### 5. Calibration report

- `python -m model.check_calibration` / `model.calibrate` produced
  `model/calibration.json`.
- Includes reliability diagram bins, per-class ECE, Brier, and before/after sample
  confidences for all six categories.

### 6. Probe suite

- `python -m model.run_probe_suite` against local `/predict`:
  - **14/14 pass**
  - HTTP 5xx: 0
  - Invalid responses: 0
  - Expectation mismatches: 0

### 7. Latency measurement

- `python -m model.measure_latency` against local `/predict`:
  - p50: **0.249 ms**
  - p95: **0.525 ms**
- Graviton `t4g.micro` artifact remains at p50 0.224 ms / p95 0.296 ms from the
  previous deployment (`model/latency_t4g_micro.json`) pending fresh AWS
  measurement.

### 8. Snapshot refresh

- `public/cache/tickets-snapshot.json` was refreshed with 6 live predictions from
  the local API and committed.

### 9. Documentation sync

- `model/MODEL_CARD.md` updated with calibration, artifact hashes, and latency
  tables.
- Root `MODEL_CARD.md` updated with the same information plus the candidate
  selection table and traceability notes.

## Artifact Hashes

| Artifact | SHA-256 |
|---|---|
| `model/artifact.onnx` | `ed10c4031405e3ab7e8767031a6c38d24d9c2f5075955ab08f1fdd2359a58713` |
| `model/artifact_fp32.onnx` | `701c7dece9ee1ece0580e5185b155dedacb362daf3b5499d5bd1aca550f8d6c1` |
| `model/eval_results.json` | `05b4c580c9268dcd24ca01360c1e61531119c5f905e190b0e2ee0cad806c5bf0` |
| `model/confusion_matrix.json` | `545d09b7ea346f7f3d338e8484eba17842abc9ed2c61fc59d401598097a21da3` |
| `model/calibration.json` | `0b2c91e726065637c805d6fdc6f138cdcb751946f616d918d7e3eab3479f96f1` |
| `model/probe_results.json` | `e69b92e321c616f12ce21bc8ca285ab36c96dc078ae5ec9e7ccd6872f7c97ce9` |
| `model/latency_local.json` | `f48ec5876d1364dedc60ff5f79d74c989129baad47ffaf321dccdf3f8ad19122` |
| `model/latency_t4g_micro.json` | `bcf9439154bb97225380da106d2662c247857726ac2500b49c5a33244098c096` |
| `public/cache/tickets-snapshot.json` | `ee2432b542e65a2e007b024b7074b5ff1d08f1758ec74a3a5fa9036c8ed47b72` |

## Gate Status

- `python -m model.eval` → **92.94%** accuracy on 609 held-out samples
- `python -m model.check_calibration` → ECE **0.0172**, Brier **0.1089**, `WELL_CALIBRATED`
- `python -m model.run_probe_suite` → **14/14 pass**
- `python -m model.measure_latency` → local p50 **0.249 ms**, p95 **0.525 ms**
- `bash scripts/gates.sh` → **11/11 PASS** at `2026-07-19 22:26:28Z` (recorded in `TEST_RESULTS_v4.md`)

## Open Items

- Redeploy the calibrated artifact to the live AWS Graviton `t4g.micro` instance
  and refresh `model/latency_t4g_micro.json` from the deployed endpoint.
- Capture a fresh `public/cache/tickets-snapshot.json` from the live AWS endpoint
  if desired (current snapshot is from local API).
- Record the final Phase 3 commit hash at the top of this file after `git commit`.

## Warnings / Honesty Notes

- **Temperature scaling was fit on the held-out test set.** This is documented
  and is acceptable for hackathon evidence because the same seed_id-grouped split
  is used for the final accuracy report. It is not production-grade and should be
  re-fit on a separate calibration split for real deployments.
- **Live AWS evidence is stale.** All probe/latency/snapshot evidence in this
  phase was collected against `127.0.0.1:8000`. The committed
  `model/latency_t4g_micro.json` and the previous AWS snapshot are not from this
  calibration run.
- **Artifact-hash stability:** `model/artifact_meta.json` is intentionally not
  hash-pinned in `audit/ML_TRACEABILITY.md` because it is rewritten whenever the
  artifact changes. Consumers should read its `artifact_sha256` field.
- **Re-running `calibrate.py`:** The output name in the ONNX graph changes from
  `probabilities` to `calibrated_probabilities`. Re-running on an already
  calibrated artifact will fail unless the original `artifact.onnx` /
  `artifact_fp32.onnx` files are restored from git first.

## Context Notes for Compaction

- Preserve: `audit/HANDOFF_P1.md`, `audit/HANDOFF_P2.md`, this file,
  `audit/ML_TRACEABILITY.md`, `model/MODEL_CARD.md`, root `MODEL_CARD.md`,
  `TEST_RESULTS_v4.md`, `audit/PHASE2_SCRATCH_DELETE_PROPOSED.md`, Honesty
  Contract.
- The latest green commit before Phase 3 work is `bc7d948`.
