"""Measure per-tier latency of the /predict/tiered endpoint.

POSTs sequential canonical + ambiguous tickets, groups the responses by the
honesty field ``inference_tier`` (onnx_int8 | local_llm_q4 | unavailable), and
writes p50/p95/n per tier to model/latency_tiers.json — the committed artifact
referenced by app/main.py.

Ambiguous samples exist to push confidence below TIERED_CONFIDENCE_THRESHOLD so
the local-LLM tier is exercised when Ollama is running; with Ollama down those
requests honestly land on the "unavailable" tier. Tiers with no samples are
reported as n=0 — never extrapolated.

Rate-limit note: /predict/tiered is limited per IP (TIERED_RATE_LIMIT_RPM,
default 20). On HTTP 429 the script sleeps for Retry-After and retries, so a
measurement run works against a stock server; it just takes longer.

Examples:
  python -m model.measure_latency_tiers
  TICKETSEC_TIERED_URL=http://3.23.60.61:8000/predict/tiered \
      python -m model.measure_latency_tiers --samples 60

THE HONESTY CONTRACT (non-negotiable):
Every datum shown is either live (from the API), cached (amber CACHED badge,
sourced from public/cache/tickets-snapshot.json), or shown as
"Unavailable — API offline". Nothing is ever fabricated and presented as live.
"""
from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_ENDPOINT = "http://127.0.0.1:8000/predict/tiered"
ENDPOINT = os.environ.get("TICKETSEC_TIERED_URL", DEFAULT_ENDPOINT)
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "latency_tiers.json"

TIERS = ("onnx_int8", "local_llm_q4", "unavailable")

# Canonical tickets per category — expected to stay on the ONNX tier.
CANONICAL_TEXTS = [
    "User clicked a link in a fake HR email and entered credentials.",
    "Endpoint alert: executable contacted a known C2 domain.",
    "Successful login from an unrecognized device at 03:00 UTC.",
    "Database table with customer PII exported to external storage.",
    "SYN flood from a botnet saturated the web tier.",
    "Alert triggered by an approved internal vulnerability scan.",
]

# Deliberately ambiguous tickets — expected to fall below the confidence
# threshold and route to the LLM fallback (or "unavailable" without Ollama).
AMBIGUOUS_TEXTS = [
    "Something looks off, not sure what.",
    "User reported a weird thing earlier.",
    "An event occurred on the network.",
    "Ticket opened about an unclear situation.",
]


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def post_tiered(text: str, timeout_s: float = 60.0) -> dict[str, Any] | None:
    """Single /predict/tiered call. Retries once after any 429 backoff."""
    payload = json.dumps({"text": text}).encode("utf-8")
    for attempt in range(3):
        req = urllib.request.Request(
            ENDPOINT,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout_s) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code == 429 and attempt < 2:
                retry_after = float(exc.headers.get("Retry-After", "5"))
                time.sleep(min(retry_after, 65.0))
                continue
            print(f"  HTTP {exc.code} for sample; skipping", file=sys.stderr)
            return None
        except Exception as exc:  # noqa: BLE001 — network/JSON failures skip
            print(f"  request failed ({type(exc).__name__}); skipping", file=sys.stderr)
            return None
    return None


def percentile(samples: list[float], q: float) -> float:
    ordered = sorted(samples)
    idx = min(len(ordered) - 1, max(0, round(q * (len(ordered) - 1))))
    return ordered[idx]


def main() -> int:
    parser = argparse.ArgumentParser(description="Measure /predict/tiered per-tier latency")
    parser.add_argument(
        "--samples",
        type=int,
        default=30,
        help="Total sequential requests, canonical+ambiguous mixed (default: 30)",
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
    args = parser.parse_args()

    probe = post_tiered(CANONICAL_TEXTS[0])
    if probe is None:
        print(f"Cannot reach {ENDPOINT}. Is the backend online?", file=sys.stderr)
        return 1

    samples = CANONICAL_TEXTS + AMBIGUOUS_TEXTS
    per_tier: dict[str, list[float]] = {t: [] for t in TIERS}
    raw: list[dict[str, Any]] = []
    for i in range(args.samples):
        response = post_tiered(samples[i % len(samples)])
        if response is None:
            continue
        tier = response.get("inference_tier")
        elapsed = response.get("processing_time_ms")
        if tier not in TIERS or not isinstance(elapsed, (int, float)):
            print(f"  malformed response (tier={tier!r}); skipping", file=sys.stderr)
            continue
        per_tier[tier].append(float(elapsed))
        raw.append(response)

    total = sum(len(v) for v in per_tier.values())
    if total < args.samples * 0.9:
        print(f"Too many failed requests: {total}/{args.samples}", file=sys.stderr)
        return 1

    tiers_out = {
        tier: {
            "n": len(times),
            "p50_ms": round(statistics.median(times), 3) if times else None,
            "p95_ms": round(percentile(times, 0.95), 3) if len(times) >= 20 else None,
        }
        for tier, times in per_tier.items()
    }

    output = {
        "status": "COMPLETE",
        "generated_at": now_utc(),
        "host": args.host,
        "endpoint": ENDPOINT,
        "sample_count": total,
        "tiers": tiers_out,
        "measurement_protocol": {
            "per_request": (
                f"Sequential {total} POST /predict/tiered calls mixing canonical "
                "and ambiguous ticket texts. Responses grouped by the honesty "
                "field inference_tier; p50/p95 computed from processing_time_ms. "
                "HTTP 429 responses are honored via Retry-After backoff."
            ),
            "interpretation": (
                "processing_time_ms is server-side tier latency reported by "
                "/predict/tiered (ONNX inference or ONNX+Ollama round trip; "
                "excludes network RTT). Tiers with n<20 report p95_ms=null. "
                "Tiers with n=0 were not exercised in this run."
            ),
        },
        "raw_responses_sample": raw[:5],
        "honesty_contract": (
            "Every datum shown is either live (from the API), cached (amber CACHED "
            "badge, sourced from public/cache/tickets-snapshot.json), or shown as "
            "'Unavailable — API offline'. Nothing is ever fabricated and presented "
            "as live."
        ),
    }

    with args.output.open("w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Measured {total} tiered requests against {args.host}.")
    for tier, stats in tiers_out.items():
        print(f"  {tier}: n={stats['n']} p50={stats['p50_ms']} ms p95={stats['p95_ms']} ms")
    print(f"  -> {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
