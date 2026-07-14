#!/usr/bin/env python3
"""
quantize.py
Apply dynamic quantization to the ONNX classifier.
Generates: models/classifier_quantized.onnx
"""

import os
from onnxruntime.quantization import quantize_dynamic, QuantType


def main():
    print("[quantize] Loading ONNX classifier...")
    model_path = "models/classifier.onnx"
    quantized_path = "models/classifier_quantized.onnx"

    print("[quantize] Applying dynamic INT8 quantization...")
    quantize_dynamic(
        model_input=model_path,
        model_output=quantized_path,
        weight_type=QuantType.QInt8,
    )

    base_size = os.path.getsize(model_path) / (1024 * 1024)
    q_size = os.path.getsize(quantized_path) / (1024 * 1024)
    print(f"[quantize] Baseline size: {base_size:.2f} MB")
    print(f"[quantize] Quantized size: {q_size:.2f} MB")
    print(f"[quantize] Reduction: {(1 - q_size/base_size)*100:.1f}%")
    print(f"[quantize] Saved: {quantized_path}")
    print("[quantize] Done.")


if __name__ == "__main__":
    main()
