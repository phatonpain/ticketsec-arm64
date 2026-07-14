#!/usr/bin/env python3
"""
convert_onnx.py
Convert trained RandomForest classifier to ONNX (input = TF-IDF vectors).
Generates: models/classifier.onnx
"""

import pickle
import numpy as np
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType


def main():
    print("[convert] Loading baseline model and vectorizer...")
    with open("models/baseline_model.pkl", "rb") as f:
        clf = pickle.load(f)
    with open("models/vectorizer.pkl", "rb") as f:
        vectorizer = pickle.load(f)

    n_features = len(vectorizer.get_feature_names_out())
    print(f"[convert] TF-IDF features: {n_features}")

    initial_type = [("input", FloatTensorType([None, n_features]))]

    print("[convert] Converting classifier to ONNX...")
    onnx_model = convert_sklearn(clf, initial_types=initial_type, target_opset=17)

    with open("models/classifier.onnx", "wb") as f:
        f.write(onnx_model.SerializeToString())

    print("[convert] Saved: models/classifier.onnx")
    print("[convert] Done. Vectorization stays in Python (TF-IDF), inference in ONNX.")


if __name__ == "__main__":
    main()
