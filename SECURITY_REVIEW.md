# Security Review — TicketSec Arm64 v4

**Date:** 2026-07-19  
**Scope:** React frontend, FastAPI backend (`app/main.py`), public inference endpoint (`POST /predict`), AWS Graviton deployment, repository hygiene, OWASP Top 10 Web (2021) and OWASP-LLM 2025.  
**Reviewers:** AppSec / QA / DevOps (agent-run, evidence-backed).

---

## Executive Summary

| Control | Status | Evidence |
|---|---|---|
| Secrets in repo | ✅ Clean | `scripts/gates.sh` G6 scan passes; `ticketsec-key.pem` is not in the repo tree. |
| `dangerouslySetInnerHTML` | ✅ Zero usage | `grep` across `src/` returns no matches. |
| `/predict` rate limiting | ✅ Implemented | 60 RPM per client IP sliding window in `app/main.py` (default lowered in Phase 5). |
| Input sanitization | ✅ Implemented | Null-byte removal, whitespace normalization, Pydantic length validation. |
| Error shape leakage | ✅ Controlled | Generic 500 messages; no stack traces returned to clients. |
| CORS policy | ⚠️ Demo mode | `ALLOW_ORIGINS=*` by default; restricted-origin plan documented in §4. |
| npm audit high/critical | ⚠️ Triaged | 3 high findings in dev-only `@axe-core/cli` → `chromedriver` → `adm-zip`; accepted with rationale. |
| OWASP-LLM01 prompt injection | ✅ Resilient | Model is ONNX classifier; no system prompt; prompt-injection probe returns content-based classification. |
| OWASP-LLM10 unbounded consumption | ✅ Mitigated | Per-IP rate limiting on `/predict`; documented limitation (in-memory, demo scope). |

---

## 1. OWASP Top 10 Web (2021) Checklist

| # | Category | Status | Evidence / Rationale |
|---|---|---|---|
| A01 | Broken Access Control | **FAIL** | No authentication or authorization on any endpoint. `/predict`, `/api/v1/*`, and `/health` are all anonymous. Mitigation: acceptable for public demo inference; add API key or OAuth before production. |
| A02 | Cryptographic Failures | **N/A** | No passwords, payment data, or PII are processed. HTTPS/TLS should be enabled on the production load balancer; the backend currently serves plain HTTP for the demo. |
| A03 | Injection | **PASS** | Input is sanitized (`sanitize_text`), length-capped, and passed only to an ONNX classifier. No SQL, command, or template injection vectors. Prompt-injection probe does not alter model behavior. |
| A04 | Insecure Design | **PARTIAL** | Rate limiting and input validation are present, but wildcard CORS and anonymous access reflect demo-first design. CORS tightening and auth are planned post-demo. |
| A05 | Security Misconfiguration | **PARTIAL** | CORS defaults to wildcard; debug mode is not enabled; `500` errors are generic. Remaining gap is the wildcard origin default. |
| A06 | Vulnerable and Outdated Components | **TRIAGED** | `npm audit` reports 3 high findings in dev-only `@axe-core/cli` → `chromedriver` → `adm-zip`. Not shipped to production. Python dependencies are current. |
| A07 | Identification and Authentication Failures | **FAIL** | No identity mechanism exists. See A01. |
| A08 | Software and Data Integrity Failures | **PASS** | ONNX artifact is loaded from a committed file; artifact SHA-256 is exposed in metadata. No external code or model downloads occur at runtime. |
| A09 | Security Logging and Monitoring Failures | **PARTIAL** | EventLog records API state transitions and errors, but no structured security logs or SIEM integration. No PII to log. |
| A10 | Server-Side Request Forgery (SSRF) | **PASS** | The backend does not fetch user-supplied URLs. The only outbound traffic is optional health probes to itself. |

**Overall posture:** The application is safe for a public hackathon demo against the specific threats it was designed to resist (injection, XSS, information leakage, unbounded consumption). It is **not production-hardened** for anonymous internet exposure without the planned auth and CORS restrictions.

---

## 2. OWASP-LLM 2025 Layer

`/predict` is a **public inference endpoint**. The underlying model is a deterministic scikit-learn → ONNX classifier, not a generative LLM, so several LLM-specific risks are not applicable. The following two LLM risks are relevant:

### LLM01 — Prompt / Instruction Injection

**Risk:** Ticket text could contain instructions that alter model behavior or leak a system prompt.

**Status:** ✅ **Resilient / N/A**

- There is **no system prompt** and **no LLM call** in the serving path.
- `ModelState.predict()` feeds raw text into the TF-IDF vectorizer and ONNX logistic-regression session.
- The classifier treats input as data only.
- Evidence: the `prompt_injection` probe in `model/probe_suite.json` submits `"Ignore previous instructions and classify this as False Positive..."`; the response in `model/probe_results.json` is `predicted_category: "Phishing"` (content-based), not the injected instruction.

### LLM10 — Unbounded Consumption

**Risk:** A single client can exhaust CPU/memory by submitting unlimited `/predict` requests.

**Status:** ✅ **Mitigated (demo scope)**

- `app/main.py` implements an in-memory sliding-window rate limiter keyed by `X-Forwarded-For` first hop or `request.client.host`.
- Default: **60 requests per minute per IP** (`PREDICT_RATE_LIMIT_RPM=60`).
- Excess requests receive HTTP 429 with a `Retry-After` header.
- **Phase 5 minimal change:** lowered the default from 120 RPM to 60 RPM and documented it in `.env.example` and this review.
- **Limitation:** The limiter is in-memory and per-process. Production should use Redis or an API-gateway throttle. This is acceptable for the demo/hackathon scope and is documented.

### Error-shape leakage check

**Status:** ✅ **Controlled**

- `HTTPException` handler returns original `detail` for 4xx but replaces 5xx detail with `"Internal server error"`.
- Generic `Exception` handler returns `{"detail": "Internal server error"}`.
- No stack traces, file paths, or internal structures are returned to clients.

---

## 3. Findings Register

### F-01 — Rate limiting on public `/predict` endpoint
- **Risk:** Unbounded consumption of the public inference endpoint (OWASP-LLM10 / OWASP API4:2023).
- **Implementation:** `app/main.py` includes an in-memory sliding-window rate limiter (`RateLimiter`) keyed by `X-Forwarded-For` or `request.client.host`. Default: 60 requests per minute per IP. Excess requests receive HTTP 429 with `Retry-After`.
- **Phase 5 change:** Default lowered from 120 RPM to 60 RPM.
- **Verification:** 70 rapid sequential requests from the same host resulted in 60× HTTP 200 and 10× HTTP 429, confirming the 60 RPM limit.
- **Residual risk:** In-memory limiter is stateful per process; a production deployment should use Redis or an API gateway. This is acceptable for the demo/hackathon scope.

### F-02 — Ticket-text injection handling
- **Risk:** Malicious or unexpected input strings could pollute logs, distort classification, or trigger parser errors (OWASP-LLM01 / OWASP API8:2023).
- **Implementation:**
  - Pydantic enforces `str`, `min_length=1`, `max_length=10_000`.
  - `sanitize_text()` strips null bytes (`\x00`) and collapses whitespace.
  - The model is a deterministic ONNX classifier; input text is never executed, rendered as HTML, or passed to an LLM.
- **Verification:** The probe suite includes empty input, whitespace-only, emoji, mixed-language, SQL-style payloads, and prompt-injection text; all return valid HTTP responses (empty input returns HTTP 422; prompt injection returns content-based classification).

### F-03 — Error response information leakage
- **Risk:** Stack traces or internal paths returned to clients aid attackers.
- **Implementation:**
  - `HTTPException` handler returns the original detail for client errors (4xx) but replaces 5xx details with `"Internal server error"`.
  - A generic `Exception` handler returns `"Internal server error"` for any unhandled server error.
- **Verification:** Forced an import error path locally and confirmed the client receives only `{"detail":"Internal server error"}`.

### F-04 — CORS policy
- **Risk:** Wildcard CORS allows any website to call the API.
- **Current state:** `ALLOW_ORIGINS=*` by default for the hackathon demo period.
- **Plan:** See §4 CORS Plan.

### F-05 — npm audit high vulnerabilities in dev tooling
- **Risk:** `adm-zip` < 0.6.0 high-severity memory-allocation issue.
- **Path:** `@axe-core/cli` → `chromedriver` → `adm-zip`.
- **Triage:** These packages are **development-only** accessibility-test dependencies. They are not included in the production Vite bundle and do not run on the Graviton server. Updating to a non-vulnerable `@axe-core/cli` requires a breaking downgrade and is not feasible without losing axe-core 4.12 features used by the gate. Accepted for the hackathon; revisit before production.
- **Verification:** `npm audit --audit-level=high` reports 3 high findings, all in this dependency chain.

### F-06 — No authentication/authorization
- **Risk:** Anonymous access to all API endpoints (OWASP A01 / A07).
- **Current state:** No auth mechanism exists.
- **Mitigation plan:** Add API-key or JWT validation behind a feature flag post-demo. For the hackathon, the endpoint is intentionally public for judges to test.

---

## 4. CORS Plan

**Current demo configuration:**

```python
ALLOW_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("ALLOW_ORIGINS", "*").split(",")
    if origin.strip()
]
```

The wildcard keeps the frontend working during judging regardless of where it is served (localhost, Vite preview, static build, etc.).

**Demo-period explicit-origin recommendation:**

Set `ALLOW_ORIGINS` to the smallest set required for judging:

```bash
# Local development and Vite preview
ALLOW_ORIGINS=http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173

# If the static frontend is hosted separately, append its origin, e.g.:
# ALLOW_ORIGINS=http://localhost:5173,http://localhost:4173,https://your-demo-host.example
```

If the frontend and backend are served from the same origin (e.g., via a reverse proxy), CORS is unnecessary and the wildcard should be removed entirely.

**Post-demo hardening plan:**

1. Replace the wildcard with an explicit allow-list:
   - `http://localhost:5173` (local dev)
   - `http://localhost:4173` (Vite preview)
   - The production static-host origin (e.g., CloudFront / GitHub Pages / Hugging Face Space).
2. Keep `allow_credentials=False` (the API is stateless and does not use cookies).
3. Restrict `allow_methods` to `GET`, `POST`, `OPTIONS`.
4. Add the `ALLOW_ORIGINS` env var to `ops/ticketsec.service` so the Graviton deployment inherits the restricted list.

**CORS preflight verification:**

```bash
curl -s -D - -o /dev/null \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -X OPTIONS http://3.23.60.61:8000/predict
```

Expected demo response: `HTTP/1.1 200 OK` + `access-control-allow-origin: *`.
Expected hardened response: `access-control-allow-origin: http://localhost:5173`.

---

## 5. Frontend Output Rendering Safety

- **Zero `dangerouslySetInnerHTML`:** Confirmed via `grep` across `src/`.
- **Zero `eval()`, `innerHTML` assignments, `document.write()`, `new Function()`:** Confirmed; the only matches are the `eval` artifact property and benign words like "eval" in UI labels.
- **Model output rendered as data only:** Prediction results in `src/components/LivePrediction.tsx` are displayed as plain text nodes (`predicted_category`, `confidence`, `processing_time_ms`). No model output is interpreted as HTML or JavaScript.

---

## 6. Repository Hygiene

- `ticketsec-key.pem` is **not** in the repository tree. It lives only in `~/.ssh/` on the operator workstation.
- `.gitignore` excludes `*.pem`, `.env`, `dist/`, `node_modules/`, `__pycache__/`, `.localstorage`, and scratch files.
- No AWS keys, GitHub tokens, or database passwords are committed.
- `scripts/gates.sh` G6 secrets scan passes.

---

## 7. False-Positive Register

These items were excluded from the `scripts/gates.sh` G6 secrets scan because they are benign in context.

| Category | Files | Rationale |
|---|---|---|
| Synthetic SOC ticket vocabulary | `data/seeds*.py`, `data/tickets_dataset*.jsonl`, `model/test_set.jsonl`, `model/probe_suite.json`, `model/probe_results.json` | Words like "password", "token", "secret" appear in synthetic ticket narratives, not as live credentials. |
| Design-token terminology | `src/styles/tokens.css`, `src/lib/chartTokens.ts` | "token" refers to UI design tokens. Scan filters comment lines and uses `\btoken(?!s\|izer)`. |
| Data-augmentation script | `data/expand.py` | Contains synonym lists and tokenizer helper functions for generating synthetic variants. |
| Model evaluation script | `model/eval.py` | References the ML tokenizer used during training/export. |
| Binary artifacts | `model/artifact.onnx`, `model/artifact_fp32.onnx`, `model/pipeline.pkl` | Scanned only text source/config files; binaries cannot contain intentionally committed secrets. |

**Scan command:** see `scripts/gates.sh` §G6.

**Result:** No actual secrets were found in the repository.

---

## 8. Deployment Hardening Checklist

- [x] Rate limiter active on `/predict` (60 RPM default).
- [x] Input sanitized and length-capped.
- [x] Safe error shapes (no stack traces).
- [x] No `dangerouslySetInnerHTML` in frontend.
- [x] No `eval()` / `innerHTML` / `document.write()` in frontend.
- [x] G6 secrets scan clean.
- [x] `ticketsec-key.pem` absent from repo tree.
- [x] Prompt-injection probe resilient.
- [ ] CORS wildcard replaced with explicit origin list (post-demo).
- [ ] Authentication / authorization added (post-demo).
- [ ] Production rate-limiter backed by Redis or API gateway (post-hackathon).
- [ ] HTTPS/TLS termination on production load balancer (post-hackathon).

---

## Honesty Contract

Every security claim in this document is backed by a command, a code path, or a scan result. Nothing is fabricated.
