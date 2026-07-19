"""Programmatic expansion of hand-authored seed tickets.

Loads data/seeds.py, applies controlled perturbations, and writes
 data/tickets_dataset.jsonl — a balanced, leakage-safe dataset for training.

Every generated sample keeps its seed_id and variant_of so that
GroupShuffleSplit(groups=seed_id) in model/train.py keeps all expansions of a
single seed on the same side of the train/test boundary.
"""
from __future__ import annotations

import json
import random
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Callable

# Allow running as script from anywhere.
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from data.seeds import SEEDS  # noqa: E402

SEED = 42
TARGET_VARIANTS_PER_SEED = 12  # 12 variants + original = 1560 total
OUTPUT_PATH = _PROJECT_ROOT / "data" / "tickets_dataset.jsonl"
DATASET_CARD_PATH = _PROJECT_ROOT / "data" / "DATASET_CARD.md"

CATEGORIES = [
    "Phishing",
    "Malware",
    "Unauthorized Access",
    "Data Breach",
    "DDoS",
    "False Positive",
]

# Simple synonym maps for entity/verb swaps.  Keys are lower-cased.
SYNONYMS: dict[str, list[str]] = {
    "user": ["user", "end user", "employee", "staff member", "team member"],
    "employee": ["employee", "staff member", "team member", "worker", "colleague"],
    "server": ["server", "host", "node", "machine"],
    "workstation": ["workstation", "desktop", "laptop", "endpoint"],
    "email": ["email", "message", "mail"],
    "account": ["account", "profile", "user identity"],
    "credentials": ["credentials", "password", "login details", "auth tokens"],
    "attacker": ["attacker", "threat actor", "adversary", "intruder"],
    "malicious": ["malicious", "suspicious", "unauthorized", "hostile"],
    "detected": ["detected", "flagged", "observed", "identified"],
    "reported": ["reported", "alerted", "notified", "flagged"],
    "external": ["external", "outside", "untrusted", "third-party"],
    "internal": ["internal", "inside", "corporate", "trusted"],
    "data": ["data", "information", "records", "files"],
    "network": ["network", "infrastructure", "environment"],
    "access": ["access", "logon", "connection", "session"],
}

FILLERS = [
    "Please review and triage.",
    "Monitoring flagged this automatically.",
    "Investigating with the owning team.",
    "No customer impact reported yet.",
    "Escalate if the pattern continues.",
    "Ticket opened from automated alert correlation.",
]

PREFIXES = [
    "SOC alert:",
    "Helpdesk ticket:",
    "Automated detection:",
    "Reported by user:",
]


def _token_synonym_swap(text: str) -> str:
    """Replace a few common words with synonyms."""
    tokens = text.split()
    new_tokens: list[str] = []
    for tok in tokens:
        stripped = tok.strip(".,;:!?\"'()[]{}").lower()
        if stripped in SYNONYMS and random.random() < 0.35:
            replacement = random.choice(SYNONYMS[stripped])
            # Preserve leading capitalization if the token was sentence-start.
            if tok[0].isupper() and len(replacement) > 1:
                replacement = replacement[0].upper() + replacement[1:]
            # Preserve trailing punctuation if any.
            trailing = ""
            if tok[-1] in ".,;:!?\"'()[]{}" and replacement[-1] not in ".,;:!?\"'()[]{":
                trailing = tok[-1]
            new_tokens.append(replacement + trailing)
        else:
            new_tokens.append(tok)
    return " ".join(new_tokens)


def _vary_case(text: str) -> str:
    """Apply random casing perturbation."""
    mode = random.choice(["orig", "lower", "upper", "title", "sentence"])
    if mode == "lower":
        return text.lower()
    if mode == "upper":
        return text.upper()
    if mode == "title":
        return text.title()
    if mode == "sentence":
        sentences = re.split(r"(?<=[.!?])\s+", text)
        return " ".join(s[0].upper() + s[1:].lower() if s else s for s in sentences)
    return text


def _vary_punctuation(text: str) -> str:
    """Add/remove/modify punctuation lightly."""
    if random.random() < 0.3:
        text = text.replace(".", "!", 1)
    if random.random() < 0.3:
        text = text.replace(".", ";", 1)
    if random.random() < 0.2:
        text = text + "..."
    if random.random() < 0.2 and not text.endswith("."):
        text = text + "."
    return text


def _add_filler(text: str) -> str:
    """Append a short SOC-style filler sentence."""
    if random.random() < 0.6:
        text = text + " " + random.choice(FILLERS)
    if random.random() < 0.2:
        text = random.choice(PREFIXES) + " " + text
    return text


def _shuffle_sentences(text: str) -> str:
    """Shuffle sentences if there are enough of them."""
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    if len(sentences) >= 3 and random.random() < 0.35:
        random.shuffle(sentences)
        return " ".join(sentences)
    return text


def _truncate_or_pad(text: str) -> str:
    """Vary length by dropping a clause or duplicating a detail."""
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    if len(sentences) > 2 and random.random() < 0.25:
        # Drop the last sentence occasionally.
        text = " ".join(sentences[:-1])
    if random.random() < 0.15 and sentences:
        # Repeat the first sentence for length/noise.
        text = sentences[0] + " " + text
    return text


def _make_variant(seed: dict[str, str], variant_index: int) -> dict[str, str]:
    """Create one synthetic variant from a seed ticket."""
    raw_text = f"{seed['subject']}. {seed['body']}"

    # Always run a deterministic-ish sequence; random state is seeded globally.
    transforms: list[Callable[[str], str]] = [
        _token_synonym_swap,
        _vary_case,
        _vary_punctuation,
        _add_filler,
        _shuffle_sentences,
        _truncate_or_pad,
    ]
    random.shuffle(transforms)

    text = raw_text
    for transform in transforms:
        text = transform(text)

    # Normalize whitespace.
    text = re.sub(r"\s+", " ", text).strip()

    return {
        "text": text,
        "category": seed["category"],
        "seed_id": seed["seed_id"],
        "variant_of": seed["seed_id"],
        "variant_index": variant_index,
    }


def _generate_dataset() -> list[dict[str, str]]:
    """Generate all seed + variant records."""
    records: list[dict[str, str]] = []
    for seed in SEEDS:
        # Original seed is variant 0.
        records.append(
            {
                "text": f"{seed['subject']}. {seed['body']}",
                "category": seed["category"],
                "seed_id": seed["seed_id"],
                "variant_of": seed["seed_id"],
                "variant_index": 0,
            }
        )
        for i in range(1, TARGET_VARIANTS_PER_SEED + 1):
            records.append(_make_variant(seed, i))
    return records


def _dedupe(records: list[dict[str, str]]) -> list[dict[str, str]]:
    """Remove exact text duplicates, preserving the first occurrence."""
    seen: set[str] = set()
    unique: list[dict[str, str]] = []
    for r in records:
        key = r["text"]
        if key in seen:
            continue
        seen.add(key)
        unique.append(r)
    return unique


def _ngram_set(text: str, n: int = 5) -> set[str]:
    words = re.findall(r"\b\w+\b", text.lower())
    return {" ".join(words[i : i + n]) for i in range(max(0, len(words) - n + 1))}


def _near_duplicate_report(records: list[dict[str, str]], threshold: float = 0.8) -> None:
    """Print 5-gram overlap statistics without removing records."""
    ngrams_by_seed: dict[str, set[str]] = {}
    for r in records:
        ngrams_by_seed.setdefault(r["seed_id"], set()).update(_ngram_set(r["text"]))

    max_overlap = 0.0
    max_pair: tuple[str, str] | None = None
    seed_ids = list(ngrams_by_seed.keys())
    for i in range(len(seed_ids)):
        for j in range(i + 1, len(seed_ids)):
            a, b = ngrams_by_seed[seed_ids[i]], ngrams_by_seed[seed_ids[j]]
            if not a or not b:
                continue
            overlap = len(a & b) / min(len(a), len(b))
            if overlap > max_overlap:
                max_overlap = overlap
                max_pair = (seed_ids[i], seed_ids[j])

    print(f"Near-duplicate check (5-gram overlap across seeds): max = {max_overlap:.2%}")
    if max_pair:
        print(f"  Max pair: {max_pair[0]} / {max_pair[1]}")
    if max_overlap > threshold:
        print("  WARNING: high overlap detected between distinct seeds.")


def _write_dataset(records: list[dict[str, str]]) -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def _write_dataset_card(records: list[dict[str, str]]) -> None:
    counts = Counter(r["category"] for r in records)
    lines = [
        "# DATASET_CARD — TicketSec Arm64 Synthetic Ticket Dataset",
        "",
        "## Generation method",
        "",
        "1. **Hand-authored seeds**: 20 realistic SOC-style tickets per class (120 total)",
        "   written in English and stored in `data/seeds.py`. Each seed has a stable",
        "   `seed_id` and belongs to one of six canonical categories.",
        "2. **Programmatic expansion**: `data/expand.py` applies template-style",
        "   synonym/entity swaps, casing/punctuation perturbations, filler prefixes,",
        "   sentence shuffling, and light length perturbations to generate 12 variants",
        "   per seed plus the original seed text.  The random seed is fixed at 42.",
        "3. **Leakage safety**: All variants of a single `seed_id` stay together during",
        "   train/test splitting because `model/train.py` uses",
        "   `GroupShuffleSplit(groups=seed_id)`.",
        "",
        "## Counts per class",
        "",
        "| Category | Samples |",
        "|---|---|",
    ]
    for cat in CATEGORIES:
        lines.append(f"| {cat} | {counts[cat]} |")
    lines += [
        "",
        f"**Total samples:** {len(records)}",
        "",
        "## Known limitations",
        "",
        "This is a **synthetic dataset**.  The classes are highly separable by design,",
        "so near-perfect accuracy on this data is expected and does **not** imply",
        "production-ready performance.  Real-world SOC tickets will contain ambiguous",
        "wording, mixed languages, class overlap, and distribution shift that this",
        "dataset does not capture.  Retraining on representative production data is",
        "required before operational use.",
        "",
        "## Traceability",
        "",
        "Every sample carries `seed_id` and `variant_of` so its lineage can be traced",
        "back to a hand-authored seed in `data/seeds.py`.",
    ]
    DATASET_CARD_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    random.seed(SEED)
    records = _generate_dataset()
    records = _dedupe(records)

    counts = Counter(r["category"] for r in records)
    print(f"Generated {len(records)} samples after exact-dedupe.")
    print("Per-class counts:")
    for cat in CATEGORIES:
        print(f"  {cat}: {counts[cat]}")

    min_count, max_count = min(counts.values()), max(counts.values())
    imbalance = (max_count - min_count) / max_count
    print(f"Class imbalance: {imbalance:.1%} (max={max_count}, min={min_count})")

    _near_duplicate_report(records)

    _write_dataset(records)
    _write_dataset_card(records)

    print(f"Wrote {OUTPUT_PATH}")
    print(f"Wrote {DATASET_CARD_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
