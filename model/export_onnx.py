"""Export the trained sklearn pipeline to ONNX and quantize to INT8.

Steps:
1. Load model/pipeline.pkl.
2. Convert to ONNX FP32 → model/artifact_fp32.onnx.
3. Dynamic quantize weights to INT8 → model/artifact.onnx.
4. Validate INT8 parity against the sklearn pipeline on the held-out test set.
5. Update eval_results.json / confusion_matrix.json with the INT8 artifact hash.
6. Write model/quantization.md with measured numbers.
"""
from __future__ import annotations

import hashlib
import json
import pickle
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import onnxruntime as ort
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import StringTensorType
from onnxruntime.quantization import quantize_dynamic, QuantType
from sklearn.linear_model import LogisticRegression

from model.categories import CATEGORIES

PROJECT_ROOT = Path(__file__).resolve().parent
PIPELINE_PATH = PROJECT_ROOT / "pipeline.pkl"
TEST_SET_PATH = PROJECT_ROOT / "test_set.jsonl"
FP32_PATH = PROJECT_ROOT / "artifact_fp32.onnx"
INT8_PATH = PROJECT_ROOT / "artifact.onnx"
RESULTS_PATH = PROJECT_ROOT / "eval_results.json"
CONFUSION_PATH = PROJECT_ROOT / "confusion_matrix.json"
QUANTIZATION_MD = PROJECT_ROOT / "quantization.md"


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def load_test_texts(path: Path) -> tuple[list[str], list[int]]:
    texts: list[str] = []
    labels: list[int] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)
            texts.append(record["text"])
            labels.append(CATEGORIES.index(record["category"]))
    return texts, labels


def update_artifact_hash(path: Path, artifact_hash: str) -> None:
    with path.open("r", encoding="utf-8") as f:
        payload = json.load(f)
    payload["artifact_sha256"] = artifact_hash
    payload["generated_at"] = now_utc()
    if path == RESULTS_PATH and "artifact_path" not in payload:
        payload["artifact_path"] = "model/artifact.onnx"
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
        f.write("\n")


def run_onnx(session: ort.InferenceSession, texts: list[str]) -> tuple[np.ndarray, np.ndarray]:
    input_name = session.get_inputs()[0].name
    # The vectorizer expects a 2-D string tensor: [batch_size, 1]
    arr = np.array([[t] for t in texts])
    outputs = session.run(None, {input_name: arr})

    # With zipmap=False the classifier emits [labels, probabilities].
    if len(outputs) >= 2 and outputs[1].ndim == 2:
        labels = outputs[0].astype(int)
        probabilities = outputs[1]
        return labels, probabilities

    out = outputs[0]
    if out.ndim == 1:
        return out.astype(int), np.zeros((len(out), len(CATEGORIES)), dtype=np.float32)
    return np.argmax(out, axis=1), out


def main() -> int:
    if not PIPELINE_PATH.exists():
        print(f"Pipeline not found: {PIPELINE_PATH}. Run python -m model.train first.")
        return 1

    print(f"Loading pipeline from {PIPELINE_PATH}")
    with PIPELINE_PATH.open("rb") as f:
        pipeline = pickle.load(f)

    # 1. Export FP32 ONNX.
    print("Converting to ONNX FP32...")
    initial_type = [("text_input", StringTensorType([None, 1]))]
    onnx_model = convert_sklearn(
        pipeline,
        initial_types=initial_type,
        target_opset=15,
        options={LogisticRegression: {"zipmap": False}},
    )
    with FP32_PATH.open("wb") as f:
        f.write(onnx_model.SerializeToString())
    print(f"  -> {FP32_PATH}")

    # 2. Quantize to INT8.
    print("Quantizing to INT8...")
    quantize_dynamic(
        model_input=str(FP32_PATH),
        model_output=str(INT8_PATH),
        weight_type=QuantType.QInt8,
    )
    print(f"  -> {INT8_PATH}")

    # 3. File sizes and hashes.
    fp32_bytes = FP32_PATH.stat().st_size
    int8_bytes = INT8_PATH.stat().st_size
    fp32_hash = file_hash(FP32_PATH)
    int8_hash = file_hash(INT8_PATH)
    size_reduction = (fp32_bytes - int8_bytes) / fp32_bytes

    print(f"FP32 size: {fp32_bytes:,} bytes ({fp32_bytes / 1_048_576:.2f} MB)")
    print(f"INT8 size: {int8_bytes:,} bytes ({int8_bytes / 1_048_576:.2f} MB)")
    print(f"Size reduction: {size_reduction:.1%}")

    # 4. Parity validation on the held-out test set.
    print("Validating INT8 parity against sklearn pipeline...")
    texts, y_true = load_test_texts(TEST_SET_PATH)

    sklearn_pred = pipeline.predict(texts)
    sklearn_acc = np.mean(sklearn_pred == y_true)

    session = ort.InferenceSession(str(INT8_PATH), providers=["CPUExecutionProvider"])
    int8_pred, _ = run_onnx(session, texts)
    int8_acc = np.mean(int8_pred == y_true)
    accuracy_delta = int8_acc - sklearn_acc

    print(f"Sklearn accuracy: {sklearn_acc:.4f}")
    print(f"INT8 accuracy:    {int8_acc:.4f}")
    print(f"Accuracy delta:   {accuracy_delta:+.4f}")

    # 5. Update eval artifacts with the real INT8 hash.
    update_artifact_hash(RESULTS_PATH, int8_hash)
    update_artifact_hash(CONFUSION_PATH, int8_hash)
    print("Updated eval_results.json and confusion_matrix.json artifact_sha256.")

    # 6. Write quantization report.
    report = f"""# Quantization Report — TicketSec Arm64 Classifier

Generated: {now_utc()}

## Artifacts

| Artifact | Path | SHA-256 | Size |
|---|---|---|---|
| FP32 ONNX | `model/artifact_fp32.onnx` | `{fp32_hash}` | {fp32_bytes / 1_048_576:.2f} MB ({fp32_bytes:,} bytes) |
| INT8 ONNX | `model/artifact.onnx` | `{int8_hash}` | {int8_bytes / 1_048_576:.2f} MB ({int8_bytes:,} bytes) |

## Size reduction

INT8 is **{size_reduction:.1%}** smaller than FP32.

## Accuracy

Measured on the held-out GroupShuffleSplit test set (groups=seed_id):

- Sklearn pipeline accuracy: {sklearn_acc:.4f}
- INT8 ONNX accuracy:        {int8_acc:.4f}
- Delta:                     {accuracy_delta:+.4f}

## Runtime notes

The INT8 artifact uses ONNX Runtime dynamic quantization: weights are INT8,
activations remain FP32.  It is loaded once at startup in the FastAPI serving
layer and runs on the CPUExecutionProvider.

The target deployment is an AWS Graviton `t4g.micro` (ARM64, 1 vCPU, 1 GB RAM).
The systemd unit caps memory at `MemoryMax=700M`, leaving headroom for the OS
and ONNX Runtime workspace.

## Honesty caveat

These numbers are produced from a synthetic, highly-separable dataset.  The
accuracy delta is a technical measurement of quantization fidelity, not a
production performance claim.
"""
    QUANTIZATION_MD.write_text(report, encoding="utf-8")
    print(f"Wrote {QUANTIZATION_MD}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
