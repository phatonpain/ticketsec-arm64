# 06 — Docs / Devpost / demo-script update (next-cycle prompt)

> **Do NOT execute this prompt now.** Use it for future submission-package
> updates on TicketSec Arm64 v4.

## Trigger

Updating README, Devpost submission, demo script, or taking new screenshots.

## Required reads

- `README.md`
- `DEVPOST_SUBMISSION.md`
- `DEMO_SCRIPT.md`
- `audit/HANDOFF_P7.md`

## Exact steps

1. Update the relevant file(s). Every metric must cite a committed artifact.
2. Recompute SHA-256 hashes in claim ledgers.
3. Check for banned phrases: "best", "perfect", "100% accurate", "industry-leading",
   or any unverifiable superlative.
4. Ensure the demo script has Branch A, Branch B, and fallback narration.
5. Run:
   ```bash
   npm run build
   npm run lint
   bash scripts/gates.sh
   ```

## Acceptance criteria

- [ ] No unverifiable superlatives.
- [ ] Every claim traces to artifact with SHA-256.
- [ ] Demo script 60–90 s with fallback narration.
- [ ] gates.sh 11/11 PASS.
