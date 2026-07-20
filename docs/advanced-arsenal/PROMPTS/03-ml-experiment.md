# 03 — ML experiment / model refresh (next-cycle prompt)

> **Do NOT execute this prompt now.** Use it for future model work on TicketSec
> Arm64 v4.

## Trigger

Retraining, new calibration, new probes, latency refresh, or ONNX export work.

## Required reads

- `model/MODEL_CARD.md`
- `audit/ML_TRACEABILITY.md`
- `model/eval_results.json`

## Exact steps

1. Use seed 42 and `GroupShuffleSplit(test_size=0.2, groups=seed_id)`.
2. Run the pipeline:
   ```bash
   python -m model.train
   python -m model.export_onnx
   python -m model.calibrate
   python -m model.eval
   python -m model.run_probe_suite
   ```
3. Verify the deployed artifact is still ONNX-exportable; if a higher-accuracy
   candidate cannot be exported, document the trade-off and keep the exportable
   one.
4. Update `MODEL_CARD.md`, `audit/ML_TRACEABILITY.md`, and any README/Devpost
   metrics tables.
5. Recompute SHA-256 hashes in claim ledgers.
6. Run `bash scripts/gates.sh`.

## Acceptance criteria

- [ ] `model/eval_results.json`, `model/confusion_matrix.json`,
      `model/calibration.json`, `model/probe_results.json`,
      `model/latency_t4g_micro.json` committed and status OK/COMPLETE.
- [ ] Accuracy wording includes dataset/split caveats.
- [ ] Claim ledgers updated with new hashes.
- [ ] gates.sh 11/11 PASS.
