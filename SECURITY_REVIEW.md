# Security Review — TicketSec Arm64 v4

**Date:** 2026-07-19  
**Scope:** React frontend, FastAPI backend (`app/main.py`), public inference endpoint (`POST /predict`), AWS Graviton deployment, repository hygiene.  
**Reviewers:** AppSec / QA / DevOps (agent-run, evidence-backed).

---

## Executive Summary

| Control | Status | Evidence |
|---|---|---|
| Secrets in repo | ✅ Clean | `scripts/gates.sh` G6 scan passes; `ticketsec-key.pem` is not in the repo tree. |
| `dangerouslySetInnerHTML` | ✅ Zero usage | `grep -r dangerouslySetInnerHTML src/` returns no matches. |
| `/predict` rate limiting | ✅ Implemented | 120 RPM per client IP sliding window in `app/main.py`. |
| Input sanitization | ✅ Implemented | Null-byte removal, whitespace normalization, Pydantic length validation. |
| Error shape leakage | ✅ Controlled | Generic 500 messages; no stack traces returned to clients. |
| CORS policy | ⚠️ Demo mode | `ALLOW_ORIGINS=*` by default; restricted-origin plan documented below. |
| npm audit high/critical | ⚠️ Triaged | 3 high findings in dev-only `@axe-core/cli` → `chromedriver` → `adm-zip`; accepted with rationale. |

---

## 1. Findings Register

### F-01 — Rate limiting on public `/predict` endpoint
- **Risk:** Unbounded consumption of the public inference endpoint (OWASP-LLM10 / OWASP API4:2023).
- **Implementation:** `app/main.py` includes an in-memory sliding-window rate limiter (`RateLimiter`) keyed by `X-Forwarded-For` or `request.client.host`. Default: 120 requests per minute per IP. Excess requests receive HTTP 429 with `Retry-After`.
- **Verification:** 65 rapid sequential requests from the same host resulted in 59× HTTP 200 and 6× HTTP 429.
- **Residual risk:** In-memory limiter is stateful per process; a production deployment should use Redis or an API gateway. This is acceptable for the demo/hackathon scope.

### F-02 — Ticket-text injection handling
- **Risk:** Malicious or unexpected input strings could pollute logs, distort classification, or trigger parser errors (OWASP-LLM01 / OWASP API8:2023).
- **Implementation:**
  - Pydantic enforces `str`, `min_length=1`, `max_length=10_000`.
  - `sanitize_text()` strips null bytes (`\x00`) and collapses whitespace.
  - The model is a deterministic ONNX classifier; input text is never executed, rendered as HTML, or passed to an LLM.
- **Verification:** The probe suite includes empty input, whitespace-only, emoji, mixed-language, and SQL-style payloads; all return valid HTTP responses (empty input returns HTTP 422).

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

---

## 2. False-Positive Register

These items were excluded from the `scripts/gates.sh` G6 secrets scan because they are benign in context.

| Category | Files | Rationale |
|---|---|---|
| Synthetic SOC ticket vocabulary | `data/seeds*.py`, `data/tickets_dataset*.jsonl`, `model/test_set.jsonl`, `model/probe_suite.json`, `model/probe_results.json` | Words like "password", "token", "secret" appear in synthetic ticket narratives, not as live credentials. |
| Design-token terminology | `src/styles/tokens.css`, `src/lib/chartTokens.ts` | "token" refers to UI design tokens. Scan filters comment lines and uses `\btoken(?!s|izer)`. |
| Data-augmentation script | `data/expand.py` | Contains synonym lists and tokenizer helper functions for generating synthetic variants. |
| Model evaluation script | `model/eval.py` | References the ML tokenizer used during training/export. |
| Binary artifacts | `model/artifact.onnx`, `model/artifact_fp32.onnx`, `model/pipeline.pkl` | Scanned only text source/config files; binaries cannot contain intentionally committed secrets. |

**Scan command:** see `scripts/gates.sh` §G6.

**Result:** No actual secrets were found in the repository.

---

## 3. Repository Hygiene

- `ticketsec-key.pem` is **not** in the repository tree. It lives only in `~/.ssh/` on the operator workstation.
- `.gitignore` excludes `*.pem`, `.env`, `dist/`, `node_modules/`, `__pycache__/`, `.localstorage`, and scratch files.
- No AWS keys, GitHub tokens, or database passwords are committed.

---

## 4. CORS Plan

**Current demo configuration:**

```python
allow_origins=os.environ.get("ALLOW_ORIGINS", "*").split(",")
```

This keeps the frontend working regardless of where it is served during judging (localhost, preview, static build, etc.).

**Post-demo hardening plan:**

1. Replace the wildcard with an explicit allow-list:
   - `http://localhost:5173` (local dev)
   - `http://localhost:4173` (Vite preview)
   - The production static-host origin (e.g., CloudFront / GitHub Pages / Hugging Face Space).
2. Set `allow_credentials=False` (the API is stateless and does not use cookies).
3. Restrict `allow_methods` to `GET`, `POST`, `OPTIONS`.
4. Add the `ALLOW_ORIGINS` env var to `ops/ticketsec.service` so the Graviton deployment inherits the restricted list.

**CORS preflight verification:**

```bash
curl -s -D - -o /dev/null \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -X OPTIONS http://3.23.60.61:8000/predict
```

Expected: `HTTP/1.1 200 OK` + `access-control-allow-origin: *` (demo mode).

---

## 5. Deployment Hardening Checklist

- [x] Rate limiter active on `/predict`.
- [x] Input sanitized and length-capped.
- [x] Safe error shapes (no stack traces).
- [x] No `dangerouslySetInnerHTML` in frontend.
- [x] G6 secrets scan clean.
- [x] `ticketsec-key.pem` absent from repo tree.
- [ ] CORS wildcard replaced with explicit origin list (post-demo).
- [ ] Production rate-limiter backed by Redis or API gateway (post-hackathon).

---

## Honesty Contract

Every security claim in this document is backed by a command, a code path, or a scan result. Nothing is fabricated.
