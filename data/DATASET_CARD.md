# DATASET_CARD — TicketSec Arm64 Synthetic Ticket Dataset

## Generation method

1. **Hand-authored seeds**: 20 realistic SOC-style tickets per class (120 total)
   written in English and stored in `data/seeds.py`. Each seed has a stable
   `seed_id` and belongs to one of six canonical categories.
2. **Programmatic expansion**: `data/expand.py` applies template-style
   synonym/entity swaps, casing/punctuation perturbations, filler prefixes,
   sentence shuffling, and light length perturbations to generate 12 variants
   per seed plus the original seed text.  The random seed is fixed at 42.
3. **Leakage safety**: All variants of a single `seed_id` stay together during
   train/test splitting because `model/train.py` uses
   `GroupShuffleSplit(groups=seed_id)`.

## Counts per class

| Category | Samples |
|---|---|
| Phishing | 511 |
| Malware | 512 |
| Unauthorized Access | 514 |
| Data Breach | 503 |
| DDoS | 506 |
| False Positive | 512 |

**Total samples:** 3058

## Known limitations

This is a **synthetic dataset**.  The classes are highly separable by design,
so near-perfect accuracy on this data is expected and does **not** imply
production-ready performance.  Real-world SOC tickets will contain ambiguous
wording, mixed languages, class overlap, and distribution shift that this
dataset does not capture.  Retraining on representative production data is
required before operational use.

## Traceability

Every sample carries `seed_id` and `variant_of` so its lineage can be traced
back to a hand-authored seed in `data/seeds.py`.
