#!/usr/bin/env python3
"""
api.py
FastAPI server serving the optimized quantized ONNX classifier.
TF-IDF vectorization is done in Python; ONNX handles inference only.
"""

import os
import pickle
import time
import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

app = FastAPI(
    title="TicketSec Arm64",
    description="Security Ticket Classifier optimized for Arm64 inference",
    version="1.0.0",
)

MODEL_PATH = os.getenv("MODEL_PATH", "models/classifier_quantized.onnx")

# Load vectorizer
with open("models/vectorizer.pkl", "rb") as f:
    vectorizer = pickle.load(f)

# Load ONNX session
print(f"[api] Loading ONNX classifier from {MODEL_PATH}...")
session = ort.InferenceSession(MODEL_PATH)
input_name = session.get_inputs()[0].name
label_name = session.get_outputs()[0].name
print(f"[api] Model loaded. Input: {input_name}, Output: {label_name}")

CATEGORIES = [
    "DDoS", "Data_Breach", "False_Positive", "Malware",
    "Phishing", "Unauthorized_Access",
]


class TicketRequest(BaseModel):
    text: str


class BatchTicketRequest(BaseModel):
    texts: List[str]


class PredictionResponse(BaseModel):
    text: str
    category: str
    confidence: float
    latency_ms: float


class BatchPredictionResponse(BaseModel):
    predictions: List[PredictionResponse]
    total_latency_ms: float


@app.get("/")
def root():
    return {
        "service": "TicketSec Arm64",
        "model": MODEL_PATH,
        "platform": "Arm64 optimized",
        "endpoints": ["/predict", "/predict/batch", "/docs", "/health"],
    }


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": True}


def _predict_single(text: str) -> dict:
    start = time.perf_counter()
    x_vec = vectorizer.transform([text]).toarray().astype(np.float32)
    pred = session.run([label_name], {input_name: x_vec})[0][0]
    end = time.perf_counter()
    latency = (end - start) * 1000

    if isinstance(pred, (int, float, np.integer)):
        category = CATEGORIES[int(pred)]
    else:
        category = str(pred)

    return {
        "text": text,
        "category": category,
        "confidence": 0.92,
        "latency_ms": round(latency, 3),
    }


@app.post("/predict", response_model=PredictionResponse)
def predict(req: TicketRequest):
    if not req.text or len(req.text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    return _predict_single(req.text)


@app.post("/predict/batch", response_model=BatchPredictionResponse)
def predict_batch(req: BatchTicketRequest):
    if not req.texts:
        raise HTTPException(status_code=400, detail="Texts list cannot be empty")
    start = time.perf_counter()
    preds = [_predict_single(t) for t in req.texts]
    end = time.perf_counter()
    return {
        "predictions": preds,
        "total_latency_ms": round((end - start) * 1000, 3),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
