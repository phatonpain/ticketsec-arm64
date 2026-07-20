---
name: security-review
description: |
  Run a structured AppSec review for the TicketSec Arm64 public inference
  endpoint and repository. Use this skill before any change that touches
  `app/main.py`, authentication, CORS, rate limiting, input handling, or secrets.
---

# security-review

## Purpose

Maintain a reproducible security posture for a public FastAPI inference endpoint
on AWS Graviton. The review covers OWASP Top 10 Web (2021), OWASP-LLM 2025,
repository hygiene, and the DevOps surface (Security Group, systemd).

## When to use

- Any change to `app/main.py`, `.env.example`, CORS, rate limits, or input
  validation.
- Adding a new API route or changing an existing one.
- Introducing secrets, tokens, or environment variables.
- Before/after a deployment to the Graviton host.

## Exact steps

1. Read `SECURITY_REVIEW.md`, `app/main.py`, and `.env.example`.
2. For code changes, verify:
   - Input is sanitized (`sanitize_text`) and length-capped by Pydantic.
   - Rate limiter key uses `X-Forwarded-For` first hop or `request.client.host`.
   - 5xx responses return only `"Internal server error"`.
   - No stack traces or internal paths leak.
3. Run the local secrets scan (same as `scripts/gates.sh` G6):
   ```bash
   grep -rP \
     --include='*.ts' --include='*.tsx' --include='*.css' --include='*.html' \
     --include='*.json' --include='*.py' --include='*.sh' --include='*.yml' --include='*.md' \
     --exclude='seeds*.py' --exclude='tickets_dataset*.jsonl' --exclude='expand.py' \
     --exclude='test_set.jsonl' --exclude='probe_suite.json' --exclude='probe_results.json' --exclude='eval.py' \
     --exclude='tokens.css' --exclude='chartTokens.ts' --exclude='query_imds.sh' \
     '(api[_-]?key|secret|password|BEGIN.*PRIVATE KEY|\btoken(?!s|izer))' \
     src/ public/ model/ ops/ app/ data/ \
     | grep -vE 'PLACEHOLDER|EXAMPLE' \
     | grep -vE '^\s*(\*|//|/\*|#|<!--)' \
     | grep -q . && echo FAIL || echo OK
   ```
4. Confirm `ticketsec-key.pem` is absent:
   ```bash
   find . -name 'ticketsec-key.pem' -not -path './node_modules/*' | grep -q . && echo FAIL || echo OK
   ```
5. Update `SECURITY_REVIEW.md` with any new finding, its status, and evidence.

## Negative constraints

- **Never** commit a real PEM key, API key, password, or token.
- **Never** disable the rate limiter in production without a replacement.
- **Never** return stack traces to API clients.
- **Never** fetch user-supplied URLs server-side.
- **Never** claim a security control is implemented unless it is exercised by a
  probe or gate.

## Verifiable acceptance criteria

- [ ] `scripts/gates.sh` G6 secrets scan passes.
- [ ] `ticketsec-key.pem` is not present in the repo.
- [ ] `SECURITY_REVIEW.md` is updated for any new finding or changed control.
- [ ] Rate limiter test: 70 rapid requests → 60× HTTP 200, 10× HTTP 429.
- [ ] Empty/oversized input returns HTTP 422 with a safe detail shape.
