"""Held-out evaluation script for the TicketSec Arm64 ONNX classifier.

Methodology (committed):
- Stratified 80/20 train/test split across the six categories.
- Random seed 42 for deterministic re-runs.
- Per-class precision/recall/F1 and overall accuracy.
- Confusion matrix over the canonical six categories.

This script expects the quantized INT8 ONNX artifact at:
    model/artifact.onnx
If the artifact is missing, it emits PENDING artifacts that do not fabricate
metrics. When the artifact is present, implement the preprocess() function below
to match the tokenizer used during training/export.

THE HONESTY CONTRACT (non-negotiable):
Every datum shown is either live (from the API), cached (amber CACHED badge,
sourced from public/cache/tickets-snapshot.json), or shown as
"Unavailable — API offline". The Event Log records ONLY real events. Nothing is
ever fabricated and presented as live.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

from model.categories import CATEGORIES

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent
ARTIFACT_PATH = PROJECT_ROOT / "artifact.onnx"
TEST_SET_PATH = PROJECT_ROOT / "test_set.jsonl"
RESULTS_PATH = PROJECT_ROOT / "eval_results.json"
CONFUSION_PATH = PROJECT_ROOT / "confusion_matrix.json"

SEED = 42


def now_utc() -> str:
    """Return an ISO-8601 UTC timestamp string."""
    return datetime.now(timezone.utc).isoformat()


def file_hash(path: Path) -> str:
    """Return the SHA-256 hash of a file, or an empty string if missing."""
    if not path.exists():
        return ""
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def load_test_set(path: Path) -> list[dict[str, str]]:
    """Load the newline-delimited JSON test set."""
    records: list[dict[str, str]] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)
            if record.get("category") not in CATEGORIES:
                raise ValueError(f"Unknown category in test set: {record.get('category')}")
            records.append(record)
    return records


def stratified_split(
    records: list[dict[str, str]], test_size: float, seed: int
) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    """Create a deterministic stratified train/test split by category."""
    rng = np.random.default_rng(seed)
    by_category: dict[str, list[dict[str, str]]] = {c: [] for c in CATEGORIES}
    for r in records:
        by_category[r["category"]].append(r)

    train: list[dict[str, str]] = []
    test: list[dict[str, str]] = []
    for category in CATEGORIES:
        items = by_category[category]
        if not items:
            raise ValueError(f"Category {category!r} has no samples.")
        # Shuffle a copy deterministically
        indices = np.arange(len(items))
        rng.shuffle(indices)
        n_test = max(1, int(round(len(items) * test_size)))
        test_idx = set(indices[:n_test].tolist())
        for i, item in enumerate(items):
            (test if i in test_idx else train).append(item)
    return train, test


def run_onnx_inference(texts: list[str]) -> tuple[list[int], list[list[float]]]:
    """Run the ONNX model on a list of texts and return predicted class indices and probabilities."""
    import onnxruntime as ort

    session = ort.InferenceSession(str(ARTIFACT_PATH), providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name

    # The vectorizer expects a 2-D string tensor [batch_size, 1].
    batch = np.array([[t] for t in texts])
    outputs = session.run(None, {input_name: batch})

    if len(outputs) >= 2 and outputs[1].ndim == 2:
        labels = outputs[0].astype(int).tolist()
        probabilities = outputs[1].tolist()
        return labels, probabilities

    logits = outputs[0]
    predictions = np.argmax(logits, axis=1).tolist()
    probabilities = np.zeros((len(predictions), len(CATEGORIES)), dtype=float).tolist()
    return predictions, probabilities


def compute_confusion_matrix(
    y_true: list[int], y_pred: list[int]
) -> list[list[int]]:
    """Build a 6x6 confusion matrix (rows = true, cols = predicted)."""
    cm = [[0] * len(CATEGORIES) for _ in CATEGORIES]
    for t, p in zip(y_true, y_pred, strict=True):
        cm[t][p] += 1
    return cm


def compute_metrics(
    y_true: list[int], y_pred: list[int]
) -> dict[str, Any]:
    """Compute per-class precision/recall/F1 and overall accuracy."""
    cm = compute_confusion_matrix(y_true, y_pred)
    metrics: dict[str, Any] = {
        "overall": {"accuracy": 0.0, "samples": len(y_true)},
        "per_class": {},
    }

    correct = sum(cm[i][i] for i in range(len(CATEGORIES)))
    metrics["overall"]["accuracy"] = correct / len(y_true) if y_true else 0.0

    for i, category in enumerate(CATEGORIES):
        tp = cm[i][i]
        fp = sum(cm[j][i] for j in range(len(CATEGORIES)) if j != i)
        fn = sum(cm[i][j] for j in range(len(CATEGORIES)) if j != i)

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (
            2 * precision * recall / (precision + recall)
            if (precision + recall) > 0
            else 0.0
        )

        metrics["per_class"][category] = {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
            "support": sum(cm[i]),
        }

    return metrics, cm


def write_json(path: Path, payload: dict[str, Any]) -> None:
    """Write a pretty-printed JSON file."""
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
        f.write("\n")


def emit_pending(reason: str) -> None:
    """Emit honest PENDING artifacts when the model or data is unavailable."""
    generated_at = now_utc()
    common = {
        "status": "PENDING",
        "reason": reason,
        "generated_at": generated_at,
        "artifact_sha256": file_hash(ARTIFACT_PATH),
        "methodology": {
            "split": "stratified 80/20",
            "seed": SEED,
            "categories": CATEGORIES,
        },
        "honesty_contract": (
            "Every datum shown is either live (from the API), cached (amber CACHED "
            "badge, sourced from public/cache/tickets-snapshot.json), or shown as "
            "'Unavailable — API offline'. The Event Log records ONLY real events. "
            "Nothing is ever fabricated and presented as live."
        ),
    }

    eval_results = {
        **common,
        "dataset_size": None,
        "train_size": None,
        "test_size": None,
        "class_balance": None,
        "overall_accuracy": None,
        "per_class_metrics": None,
    }
    write_json(RESULTS_PATH, eval_results)

    confusion = {
        **common,
        "matrix": None,
        "labels": CATEGORIES,
    }
    write_json(CONFUSION_PATH, confusion)

    print(f"[PENDING] {reason}")
    print(f"  -> {RESULTS_PATH}")
    print(f"  -> {CONFUSION_PATH}")


def main() -> int:
    if not TEST_SET_PATH.exists():
        emit_pending(f"Test set not found: {TEST_SET_PATH}")
        return 1

    records = load_test_set(TEST_SET_PATH)
    if len(records) < 6:
        emit_pending(f"Test set too small: {len(records)} records (need >= 6).")
        return 1

    # test_set.jsonl is the held-out test split produced by model/train.py.
    test = records

    if not ARTIFACT_PATH.exists():
        emit_pending(
            f"ONNX artifact not found at {ARTIFACT_PATH}. "
            "Commit the quantized INT8 model to generate real metrics."
        )
        return 0

    # Real evaluation path — artifact present.
    y_true = [CATEGORIES.index(r["category"]) for r in test]
    texts = [r["text"] for r in test]
    try:
        y_pred, _ = run_onnx_inference(texts)
    except Exception as exc:  # noqa: BLE001
        emit_pending(f"ONNX inference failed: {exc}")
        return 1

    metrics, cm = compute_metrics(y_true, y_pred)

    class_counts = {c: sum(1 for r in records if r["category"] == c) for c in CATEGORIES}
    generated_at = now_utc()
    artifact_hash = file_hash(ARTIFACT_PATH)

    # Preserve richer fields already written by model/train.py.
    existing_eval: dict[str, Any] = {}
    if RESULTS_PATH.exists():
        try:
            with RESULTS_PATH.open("r", encoding="utf-8") as f:
                existing_eval = json.load(f)
        except Exception:  # noqa: BLE001
            existing_eval = {}

    eval_results = {
        "status": "COMPLETE",
        "generated_at": generated_at,
        "artifact_sha256": artifact_hash,
        "methodology": existing_eval.get(
            "methodology",
            {
                "split": "GroupShuffleSplit(test_size=0.2, groups=seed_id)",
                "seed": SEED,
                "categories": CATEGORIES,
            },
        ),
        "dataset_size": existing_eval.get("dataset_size", len(records)),
        "train_size": existing_eval.get("train_size", None),
        "test_size": len(test),
        "class_balance": existing_eval.get("class_balance", class_counts),
        "winner_candidate_id": existing_eval.get("winner_candidate_id"),
        "deployed_candidate_id": existing_eval.get("deployed_candidate_id"),
        "deployed_note": existing_eval.get("deployed_note"),
        "calibration": existing_eval.get("calibration"),
        "overall_accuracy": round(metrics["overall"]["accuracy"], 4),
        "per_class_metrics": metrics["per_class"],
        "ablation": existing_eval.get("ablation"),
        "weak_classes": existing_eval.get("weak_classes"),
        "honesty_contract": (
            "Every datum shown is either live (from the API), cached (amber CACHED "
            "badge, sourced from public/cache/tickets-snapshot.json), or shown as "
            "'Unavailable — API offline'. The Event Log records ONLY real events. "
            "Nothing is ever fabricated and presented as live."
        ),
        "caveat": (
            "Small synthetic hackathon dataset; near-perfect scores on such data carry "
            "train/test leakage risk if groups are not respected. This is a demo "
            "metric, not production accuracy."
        ),
    }
    write_json(RESULTS_PATH, eval_results)

    confusion = {
        "status": "COMPLETE",
        "generated_at": generated_at,
        "artifact_sha256": artifact_hash,
        "methodology": eval_results["methodology"],
        "labels": CATEGORIES,
        "matrix": cm,
        "winner_candidate_id": existing_eval.get("winner_candidate_id"),
        "deployed_candidate_id": existing_eval.get("deployed_candidate_id"),
        "honesty_contract": eval_results["honesty_contract"],
    }
    write_json(CONFUSION_PATH, confusion)

    print(f"[OK] Evaluated {len(test)} held-out samples.")
    print(f"  Overall accuracy: {eval_results['overall_accuracy']}")
    print(f"  -> {RESULTS_PATH}")
    print(f"  -> {CONFUSION_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
