# TicketSec Arm64 — Data Model

> Source: `app/main.py`, `model/test_set.jsonl`.  
> This document is standalone — no need to read the backend code.

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Returns `{"status": "ok"}` |
| POST | `/predict` | Classify raw ticket text |
| GET | `/api/v1/stats/categories` | Category counts from the test set |
| GET | `/api/v1/performance/history` | Performance history (currently empty) |
| GET | `/api/v1/classifications` | Synthetic classification list |

## `/predict` request schema

```json
{
  "text": "string, 1–10,000 chars"
}
```

Validation:

- `min_length=1`
- `max_length=10_000`
- Sanitized server-side: null bytes stripped, whitespace collapsed.

## `/predict` response schema

```json
{
  "predicted_category": "Phishing",
  "confidence": 0.912345,
  "processing_time_ms": 0.2341,
  "probabilities": {
    "Phishing": 0.912345,
    "Malware": 0.045000,
    "Data Breach": 0.020000,
    "Unauthorized Access": 0.015000,
    "DDoS": 0.005000,
    "False Positive": 0.002655
  }
}
```

| Field | Type | Meaning |
|---|---|---|
| `predicted_category` | string | One of the six categories below |
| `confidence` | float | Probability of the predicted class, rounded to 6 decimals |
| `processing_time_ms` | float | ONNX inference latency, rounded to 4 decimals |
| `probabilities` | object | Softmax-normalized scores for all categories |

## Categories (canonical order)

1. Phishing
2. Malware
3. Data Breach
4. Unauthorized Access
5. DDoS
6. False Positive

## `/api/v1/classifications` item schema

```json
{
  "id": "TKT-8501",
  "subject": "Fake security alert from cloud storage provider",
  "category": "Phishing",
  "confidence": 0.8234,
  "status": "Resolved",
  "assignedTo": "Auto",
  "createdAt": "2026-07-20T03:00:00+00:00"
}
```

| Field | Type | Source |
|---|---|---|
| `id` | string | Synthetic `TKT-{8501 + index}` |
| `subject` | string | First sentence of ticket text, capped at 120 chars |
| `category` | string | From `test_set.jsonl` |
| `confidence` | float | Random uniform `0.75 + 0.24 * rng.random()` (placeholder) |
| `status` | string | One of: Resolved, Escalated, Pending |
| `assignedTo` | string | One of: Auto, Security Team, SOC L1, SOC L2 |
| `createdAt` | ISO timestamp | `datetime.now(timezone.utc)` at request time |

## 5 real examples from `model/test_set.jsonl`

These are the actual first five records used by the backend.

### 1. Phishing
```json
{
  "text": "Fake security alert from cloud storage provider. An email warns that unusual sign-in activity was detected and the user must verify their identity by signing in through a link. The link domain is not the official provider.",
  "category": "Phishing",
  "seed_id": "phi_006",
  "variant_of": "phi_006",
  "variant_index": 0
}
```

### 2. Phishing (variant)
```json
{
  "text": "Fake security alert from cloud storage provider; An email warns that unusual sign-in activity was identified and the employee must verify their identity by signing in through a link. The link domain is not the official provider. Monitoring flagged this automatically.",
  "category": "Phishing",
  "seed_id": "phi_006",
  "variant_of": "phi_006",
  "variant_index": 1
}
```

### 3. Phishing (variant)
```json
{
  "text": "Fake security alert from cloud storage provider. An email warns that unusual sign-in activity was detected and the employee must verify their identity by signing in through a link. The link domain is not the official provider....",
  "category": "Phishing",
  "seed_id": "phi_006",
  "variant_of": "phi_006",
  "variant_index": 2
}
```

### 4. Phishing (variant)
```json
{
  "text": "fake security alert from cloud storage provider. an mail warns that unusual sign-in activity was detected and the user must verify their identity by signing in through a link. the link domain is not the official provider.",
  "category": "Phishing",
  "seed_id": "phi_006",
  "variant_of": "phi_006",
  "variant_index": 3
}
```

### 5. Phishing (variant)
```json
{
  "text": "FAKE SECURITY ALERT FROM CLOUD STORAGE PROVIDER. FAKE SECURITY ALERT FROM CLOUD STORAGE PROVIDER. AN Mail WARNS THAT UNUSUAL SIGN-IN ACTIVITY WAS DETECTED AND THE USER MUST VERIFY THEIR IDENTITY BY SIGNING IN THROUGH A LINK. THE LINK DOMAIN IS NOT THE OFFICIAL PROVIDER.",
  "category": "Phishing",
  "seed_id": "phi_006",
  "variant_of": "phi_006",
  "variant_index": 4
}
```

## Rate limits

- `/predict`: 60 RPM per client IP (sliding window).
- Exceeding returns HTTP 429 with `Retry-After` header.

## Error shapes

- HTTP 422: empty text after sanitization.
- HTTP 429: rate limit exceeded.
- HTTP 503: model not loaded.
- No stack traces or internal paths leak to the client.
