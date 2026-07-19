# HANDOFF — Phase 5 (Security / AppSec) → Close-out

Date: 2026-07-19  
Branch: `mission/v4`  
Phase 4 final commit: `b88e430`  
Phase 5 final commit: `0dca304`

## Done

### 1. OWASP Top 10 Web (2021) checklist

Reviewed each item against the React frontend, FastAPI backend, and deployment
config. Results recorded in `SECURITY_REVIEW.md` §1.

| # | Category | Status |
|---|---|---|
| A01 | Broken Access Control | FAIL — no auth/authz (demo scope) |
| A02 | Cryptographic Failures | N/A — no sensitive data processed; TLS post-hackathon |
| A03 | Injection | PASS — sanitized input, ONNX classifier, no LLM |
| A04 | Insecure Design | PARTIAL — controls exist, wildcard CORS remains |
| A05 | Security Misconfiguration | PARTIAL — wildcard CORS default |
| A06 | Vulnerable and Outdated Components | TRIAGED — 3 high findings in dev-only axe tooling |
| A07 | Identification and Authentication Failures | FAIL — no identity mechanism |
| A08 | Software and Data Integrity Failures | PASS — committed ONNX artifact, SHA-256 metadata |
| A09 | Security Logging and Monitoring Failures | PARTIAL — event log only |
| A10 | Server-Side Request Forgery | PASS — no user-supplied URLs fetched |

### 2. OWASP-LLM 2025 layer

- **LLM01 — Prompt / instruction injection:**
  - `/predict` is a public inference endpoint backed by a deterministic ONNX
    classifier, not a generative LLM.
  - There is **no system prompt** and no LLM call.
  - The `prompt_injection` probe in `model/probe_suite.json` returns a
    content-based classification (`Phishing`) rather than following the
    injected instruction.
  - Status: **PASS / resilient**.

- **LLM10 — Unbounded consumption:**
  - Implemented per-IP sliding-window rate limiter in `app/main.py`.
  - **Phase 5 minimal change:** lowered the default `PREDICT_RATE_LIMIT_RPM`
    from `120` to `60` and documented it in `.env.example`.
  - Verified: 70 rapid sequential requests from one host → 60× HTTP 200,
    10× HTTP 429.
  - Status: **Mitigated (demo scope)**.

- **Error-shape leakage:**
  - 5xx responses return only `{"detail": "Internal server error"}`.
  - No stack traces or internal paths leak to clients.
  - Status: **PASS**.

### 3. Frontend output rendering safety

- Zero `dangerouslySetInnerHTML` in `src/`.
- Zero `eval()`, `innerHTML` assignments, `document.write()`, or `new Function()`.
- Prediction results are rendered as plain text nodes only.

### 4. Secrets and repository hygiene

- `scripts/gates.sh` G6 secrets scan passes.
- `ticketsec-key.pem` is absent from the entire repository tree.
- No AWS keys, tokens, or passwords committed in source or `ops/`.

### 5. npm audit

- Command: `npm audit --audit-level=high`
- Result: **0 critical, 3 high**.
- All 3 high findings are in the dev-only dependency chain
  `@axe-core/cli` → `chromedriver` → `adm-zip` (crafted-ZIP memory issue).
- These packages are not shipped in the production Vite bundle and do not run
  on the Graviton server.
- Triage documented in `SECURITY_REVIEW.md` §3 F-05.

### 6. CORS plan

- Current demo default: `ALLOW_ORIGINS=*` (configurable via env var).
- Documented demo-period explicit-origin recommendation:
  - `http://localhost:5173`
  - `http://localhost:4173`
  - `http://127.0.0.1:5173`
  - Plus the static demo-host origin when known.
- Post-demo hardening plan:
  - Replace wildcard with explicit production origin list.
  - Keep `allow_credentials=False`.
  - Restrict methods to `GET`, `POST`, `OPTIONS`.
  - Add `ALLOW_ORIGINS` to `ops/ticketsec.service`.

### 7. SECURITY_REVIEW.md

Rewrote the file to include:
- Executive summary with all security controls.
- OWASP Top 10 Web checklist.
- OWASP-LLM 2025 layer section.
- Findings register (F-01 through F-06).
- False-positive register.
- Repository hygiene.
- CORS plan.
- Frontend rendering-safety notes.
- Deployment hardening checklist.
- Honesty Contract.

### 8. Code changes

- `app/main.py`: default `PREDICT_RATE_LIMIT_RPM` changed from `120` to `60`;
  docstring already claimed 60 RPM.
- `.env.example`: added `ALLOW_ORIGINS` and `PREDICT_RATE_LIMIT_RPM` examples.
- `.gitignore`: added exception for `audit/HANDOFF_P5.md`.

## Gate Status

- `bash scripts/gates.sh` → **11/11 PASS** at `2026-07-19 23:50:35Z`
  (recorded in `TEST_RESULTS_v4.md`; gate-evidence commit `8cb65f6`).

## Open Items

- Replace CORS wildcard with explicit origin list post-demo.
- Add authentication/authorization before production anonymous exposure.
- Replace in-memory rate limiter with Redis or API-gateway throttling
  post-hackathon.
- Enable HTTPS/TLS termination on the production load balancer.
- Record the final Phase 5 commit hash at the top of this file after
  `git commit`.

## Warnings / Honesty Notes

- The API is intentionally anonymous and uses wildcard CORS for the demo.
  It should not be exposed to untrusted production traffic without the
  hardening steps above.
- `npm audit` high findings are accepted only because they are in dev-only
  tooling; they must be revisited before production.

## Context Notes for Compaction

- Preserve: `audit/HANDOFF_P1.md`, `audit/HANDOFF_P2.md`,
  `audit/HANDOFF_P3.md`, `audit/HANDOFF_P4.md`, this file,
  `audit/ML_TRACEABILITY.md`, `SECURITY_REVIEW.md`, `model/MODEL_CARD.md`,
  root `MODEL_CARD.md`, `TEST_RESULTS_v4.md`, Honesty Contract.
