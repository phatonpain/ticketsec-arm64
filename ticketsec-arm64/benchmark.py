#!/usr/bin/env python3
"""
benchmark.py
Compare baseline (pickle + sklearn) vs ONNX classifier vs Quantized ONNX classifier.
TF-IDF vectorization is done in Python for all variants (fair comparison).
"""

import os
import json
import time
import pickle
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.metrics import accuracy_score
import onnxruntime as ort

os.makedirs("results", exist_ok=True)

# Load test data
print("[benchmark] Loading test data...")
df = pd.read_csv("data/tickets.csv")
np.random.seed(42)
mask = np.random.rand(len(df)) < 0.8
test_df = df[~mask]
X_test_raw = test_df["text"].values.tolist()
y_test = test_df["category"].values.tolist()

CATEGORIES = sorted(df["category"].unique().tolist())

# Load vectorizer once
with open("models/vectorizer.pkl", "rb") as f:
    vectorizer = pickle.load(f)
X_test_vec = vectorizer.transform(X_test_raw).astype(np.float32)


def benchmark_sklearn(X_vec, y, n_warmup=50):
    with open("models/baseline_model.pkl", "rb") as f:
        clf = pickle.load(f)

    # Warmup
    for _ in range(n_warmup):
        clf.predict(X_vec[:10])

    latencies = []
    for i in range(min(500, X_vec.shape[0])):
        x = X_vec[i:i+1]
        start = time.perf_counter()
        pred = clf.predict(x)[0]
        end = time.perf_counter()
        latencies.append((end - start) * 1000)

    preds = clf.predict(X_vec)
    acc = accuracy_score(y, preds)
    return {
        "framework": "scikit-learn",
        "model": "baseline_model.pkl",
        "accuracy": float(acc),
        "avg_latency_ms": float(np.mean(latencies)),
        "p95_latency_ms": float(np.percentile(latencies, 95)),
        "throughput_rps": float(1000.0 / np.mean(latencies)),
        "model_size_mb": os.path.getsize("models/baseline_model.pkl") / (1024 * 1024),
    }


def benchmark_onnx(model_path, name, X_vec, y, n_warmup=50):
    session = ort.InferenceSession(model_path)
    input_name = session.get_inputs()[0].name
    label_name = session.get_outputs()[0].name

    # Warmup
    for _ in range(n_warmup):
        session.run([label_name], {input_name: X_vec[:10].toarray().astype(np.float32)})

    latencies = []
    for i in range(min(500, X_vec.shape[0])):
        x = X_vec[i:i+1].toarray().astype(np.float32)
        start = time.perf_counter()
        pred = session.run([label_name], {input_name: x})[0][0]
        end = time.perf_counter()
        latencies.append((end - start) * 1000)

    # Batch prediction for accuracy
    batch_preds = session.run([label_name], {input_name: X_vec.toarray().astype(np.float32)})[0]
    if isinstance(batch_preds[0], (int, np.integer)):
        batch_preds = [CATEGORIES[p] for p in batch_preds]
    else:
        batch_preds = [str(p) for p in batch_preds]

    acc = accuracy_score(y, batch_preds)
    return {
        "framework": name,
        "model": model_path,
        "accuracy": float(acc),
        "avg_latency_ms": float(np.mean(latencies)),
        "p95_latency_ms": float(np.percentile(latencies, 95)),
        "throughput_rps": float(1000.0 / np.mean(latencies)),
        "model_size_mb": os.path.getsize(model_path) / (1024 * 1024),
    }


def plot_results(results):
    frameworks = [r["framework"] for r in results]
    sizes = [r["model_size_mb"] for r in results]
    latencies = [r["avg_latency_ms"] for r in results]
    throughputs = [r["throughput_rps"] for r in results]

    fig, axes = plt.subplots(1, 3, figsize=(14, 5))
    colors = ["#e74c3c", "#3498db", "#27ae60"]

    axes[0].bar(frameworks, sizes, color=colors)
    axes[0].set_ylabel("Size (MB)")
    axes[0].set_title("Model Size")
    for i, v in enumerate(sizes):
        axes[0].text(i, v + max(sizes)*0.02, f"{v:.2f} MB", ha="center", fontweight="bold")

    axes[1].bar(frameworks, latencies, color=colors)
    axes[1].set_ylabel("Latency (ms)")
    axes[1].set_title("Avg Inference Latency")
    for i, v in enumerate(latencies):
        axes[1].text(i, v + max(latencies)*0.02, f"{v:.2f} ms", ha="center", fontweight="bold")

    axes[2].bar(frameworks, throughputs, color=colors)
    axes[2].set_ylabel("Requests / sec")
    axes[2].set_title("Throughput")
    for i, v in enumerate(throughputs):
        axes[2].text(i, v + max(throughputs)*0.02, f"{v:.1f} req/s", ha="center", fontweight="bold")

    for ax in axes:
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)

    plt.suptitle("TicketSec Arm64 — Benchmark Results", fontsize=14, fontweight="bold")
    plt.tight_layout()
    plt.savefig("results/benchmark_chart.png", dpi=150, bbox_inches="tight")
    print("[benchmark] Saved: results/benchmark_chart.png")


def main():
    print("[benchmark] Running benchmarks...")
    results = []

    print("[benchmark] 1/3 — Baseline (scikit-learn)...")
    results.append(benchmark_sklearn(X_test_vec, y_test))

    print("[benchmark] 2/3 — ONNX classifier...")
    results.append(benchmark_onnx("models/classifier.onnx", "ONNX", X_test_vec, y_test))

    print("[benchmark] 3/3 — ONNX quantized (INT8)...")
    results.append(benchmark_onnx("models/classifier_quantized.onnx", "ONNX INT8", X_test_vec, y_test))

    with open("results/benchmark_results.json", "w") as f:
        json.dump(results, f, indent=2)

    print("[benchmark] Saved: results/benchmark_results.json")
    print("[benchmark] Results:")
    for r in results:
        print(f"  {r['framework']:15s} | Size: {r['model_size_mb']:6.2f} MB | "
              f"Latency: {r['avg_latency_ms']:6.2f} ms | Throughput: {r['throughput_rps']:6.2f} req/s | "
              f"Accuracy: {r['accuracy']:.4f}")

    plot_results(results)
    print("[benchmark] Done.")


if __name__ == "__main__":
    main()
