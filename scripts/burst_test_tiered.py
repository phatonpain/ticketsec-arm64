"""Burst test for the /predict/tiered rate limiter (per-tier budget).

Fires a rapid burst well above TIERED_RATE_LIMIT_RPM (default 20) and asserts:
- the limiter engages: at least one HTTP 429 is observed;
- every 429 carries a Retry-After header;
- the number of 2xx responses never exceeds the configured limit;
- no 5xx is ever returned under load.

Evidence is written to audit/evidence/burst_tiered.json. Run against a stock
server (default limits); exit code 0 = gate green, 1 = gate red.

Example:
  python scripts/burst_test_tiered.py
  TICKETSEC_TIERED_URL=http://3.23.60.61:8000/predict/tiered \
      python scripts/burst_test_tiered.py --limit 20
"""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_ENDPOINT = "http://127.0.0.1:8000/predict/tiered"
ENDPOINT = os.environ.get("TICKETSEC_TIERED_URL", DEFAULT_ENDPOINT)
EVIDENCE_PATH = (
    Path(__file__).resolve().parent.parent / "audit" / "evidence" / "burst_tiered.json"
)


def fire(text: str) -> dict[str, Any]:
    payload = json.dumps({"text": text}).encode("utf-8")
    req = urllib.request.Request(
        ENDPOINT,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return {
                "http_status": resp.status,
                "retry_after": None,
                "inference_tier": body.get("inference_tier"),
            }
    except urllib.error.HTTPError as exc:
        return {
            "http_status": exc.code,
            "retry_after": exc.headers.get("Retry-After"),
            "inference_tier": None,
        }
    except Exception as exc:  # noqa: BLE001
        return {"http_status": 0, "retry_after": None, "error": type(exc).__name__}


def main() -> int:
    parser = argparse.ArgumentParser(description="Burst test /predict/tiered rate limiter")
    parser.add_argument("--limit", type=int, default=20,
                        help="Expected TIERED_RATE_LIMIT_RPM of the target (default: 20)")
    parser.add_argument("--burst", type=int, default=40,
                        help="Concurrent requests to fire (default: 40)")
    args = parser.parse_args()

    text = "Endpoint alert: executable contacted a known C2 domain."
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.burst) as pool:
        results = list(pool.map(lambda _: fire(text), range(args.burst)))

    ok = sum(1 for r in results if r["http_status"] == 200)
    limited = [r for r in results if r["http_status"] == 429]
    server_errors = [r for r in results if 500 <= r["http_status"] < 600]
    unreachable = [r for r in results if r["http_status"] == 0]
    missing_retry = [r for r in limited if not r["retry_after"]]

    checks = {
        "limiter_engaged": len(limited) > 0,
        "retry_after_present": len(missing_retry) == 0,
        "throughput_capped": ok <= args.limit,
        "no_5xx_under_load": len(server_errors) == 0,
        "endpoint_reachable": len(unreachable) < args.burst,
    }
    passed = all(checks.values())

    evidence = {
        "status": "PASS" if passed else "FAIL",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "endpoint": ENDPOINT,
        "expected_limit_rpm": args.limit,
        "burst_size": args.burst,
        "http_2xx": ok,
        "http_429": len(limited),
        "http_5xx": len(server_errors),
        "unreachable": len(unreachable),
        "checks": checks,
        "results": results,
    }
    EVIDENCE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with EVIDENCE_PATH.open("w", encoding="utf-8") as f:
        json.dump(evidence, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Burst of {args.burst} against {ENDPOINT} (limit {args.limit} RPM):")
    print(f"  2xx={ok} 429={len(limited)} 5xx={len(server_errors)} unreachable={len(unreachable)}")
    for name, ok_flag in checks.items():
        print(f"  [{'PASS' if ok_flag else 'FAIL'}] {name}")
    print(f"  -> {EVIDENCE_PATH}")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
