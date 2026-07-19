"""Run the adversarial probe suite against the /predict endpoint.

THE HONESTY CONTRACT (non-negotiable):
Every datum shown is either live (from the API), cached (amber CACHED badge,
sourced from public/cache/tickets-snapshot.json), or shown as
"Unavailable — API offline". The Event Log records ONLY real events. Nothing is
ever fabricated and presented as live.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import urllib.error
import urllib.request

from model.categories import CATEGORIES

DEFAULT_ENDPOINT = "http://127.0.0.1:8000/predict"
ENDPOINT = os.environ.get("TICKETSEC_API_URL", DEFAULT_ENDPOINT)
PROBE_SUITE_PATH = Path(__file__).resolve().parent / "probe_suite.json"
PROBE_RESULTS_PATH = Path(__file__).resolve().parent / "probe_results.json"


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def file_hash(path: Path) -> str:
    if not path.exists():
        return ""
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def load_suite(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def expand_text(probe: dict[str, Any]) -> str:
    text = probe.get("text", "")
    if "repeat" in probe:
        text = text * int(probe["repeat"])
    return text


def run_probe(probe: dict[str, Any]) -> dict[str, Any]:
    text = expand_text(probe)
    payload = json.dumps({"text": text}).encode("utf-8")
    req = urllib.request.Request(
        ENDPOINT,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8")
            http_status = resp.status
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        http_status = exc.code
    except Exception as exc:  # noqa: BLE001
        body = str(exc)
        http_status = 0
    elapsed_ms = (time.perf_counter() - start) * 1000

    parsed: dict[str, Any] | None = None
    valid = False
    actual_category: str | None = None
    try:
        parsed = json.loads(body)
        if isinstance(parsed, dict):
            actual_category = parsed.get("predicted_category")
            if (
                actual_category in CATEGORIES
                and isinstance(parsed.get("confidence"), (int, float))
                and 0 <= parsed["confidence"] <= 1
                and isinstance(parsed.get("processing_time_ms"), (int, float))
            ):
                valid = True
    except json.JSONDecodeError:
        pass

    expected = probe.get("expected_category")
    expected_vs_actual = {
        "expected": expected,
        "actual": actual_category,
        "matched": expected is None or expected == actual_category,
    }

    return {
        "id": probe["id"],
        "text_preview": text[:200],
        "text_bytes": len(text.encode("utf-8")),
        "http_status": http_status,
        "client_elapsed_ms": round(elapsed_ms, 3),
        "response": parsed if parsed is not None else body,
        "valid": valid,
        "expected_vs_actual": expected_vs_actual,
    }


def main() -> int:
    if not PROBE_SUITE_PATH.exists():
        print(f"Probe suite not found: {PROBE_SUITE_PATH}", file=sys.stderr)
        return 1

    print(f"Running probe suite against {ENDPOINT}")
    suite = load_suite(PROBE_SUITE_PATH)
    probes = suite["probes"]
    results: list[dict[str, Any]] = []
    non_2xx = 0
    invalid = 0
    expectation_mismatches = 0

    for probe in probes:
        result = run_probe(probe)
        results.append(result)
        if result["http_status"] != 200:
            non_2xx += 1
        elif not result["valid"]:
            invalid += 1
        if not result["expected_vs_actual"]["matched"]:
            expectation_mismatches += 1
            print(
                f"  [mismatch] {probe['id']}: expected {result['expected_vs_actual']['expected']}, "
                f"got {result['expected_vs_actual']['actual']}"
            )

    http_5xx = sum(1 for r in results if 500 <= r["http_status"] < 600)

    output = {
        "status": "OK" if http_5xx == 0 else "NEEDS_REVIEW",
        "generated_at": now_utc(),
        "endpoint": ENDPOINT,
        "probe_suite_sha256": file_hash(PROBE_SUITE_PATH),
        "probe_count": len(probes),
        "probes_run": len(results),
        "http_2xx_count": sum(1 for r in results if r["http_status"] == 200),
        "non_2xx_count": non_2xx,
        "http_5xx_count": http_5xx,
        "invalid_response_count": invalid,
        "expectation_mismatches": expectation_mismatches,
        "results": results,
        "honesty_contract": (
            "Every datum shown is either live (from the API), cached (amber CACHED "
            "badge, sourced from public/cache/tickets-snapshot.json), or shown as "
            "'Unavailable — API offline'. The Event Log records ONLY real events. "
            "Nothing is ever fabricated and presented as live."
        ),
        "next_command": "Review mismatches in results[].expected_vs_actual; any mismatch is a documented finding, not a failure.",
        "file_sha256": "",
    }

    with PROBE_RESULTS_PATH.open("w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
        f.write("\n")

    # Hash after writing.
    output["file_sha256"] = file_hash(PROBE_RESULTS_PATH)
    with PROBE_RESULTS_PATH.open("w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Ran {len(results)} probes against {ENDPOINT}")
    print(f"  HTTP 5xx: {http_5xx}, invalid responses: {invalid}, mismatches: {expectation_mismatches}")
    print(f"  -> {PROBE_RESULTS_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
