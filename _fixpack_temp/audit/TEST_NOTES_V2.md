# TEST_NOTES_V2 — Real-Targeted Test Adaptation (Mission C)

**Date:** 2026-07-18 · **Suites:** `fixpack-v2/tests/**` (16 files, 2,394 LoC)
**Verified run:** `/tmp/w04-real-verify` (real src extracted from `ticketsec-source.pdf`, 60
truncation repairs, `npm i` + `npm i -D vitest @testing-library/{react,user-event,jest-dom} jsdom`)
**Result: 14 test files, 129 tests → 102 GREEN · 27 expected-fail (`it.fails`) · 0 unexpected failures. `npx vitest run` in ~48s.**

The 27 expected-fails pin correct behavior for **confirmed** real-code defects and missing
features; they are green-by-design (`it.fails` fails the run only if the assertion unexpectedly
passes). They flip green as agents A/B's fixes land. None were weakened to force green.

---

## 1. Pass-1 → v2 mapping table

| Pass-1 suite | Pass-1 assumption | REAL target found | v2 disposition |
|---|---|---|---|
| `lib/csv.test.ts` | `src/lib/csv.ts`, `ticketsToCsv` pure fn, header `Ticket ID,…,Severity,…,Time`, confidence `96%` | `src/lib/exportCsv.ts` — `exportTicketsToCsv(tickets, filename)` (side-effectful); header `ID,Subject,Category,Confidence,Status,Assigned To,Created At`; confidence `96.0` (no %); **no Severity column**; empty list = no download | `lib/exportCsv.test.ts` (12 tests, all green). Blob captured via `URL.createObjectURL` stub; RFC-4180 round-trip parser retained. Real format pinned. |
| `lib/time.test.ts` | injected clock; seconds bucket (`45s ago`) | `src/lib/formatRelativeTime.ts` — `(date: Date)`, no injected clock; buckets `just now / Nm / Nh / Nd` | `lib/formatRelativeTime.test.ts` (9 = 7 green + 2 xf). Offsets computed at call time, ≥1 s from bucket edges (no flakiness). Invalid input → EXPOSED-01. |
| `lib/sort.test.ts` | `src/lib/sort.ts` `sortTickets` | **no such module** — `sortTickets` is component-local, `ClassificationTable.tsx:21-44` | Folded into `components/ClassificationTable.test.tsx` via rendered table + header-button clicks. Contract cases kept (severity rank, stability, numeric confidence, direction toggle, aria-sort). Lexicographic id sort → EXPOSED-05. |
| `lib/filter.test.ts` | `src/lib/filter.ts` | component-local `matchesQuery`, `ClassificationTable.tsx:46-56` | Folded into ClassificationTable + search-filter flow (currently xf via FIX-01 store defect, not filter logic). |
| `lib/fuzzy.test.ts` | `src/lib/fuzzy.ts` `fuzzyMatch` | **NO fuzzy search exists** — `matchesQuery` is plain case-insensitive substring over id/subject/category/status/assignedTo | Suite **dropped**; multi-field + case + no-match-honesty cases folded into `flows/search-filter.test.tsx`. No fuzzy semantics to preserve. |
| `lib/ids.test.ts` | `src/lib/ids.ts` `createTicketIdGenerator` | counter `store.nextId` (start 8472) + `formatTicketId`, `useTickets.ts:33,46-52` | `hooks/useTickets.test.ts` (13 = 11 green + 2 xf). Monotonic/unique-10k/2^31-safe all **pass** on the real counter. Duplicate-explicit-id → EXPOSED-03. Dead `generateTicketId` (utils.ts:70-76, random 4-digit) exposed separately as EXPOSED-02. |
| `lib/backoff.test.ts` | `src/lib/backoff.ts` `createBackoff` w/ injected RNG + full jitter | **inline** backoff `useApi.ts:208-215`: `30s × min(2^failures, 10)`, cap 300 s, **no jitter** | `hooks/useApiBackoff.test.tsx` (3, all green): probe-round timing at 30 s/150 s/390 s/690 s/990 s under fake timers; pre-elapse silence; 10 s hanging-probe abort. |
| `flows/testUtils.ts` | zustand `useApi.getState().reset()` | plain module singletons, **no reset APIs** | Rewritten: `resetStores()` via real APIs; `vi.resetModules()` + dynamic import per test in flows; REAL offline handler (bare array snapshot, not `{generatedAt,tickets}`). |
| flow (a) classify-offline | — | same intent | `flows/classify-offline.test.tsx` (7 = 3 green + 4 xf). Real selectors (`aria-label="Ticket text"`, "Classify Ticket", `#live-prediction`). |
| flow (b) search-filter | — | same intent | `flows/search-filter.test.tsx` (6 = 3 green + 3 xf). |
| flow (c) pagination | — | same intent | `flows/pagination.test.tsx` (3, all green). |
| flow (d) command-palette | Ctrl+K palette exists | **NO palette anywhere** (App.tsx:94-130 has only `/`, `r`, `?`, `Esc`; HelpModal.tsx:13-16 confirms) | Renamed `flows/keyboard-shortcuts.test.tsx` (6 = 4 green + 2 xf). Palette = **MISSING FEATURE**, stated plainly in 2 xf tests. |
| flow (e) settings-reprobe | URL change ⇒ immediate re-probe | re-probe only on next scheduled/manual health check; "Test Connection" probes saved base | `flows/settings-reprobe.test.tsx` (9 = 6 green + 3 xf). |
| — (new) | — | FIX-01 mechanism unknown in pass 1 | `hooks/storeIdentity.test.tsx` (6 = 3 green + 3 xf) — the root-cause proof. |
| — (new) | — | utils.ts untested | `lib/utils.test.ts` (17 = 14 green + 3 xf). |
| — (new) | — | Header behaviors | `components/Header.test.tsx` (7 = 6 green + 1 xf). |

## 2. HEADLINE: FIX-01 root cause is CONFIRMED — and it is not what pass 1 inferred

**Pass-1 inference (FIX_PACK.md:6-10): "probe fetch() without timeout never settles." REFUTED.**
A 10 s `AbortController` timeout exists (`useApi.ts:127-136`), `probeSingleEndpoint` never throws
(`:138-155`), and `hooks/useApiBackoff.test.tsx` proves a hanging fetch is aborted at 10 s and the
probe lock releases.

**Real root cause (code-confirmed + test-reproduced):** three stores mutate a module-level
object and return that same object from `getSnapshot`:
- `useApi.ts:108-110` → `getSnapshot(): ApiStore { return store; }`
- `useEventLog.ts:99-101` → same pattern
- `useTicketQuery.ts:24-26` → same pattern

`useSyncExternalStore` compares snapshots with `Object.is`; a mutated same-identity snapshot
bails out, so **emit() never repaints subscribers**. `storeIdentity.test.tsx` reproduces the S1
stuck "Checking…" pill in a unit test (`it.fails`, FIX-01) and shows the mutation lands but is
never published (stale read until an unrelated re-render). Healthy control group: `useTickets`
(immutable array, `:97-99`), `useSettings` (object replaced, `:68-70`), `useSettingsDrawer`
(boolean) — all propagate.

**Blast radius (all evidenced in S1–S4, all covered by xf tests):** stuck "Checking…" pill
(FIX-01 + `Header.test.tsx`); Event Log frozen at 2 entries; search box dead (controlled input
never echoes); classify submit gives no loading state, no error box, invisible log entry.
The FIX-01 replacement MUST make these stores immutable single-writer (or version-stamped
snapshots); the 13 `it.fails(FIX-01)` tests are the acceptance gate.

**FIX-08 also refuted:** bell unread IS store-derived (`Header.tsx:12`); badge/panel behavior is
green in `Header.test.tsx`. The S1 "3 vs 2" is fully explained by store writes landing between
repaints (same FIX-01 mechanism), not a duplicated counter.

## 3. Expected-fail registry (27)

| # | Tag | Suite | Defect (file:line) | Status for FIX PACK |
|---|---|---|---|---|
| 1 | FIX-01 | storeIdentity ×3, ClassificationTable ×3, Header ×1, classify-offline ×3, search-filter ×3 | getSnapshot identity bail-out (`useApi.ts:108-110`, `useEventLog.ts:99-101`, `useTicketQuery.ts:24-26`) | **CONFIRMED root cause; refine FIX-01 text** (not "no timeout") |
| 2 | EXPOSED-01 | formatRelativeTime ×2 | invalid Date → `"NaNd ago"` (`formatRelativeTime.ts:3-11`, NaN falls through every `<`) | new P2 defect |
| 3 | EXPOSED-02 | utils ×2 | `generateTicketId` random 4-digit: non-unique, non-monotonic, dead code (`utils.ts:70-76`) | new P2 (delete or fix) |
| 4 | EXPOSED-03 | useTickets ×2 | duplicate explicit ids accepted; explicit id doesn't advance `nextId` → later collisions (`useTickets.ts:57-64`); React key clash (`ClassificationTable.tsx:267`) | new P1 |
| 5 | EXPOSED-04 | utils ×1 | `truncate` slices UTF-16 units → surrogate mojibake on astral chars (`utils.ts:66-67`) | new P2 |
| 6 | EXPOSED-05 | ClassificationTable ×1 | id sort is `localeCompare` — `TKT-10000` sorts before `TKT-9999` ascending (`ClassificationTable.tsx:28`) | new P2 (breaks at 5-digit ids) |
| 7 | EXPOSED-06 | classify-offline ×1 | stale `error` closure in `handleClassify` → log gets fallback "API request failed" instead of the real network error (`LivePrediction.tsx:48`) | new P2 (honesty-adjacent: hides real error text in the log) |
| 8 | EXPOSED-07 | settings-reprobe ×1 | Reduced-motion toggle is an unnamed `<button aria-pressed>` — no accessible name/role (`SettingsDrawer.tsx:192-195`), WCAG 4.1.2 | new P2 a11y |
| 9 | EXPOSED-08 | settings-reprobe ×1 | `normalizeApiBase` never strips trailing slashes → `localhost:9999/` stored raw; probes build `localhost:9999//health` without protocol (`useSettings.ts:48-57`) | new P1 |
| 10 | MISSING FEATURE | keyboard-shortcuts ×2 | no command palette (Ctrl+K/Cmd+K) exists | no FIX assigned — **flagged to lead** |
| 11 | MISSING BEHAVIOR | settings-reprobe ×1 | no immediate re-probe on base-URL change (next scheduled check only) | assign to FIX-01 replacement owner |

## 4. GREEN highlights (verified-correct real behavior)

- **Honesty Contract holds at the data layer:** offline → status `offline` (not `cached`) until a
  cache exists; cached snapshot renders with amber "API Offline — Displaying cached data";
  predict failure returns `null`, no fabricated category/confidence anywhere (`useApi.test.tsx`,
  `classify-offline.test.tsx` green assertions); empty cache + failure → `[]`, never invented rows.
- **IDs:** monotonic counter, unique across 10 k adds, safe past 2^31, `seedTickets` max-scan works.
- **Backoff:** deterministic 30 s×1/4/8/10/10… schedule, capped 300 s, no probe before elapse.
- **CSV:** real 7-column format, RFC-4180 escaping incl. quotes+commas+CRLF, unicode, six exact
  categories; wired end-to-end from the Export CSV button (FIX-25 wiring exists).
- **Pagination:** FIX-28 verified — bounds, disabled states, `Showing A–B of N`, page walk.
- **Settings:** drawer a11y, host:port normalization on save, persistence, Test Connection probes
  the new base, reduced-motion toggles `<html data-reduced-motion>`, restore defaults.
- **Shortcuts:** `/` focuses search, `r` re-probes, `?` opens/Esc closes help, typing-guard works.

## 5. Coverage gaps that remain

1. **ECharts rendering** — mocked in jsdom (no canvas). The S6 `grid.containLabel` /
   `LegacyGridContainLabel` warning (`lib/echarts.ts` registers `GridComponent` but not the echarts-6
   legacy grid module) is code-confirmed but **not test-covered**; needs a browser smoke test or an
   echarts-options assertion harness.
2. **KpiCard stuck tooltip (S1)** — scroll-driven (element moves out from under cursor; no
   `mouseleave` fires). Not reproducible in jsdom; needs a layout/scroll harness. Code has
   `pointerEvents:'none'` + onMouseLeave (`KpiCard.tsx:177-179`) — looks correct for the hover case.
3. **SystemMonitor / charts' cached-badge rendering** — only covered indirectly via App flows.
4. **`npm run build` / `npm run lint` / `tsc --noEmit` on tests** — not runnable: the archive lacks
   `tsconfig.app.json`/`tsconfig.node.json` and `oxlint` config; vitest+esbuild transpile-verifies
   all suites, but strict type-checking of the test tree awaits the real repo configs.
5. **Auto-recovery → live transition** (offline→online flip) — the status store can't republish
   (FIX-01), so a flip test would be xf like the others; omitted as redundant.
6. **60 repaired PDF-truncated lines** — suites run against reconstructions (see README "Source
   caveats"); re-verify against the untruncated repo when available.
7. **One cosmetic React act() warning** from the App's async snapshot seeding after teardown
   (harmless; noted in README).

## 6. Note for agents A/B (v2 fixpack owners)

`fixpack-v2/src/` (another agent's tree) now contains `lib/backoff.ts`, `lib/paginate.ts`,
`lib/timeRange.ts`, `hooks/useTimeRange.ts`, `components/ProvenanceBadge.tsx` — i.e., the missing
modules are being created. When those replacements land: retarget `useApiBackoff` (inline →
`lib/backoff.ts` factory), keep `storeIdentity.test.tsx` as the FIX-01 acceptance gate, and flip
every `it.fails(FIX-01)` to a normal `it` — they should all pass.
