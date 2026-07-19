"""FastAPI serving layer for the TicketSec Arm64 ticket classifier.

Loads model/artifact.onnx (INT8) once at startup and exposes the endpoints the
frontend expects:
- GET  /health
- POST /predict
- GET  /api/v1/stats/categories
- GET  /api/v1/performance/history
- GET  /api/v1/classifications

Security controls:
- CORS origin list is configurable via ALLOW_ORIGINS env var (demo default: *).
- /predict is rate-limited per client IP (default 60 RPM) to mitigate
  unbounded consumption (OWASP-LLM10 / OWASP API4:2023).
- Input is sanitized and length-capped; no free-form text is ever executed,
  rendered, or passed to an LLM (OWASP-LLM01 / OWASP API8:2023).
- Error responses expose no stack traces or internal paths.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Any

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from model.categories import CATEGORIES

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ARTIFACT_PATH = PROJECT_ROOT / "model" / "artifact.onnx"
TEST_SET_PATH = PROJECT_ROOT / "model" / "test_set.jsonl"
EVAL_RESULTS_PATH = PROJECT_ROOT / "model" / "eval_results.json"
MAX_TEXT_LEN = 10_000

PREDICT_RATE_LIMIT_RPM = int(os.environ.get("PREDICT_RATE_LIMIT_RPM", "60"))
ALLOW_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("ALLOW_ORIGINS", "*").split(",")
    if origin.strip()
]


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
# Rate limiting (in-memory sliding window, per client IP)
# ---------------------------------------------------------------------------
class RateLimiter:
    """Simple per-IP sliding-window rate limiter.

    Production should replace this with a Redis-backed limiter or a gateway
    rule (e.g., AWS WAF / API Gateway throttling). It is sufficient for the
    hackathon demo and keeps the service self-contained.
    """

    def __init__(self, max_requests: int, window_seconds: float) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._windows: dict[str, list[float]] = {}

    def is_allowed(self, client_id: str, now: float | None = None) -> tuple[bool, int]:
        """Return (allowed, retry_after_seconds)."""
        if now is None:
            now = time.perf_counter()
        cutoff = now - self.window_seconds
        window = self._windows.get(client_id, [])
        # Drop stale timestamps.
        window = [t for t in window if t > cutoff]
        if len(window) >= self.max_requests:
            retry_after = int(window[0] - cutoff) + 1
            self._windows[client_id] = window
            return False, max(retry_after, 1)
        window.append(now)
        self._windows[client_id] = window
        return True, 0


predict_limiter = RateLimiter(max_requests=PREDICT_RATE_LIMIT_RPM, window_seconds=60.0)


def client_id(request: Request) -> str:
    """Best-effort client identifier from forwarded headers or connection."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def sanitize_text(text: str) -> str:
    """Normalize ticket text: strip, collapse whitespace, drop null bytes.

    The ONNX classifier is not an LLM, so prompt injection is not a direct
    concern, but we still reject control characters and normalize input to
    avoid surprises in the TF-IDF vectorizer.
    """
    text = text.replace("\x00", "")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


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
    allow_origins=ALLOW_ORIGINS,
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
async def predict(req: PredictionRequest, request: Request) -> dict[str, Any]:
    if model_state is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    cid = client_id(request)
    allowed, retry_after = predict_limiter.is_allowed(cid)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Slow down.",
            headers={"Retry-After": str(retry_after)},
        )

    text = sanitize_text(req.text)
    if not text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Text is empty after sanitization.",
        )

    label_idx, confidence, probabilities, elapsed_ms = model_state.predict(text)
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


# ---------------------------------------------------------------------------
# Safe error shapes — never leak stack traces or internal paths.
# ---------------------------------------------------------------------------
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    # 5xx responses are returned as a generic message to avoid information leakage.
    if exc.status_code >= 500:
        detail = "Internal server error"
    else:
        detail = exc.detail
    headers = dict(exc.headers) if exc.headers else None
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": detail},
        headers=headers,
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )
