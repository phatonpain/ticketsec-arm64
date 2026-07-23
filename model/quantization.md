# Quantization Report — TicketSec Arm64 Classifier

Generated: 2026-07-18T05:24:07.636892+00:00

## Artifacts

| Artifact | Path | SHA-256 | Size |
|---|---|---|---|
| FP32 ONNX | `model/artifact_fp32.onnx` | `701c7dece9ee1ece0580e5185b155dedacb362daf3b5499d5bd1aca550f8d6c1` | 0.38 MB (401,864 bytes) |
| INT8 ONNX | `model/artifact.onnx` | `ed10c4031405e3ab7e8767031a6c38d24d9c2f5075955ab08f1fdd2359a58713` | 0.38 MB (401,872 bytes) |

## Size reduction

INT8 is effectively the **same size** as FP32 (+8 bytes, +0.002%).

## Accuracy

Measured on the held-out GroupShuffleSplit test set (groups=seed_id):

- Sklearn pipeline accuracy: 0.9278
- INT8 ONNX accuracy:        0.9294
- Delta:                     +0.0016

## Runtime notes

The INT8 artifact uses ONNX Runtime dynamic quantization: weights are INT8,
activations remain FP32.  It is loaded once at startup in the FastAPI serving
layer and runs on the CPUExecutionProvider.

The target deployment is an AWS Graviton `t4g.micro` (ARM64, 2 vCPU, 1 GB RAM).
The systemd unit caps memory at `MemoryMax=700M`, leaving headroom for the OS
and ONNX Runtime workspace.

## Honesty caveat

These numbers are produced from a synthetic, highly-separable dataset.  The
accuracy delta is a technical measurement of quantization fidelity, not a
production performance claim.
