---
name: demo-script
description: |
  Build or review a 60–90 second demo script for TicketSec Arm64. Use this skill
  when preparing a Devpost video, live demo, or screenshot gallery. It enforces
  traceability: every spoken number must link to a committed artifact.
---

# demo-script

## Purpose

Keep the demo honest and under 90 seconds. The script is shot-based, branches on
live vs. cached API state, and cites committed artifacts for every claim.

## When to use

- Writing or updating `DEMO_SCRIPT.md`.
- Recording a Devpost video.
- Preparing a live demo for judges.
- Adding fallback narration for API outages.

## Exact steps

1. Check the only allowed signal:
   ```bash
   curl -s http://3.23.60.61:8000/health
   ```
2. Choose Branch A (HTTP 200) or Branch B (non-200 / timeout).
3. Structure the script as timed shots:
   - Hook + problem (0–8 s)
   - Live classification OR honest cached mode (8–30 s)
   - Model Registry: hashes, ablation, confusion matrix, latency (30–55 s)
   - Honesty drill (55–75 s)
   - Close + CTA (75–90 s)
4. For every number, add a **Cite** line pointing to a committed file.
5. Add a fallback narration block for mid-recording API drops.
6. Add a pre-flight checklist.

## Negative constraints

- **Never** claim a live API call when the badge is `CACHED` or `API OFFLINE`.
- **Never** round latency/accuracy numbers in a way that hides the artifact value.
- **Never** show a screenshot as "current live" unless it was captured against the
  live endpoint.
- **Never** invent a probe result or metric.

## Verifiable acceptance criteria

- [ ] Every spoken metric has a `Cite:` line pointing to a committed artifact.
- [ ] Branch A and Branch B are both covered.
- [ ] Fallback narration exists for API drops mid-recording.
- [ ] Demo checklist includes `curl /health`, `npm run build`, and `bash scripts/gates.sh`.
- [ ] Script duration is between 60 and 90 seconds.
