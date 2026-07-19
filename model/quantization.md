# Quantization Report — TicketSec Arm64 Classifier

Generated: 2026-07-18T05:24:07.636892+00:00

## Artifacts

| Artifact | Path | SHA-256 | Size |
|---|---|---|---|
| FP32 ONNX | `model/artifact_fp32.onnx` | `00d3daa4f79a5c2ff2f39c45fde75558c9675a4c48cf366787c0d3ef1893628d` | 0.38 MB (401,542 bytes) |
| INT8 ONNX | `model/artifact.onnx` | `9c8da3f9866e58bdec2f6b66ce9ea00d8bdacab95a0bf3b32d00c30f143d716b` | 0.38 MB (401,770 bytes) |

## Size reduction

INT8 is **-0.1%** smaller than FP32.

## Accuracy

Measured on the held-out GroupShuffleSplit test set (groups=seed_id):

- Sklearn pipeline accuracy: 0.9278
- INT8 ONNX accuracy:        0.9294
- Delta:                     +0.0016

## Runtime notes

The INT8 artifact uses ONNX Runtime dynamic quantization: weights are INT8,
activations remain FP32.  It is loaded once at startup in the FastAPI serving
layer and runs on the CPUExecutionProvider.

The target deployment is an AWS Graviton `t4g.micro` (ARM64, 1 vCPU, 1 GB RAM).
The systemd unit caps memory at `MemoryMax=700M`, leaving headroom for the OS
and ONNX Runtime workspace.

## Honesty caveat

These numbers are produced from a synthetic, highly-separable dataset.  The
accuracy delta is a technical measurement of quantization fidelity, not a
production performance claim.
