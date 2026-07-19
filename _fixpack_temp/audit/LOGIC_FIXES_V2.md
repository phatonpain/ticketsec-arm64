# LOGIC_FIXES_V2.md — W-03 SECOND PASS on the REAL source

**Source:** reconstructed from `/mnt/agents/upload/ticketsec-source.pdf` (53 files) into `/tmp/ticketsec-src/`.
Reconstruction sanity: line counts match the canonical numbers exactly — useApi.ts 329, useEventLog.ts 159, useSettings.ts 130, useSettingsDrawer.ts 40, useTicketQuery.ts 78, useTickets.ts 112, App.tsx 399. **Caveat honored:** 85 PDF-truncated lines (suffix `...`) were cataloged; every patch below avoids rewriting truncated lines except where explicitly flagged **[TRUNCATED line — verify tail before applying]**.

**Verdict tags:** **[CONFIRMED]** = root cause read in the real source at the cited file:line. **[VERIFIED CLEAN]** = checked, no defect. All patches are TS-strict, `no any`, tokens-only, and preserve the live/CACHED-amber/"Unavailable — API offline" Honesty Contract exactly.

---

# 0. HEADLINE — the real root cause of "many things don't work correctly"

Three of the six singleton stores return a **mutable wrapper object** from `getSnapshot`, and all their mutations are **in place** on that same object:

| Store | getSnapshot | Mutation style | Result |
|---|---|---|---|
| `src/hooks/useApi.ts:107-109` | returns `store` (const object) | in place (`store.status = …` :117-121, `store.checking = …` :175/:200, `store.diagnostics = …` :185-189, `store.loading/error = …` :222-226/:244/:247) | **STALE UI** |
| `src/hooks/useEventLog.ts:98-100` | returns `store` | in place wrapper (`store.logs = …` :89, `store.lastRead = …` :104) | **STALE UI** |
| `src/hooks/useTicketQuery.ts:24-26` | returns `store` | in place (`store.query = …` :31, `store.expanded = …` :43/:48) | **STALE UI** |
| `src/hooks/useTickets.ts:96-98` | returns `store.tickets` | array **replaced** (:51, :61) | works |
| `src/hooks/useSettings.ts:68-70` | returns `store.settings` | object **replaced** (:90, :97, :104) | works |
| `src/hooks/useSettingsDrawer.ts:22-24` | returns `store.open` (boolean) | primitive | works |

`useSyncExternalStore` detects changes by calling `getSnapshot()` on each emit and comparing with the previous snapshot via `Object.is`. A mutated-same-identity snapshot compares **equal**, so React **never schedules a re-render** for subscribers of useApi / useEventLog / useTicketQuery. Subscribers only refresh *incidentally* when something else re-renders them (e.g. App re-renders when useTickets seeds), reading whatever the mutated fields happen to hold at that moment.

User-visible consequences (each confirmed in code, and matching S1–S4):
1. Header status pill frozen at its mount-time value — store mounts with `checking: true` (useApi.ts:85) → "Checking…" (Header.tsx:69-70). After the snapshot fix, state is honest and bounded (see §1).
2. Event Log panel never renders entries added after mount — e.g. `addInfo('Cached ticket snapshot loaded')` (App.tsx:165) **is in the store** but not rendered. This precisely explains the evidence: panel shows 2 entries while the bell badge (same store, Header.tsx:341-361) shows **3**.
3. Sidebar ticket search is a controlled input bound to the stale store (Sidebar.tsx:184-201): typing mutates `store.query` but neither the input value, the table filter (ClassificationTable.tsx:91-93), the "filtered by" subtitle (:176), nor the Clear-filter button (:180-195) ever re-render → "search doesn't work".
4. LivePrediction's `loading`/`error` come from the stale useApi snapshot (LivePrediction.tsx:27): the Classify button's `disabled={loading …}` guard (:129) never engages (→ double-submit), the spinner never shows, and the error panel (:161-188) never appears → classification failures are **silent** (request times out after 15 s, nothing visible happens).
5. Bell badge "mark all read" (Header.tsx:62-67) mutates `lastRead` but the badge doesn't clear until an incidental re-render.

**Single minimal pattern fixes all three stores** — rebuild an immutable snapshot inside `emit()` (call sites unchanged). Diffs in §4 (N-01; useApi.ts one is **FOR INTEGRATION**).

---

# 1. FIX-01 premise verification against the REAL `src/hooks/useApi.ts`

Pass-1 FIX-L1 hypothesized: (a) no timeout on the probe fetch; (b) rejection path never settles. **Both are REFUTED by the real file:**

| Question | Real answer | Evidence |
|---|---|---|
| Does the real probe have a timeout? | **YES** — `HEALTH_TIMEOUT_MS = 10_000` | useApi.ts:69; enforced by `fetchWithTimeout` (AbortController + `window.setTimeout`, cleared in `finally`) at useApi.ts:126-135; every probe endpoint goes through it (:140) |
| Does the probe settle on failure? | **YES** — `probeSingleEndpoint` catches and returns `{ok:false}` (:146-152); `checkHealth` has try/catch/**finally** that always clears `checking` and `isProbing` and emits (:199-203) | useApi.ts:172-204 |
| Does the real file already have backoff? | **YES** — exponential: `BASE_RECOVERY_INTERVAL_MS = 30_000` → `MAX_RECOVERY_INTERVAL_MS = 300_000`, multiplier `2 ** consecutiveFailures` (failures capped at 6) | useApi.ts:74-75, :94, :183, :206-213. **No jitter** (P3 nit). |
| So where does the pill get stuck? | **Not in the probe.** The stuck state is the §0 snapshot-identity defect: after any probe transition, subscribers are not re-rendered; the pill keeps showing whatever it last rendered (mount-time `checking: true`, useApi.ts:85, rendered at Header.tsx:69-70) | useApi.ts:107-109 + in-place writers listed in §0 |

**Precise 3-line root cause for the orchestrator:**
1. The probe is healthy (10 s timeout, always settles, backoff 30 s→300 s) — pass-1's premise is wrong for this source.
2. The defect is `getSnapshot(): ApiStore { return store; }` (useApi.ts:107-109) returning a mutable singleton that is mutated in place; `useSyncExternalStore`'s `Object.is` snapshot check never sees a change, so `checking=false`/`status='cached'` never reach the Header.
3. Fix = rebuild an immutable snapshot on every `emit()` (N-01 diff), plus two honesty follow-ons the stale snapshot was masking: background probes must not flip the pill to "Checking…" for 10 s every cycle (N-05), and `predict()` failures must mark the API offline (N-03).

**Residual discrepancy (stated honestly):** with this exact source, an incidental App re-render (ticket-snapshot seed at ~10 s, App.tsx:161 via useTickets, which works) would also re-render the Header and un-stick the pill to "System Cached". The *permanently* stuck "Checking…" in S1–S4 (~13 min after load) is most consistent with the **deployed build being older than this archived source** (archive generated 16:17 vs screenshots 13:38) — i.e. the deployed build likely also had a non-settling probe, which this source already fixes. Either way, the N-01 snapshot fix is required in this source: without it, any *later* transition (e.g. API recovery at a random hour, when no incidental renders occur) leaves the pill lying indefinitely — an Honesty Contract violation in the real code. **[CONFIRMED for the snapshot defect; deployed-build probe-settle failure is INFERRED from the timestamp gap]**

Also verified for FIX-L2 (ECharts `containLabel`): **premise CONFIRMED in real code** — `grid: { …, containLabel: true }` at `ThreatBarChart.tsx:70` and `PerformanceLineChart.tsx:74`, while `src/lib/echarts.ts:12-22` registers no `LegacyGridContainLabel` → the S6 console warning. Patch (pass-1 Option B, verified equivalent in echarts@6.1.0):

```diff
--- a/src/components/ThreatBarChart.tsx
-   grid: { left: 12, right: 80, top: 12, bottom: 12, containLabel: true },
+   grid: { left: 12, right: 80, top: 12, bottom: 12, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
--- a/src/components/PerformanceLineChart.tsx
-    grid: { left: 12, right: 12, top: 36, bottom: 24, containLabel: true },
+    grid: { left: 12, right: 12, top: 36, bottom: 24, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
```

---

# 2. The 15-item checklist — verdict table

| # | Item | Verdict | file:line | Fix |
|---|---|---|---|---|
| B-1 | In-place sort mutation of store arrays | **VERIFIED CLEAN** | All 3 `.sort()` sites copy first: `useTickets.ts:51` (`store.tickets = [...tickets].sort(…)`), `ClassificationTable.tsx:22-23` (`const sorted = [...tickets]`), `ThreatBarChart.tsx:48` (`[...data].sort(…)`) | none |
| B-2 | getSnapshot identity (pass-1 feared infinite re-render; reality is the opposite — stale renders) | **CONFIRMED DEFECT ×3** | `useApi.ts:107-109`; `useEventLog.ts:98-100`; `useTicketQuery.ts:24-26`. CLEAN: `useTickets.ts:96-98`, `useSettings.ts:68-70`, `useSettingsDrawer.ts:22-24` | N-01 diffs (§4) |
| B-3 | Subscription leaks | **VERIFIED CLEAN** | every `subscribe` returns an unsubscribe: useApi.ts:102-105, useEventLog.ts:93-96, useTicketQuery.ts:19-22, useTickets.ts:91-94, useSettings.ts:63-66, useSettingsDrawer.ts:17-20; listeners removed: useApi.ts:310-313, Header.tsx:36-38/44/52-54, App.tsx:238-239, ECharts.tsx:25-29 | none |
| B-4 | Interval/timeout leaks | **VERIFIED CLEAN** | only 3 timer sites: abort timeout cleared in `finally` (useApi.ts:133); recovery timer cleared before reschedule (useApi.ts:207) and is an intentional app-lifetime singleton; one-shot focus timer (useTicketQuery.ts:50). **No `setInterval` anywhere** | none |
| B-5 | echarts.init in render / missing dispose | **VERIFIED CLEAN** | init inside effect with `dispose()` in cleanup, resize listener removed: `ECharts.tsx:14-31`; no caller passes `onChartReady` → `[onChartReady]` dep is stable → no re-init churn. (P2 hardening: `chart.hideTip()` before dispose — N-15) | N-15 (optional) |
| B-6 | Missing useEffect deps | **VERIFIED CLEAN** | deps complete: App.tsx:175/:187/:240, ThreatBarChart.tsx:45, PerformanceLineChart.tsx:43/:47, EventLog-useEventLog.ts:132, SettingsDrawer.tsx:22, ClassificationTable.tsx:79. `ECharts.tsx:30` omits `option` deliberately with an `eslint-disable` and a compensating update effect at :33-35 | none |
| B-7 | Health-probe vs user-action race | **CONFIRMED DEFECT** | asymmetric: `predict()` success calls `updateStatus(true)` (useApi.ts:240) but failure only sets `store.error` (:242-245) — a dead API stays "System Online" after a failed classify; and `if (isProbing) return;` (:173) makes a manual refresh click during a background probe a **silent no-op** (Header.tsx:56-60 flashes the spinner, probes nothing). Also a slow probe result can overwrite a fresher `predict()` success (no sequencing) | N-03, N-04 diffs (**FOR INTEGRATION**) |
| B-8 | Memoization gaps (EventLog appends re-render charts) | **VERIFIED CLEAN** | chart options memoized: ThreatBarChart.tsx:51-121, PerformanceLineChart.tsx:49-136, ModelHealthDonut.tsx:25-113; `setOption` only in `[option]` effect (ECharts.tsx:33-35); no chart consumes `useEventLog` | none |
| B-9 | Pagination clamp after filtering | **VERIFIED CLEAN** | `currentPage = Math.min(page, pageCount)` (ClassificationTable.tsx:99); reset on filter/data change (:77-79); slice after sort (:95-100); empty state guarded (:250-255, footer hidden when 0 rows :329). P2 nit: a new classification resets the user to page 1 mid-browse (:77-79 dep on `tickets.length`) | optional: reset only on `query` change |
| B-10 | Sort tie-breaks / stability | **VERIFIED CLEAN (note)** | comparator (ClassificationTable.tsx:21-44) has no tie-break, but `Array.prototype.sort` is stable (ES2019+) and the input order is deterministic (store order, `useTickets.ts:51`) → deterministic output. Belt-and-braces: append `|| a.id.localeCompare(b.id)` before `return` (applies to :41) | optional one-liner |
| B-11 | Classify double-submit | **CONFIRMED DEFECT** | `disabled={loading \|\| !text.trim()}` (LivePrediction.tsx:129) binds to the **stale-store** `loading` (:27) → never disables; no local in-flight guard in `handleClassify` (:29-50); example chips are a second unguarded submit vector (:106-124, `onClick` at :109). Two rapid clicks → two concurrent POSTs → duplicate tickets on success | N-07 diff |
| B-12 | Unicode/regex input handling | **VERIFIED CLEAN (regex) / P2 nit (unicode)** | no dynamic `RegExp` anywhere; search is `String.includes` on `toLowerCase()` (ClassificationTable.tsx:46-56); query is `trimStart`ed (useTicketQuery.ts:29). Nits: no `.normalize('NFC')` (accented subjects can be missed), no length cap on the LivePrediction textarea | optional hardening in N-07 diff notes |
| B-13 | CSV formula injection | **CONFIRMED DEFECT** | `escapeCsvCell` quotes `,"`\n`\r` but does not neutralize leading `= + - @` (exportCsv.ts:3-9); a subject like `=HYPERLINK("http://evil","x")` executes on open in Excel/Sheets — embarrassing for a security product | N-16 diff |
| B-14 | Relative-time ticker leaks | **VERIFIED CLEAN (inverse defect found)** | no ticker exists at all → nothing leaks; but "Xm ago" cells (ClassificationTable.tsx:~321 **[TRUNCATED]**, Header.tsx:195/:200/:417) freeze at last render. P2: add one shared 30 s `useNow` ticker | N-19 (housekeeping pack) |
| B-15 | Unbounded EventLog growth | **VERIFIED CLEAN** | ring cap exists: `store.logs = [entry, ...store.logs].slice(0, maxEntries)` (useEventLog.ts:89). P2 nit: cap differs per consumer — `useEventLog(50)` (App.tsx:116, Header.tsx:12) vs `useEventLog(100)` (EventLog.tsx:20); the effective cap depends on *who logs* | N-19 (housekeeping pack) |

---

# 3. Pass-1 claims — verified against the real code

| # | Pass-1 claim | Verdict | Real location |
|---|---|---|---|
| C-1 | Severity dots use undefined `--sev-*` | **CONFIRMED** | `src/lib/utils.ts:48-53` (`SEVERITY_COLORS` → `var(--sev-critical/high/medium/info)`); tokens.css:59-63 defines **only** `--color-sev-*`. Consumer: `ClassificationTable.tsx:293` (dot `backgroundColor`) → dots render **transparent/invisible**. Fix: N-06 |
| C-2 | Category badges use undefined `--cat-*` | **CONFIRMED** | `src/lib/utils.ts:11-18` (`CATEGORY_COLORS` → `var(--cat-1..6)`); tokens.css:51-56 defines **only** `--color-cat-1..6`. Consumers: `ClassificationTable.tsx:259/280/286` (badge text + dot), `LivePrediction.tsx:53/204/207/230` (result badge, dot, **and the confidence bar fill** — the bar is invisible even on a successful classify). `CATEGORY_BG` (utils.ts:20-27) is raw rgba and *does* render, which is why badges look washed-out instead of absent. Fix: N-06 |
| C-3 | SEVERITY/CONFIDENCE header overlap | **CONFIRMED** | `ClassificationTable.tsx:242` — Severity `width={70}` with `thBaseStyle` `padding: '6px 12px'` + `boxSizing: 'border-box'` (:102-113) leaves **46 px** of content width for the uppercase 11 px "SEVERITY" label (~60 px) + sort arrow (:150-153); `whiteSpace: 'nowrap'` (:110) and no `overflow: hidden` on `th` → the label spills into the Confidence column (:243). Fix: N-08 |
| C-4 | Bell badge "3" source | **CORRECTED (not hard-coded)** | `Header.tsx:341-361` renders `unreadCount` from `useEventLog` (`useEventLog.ts:109-111`, counts entries newer than `lastRead`). It is **not** a constant. Store holds 3 entries — 2 initial (`useEventLog.ts:68-74`) + `Cached ticket snapshot loaded` (App.tsx:165) — while the stale EventLog panel renders only the 2 mount-time ones (§0). Badge "3" vs 2 visible entries = the stale-snapshot defect, not a counting bug. No separate fix beyond N-01 |
| C-5 | Stuck tooltip overlapping the header (KpiCard) | **CONFIRMED (mechanism refined)** | `KpiCard.tsx:245-270`: tooltip renders **above** the card (`bottom: 'calc(100% + 8px)'`, :251) — the top KPI row's tooltip therefore always overlaps the page-title/sticky-header zone. Visibility is toggled **only** by `onMouseEnter`/`onMouseLeave` on the card (:175-176 **[TRUNCATED tail — assumed `setShowTooltip(false);`]**); if layout shifts under a stationary pointer (window scroll/resize, content reflow from a lazy chart resolving) the pointer leaves the card bounds without a `mouseleave` event → tooltip stuck open. It is not an ECharts tooltip (the two `z-index:9999999` nodes in dom.html are normal *hidden* ECharts tooltip divs). Fix: N-09 |
| C-6 | Dead `href="#"` ticket links | **CONFIRMED** | `ClassificationTable.tsx:270` — `<a href="#">` with no handler; clicking navigates to `#` and scrolls the dashboard to top. No ticket-detail route exists anywhere in the source. Fix: N-10 |
| C-7 | EventLog chips missing `aria-pressed` | **CONFIRMED** | `EventLog.tsx:66-86` — filter buttons expose active state only via background color (:79). Only `SettingsDrawer.tsx:198` uses `aria-pressed` in the whole app. Fix: N-11 |
| C-8 | `outline: none` focus killers ×3 | **CONFIRMED — actual count is 4** | `Header.tsx:152` (status pill, also `tabIndex=0`), `LivePrediction.tsx:99` (textarea), `Sidebar.tsx:199` (search input), `SettingsDrawer.tsx:128` (API URL input). Inline `outline: 'none'` **overrides** the global `:focus-visible` ring (tokens.css:175-178) → WCAG 2.4.7 failure on all four. Fix: N-12 |
| C-9 | CACHED badge on unavailable SystemMonitor | **CONFIRMED** | `SystemMonitor.tsx:89-101` renders `CACHED` (:100) while every tile shows `—` + "Unavailable — API offline" (:105-136). There is no cached system-metrics source (no snapshot for CPU/mem), so "CACHED" asserts cached data that does not exist — the badge should read OFFLINE. Tiles' "Unavailable — API offline" copy is honest and stays. Fix: N-13 |
| C-10 | Donut center label overlap | **CONFIRMED** | `ModelHealthDonut.tsx`: pie `center: ['34%', '50%']` (:63) but graphic texts anchored at `left: '25%'` (:89) and `left: '26%'` (:102) → "8.73MB"/"Optimized" are shifted ~9% left of the donut center and strike the ring. Fix: N-14 |
| C-11 | Footer "API Docs" href in Footer.tsx | **CORRECTED** | `src/components/Footer.tsx` is **dead code** — never imported (App renders an inline footer at `App.tsx:371-386`). The live link is `App.tsx:384` **[TRUNCATED tail]**, hard-coding `http://3.23.60.61:8000/docs` instead of the configured `getApiBase()` (useSettings.ts:83-85): changing the endpoint in Settings leaves the footer pointing at the old host. Fix: N-15 (+ delete dead Footer.tsx) |

---

# 4. NEW defects found in the real source (numbered N-01…)

## N-01 [P0] — Mutable-snapshot stores → app-wide stale UI  *(root cause; patches)*
**Evidence:** §0 table. **Root cause [CONFIRMED]:** `getSnapshot` returns the mutable module singleton while all writers mutate in place.

**Patch — `src/hooks/useApi.ts` (FOR INTEGRATION — agent B owns this file):**
```diff
 const store: ApiStore = {
   status: 'offline',
   checking: true,
   loading: false,
   error: null,
   lastSync: null,
   diagnostics: { lastProbe: null, lastError: null, endpoints: [] },
   listeners: new Set(),
 };
 
+/**
+ * Immutable mirror of the public store state, rebuilt on every emit().
+ * useSyncExternalStore compares snapshots with Object.is; returning the
+ * mutable `store` object itself meant UI updates were NEVER scheduled
+ * (stuck "Checking…" pill, stale CACHED/LIVE badges).
+ */
+let snapshot: ApiStoreState = {
+  status: store.status,
+  checking: store.checking,
+  loading: store.loading,
+  error: store.error,
+  lastSync: store.lastSync,
+  diagnostics: store.diagnostics,
+};
+
 function emit() {
+  snapshot = {
+    status: store.status,
+    checking: store.checking,
+    loading: store.loading,
+    error: store.error,
+    lastSync: store.lastSync,
+    diagnostics: store.diagnostics,
+  };
   store.listeners.forEach(listener => listener());
 }
 
 function subscribe(listener: () => void) {
   store.listeners.add(listener);
   return () => store.listeners.delete(listener);
 }
 
-function getSnapshot(): ApiStore {
-  return store;
+function getSnapshot(): ApiStoreState {
+  return snapshot;
 }
```
(Hook body unchanged — `useSyncExternalStore(subscribe, getSnapshot)` now returns `ApiStoreState`; every field the hook reads exists on it, so useApi.ts:316-328 compiles as-is. Re-render cadence stays bounded by emit cadence: probes every 30–300 s, user actions.)

**Patch — `src/hooks/useEventLog.ts`:**
```diff
 const store: EventLogStore = {
   logs: [],
   lastRead: readLastRead(),
   listeners: new Set(),
   initialized: false,
 };
 
+/** Immutable snapshot mirror — see useApi.ts note. Fixes stale Event Log panel. */
+let snapshot: EventLogStore = { ...store };
+
 function emit() {
+  snapshot = { ...store };
   store.listeners.forEach(listener => listener());
 }
```
```diff
-function getSnapshot(): EventLogStore {
-  return store;
+function getSnapshot(): EventLogStore {
+  return snapshot;
 }
```
(`{ ...store }` copies the `logs` array *reference*, which is already replaced immutably at :89 — correct and cheap.)

**Patch — `src/hooks/useTicketQuery.ts`:**
```diff
 const store: TicketQueryStore = {
   query: '',
   expanded: false,
   listeners: new Set(),
 };
 
+/** Immutable snapshot mirror — fixes dead ticket search. */
+let snapshot: TicketQueryStore = { ...store };
+
 function emit() {
+  snapshot = { ...store };
   store.listeners.forEach(listener => listener());
 }
```
```diff
-function getSnapshot(): TicketQueryStore {
-  return store;
+function getSnapshot(): TicketQueryStore {
+  return snapshot;
 }
```
**Acceptance (10 s each):** 1) pill flips "Checking…" → "System Cached" ≤ 10 s after load with the API down, no other interaction needed; 2) Event Log shows "Cached ticket snapshot loaded" without a page reload; 3) typing in the sidebar search filters the table live and shows the Clear-filter button; 4) bell badge clears the moment Notifications opens.

## N-02 [P0] — ThreatBarChart renders fabricated fallback numbers under a CACHED badge
**Evidence:** S1 shows populated bars while the API is offline. **Root cause [CONFIRMED]:** hard-coded `FALLBACK` counts (ThreatBarChart.tsx:7-14) used as initial state (:34); when `getStats()` fails it returns `[]` and `setData` is never called (:36-45), so the fake counts stay on screen — labeled "CACHED" (:137-141) although they come from **no cache anywhere** (the only snapshot, public/cache/tickets-snapshot.json, holds 6 tickets and no category counts). This is precisely the "fabricated data" the Honesty Contract forbids; it also visually contradicts the honest empty PerformanceLineChart next to it (S2).

**Patch — `src/components/ThreatBarChart.tsx`** (honest fallback: derive counts from the real cached ticket snapshot already loaded into the tickets store; honest empty state mirroring PerformanceLineChart when there is nothing):
```diff
 import React, { useEffect, useMemo, useState } from 'react';
 import { ECharts } from './ECharts';
 import type { EChartsCoreOption } from '../lib/echarts';
 import { useApi, type CategoryStats } from '../hooks/useApi';
+import { useTickets } from '../hooks/useTickets';
 import { categoryChartColors, chartColors } from '../lib/chartTokens';
 
-const FALLBACK: CategoryStats[] = [
-   { category: 'False Positive', count: 156 },
-   { category: 'DDoS', count: 412 },
-   { category: 'Data Breach', count: 634 },
-   { category: 'Unauthorized Access', count: 982 },
-   { category: 'Malware', count: 1245 },
-   { category: 'Phishing', count: 1847 },
-];
-
```
```diff
 export const ThreatBarChart: React.FC = () => {
  const { status, getStats, lastSync } = useApi();
- const [data, setData] = useState<CategoryStats[]>(FALLBACK);
+ const { tickets } = useTickets();
+ const [liveData, setLiveData] = useState<CategoryStats[]>([]);
 
  useEffect(() => {
    let mounted = true;
    getStats().then(res => {
      if (!mounted) return;
      if (res && res.length > 0) {
-       setData(res);
+       setLiveData(res);
      }
    });
    return () => { mounted = false; };
  }, [getStats]);
+
+ // Honesty Contract: live stats when reachable; otherwise counts derived
+ // from the REAL cached ticket snapshot (never fabricated constants).
+ const data = useMemo<CategoryStats[]>(() => {
+   if (liveData.length > 0) return liveData;
+   const counts = new Map<string, number>();
+   for (const t of tickets) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
+   return Array.from(counts, ([category, count]) => ({ category, count }));
+ }, [liveData, tickets]);
```
and in the render, add the honest empty state (lines 143-145 are not truncated):
```diff
   <div className="px-5 pb-3 flex-1">
-   <ECharts option={option} style={{ width: '100%', height: '320px' }} />
+   {sortedData.length === 0 ? (
+     <div style={{ height: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
+       <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Unavailable — API offline</span>
+       <span style={{ fontSize: 11 }}>Category distribution will appear once the API or a cached snapshot provides real data.</span>
+     </div>
+   ) : (
+     <ECharts option={option} style={{ width: '100%', height: '320px' }} />
+   )}
   </div>
```
(`maxValue` at :54 already guards the empty case via `Math.max(...values, 1)`.) **Acceptance:** with the API down and the 6-ticket snapshot loaded, the bar chart shows exactly 6 bars' worth of counts summing to 6 (Phishing 1, Malware 1, Unauthorized Access 1, + the remaining snapshot rows), CACHED badge still amber; clear the snapshot and it shows "Unavailable — API offline" instead of invented thousands.

## N-03 [P0] — `predict()` failure never marks the API offline (Honesty Contract risk) — **FOR INTEGRATION (useApi.ts)**
**Root cause [CONFIRMED]:** success path calls `updateStatus(true)` (useApi.ts:240) but the catch only sets `store.error` (:242-245). After one successful classify, a later failure leaves `status: 'live'` — the pill can claim "System Online" while every request fails, for up to one full backoff cycle (≤ 5 min).
```diff
     } catch (err) {
       const message = err instanceof Error ? err.message : 'Unknown error';
       store.error = message;
+      // User-action evidence: a failed inference contradicts 'live'.
+      // Routes through the single status writer; settles as 'cached' when
+      // any cache exists (updateStatus already implements that rule).
+      updateStatus(false);
       return null;
     } finally {
```
**Acceptance:** with the API up, classify once (pill Online); kill the API; classify again → pill flips to Cached/Offline within the 15 s predict timeout instead of staying Online.

## N-04 [P1] — Manual refresh is a silent no-op during a background probe — **FOR INTEGRATION (useApi.ts)**
**Root cause [CONFIRMED]:** `checkHealth` early-returns when `isProbing` (useApi.ts:173). `Header.handleRefresh` (Header.tsx:56-60) then resolves instantly: spinner flashes, **no probe runs**, and (after N-01) the 'r' shortcut's "Manual refresh triggered" log entry (App.tsx:230) lies.
```diff
 let isProbing = false;
+let rerunAfterProbe = false;
 let consecutiveFailures = 0;
```
```diff
 export async function checkHealth(): Promise<void> {
- if (isProbing) return;
+ if (isProbing) {
+   rerunAfterProbe = true; // queue one follow-up instead of dropping the request
+   return;
+ }
```
```diff
     } finally {
       store.checking = false;
       isProbing = false;
       emit();
+      if (rerunAfterProbe) {
+        rerunAfterProbe = false;
+        void checkHealth();
+      }
     }
```
**Acceptance:** click Refresh repeatedly during a probe window — every click eventually produces a fresh diagnostics tooltip timestamp; none are dropped.

## N-05 [P1] — Post-fix regression: pill would flap "Checking…" for 10 s every 30–300 s — **FOR INTEGRATION (useApi.ts)**
**Root cause [CONFIRMED]:** `checkHealth` sets `store.checking = true` (useApi.ts:175) for *every* probe, including scheduled background ones. Today the stale snapshot hides this; after N-01 lands, the pill will visibly flap "Checking…" for up to `HEALTH_TIMEOUT_MS` (10 s, useApi.ts:69) every recovery cycle — looking exactly like the S1 bug. Ship with N-01.
```diff
-export async function checkHealth(): Promise<void> {
+export async function checkHealth(options: { background?: boolean } = {}): Promise<void> {
  if (isProbing) {
    rerunAfterProbe = true;
    return;
  }
  isProbing = true;
- store.checking = true;
- emit();
+ if (!options.background) {
+   store.checking = true; // 'Checking…' is reserved for user-initiated / first-run probes
+   emit();
+ }
```
```diff
  recoveryTimer = window.setTimeout(() => {
-   void checkHealth().then(scheduleNextProbe);
+   void checkHealth({ background: true }).then(scheduleNextProbe);
  }, delay);
```
```diff
      const onVisible = () => {
       if (!document.hidden) {
-        void checkHealth();
+        void checkHealth({ background: true });
       }
      };
      const onFocus = () => {
-       void checkHealth();
+       void checkHealth({ background: true });
      };
```
(Header refresh + App 'r' shortcut call `checkHealth()` with no args → foreground, pill shows "Checking…" only for real user intent and the initial mount.) **Acceptance:** leave the dashboard open 5 min with the API down — the pill stays "System Cached" without flickering; clicking Refresh shows "Checking…" once, then settles.

## N-06 [P1] — All category badges / severity dots / the classify-confidence bar are colorless (undefined tokens)
**Root cause [CONFIRMED]:** utils.ts references `--cat-*`/`--sev-*`; tokens.css defines only `--color-cat-*`/`--color-sev-*` (grep-verified: zero definitions of the short names; zero usages of the long names). Unresolved `var()` makes `background-color`/`color` invalid at computed-value time → severity dots transparent (ClassificationTable.tsx:293), badge text falls back to inherited color (:280,:286, LivePrediction.tsx:204), confidence bar fill transparent (LivePrediction.tsx:230). This is the single biggest "still looks generic" visual defect.
**Patch — `src/lib/utils.ts`:**
```diff
 export const CATEGORY_COLORS: Record<string, string> = {
-  Phishing: 'var(--cat-1)',
-  Malware: 'var(--cat-2)',
-  'Data Breach': 'var(--cat-3)',
-  'Unauthorized Access': 'var(--cat-4)',
-  DDoS: 'var(--cat-5)',
-  'False Positive': 'var(--cat-6)',
+  Phishing: 'var(--color-cat-1)',
+  Malware: 'var(--color-cat-2)',
+  'Data Breach': 'var(--color-cat-3)',
+  'Unauthorized Access': 'var(--color-cat-4)',
+  DDoS: 'var(--color-cat-5)',
+  'False Positive': 'var(--color-cat-6)',
 };
```
```diff
 export const SEVERITY_COLORS: Record<string, string> = {
-  critical: 'var(--sev-critical)',
-  high: 'var(--sev-high)',
-  medium: 'var(--sev-medium)',
-  info: 'var(--sev-info)',
+  critical: 'var(--color-sev-critical)',
+  high: 'var(--color-sev-high)',
+  medium: 'var(--color-sev-medium)',
+  info: 'var(--color-sev-info)',
 };
```
Also fix the now-wrong comment in `src/lib/chartTokens.ts:18` (`Mirrors --color-cat-1..6 / --cat-1..6` → `Mirrors --color-cat-1..6`) and :27. **Acceptance:** severity dots show red/orange/yellow/blue; the Phishing badge text is indigo; a successful classify shows a filled confidence bar.

## N-07 [P1] — Classify has no working in-flight guard (double-submit) and fails silently
**Root cause [CONFIRMED]:** LivePrediction.tsx:129 `disabled={loading || !text.trim()}` reads `loading` from the stale snapshot (:27) — N-01 makes it accurate, but a local guard is still required because two clicks in the same frame both pass before any store update can render. Chips at :106-124 call `handleClassify(ex)` directly (:109) with no guard at all.
**Patch — `src/components/LivePrediction.tsx`:**
```diff
 export const LivePrediction: React.FC<LivePredictionProps> = ({ onClassify, onError, onSubmit }) => {
  const [text, setText] = useState('');
  const [result, setResult] = useState<EnrichedResult | null>(null);
  const [processingTime, setProcessingTime] = useState<string | null>(null);
+ const [pending, setPending] = useState(false);
  const { predict, loading, error } = useApi();
 
  const handleClassify = async (inputText?: string) => {
    const ticket = inputText ?? text;
-   if (!ticket.trim()) return;
+   if (!ticket.trim() || pending) return;
+   setPending(true);
    onSubmit?.(ticket);
    setResult(null);
    setProcessingTime(null);
    const start = performance.now();
-   const res = await predict(ticket);
-   const elapsed = (performance.now() - start).toFixed(2);
-   if (res) {
-     const enriched = {
-       ...res,
-       category: res.predicted_category,
-       processing_time_ms: elapsed,
-     };
-     setResult(enriched);
-     setProcessingTime(`${elapsed}ms`);
-     onClassify?.(enriched, ticket);
-   } else {
-     onError?.(ticket, error ?? 'API request failed');
+   try {
+     const res = await predict(ticket);
+     const elapsed = (performance.now() - start).toFixed(2);
+     if (res) {
+       const enriched = {
+         ...res,
+         category: res.predicted_category,
+         processing_time_ms: elapsed,
+       };
+       setResult(enriched);
+       setProcessingTime(`${elapsed}ms`);
+       onClassify?.(enriched, ticket);
+     } else {
+       onError?.(ticket, error ?? 'API request failed');
+     }
+   } finally {
+     setPending(false);
    }
  };
```
```diff
-      <button
-        key={ex}
-        onClick={() => { setText(ex); handleClassify(ex); }}
+      <button
+        key={ex}
+        disabled={pending}
+        onClick={() => { setText(ex); handleClassify(ex); }}
```
```diff
   <button
    onClick={() => handleClassify()}
-   disabled={loading || !text.trim()}
+   disabled={loading || pending || !text.trim()}
```
(Notes, not in the diff: once N-01 lands, `loading`/`error` become live and the error panel at :161-188 works; optional honesty upgrade — also destructure `status` from useApi and add `title={status !== 'live' ? 'Unavailable — API offline' : undefined}` plus `status !== 'live'` to the disabled expression, so the button refuses input it cannot serve instead of failing after 15 s.) **Acceptance:** double-click Classify → exactly one new ticket row and one "Inference OK" log entry; click an example chip mid-request → ignored.

## N-08 [P1] — SEVERITY/CONFIDENCE table header overlap
**Root cause [CONFIRMED]:** C-3 above (70 px column, 46 px content box, ~70 px label).
**Patch — `src/components/ClassificationTable.tsx`:**
```diff
-      <SortableHeader label="Severity" colKey="severity" width={70} />
+      <SortableHeader label="Severity" colKey="severity" width={96} />
```
```diff
-           <td style={{ ...tdStyle, width: 70 }}>
+           <td style={{ ...tdStyle, width: 96 }}>
```
**Acceptance:** S3 retaken — "SEVERITY" and its sort arrow no longer touch "CONFIDENCE" at any viewport ≥ 1280 px.

## N-09 [P2] — KPI tooltip can stick over the header zone
**Root cause [CONFIRMED code / INFERRED trigger]:** KpiCard.tsx:175-176 toggle only on enter/leave; tooltip above card (:251). **[Line 176 TRUNCATED — assumed `setShowTooltip(false);` — verify tail before applying.]** A layout shift under a stationary pointer strands it open.
**Patch — `src/components/KpiCard.tsx`** (robust: also close on scroll/resize, cheap global listener only while open):
```diff
 export const KpiCard: React.FC<KpiCardProps> = ({ … }) => {
   const [showTooltip, setShowTooltip] = useState(false);
   const tooltipId = useId();
   const hasTooltip = Boolean(tooltip);
+
+  React.useEffect(() => {
+    if (!showTooltip) return undefined;
+    const close = () => setShowTooltip(false);
+    window.addEventListener('scroll', close, { passive: true, capture: true });
+    window.addEventListener('resize', close);
+    return () => {
+      window.removeEventListener('scroll', close, { capture: true } as EventListenerOptions);
+      window.removeEventListener('resize', close);
+    };
+  }, [showTooltip]);
```
(`import React, { useId, useState } from 'react';` already imports React at :1.) **Acceptance:** hover a KPI card, scroll the dashboard with the wheel — the tooltip closes instead of lingering over the header.

## N-10 [P1] — Dead `href="#"` ticket links
**Root cause [CONFIRMED]:** ClassificationTable.tsx:270.
**Patch — `src/components/ClassificationTable.tsx`:**
```diff
-             <a href="#" className="font-mono text-xs text-accent-indigo hover:underline">{row.id}</a>
+             <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{row.id}</span>
```
(No ticket-detail view exists; a fake affordance that scrolls to top is broken functionality. IDs stay copyable mono text — honest.) **Acceptance:** clicking a ticket ID no longer scrolls the page; no console navigation.

## N-11 [P2] — EventLog filter chips missing `aria-pressed`
**Root cause [CONFIRMED]:** EventLog.tsx:66-86.
**Patch — `src/components/EventLog.tsx`:**
```diff
         <button
           key={f.key}
           type="button"
+          aria-pressed={active}
           onClick={() => setFilter(f.key)}
```
**Acceptance:** screen reader announces "Info, toggle button, pressed".

## N-12 [P1] — Four `outline: 'none'` focus killers (WCAG 2.4.7)
**Root cause [CONFIRMED]:** inline style overrides the global `:focus-visible` ring (tokens.css:175-178).
**Patch — delete the inline property at all four sites:**
```diff
--- a/src/components/Header.tsx (:152, inside the status-pill style)
-      outline: 'none',
--- a/src/components/LivePrediction.tsx (:99, textarea style)
-      outline: 'none',
--- a/src/components/Sidebar.tsx (:199, search input style)
-              outline: 'none',
--- a/src/components/SettingsDrawer.tsx (:128, API URL input style)
-        outline: 'none',
```
(Removing the inline `outline` restores the token-styled `:focus-visible` ring; nothing else changes visually in the unfocused state.) **Acceptance:** Tab through the header pill, sidebar search, settings URL field and the classify textarea — each shows the 2 px indigo ring.

## N-13 [P2] — SystemMonitor badge claims CACHED data that doesn't exist
**Root cause [CONFIRMED]:** SystemMonitor.tsx:100 + fallback caption :60-64.
**Patch — `src/components/SystemMonitor.tsx`:**
```diff
-        {offline ? 'CACHED' : 'LIVE'}
+        {offline ? 'OFFLINE' : 'LIVE'}
```
```diff
  const caption = lastSync && offline
   ? `Snapshot: cached · ${lastSync.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
   : lastSync
   ? `Last refreshed: ${lastSync.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
-  : 'Snapshot: cached';
+  : 'Unavailable — API offline';
```
(There is no system-metrics cache; the tiles already say "Unavailable — API offline" — now the badge and caption agree with them. Amber styling is kept for the offline badge: honest, alarming, not hidden.) **Acceptance:** with the API down, the System Monitor header reads OFFLINE and no caption claims a snapshot exists.

## N-14 [P2] — Donut center labels strike the ring
**Root cause [CONFIRMED]:** graphic anchors (25%/26%) ≠ pie center (34%), ModelHealthDonut.tsx:86-112 vs :62-63.
**Patch — `src/components/ModelHealthDonut.tsx`:**
```diff
      {
        type: 'text',
-       left: '25%',
-       top: '46%',
+       left: '34%',
+       top: '44%',
        style: {
          text: '8.73MB',
          textAlign: 'center',
+         textVerticalAlign: 'middle',
          fill: chartColors.textPrimary,
          fontSize: 20,
          fontWeight: 600,
          fontFamily: 'JetBrains Mono',
        },
      },
      {
        type: 'text',
-       left: '26%',
-       top: '56%',
+       left: '34%',
+       top: '58%',
        style: {
          text: 'Optimized',
          textAlign: 'center',
+         textVerticalAlign: 'middle',
          fill: chartColors.textMuted,
          fontSize: 11,
          fontFamily: 'Inter',
        },
      },
```
**Acceptance:** "8.73MB" is optically centered in the donut hole at any panel width; the ring is untouched by text.

## N-15 [P2] — Footer link ignores the configured API base; Footer.tsx is dead code; ECharts hideTip
**Root cause [CONFIRMED]:** live footer inline at App.tsx:383-386; link at :384 hard-codes `http://3.23.60.61:8000/docs` **[TRUNCATED tail — the className/style tail is cut; the href itself is fully visible]**. `Footer.tsx` never imported. Two hidden ECharts tooltip divs observed in dom.html.
**Patch — `src/App.tsx`** (use the settings store the app already has):
```diff
+import { getApiBase } from './hooks/useSettings';
 …
-     <a href="http://3.23.60.61:8000/docs" style={{ color: 'var(--accent-indigo)', textDecoration: 'none' }}>API Docs</a…
+     <a href={`${getApiBase()}/docs`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-indigo)', textDecoration: 'none' }}>API Docs</a>
```
**Patch — delete `src/components/Footer.tsx`** (dead file; keeps the audit surface honest).
**Patch — `src/components/ECharts.tsx`** (P2 hardening so no tooltip node can outlive its chart):
```diff
    return () => {
      window.removeEventListener('resize', handleResize);
+     chart.hideTip();
      chart.dispose();
      chartRef.current = null;
    };
```
**Acceptance:** change the API base in Settings → footer "API Docs" points at the new host's /docs; unmounting a chart (route change/lazy fallback swap) leaves no tooltip node in DevTools.

## N-16 [P0] — CSV formula injection in Export CSV
**Root cause [CONFIRMED]:** exportCsv.ts:3-9 (B-13).
**Patch — `src/lib/exportCsv.ts`:**
```diff
 function escapeCsvCell(value: string | number): string {
-  const str = String(value);
+  let str = String(value);
+  // Spreadsheet formula injection guard: Excel/Sheets/LibreOffice execute
+  // cells whose first character is = + - @ (tab/CR can smuggle formulas too).
+  // Prefixing with ' makes the cell inert text — mandatory for a security tool.
+  if (/^[=+\-@\t\r]/.test(str)) {
+    str = `'${str}`;
+  }
   if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
     return `"${str.replace(/"/g, '""')}"`;
   }
   return str;
 }
```
**Acceptance:** classify a ticket whose subject is `=HYPERLINK("http://evil.example","click")`; export CSV; the cell opens as inert text prefixed with `'`.

## N-17 [P1] — Time-range dropdown is a dead control
**Root cause [CONFIRMED]:** `selectedTime` (Header.tsx:15) is written (:306-307) but never read by any chart, table, or store; `TIME_OPTIONS` (:8) is decorative. The control is fully keyboard-accessible — and does nothing.
**Patch — `src/components/Header.tsx`** (honest removal; wiring real range filtering is a larger feature, out of fixpack scope):
```diff
-const TIME_OPTIONS = ['Last 1 hour', 'Last 6 hours', 'Last 24 hours', 'Last 7 days'];
 …
- const [dropdownOpen, setDropdownOpen] = useState(false);
- const [selectedTime, setSelectedTime] = useState('Last 24 hours');
```
…and delete the entire `{/* Time Range Dropdown */}` block (:261-323) plus the now-unused `dropdownRef` (:20) and its branch in `handleClickOutside` (:26-28). **[Truncated lines 307/316 fall inside the deleted block — safe.]** **Acceptance:** header no longer offers a control that cannot do anything; no dead state remains (`grep selectedTime src/` → 0 hits).

## N-18 [P2] — Misleading "Cached …" log copy when data is live
**Root cause [CONFIRMED]:** App.tsx:169-171 — the branch runs only when `hasLivePerformance || classifications.length > 0`, i.e. when LIVE endpoints answered, but logs "Cached performance and classification data loaded".
**Patch — `src/App.tsx`:**
```diff
   if (hasLivePerformance || classifications.length > 0) {
-    addInfo('Cached performance and classification data loaded');
+    addInfo('Live performance and classification data loaded');
   }
```
**Acceptance:** with the API up, the Event Log says "Live …"; with it down, only "Cached ticket snapshot loaded" appears.

## N-19 [P2] — Housekeeping pack (all CONFIRMED in source)
- **Duplicate DOM id** `model-health`: App.tsx:342 **and** ModelHealthDonut.tsx:123 **[line TRUNCATED — prefix `<div id="model-health"` fully visible]**. Remove the one in ModelHealthDonut.tsx (keep App's, which `Sidebar.scrollTo('model-health')` targets).
- **Missing TS project files:** tsconfig.json references `./tsconfig.app.json` and `./tsconfig.node.json` (tsconfig.json:4-5) but **neither is in the 53-file archive** → `npm run build` (`tsc -b && vite build`, package.json:8) fails out of the box. **[Verify against the real zip — if truly absent, this is P0.]** Standard Vite react-ts templates suffice (strict: true; no any).
- **Dead/unused:** `echarts-for-react` dependency (package.json:17, zero imports — app uses its own ECharts.tsx); `generateTicketId` (utils.ts:70-75, zero call sites, random/collision-prone); `useEventLog`'s `bottomRef` + scroll effect (useEventLog.ts:117/:128-132 — never attached by any component; EventLog uses its own `scrollRef`, EventLog.tsx:23/:94); `useTicketQuery`'s `expanded` state (useTicketQuery.ts:5/:41-45 — the sidebar input is always rendered, Sidebar.tsx:182-227; nothing reads `expanded`); inconsistent log caps `useEventLog(50)` (App.tsx:116, Header.tsx:12) vs `useEventLog(100)` (EventLog.tsx:20) — standardize on one constant.
- **Frozen relative times:** no ticker exists (B-14). Optional: one shared `useNow(30_000)` hook (module singleton interval + `useSyncExternalStore`, started on first subscriber, stopped on last unsubscribe) passed as `now` into `formatRelativeTime(date, now)` at ClassificationTable.tsx:~321 **[TRUNCATED line]** and Header.tsx:195/:200/:417.
- **Pagination reset nit:** ClassificationTable.tsx:77-79 resets to page 1 when `tickets.length` changes (a live classify bumps the user off page 2). Restrict the reset to `[query]`.

---

# 5. Contradictions with pass 1 (explicit)

1. **FIX-01 premise inverted:** real probe HAS a 10 s AbortController timeout (useApi.ts:69/:126-135), always settles (:199-203), and HAS exponential backoff 30→300 s (:74-75/:206-213). Pass-1's replacement probe (4 s timeout, jitter, seq token) is *not* needed; the real defect is the mutable getSnapshot (:107-109) — fix N-01 (+N-03/N-04/N-05). The pass-1 backoff.ts / probe test assets are unnecessary for this codebase.
2. **Bell badge is not hard-coded** (pass-1 B-14 suspicion): it is a correct unread count from the event store; the "3 vs 2" mismatch is the stale-render defect (§0).
3. **B-14 inverted:** no ticker leak — there is no ticker at all; the defect is frozen times (P2).
4. **Footer.tsx cited by pass 1 is dead code;** the live footer is inline in App.tsx:371-386.
5. **outline:none count is 4, not 3** (Sidebar:199, Header:152, SettingsDrawer:128, LivePrediction:99).
6. **B-2 inverted in direction:** not an infinite re-render loop (fresh object per call) but a never-render (same mutable object every call) — same checklist item, opposite mechanism.
7. **Not contradicted, newly confirmed:** FIX-L2 (containLabel) — exact sites ThreatBarChart.tsx:70, PerformanceLineChart.tsx:74; registration gap at lib/echarts.ts:12-22.

# 6. What could NOT be diagnosed from this source

- Whether the **deployed build** (screenshots 13:38) equals this archived source (PDF generated 16:17) — the permanently-stuck "Checking…" in S1–S4 is *more* stuck than this source can produce after the ticket-snapshot seed re-render (~10 s). Need: the deployed bundle or its build hash. Either way N-01 is required in this source.
- **tsconfig.app.json / tsconfig.node.json** presence in the real zip (missing from the PDF archive → build failure if truly absent).
- Tails of the 85 PDF-truncated lines; 3 of them touch cited code and are flagged inline: KpiCard.tsx:176, App.tsx:384, ModelHealthDonut.tsx:123 (plus ClassificationTable.tsx:303/320/321, which no patch rewrites).
- Whether `model/artifact.onnx` exists at runtime (eval_results.json status is "PENDING" → the "Awaiting eval — see MODEL_CARD.md" KPI copy is honest and correct as-is).
- oxlint configuration (no .oxlintrc in archive; `npm run lint` runs bare `oxlint`).

# 7. Verdict summary counts

- Checklist B-1…B-15: **VERIFIED CLEAN 9** (B-1, B-3, B-4, B-5, B-6, B-8, B-9, B-10, B-15) · **CONFIRMED DEFECT 4** (B-2 ×3 stores, B-7, B-11, B-13) · **CLEAN-with-P2-note 2** (B-12 unicode, B-14 frozen times).
- Pass-1 claims C-1…C-11: **CONFIRMED 9** (C-1, C-2, C-3, C-5, C-6, C-7, C-8 [count corrected 3→4], C-9, C-10) · **CORRECTED 2** (C-4 badge, C-11 footer location).
- New defects: **19 findings N-01…N-19** — P0 ×4 (N-01 store snapshots, N-02 fabricated chart fallback, N-03 predict-offline, N-16 CSV injection) [+ N-19 build-files P0 pending zip verification] · P1 ×8 (N-04 refresh no-op, N-05 checking flap, N-06 dead tokens, N-07 double-submit, N-08 header overlap, N-10 dead href, N-12 outline killers, N-17 dead time-range) · P2 ×7 (N-09 tooltip, N-11 aria-pressed, N-13 SystemMonitor badge, N-14 donut, N-15 footer/hideTip, N-18 log copy, N-19 housekeeping pack).
