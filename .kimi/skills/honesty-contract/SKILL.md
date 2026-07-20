---
name: honesty-contract
description: |
  Enforce the TicketSec Arm64 Honesty Contract on any feature, UI surface, test,
  or document. Use this skill whenever data provenance could be ambiguous:
  dashboards, tables, charts, event logs, model metrics, screenshots, or
  submission claims.
---

# honesty-contract

## Purpose

Ensure every datum is labeled as **live**, **cached**, or **offline/unavailable**,
and that the Event Log records only real events. The contract is the project's
core differentiator and must survive UI changes, backend outages, and demo-day
pressure.

## When to use

- Adding any surface that displays data.
- Writing or reviewing tests for `useApi`, `useTickets`, `useEventLog`.
- Updating `README.md`, `DEVPOST_SUBMISSION.md`, `DEMO_SCRIPT.md`, or model cards.
- Reviewing a screenshot or demo narrative.
- Any change that could cause fabricated "live" data.

## Exact steps

1. Identify the data source:
   - API response → must show `LIVE` badge or equivalent provenance.
   - `public/cache/tickets-snapshot.json` → must show `CACHED` badge.
   - Missing source → must show "Unavailable — API offline" or `PENDING`.
2. Check the relevant store in `src/hooks/`:
   - `useApi.ts` provides `status: 'live' | 'cached' | 'offline'`.
   - `useEventLog.ts` records only dispatched API events.
3. Verify the UI uses the store value, not a prop or constant.
4. For docs/claims, ensure every metric links to a committed artifact with
   SHA-256 and generation command.
5. Run the honesty-specific tests:
   ```bash
   npx vitest run tests/flows/offline-silence.test.tsx tests/flows/classify-offline.test.tsx
   ```

## Negative constraints

- **Never** show cached data with a green `LIVE` badge.
- **Never** add a fake Event Log entry to make the dashboard look active.
- **Never** hand-edit `public/cache/tickets-snapshot.json` and present it as live.
- **Never** claim a metric is from a live measurement without a timestamp and
  command.
- **Never** silently fall back to placeholder data.

## Verifiable acceptance criteria

- [ ] `useApi` status has exactly three states and drives every data surface.
- [ ] Offline tests pass: no fabricated rows, no fake log entries, no "Classifying…" spinner.
- [ ] Every README/Devpost/demo claim cites a committed artifact.
- [ ] A manual honesty drill (disable API → observe CACHED → restore → observe LIVE) passes.
