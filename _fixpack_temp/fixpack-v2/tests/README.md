# TicketSec Arm64 — Test Suites v2 (REAL-targeted)

Contract-based suites adapted to the **real** source (`ticketsec-source.pdf`, 53 files).
Pass-1 suites (`fixpack/tests/`) were written against guessed module paths; every suite here
imports and exercises the **actual** `src/**` modules and rendered DOM.

**Result against the real code (vitest, jsdom): 14 files / 129 tests — 102 green, 27 expected-fail (`it.fails`), 0 unexpected failures.**

The 27 expected-fails are deliberate: they pin the *correct* behavior for confirmed real-code
defects (FIX-01 root cause, EXPOSED-01…08) and two plainly-missing features. They turn green
as the corresponding fixes land. **Do not weaken them to force green.**

## Layout

```
tests/
  lib/
    fixtures.ts                  real-model fixtures (Ticket = Date createdAt, NO severity field)
    exportCsv.test.ts            → src/lib/exportCsv.ts (REAL header/escaping; Blob capture)
    formatRelativeTime.test.ts   → src/lib/formatRelativeTime.ts (real buckets + EXPOSED-01)
    utils.test.ts                → src/lib/utils.ts (key systems, truncate, series, EXPOSED-02/04)
  hooks/
    useTickets.test.ts           → src/hooks/useTickets.ts (THE real id generator: monotonic counter)
    useApi.test.tsx              → src/hooks/useApi.ts (probe/predict/cache; Honesty Contract)
    useApiBackoff.test.tsx       → inline backoff in useApi.ts:208-215 (fake timers; timeout refutation)
    storeIdentity.test.tsx       → THE FIX-01 root-cause suite (getSnapshot identity bail-out)
  components/
    ClassificationTable.test.tsx → sort/filter/pagination WHERE IT LIVES (component-local, lines 21-101)
    Header.test.tsx              → pill (S1 repro), bell (FIX-08 refuted), time listbox (FIX-26)
  flows/
    testUtils.ts                 fetch mock + REAL offline handler + jsdom stubs (no zustand reset!)
    classify-offline.test.tsx    flow (a): offline classify honesty — 4 it.fails (FIX-01, EXPOSED-06)
    search-filter.test.tsx       flow (b): substring search — 3 it.fails (FIX-01)
    pagination.test.tsx          flow (c): 6 cached rows, page size 5 — all green (FIX-28 verified)
    keyboard-shortcuts.test.tsx  flow (d): REAL shortcuts (/, r, ?, Esc) + palette MISSING FEATURE
    settings-reprobe.test.tsx    flow (e): drawer, URL override, Test Connection, EXPOSED-07/08
```

## Install & run (verified)

```bash
# 1. real source tree (see "Source caveats" below — the PDF truncates long lines)
cp -r /path/to/real/ticketsec ./w04-real-verify && cd w04-real-verify

# 2. runtime deps come from the project's own package.json
npm i
npm i -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom

# 3. copy this tests/ tree into the project root (imports are ../../src/…)
npx vitest run            # all suites
npx vitest run tests/hooks/storeIdentity.test.tsx   # the FIX-01 proof, fastest read
```

No vitest config file is required: environments are set per file via
`// @vitest-environment jsdom` docblocks (pure-logic suites run in node).

## Source caveats (read before trusting a red test)

* **PDF truncation:** the source archive truncates lines >~143 chars. 60 source lines were
  reconstructed for the verified run (panel chrome divs, style objects, one lazy import in
  `App.tsx:22`, tooltip text, `ClassificationTable.tsx:307` `{(row.confidence*100).toFixed(0)}%`
  — cross-checked against `evidence/text-content.txt` "96%"). Repairs are semantics-preserving
  but are **reconstructions**; when the untruncated repo is available, re-diff.
* `tsconfig.app.json` / `tsconfig.node.json` were **not** in the archive (referenced by
  `tsconfig.json`) — vitest/esbuild doesn't need them; `npm run build` would.
* Tests were verified against the extracted+repaired tree at `/tmp/w04-real-verify`.

## Adaptation notes (why the suites look like this)

* **No lib modules for sort/filter/fuzzy/backoff/ids.** Real `src/lib/` = chartTokens,
  echarts, exportCsv, formatRelativeTime, utils only. Sort/filter/pagination are component-local
  in `ClassificationTable.tsx` (not exported) → tested through the rendered table. IDs are the
  `nextId` counter in `useTickets.ts`. Backoff is inline in `useApi.ts` → tested via probe-call
  timing under fake timers.
* **`it.fails` semantics (vitest):** the test passes when its assertion throws, and the run fails
  if it ever passes unexpectedly. Used ONLY for confirmed defects/missing features; each carries
  a `FIX-NN` or `EXPOSED-NN` tag with file:line. Registry in `audit/TEST_NOTES_V2.md`.
* **Singleton stores:** all five stores are module singletons. Isolation is achieved by
  `vi.resetModules()` + dynamic `await import(...)` per test (React and RTL stay single because
  vitest externalizes node_modules). Suites using static imports (`ClassificationTable`,
  `useTickets`, `storeIdentity`) instead reset via the stores' own APIs (`seedTickets([])`,
  `setTicketQuery('')`, `localStorage.clear()`); `useApi`/`useEventLog` have **no** reset API —
  tests there are written to be state-tolerant or read state via a fresh hook mount.
* **Reading a broken store:** because useApi/useEventLog/useTicketQuery never republish (FIX-01),
  true store state is read either through side effects (fetch calls) or by forcing a re-render
  (`rerender()` / a fresh mount) — documented inline at `storeIdentity.test.tsx:71-88`.
* **ECharts is mocked** in flow suites (`vi.mock('../../src/components/ECharts', …)`) because
  jsdom has no canvas; the mock must be top-level per file (hoisting).
* **Offline handler serves the REAL snapshot shape** — bare array with `minutesAgo`
  (`public/cache/tickets-snapshot.json` verbatim, `fixtures.ts:52-60`), at the relative path
  `/cache/tickets-snapshot.json`. Pass-1 guessed `{generatedAt, tickets}`.
* **Known noise:** one React "not wrapped in act" warning from the App's async snapshot seeding
  (harmless store write after test teardown); jsdom focus events fire an extra window-focus
  probe on click — suites settle around both (`keyboard-shortcuts.test.tsx:96-103`).
