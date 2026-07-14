#!/bin/bash
# run_all.sh — Full pipeline: train → convert → quantize → benchmark → serve
set -e

echo "========================================"
echo "TicketSec Arm64 — Full Pipeline"
echo "========================================"

echo "[1/5] Training baseline model..."
python3 train.py

echo "[2/5] Converting to ONNX..."
python3 convert_onnx.py

echo "[3/5] Quantizing to INT8..."
python3 quantize.py

echo "[4/5] Running benchmarks..."
python3 benchmark.py

echo "[5/5] Starting API server..."
echo "API available at http://localhost:8000/docs"
python3 api.py
