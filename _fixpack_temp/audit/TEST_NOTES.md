# TEST_NOTES.md — W-04 Contract-Based Test Suite

## What was delivered

`fixpack/tests/` — 14 files, **116 tests, all green**, authored against the documented `src/lib` + five-flow contracts (the real `src/` was unavailable; suites are contract-based with a single adaptation shim at `tests/lib/index.ts`).

| Suite | Tests | Coverage |
| --- | --- | --- |
| `lib/sort.test.ts` | 12 | six exact categories (en collation), severity rank (Critical>High>Medium>Low), confidence numeric-vs-lexicographic, stability, unicode/RTL subjects, empty/singleton, input non-mutation, antisymmetry over all 8 keys, asc/desc reversal |
| `lib/filter.test.ts` | 15 | `byCategory/bySeverity/byStatus`, `combinePredicates` AND + zero-pred, `filterTickets` per-dimension + combined + `'All'` no-op, empty result, non-mutation |
| `lib/fuzzy.test.ts` | 13 | score 0 = no-match, case-insensitivity, prefix>substring>subsequence ranking, exact≥prefix, empty/whitespace query → all, no-match → `[]`, unicode/RTL/combining-accent safety, non-mutation |
| `lib/csv.test.ts` | 12 | exact header, `96%` confidence format, ISO time, comma/quote/newline/CR escaping, combined escaping, self-written RFC 4180 parser round-trip, unicode pass-through, six categories verbatim, empty list → header only |
| `lib/time.test.ts` | 19 | injected-clock buckets, 59s/1m/59m/1h/23h/1d boundaries, sub-second flooring, future skew → `just now`, NaN/±Infinity → `—`, determinism |
| `lib/backoff.test.ts` | 10 | 1-2-4-8 doubling, max cap, attempt counter, seeded-RNG jitter bounds (0..capped), fixed-0.5 jitter exact halves, seed reproducibility, reset, 120-attempt overflow safety, huge-base cap |
| `lib/ids.test.ts` | 8 | strict monotonicity over 10k calls, zero repeats, same-seed determinism, different-seed divergence, 2^31 crossing (no int32 wrap/negative), deep-past-2^31 safety, `TKT-<n>` format |
| `flows/classify-offline.test.tsx` | 4 | disabled-until-text, **honest offline error with zero fabricated category/confidence**, real EventLog entry, repeat-submit no stale success |
| `flows/search-filter.test.tsx` | 4 | distinctive-word narrowing, clear-restores, no-match → empty table (no fabricated rows), case-insensitivity |
| `flows/pagination.test.tsx` | 4 | page-1 state (Previous disabled), Next → page 2, round-trip, disabled-button no-op |
| `flows/command-palette.test.tsx` | 6 | Ctrl+K open + focus, Escape close, type-to-filter + Enter executes Refresh (API re-probe), no-match executes nothing, ⌘K variant, offline refresh never fabricates |
| `flows/settings-reprobe.test.tsx` | 4 | save re-probes `<newBase>/health`, old base abandoned, honest online transition, unroutable override keeps honest offline state |

## Verification performed (this is the important part)

The suites were executed in a scratch project (`/tmp/w04-verify`, **not** a deliverable) against contract-conforming stub implementations of `src/lib/*`, the five hooks, and a minimal App reproducing the evidenced DOM:

- `tsc --noEmit` under **strict + noUncheckedIndexedAccess + noUnusedLocals + noUnusedParameters**: 0 errors.
- `npx vitest run`: **12/12 files, 116/116 tests pass** (vitest 4.1, jsdom 29, RTL 16.3, React 19).
- **Mutation checks** (suites must detect defects, not just pass): severity sorted alphabetically → `orders by severity rank desc` fails as designed; CSV escaping removed → 6 escaping tests fail as designed; stubs restored → all green again.
- Verification surfaced and fixed 2 real test bugs before delivery: a `Math.sign` +0/−0 `Object.is` ambiguity in the antisymmetry assertion, and an ambiguous prefix-tie in the fuzzy ranking fixture.

## Evidence grounding (selectors used by flow suites)

CONFIRMED from rendered DOM (`evidence/a11y-attrs.txt`, `dom.html`, `text-content.txt`): `aria-label="Search tickets"`, `aria-label="Ticket text"`, `aria-label="Settings"` (gear — disambiguated from the sidebar "Settings" nav item via `getByLabelText`), buttons `Previous`/`Next` with `disabled`+`aria-disabled`, copy `Showing 1–5 of 6` (en dash) / `Page 1`, `Classify Ticket` disabled-when-empty, headings `Live Classification` / `Event Log`, severity aria-labels Critical/High/Medium, statuses Resolved/Escalated/Pending, `/health` probe target (console evidence S6).

INFERRED (marked `TODO(confirm-dom)` inline): snapshot JSON shape `{generatedAt, tickets}`; classify endpoint path fragment; exact offline-error and EventLog failure copy; filtered-count copy `Showing 1–1 of 1`; palette shortcut (Ctrl+K/⌘K assumed), palette `role=dialog`/option roles, `Refresh data` action name reuse; settings dialog role, `API URL` field label, `Save` button copy; store `reset()` API in `testUtils.resetStores()`.

## The 3 highest-risk untested areas (need the real `src/`)

1. **Chart/ECharts option builders + canvas behavior.** The flows mount `App` under jsdom where ECharts' canvas renderer cannot run; the verification stub omits charts entirely. Nothing pins the `grid.containLabel`→`grid.outerBounds` migration (console warning in S6), donut/bar option correctness, tooltip pinning/dismissal (S1 shows a stuck tooltip overlapping the header), or chart-resize on panel layout. Needs real chart components + an echarts mock harness (or component-level option-object unit tests once `src/components/charts/**` exists).
2. **Store internals and async wiring.** Flow tests assert only *observable* behavior; the singleton stores' real mechanics are unverified: health-probe backoff actually consuming `createBackoff` (jitter/reset on success), cache-fallback ordering (live → CACHED badge → snapshot), the `Checking…`→offline status transitions, EventLog dedup/ring-buffer bounds, and React 19 concurrent re-render storms from singleton subscriptions. Needs real `src/hooks/*` to write store-level unit tests (current `resetStores()` is a contract assumption).
3. **Token/styling compliance and visual-density regressions.** No test can assert the 40px row / 16px padding density, tabular-nums on metrics, no-gradient/no-glow rules, or the SEVERITY/CONFIDENCE header overlap (S3) — these are computed-style/visual properties requiring the real components, `tokens.css`, and either computed-style assertions in jsdom or Playwright screenshot diffs. Related a11y gap: the palette focus-trap and row keyboard navigation (rows render `tabindex=0` per evidence) are untested.

## Notes for integration

- Install: `npm i -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom` (dev-only; bundle budget untouched).
- Copy `tests/` to project root; if real exports differ, edit `tests/lib/index.ts` (one line per module) — documented in `tests/README.md`.
- If fixpack reference implementations land with different contract details (CSV time format, `just now` copy, jitter formula), the pinned values live in `tests/lib/contracts.ts` + each suite header — update there deliberately, never weaken flow (a)'s honesty assertions.
