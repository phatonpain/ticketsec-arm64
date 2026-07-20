# 02 — Security hardening (next-cycle prompt)

> **Do NOT execute this prompt now.** Use it for future AppSec work on TicketSec
> Arm64 v4.

## Trigger

Changes to `app/main.py`, CORS, rate limiting, auth, input handling, secrets, or
Security Group rules.

## Skill

Invoke `/skill:security-review`.

## Required reads

- `SECURITY_REVIEW.md`
- `app/main.py`
- `.env.example`

## Exact steps

1. Read the current findings register in `SECURITY_REVIEW.md`.
2. Implement the smallest change that closes one finding.
3. Update `SECURITY_REVIEW.md` with status and evidence.
4. Run the G6 secrets scan manually:
   ```bash
   bash scripts/gates.sh
   ```
5. If rate limits changed, reproduce the 70-request test and verify 60× 200 /
   10× 429.

## Acceptance criteria

- [ ] G6 secrets scan passes.
- [ ] `ticketsec-key.pem` absent from repo.
- [ ] `SECURITY_REVIEW.md` updated.
- [ ] No stack-trace leakage.
- [ ] gates.sh 11/11 PASS.
