"""FastAPI serving layer for the TicketSec Arm64 ticket classifier.

Loads model/artifact.onnx (INT8) once at startup and exposes the endpoints the
frontend expects:
- GET  /health
- POST /predict
- GET  /api/v1/stats/categories
- GET  /api/v1/performance/history
- GET  /api/v1/classifications
"""
from __future__ import annotations

import hashlib
import json
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from model.categories import CATEGORIES

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ARTIFACT_PATH = PROJECT_ROOT / "model" / "artifact.onnx"
TEST_SET_PATH = PROJECT_ROOT / "model" / "test_set.jsonl"
EVAL_RESULTS_PATH = PROJECT_ROOT / "model" / "eval_results.json"
MAX_TEXT_LEN = 10_000


def file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def load_test_set(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    if not path.exists():
        return records
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            records.append(json.loads(line))
    return records


def category_counts(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counts: dict[str, int] = {c: 0 for c in CATEGORIES}
    for r in records:
        cat = r.get("category")
        if cat in counts:
            counts[cat] += 1
    return [{"category": c, "count": n} for c, n in counts.items()]


class PredictionRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=MAX_TEXT_LEN)


class PredictionResponse(BaseModel):
    predicted_category: str
    confidence: float
    processing_time_ms: float
    probabilities: dict[str, float]


# ---------------------------------------------------------------------------
# Shared inference function (used by the probe suite and the API)
# ---------------------------------------------------------------------------
class ModelState:
    def __init__(self, artifact_path: Path):
        if not artifact_path.exists():
            raise RuntimeError(f"ONNX artifact not found: {artifact_path}")
        self.session = ort.InferenceSession(
            str(artifact_path), providers=["CPUExecutionProvider"]
        )
        self.input_name = self.session.get_inputs()[0].name
        self.artifact_sha256 = file_hash(artifact_path)
        self.test_records = load_test_set(TEST_SET_PATH)

    def predict(self, text: str) -> tuple[int, float, dict[str, float], float]:
        """Return (label_index, confidence, probabilities, processing_time_ms)."""
        batch = np.array([[text]])
        start = time.perf_counter()
        outputs = self.session.run(None, {self.input_name: batch})
        elapsed_ms = (time.perf_counter() - start) * 1000

        if len(outputs) >= 2 and outputs[1].ndim == 2:
            label_idx = int(outputs[0][0])
            probs = outputs[1][0]
        else:
            logits = outputs[0][0]
            label_idx = int(np.argmax(logits))
            probs = logits

        probs = np.asarray(probs, dtype=float)
        probs = np.clip(probs, 0.0, 1.0)
        # Normalize to sum to 1 in case quantization shifted values slightly.
        total = probs.sum()
        if total > 0:
            probs = probs / total
        confidence = float(probs[label_idx])
        probabilities = {cat: float(probs[i]) for i, cat in enumerate(CATEGORIES)}
        return label_idx, confidence, probabilities, elapsed_ms


model_state: ModelState | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model_state
    model_state = ModelState(ARTIFACT_PATH)
    yield
    model_state = None


app = FastAPI(title="TicketSec Arm64 Classifier", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
async def root() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/predict", response_model=PredictionResponse)
async def predict(req: PredictionRequest) -> dict[str, Any]:
    if model_state is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    label_idx, confidence, probabilities, elapsed_ms = model_state.predict(req.text)
    return {
        "predicted_category": CATEGORIES[label_idx],
        "confidence": round(confidence, 6),
        "processing_time_ms": round(elapsed_ms, 4),
        "probabilities": probabilities,
    }


@app.get("/api/v1/stats/categories")
async def stats_categories() -> list[dict[str, Any]]:
    if model_state is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return category_counts(model_state.test_records)


@app.get("/api/v1/performance/history")
async def performance_history() -> list[dict[str, Any]]:
    if model_state is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    # No live performance history available yet; empty array triggers the UI empty state.
    return []


@app.get("/api/v1/classifications")
async def classifications() -> list[dict[str, Any]]:
    if model_state is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    rng = np.random.default_rng(42)
    statuses = ["Resolved", "Escalated", "Pending"]
    owners = ["Auto", "Security Team", "SOC L1", "SOC L2"]

    results: list[dict[str, Any]] = []
    base_time = datetime.now(timezone.utc)
    for i, r in enumerate(model_state.test_records):
        text = r["text"]
        # Use the first sentence as a synthetic subject.
        subject = text.split(".")[0].strip()
        if len(subject) > 120:
            subject = subject[:117] + "..."
        created_at = base_time.isoformat()
        results.append(
            {
                "id": f"TKT-{8501 + i}",
                "subject": subject,
                "category": r["category"],
                "confidence": round(
                    0.75 + 0.24 * rng.random(), 4
                ),  # placeholder; real API would store live scores
                "status": rng.choice(statuses),
                "assignedTo": rng.choice(owners),
                "createdAt": created_at,
            }
        )
    return results


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> dict[str, Any]:
    # Keep the default FastAPI detail shape; this handler just ensures CORS.
    return {"detail": exc.detail}
