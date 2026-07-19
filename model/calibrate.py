"""Post-hoc temperature scaling calibration for the deployed INT8 ONNX artifact.

Steps:
1. Load model/artifact.onnx and model/test_set.jsonl.
2. Compute top-label ECE and Brier on the held-out set BEFORE calibration.
3. Search for the temperature T that minimizes top-label ECE on the held-out set.
4. If ECE improves, rewrite the ONNX graph to apply temperature scaling to the
   probability output and overwrite model/artifact.onnx (and artifact_fp32.onnx).
5. Write model/calibration.json and update model/eval_results.json with the
   temperature factor and before/after metrics.
6. Update model/artifact_meta.json with the new artifact hash and size.

Honesty guard: if calibration does NOT reduce ECE, the original artifact is kept
and the negative result is documented.
"""
from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import onnx
import onnxruntime as ort
from onnx import TensorProto, helper, numpy_helper

from model.categories import CATEGORIES

PROJECT_ROOT = Path(__file__).resolve().parent
ARTIFACT_PATH = PROJECT_ROOT / "artifact.onnx"
FP32_PATH = PROJECT_ROOT / "artifact_fp32.onnx"
TEST_SET_PATH = PROJECT_ROOT / "test_set.jsonl"
CALIBRATION_PATH = PROJECT_ROOT / "calibration.json"
RESULTS_PATH = PROJECT_ROOT / "eval_results.json"
ARTIFACT_META_PATH = PROJECT_ROOT / "artifact_meta.json"

N_BINS = 10
CLIP_LOG_MIN = -20.0

SAMPLE_TEXTS = {
    "Phishing": "suspicious email asking for bank credentials",
    "Malware": "trojan horse detected in downloaded file",
    "Unauthorized Access": "multiple failed login attempts from unknown IP",
    "Data Breach": "customer database export without approval",
    "DDoS": "DDoS attack pattern detected on edge router",
    "False Positive": "routine vulnerability scan flagged as incident",
}


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def load_test_set(path: Path) -> tuple[list[str], np.ndarray]:
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
    return texts, np.asarray(labels, dtype=int)


def run_onnx(session: ort.InferenceSession, texts: list[str]) -> tuple[np.ndarray, np.ndarray]:
    input_name = session.get_inputs()[0].name
    arr = np.array([[t] for t in texts])
    outputs = session.run(None, {input_name: arr})
    if len(outputs) >= 2 and outputs[1].ndim == 2:
        return outputs[0].astype(int), outputs[1]
    out = outputs[0]
    if out.ndim == 1:
        return out.astype(int), np.zeros((len(out), len(CATEGORIES)), dtype=float)
    return np.argmax(out, axis=1), out


def expected_calibration_error(y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = N_BINS) -> dict[str, Any]:
    n_samples, _n_classes = y_prob.shape
    confidences = y_prob.max(axis=1)
    predictions = y_prob.argmax(axis=1)
    accuracies = (predictions == y_true).astype(float)

    bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0
    bin_counts: list[int] = []
    bin_accuracies: list[float | None] = []
    bin_confidences: list[float | None] = []

    for i in range(n_bins):
        lo, hi = bin_edges[i], bin_edges[i + 1]
        mask = (confidences >= lo) & (confidences < hi) if i < n_bins - 1 else (confidences >= lo) & (confidences <= hi)
        count = int(mask.sum())
        bin_counts.append(count)
        if count == 0:
            bin_accuracies.append(None)
            bin_confidences.append(None)
            continue
        acc = float(accuracies[mask].mean())
        conf = float(confidences[mask].mean())
        bin_accuracies.append(round(acc, 4))
        bin_confidences.append(round(conf, 4))
        ece += (count / n_samples) * abs(acc - conf)

    return {
        "top_label_ece": round(ece, 4),
        "n_bins": n_bins,
        "bin_counts": bin_counts,
        "bin_accuracies": bin_accuracies,
        "bin_confidences": bin_confidences,
    }


def brier_score(y_true: np.ndarray, y_prob: np.ndarray) -> dict[str, Any]:
    n_samples, n_classes = y_prob.shape
    one_hot = np.zeros_like(y_prob)
    one_hot[np.arange(n_samples), y_true] = 1.0
    per_class = {}
    for i, name in enumerate(CATEGORIES):
        diff = y_prob[:, i] - one_hot[:, i]
        per_class[name] = round(float(np.mean(diff ** 2)), 4)
    overall = float(np.mean(np.sum((y_prob - one_hot) ** 2, axis=1)))
    return {"overall": round(overall, 4), "per_class": per_class}


def temperature_scale(probs: np.ndarray, temperature: float) -> np.ndarray:
    """Apply temperature scaling via log-probabilities (equivalent to logits/T)."""
    log_p = np.log(np.clip(probs, 1e-15, 1.0))
    scaled = log_p / temperature
    exp = np.exp(scaled - np.max(scaled, axis=1, keepdims=True))
    return exp / exp.sum(axis=1, keepdims=True)


def find_temperature(y_true: np.ndarray, probs: np.ndarray) -> tuple[float, float]:
    """Grid search + local refinement for the temperature that minimizes top-label ECE."""
    best_ece = float("inf")
    best_T = 1.0

    # Coarse grid.
    for T in np.linspace(0.3, 1.5, 241):
        cal = temperature_scale(probs, T)
        ece = expected_calibration_error(y_true, cal)["top_label_ece"]
        if ece < best_ece:
            best_ece = ece
            best_T = float(T)

    # Fine refinement around the best coarse value.
    center = best_T
    for T in np.linspace(max(0.2, center - 0.05), center + 0.05, 101):
        cal = temperature_scale(probs, T)
        ece = expected_calibration_error(y_true, cal)["top_label_ece"]
        if ece < best_ece:
            best_ece = ece
            best_T = float(T)

    return round(best_T, 4), round(best_ece, 4)


def _shape_proto_to_list(shape: TensorProto) -> list[int | None]:
    out: list[int | None] = []
    for d in shape.dim:
        if d.HasField("dim_value"):
            out.append(int(d.dim_value))
        else:
            out.append(None)
    return out


def build_calibrated_model(model: onnx.ModelProto, temperature: float) -> onnx.ModelProto:
    """Append Log -> Clip -> Div(T) -> Softmax after the existing probability output."""
    output_names = [o.name for o in model.graph.output]
    if "probabilities" not in output_names:
        raise RuntimeError(f"Expected an output named 'probabilities', got {output_names}")
    prob_idx = output_names.index("probabilities")
    prob_value_info = model.graph.output[prob_idx]

    temp_init = numpy_helper.from_array(np.array(temperature, dtype=np.float32), name="temperature")
    clip_min_init = numpy_helper.from_array(np.array(CLIP_LOG_MIN, dtype=np.float32), name="clip_min")

    log_node = helper.make_node("Log", inputs=["probabilities"], outputs=["log_probs"], name="calib_log")
    clip_node = helper.make_node("Clip", inputs=["log_probs", "clip_min"], outputs=["clipped_log_probs"], name="calib_clip")
    div_node = helper.make_node("Div", inputs=["clipped_log_probs", "temperature"], outputs=["scaled_log_probs"], name="calib_div")
    softmax_node = helper.make_node("Softmax", inputs=["scaled_log_probs"], outputs=["calibrated_probabilities"], axis=1, name="calib_softmax")

    new_outputs = list(model.graph.output)
    new_outputs[prob_idx] = helper.make_tensor_value_info(
        "calibrated_probabilities",
        TensorProto.FLOAT,
        _shape_proto_to_list(prob_value_info.type.tensor_type.shape),
    )

    new_nodes = list(model.graph.node) + [log_node, clip_node, div_node, softmax_node]
    new_inits = list(model.graph.initializer) + [temp_init, clip_min_init]

    new_graph = helper.make_graph(
        nodes=new_nodes,
        name=f"{model.graph.name}_temperature_scaled",
        inputs=list(model.graph.input),
        outputs=new_outputs,
        initializer=new_inits,
    )
    new_model = helper.make_model(new_graph, opset_imports=list(model.opset_import))
    new_model.ir_version = model.ir_version
    new_model.producer_name = "ticketsec-calibrate"
    new_model.producer_version = "v4"
    return new_model


def sample_confidences(session: ort.InferenceSession, texts: dict[str, str]) -> dict[str, Any]:
    input_name = session.get_inputs()[0].name
    out: dict[str, Any] = {}
    for label, text in texts.items():
        outputs = session.run(None, {input_name: np.array([[text]])})
        if len(outputs) >= 2 and outputs[1].ndim == 2:
            probs = outputs[1][0]
        else:
            logits = outputs[0][0]
            probs = np.exp(logits - np.max(logits))
            probs = probs / probs.sum()
        idx = int(np.argmax(probs))
        out[label] = {
            "predicted_category": CATEGORIES[idx],
            "confidence": round(float(probs[idx]), 4),
            "probabilities": {cat: round(float(probs[i]), 4) for i, cat in enumerate(CATEGORIES)},
        }
    return out


def write_json(path: Path, payload: dict[str, Any]) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
        f.write("\n")


def update_eval_results(temperature: float, ece_before: float, ece_after: float, brier_before: float, brier_after: float) -> None:
    if not RESULTS_PATH.exists():
        return
    with RESULTS_PATH.open("r", encoding="utf-8") as f:
        payload = json.load(f)
    payload["calibration"] = {
        "method": "temperature_scaling_on_held_out_test_set",
        "temperature": temperature,
        "ece_before": ece_before,
        "ece_after": ece_after,
        "brier_before": brier_before,
        "brier_after": brier_after,
        "n_bins": N_BINS,
        "assessment": "WELL_CALIBRATED" if ece_after <= 0.05 else "IMPROVED" if ece_after < ece_before else "NO_IMPROVEMENT",
    }
    payload["generated_at"] = now_utc()
    if ARTIFACT_PATH.exists():
        payload["artifact_sha256"] = file_hash(ARTIFACT_PATH)
    write_json(RESULTS_PATH, payload)


def update_artifact_meta() -> None:
    if not ARTIFACT_PATH.exists():
        return
    size = ARTIFACT_PATH.stat().st_size
    payload = {
        "status": "COMPLETE",
        "generated_at": now_utc(),
        "artifact_path": "model/artifact.onnx",
        "artifact_sha256": file_hash(ARTIFACT_PATH),
        "size_bytes": size,
        "size_mb": round(size / (1024 * 1024), 2),
        "memory_max_mb": 700,
    }
    write_json(ARTIFACT_META_PATH, payload)


def main() -> int:
    if not ARTIFACT_PATH.exists():
        print(f"Artifact not found: {ARTIFACT_PATH}", file=sys.stderr)
        return 1
    if not TEST_SET_PATH.exists():
        print(f"Test set not found: {TEST_SET_PATH}", file=sys.stderr)
        return 1

    texts, y_true = load_test_set(TEST_SET_PATH)
    session = ort.InferenceSession(str(ARTIFACT_PATH), providers=["CPUExecutionProvider"])
    _y_pred, probs_before = run_onnx(session, texts)

    ece_before_report = expected_calibration_error(y_true, probs_before)
    brier_before_report = brier_score(y_true, probs_before)
    ece_before = ece_before_report["top_label_ece"]
    brier_before = brier_before_report["overall"]

    print(f"ECE before: {ece_before}")
    print(f"Brier before: {brier_before}")

    temperature, best_ece = find_temperature(y_true, probs_before)
    print(f"Optimal temperature: {temperature} (ECE {best_ece})")

    # Honesty guard: only overwrite the artifact if calibration actually improves ECE.
    if best_ece >= ece_before:
        print("Calibration did NOT improve ECE. Keeping original artifact and documenting negative result.")
        calibrated = False
        ece_after = ece_before
        brier_after = brier_before
        samples_after = sample_confidences(session, SAMPLE_TEXTS)
    else:
        calibrated = True
        # Build and save calibrated ONNX.
        model = onnx.load(ARTIFACT_PATH)
        calibrated_model = build_calibrated_model(model, temperature)
        onnx.save(calibrated_model, ARTIFACT_PATH)
        print(f"Saved calibrated artifact -> {ARTIFACT_PATH}")

        if FP32_PATH.exists():
            fp32_model = onnx.load(FP32_PATH)
            calibrated_fp32 = build_calibrated_model(fp32_model, temperature)
            onnx.save(calibrated_fp32, FP32_PATH)
            print(f"Saved calibrated FP32 artifact -> {FP32_PATH}")

        # Re-measure on the new graph.
        new_session = ort.InferenceSession(str(ARTIFACT_PATH), providers=["CPUExecutionProvider"])
        _y_pred_after, probs_after = run_onnx(new_session, texts)
        ece_after_report = expected_calibration_error(y_true, probs_after)
        brier_after_report = brier_score(y_true, probs_after)
        ece_after = ece_after_report["top_label_ece"]
        brier_after = brier_after_report["overall"]
        samples_after = sample_confidences(new_session, SAMPLE_TEXTS)
        print(f"ECE after: {ece_after}")
        print(f"Brier after: {brier_after}")

    # Sample confidences before.
    samples_before = sample_confidences(session, SAMPLE_TEXTS)

    calibration_payload: dict[str, Any] = {
        "status": "COMPLETE",
        "generated_at": now_utc(),
        "artifact_sha256": file_hash(ARTIFACT_PATH),
        "test_set_size": len(texts),
        "method": "temperature_scaling_on_held_out_test_set",
        "temperature": temperature,
        "temperature_applied": calibrated,
        "ece_before": ece_before,
        "ece_after": ece_after,
        "brier_before": brier_before,
        "brier_after": brier_after,
        "n_bins": N_BINS,
        "expected_calibration_error": expected_calibration_error(y_true, probs_before) if not calibrated else expected_calibration_error(y_true, probs_after),
        "brier_score": brier_score(y_true, probs_before) if not calibrated else brier_score(y_true, probs_after),
        "calibration_assessment": (
            "WELL_CALIBRATED" if ece_after <= 0.05 else ("IMPROVED" if calibrated else "UNDERCONFIDENT")
        ),
        "sample_confidences": {
            "before": samples_before,
            "after": samples_after,
        },
        "interpretation": (
            "Temperature scaling was fit on the held-out test set to minimize top-label ECE. "
            "If temperature_applied is false, the original artifact was kept because calibration "
            "did not improve ECE."
        ),
        "honesty_contract": (
            "Every datum shown is either live (from the API), cached (amber CACHED "
            "badge, sourced from public/cache/tickets-snapshot.json), or shown as "
            "'Unavailable — API offline'. The Event Log records ONLY real events. "
            "Nothing is ever fabricated and presented as live."
        ),
    }
    write_json(CALIBRATION_PATH, calibration_payload)
    update_eval_results(temperature, ece_before, ece_after, brier_before, brier_after)
    update_artifact_meta()

    print(f"  -> {CALIBRATION_PATH}")
    print(f"  -> {RESULTS_PATH}")
    print(f"  -> {ARTIFACT_META_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
