"""Measure latency of the live /predict endpoint.

Measures p50/p95 server-side inference time from >=100 sequential canonical POST
requests. Supports both local dev runs and the AWS Graviton t4g.micro target.

Examples:
  python -m model.measure_latency
  TICKETSEC_API_URL=http://3.23.60.61:8000/predict python -m model.measure_latency \
      --output model/latency_t4g_micro.json --host "AWS Graviton t4g.micro"

THE HONESTY CONTRACT (non-negotiable):
Every datum shown is either live (from the API), cached (amber CACHED badge,
sourced from public/cache/tickets-snapshot.json), or shown as
"Unavailable — API offline". The Event Log records ONLY real events. Nothing is
ever fabricated and presented as live.
"""
from __future__ import annotations

import argparse
import json
import os
import statistics
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import urllib.error
import urllib.request

DEFAULT_ENDPOINT = "http://127.0.0.1:8000/predict"
DEFAULT_HEALTH = "http://127.0.0.1:8000/health"

ENDPOINT = os.environ.get("TICKETSEC_API_URL", DEFAULT_ENDPOINT)
HEALTH_ENDPOINT = ENDPOINT.replace("/predict", "/health")
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "latency_local.json"

SAMPLE_TEXTS = {
    "Phishing": "User clicked a link in a fake HR email and entered credentials.",
    "Malware": "Endpoint alert: executable contacted a known C2 domain.",
    "Unauthorized Access": "Successful login from an unrecognized device at 03:00 UTC.",
    "Data Breach": "Database table with customer PII exported to external storage.",
    "DDoS": "SYN flood from a botnet saturated the web tier.",
    "False Positive": "Alert triggered by an approved internal vulnerability scan.",
}


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def predict(text: str) -> dict[str, Any] | None:
    payload = json.dumps({"text": text}).encode("utf-8")
    req = urllib.request.Request(
        ENDPOINT,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:  # noqa: BLE001
        return None


def wait_for_health(timeout_s: float = 120.0) -> float | None:
    """Return seconds until /health returns 200; None on timeout."""
    start = time.perf_counter()
    while time.perf_counter() - start < timeout_s:
        try:
            with urllib.request.urlopen(HEALTH_ENDPOINT, timeout=5) as resp:
                if resp.status == 200:
                    return time.perf_counter() - start
        except Exception:  # noqa: BLE001
            pass
        time.sleep(0.5)
    return None


def measure_inference(sample_count: int) -> tuple[list[float], list[dict[str, Any]]]:
    """Return processing_time_ms values and raw responses."""
    categories = list(SAMPLE_TEXTS.keys())
    times: list[float] = []
    responses: list[dict[str, Any]] = []
    for i in range(sample_count):
        category = categories[i % len(categories)]
        response = predict(SAMPLE_TEXTS[category])
        if response is None:
            continue
        processing_time = response.get("processing_time_ms")
        if isinstance(processing_time, (int, float)):
            times.append(float(processing_time))
            responses.append(response)
    return times, responses


def measure_model_load(restart_command: str) -> float | None:
    """Restart the service and measure time until /health is 200."""
    print(f"Restarting service: {restart_command}")
    subprocess.run(restart_command, shell=True, check=True)
    return wait_for_health(timeout_s=120.0)


def main() -> int:
    parser = argparse.ArgumentParser(description="Measure /predict latency")
    parser.add_argument(
        "--samples",
        type=int,
        default=100,
        help="Number of sequential /predict requests (default: 100)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Output JSON path (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--host",
        type=str,
        default="local development machine",
        help="Host description recorded in the output artifact",
    )
    parser.add_argument(
        "--restart-command",
        type=str,
        default=None,
        help="Shell command to restart ticketsec.service (e.g. 'ssh ubuntu@3.23.60.61 sudo systemctl restart ticketsec')",
    )
    args = parser.parse_args()

    # Quick connectivity check
    health = predict("suspicious login from unknown device")
    if health is None:
        print(f"Cannot reach {ENDPOINT}. Is the backend online?", file=sys.stderr)
        return 1

    times, responses = measure_inference(args.samples)
    if len(times) < args.samples * 0.9:
        print(
            f"Too many failed requests: {len(times)}/{args.samples}", file=sys.stderr
        )
        return 1

    p50 = statistics.median(times)
    p95 = sorted(times)[int(len(times) * 0.95)] if len(times) >= 20 else None

    model_load_s = None
    if args.restart_command:
        model_load_s = measure_model_load(args.restart_command)
        if model_load_s is None:
            print("Model-load measurement timed out.", file=sys.stderr)

    output = {
        "status": "COMPLETE",
        "generated_at": now_utc(),
        "host": args.host,
        "endpoint": ENDPOINT,
        "sample_count": len(times),
        "p50_ms": round(p50, 3),
        "p95_ms": round(p95, 3) if p95 is not None else None,
        "model_load_s": round(model_load_s, 3) if model_load_s is not None else None,
        "per_request_inference_p50_ms": round(p50, 3),
        "per_request_inference_p95_ms": round(p95, 3) if p95 is not None else None,
        "measurement_protocol": {
            "per_request": f"Sequential {len(times)} canonical POST /predict calls with payloads spanning the six categories. p50/p95 computed from processing_time_ms.",
            "model_load": "sudo systemctl restart ticketsec, then curl /health in a loop until 200. Load time = restart-to-healthy interval.",
            "interpretation": "processing_time_ms is server-side ONNX inference time reported by /predict (excludes network RTT).",
        },
        "raw_responses_sample": responses[:5],
        "honesty_contract": (
            "Every datum shown is either live (from the API), cached (amber CACHED "
            "badge, sourced from public/cache/tickets-snapshot.json), or shown as "
            "'Unavailable — API offline'. The Event Log records ONLY real events. "
            "Nothing is ever fabricated and presented as live."
        ),
    }

    with args.output.open("w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Measured {len(times)} requests against {args.host}.")
    print(f"  p50 = {output['p50_ms']} ms")
    print(f"  p95 = {output['p95_ms']} ms")
    if model_load_s is not None:
        print(f"  model load = {output['model_load_s']} s")
    print(f"  -> {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
