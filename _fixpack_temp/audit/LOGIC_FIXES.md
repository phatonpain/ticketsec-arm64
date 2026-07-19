# LOGIC_FIXES.md — W-03 Code Logic Review (TicketSec Arm64 DEEP AUDIT + FIX PACK)

**Scope:** code-logic findings derived from S1–S6 + evidence extracts (`dom.html`, `text-content.txt`, `a11y-attrs.txt`, `inline-styles.txt`, `inlined-css.txt`). The real `src/` was **not** provided (saved HTML had scripts stripped), so root causes that require reading source are tagged **[INFERRED — needs src/ to confirm file:line]**; defects visible in evidence are tagged **[CONFIRMED from evidence]**. No file:line is fabricated.

**Validation of every shipped patch (run in a scratch env, echarts@6.1.0 + react@19 + typescript@latest):**

| Check | Result |
|---|---|
| `tsc --strict` (+`noUnusedLocals`/`noUnusedParameters`) on all 4 reference files | **PASS, 0 errors** |
| `LegacyGridContainLabel` export location | **Verified:** `echarts/features` (NOT `echarts/components`); it is `installLegacyGridContainLabel` |
| `grid.containLabel` deprecation + exact replacement | **Verified:** `echarts@6.1.0` `types/dist/echarts.d.ts:2941–2973` — `containLabel:true` ≡ `{outerBoundsMode:'same', outerBoundsContain:'axisLabel'}` |
| Warning string in S6 | **Verified verbatim** in `echarts@6.1.0` `dist/echarts.common.js` |
| `createBackoff` contract (matches `fixpack/tests/lib/backoff.test.ts`) | **10/10 runtime checks PASS** |
| useApi probe state machine (vitest smoke, 6 tests: timeout settle, rejection, 200, 503, race, user-action report) | **6/6 PASS** |

**Honesty Contract:** every patch below preserves the live / CACHED-amber / "Unavailable — API offline" model exactly. Nothing fabricates data, nothing hides the offline state; the fixes only make the app *tell the truth faster and reliably*.

---

# PART A — CONFIRMED code defects from evidence

## FIX-L1 [P0] Health probe never settles → status pill stuck on "Checking…" everywhere

**Evidence**
- S1: header pill "Checking…" (pulsing dot). Same pill in S2, S3, S4 — every screenshot, ~70 s span.
- S6: `ERR_CONNECTION_TIMED_OUT` ×3 for `http://3.23.60.61:8000/health`, `/`, `/docs`.
- `text-content.txt`: Event Log contains exactly two entries — `13:19:50 INFO Dashboard initialized`, `13:19:50 DEBUG Health probe started`. The HTML snapshot was captured at 13:38:05 (source filename) → **~18 minutes after "Health probe started" there is still no success/failure log entry**, and the pill still says "Checking…".
- `dom.html`: pill markup `<span style="…animation:…pulse…"></span>Checking…</div>` immediately followed by `<button aria-label="Refresh data">` (the manual refresh entry point the fix must serve).

**Defect.** The health probe issues `fetch()` with **no timeout** and its rejection path **does not settle the status store**. `status` therefore stays `'checking'` indefinitely (OS-level TCP timeout takes minutes; even after `ERR_CONNECTION_TIMED_OUT` the UI never updates). This is broken functionality *and* an Honesty Contract risk: the UI claims "still checking" while every other panel already knows the truth (CACHED badges, "Unavailable — API offline", "API Offline — Displaying cached data"). A stuck spinner next to an honest CACHED badge makes the whole dashboard look broken — which is exactly what the user reported.

**Root cause.** Stuck state itself **[CONFIRMED from evidence]** (pill + missing log entry across an 18-minute window). The precise line-level cause is **[INFERRED — needs src/ to confirm file:line]** — two candidate defects, both eliminated by the reference implementation: (a) no `AbortController`/timeout on the probe fetch; (b) missing/!awaited rejection handling so the promise neither resolves state nor logs (unhandled-rejection risk). Note Chrome logs `ERR_CONNECTION_TIMED_OUT` for both handled and unhandled rejections, so S6 cannot discriminate (a) from (b) — hence the tag.

**Patch.** Replace `src/hooks/useApi.ts` with the reference implementation below (shipped as `fixpack/src/hooks/useApi.ts`). Guarantees: every probe settles in ≤ 4 s (`AbortController` + timer); no unhandled rejections (probe never throws); race-safe via a monotonic sequence token (probe vs. manual refresh vs. user-action reports); single writer for all health transitions; offline backoff 5 s→60 s with full jitter via `createBackoff`; `visibilitychange`/`online` re-probe; idempotent `startApiMonitor()` safe under React 19 StrictMode; transitions logged to the Event Log (offline = `error` once, recovery = `info`, continued failure = throttled `debug`).

Dependencies (also shipped): `src/lib/backoff.ts` → `fixpack/src/lib/backoff.ts` (contract-compatible with `fixpack/tests/lib/backoff.test.ts`); `src/hooks/useEventLog.ts` → reference scaffold `fixpack/src/hooks/useEventLog.ts` (**if the real store exists, keep it** and map only `logEvent(level, message)` — see file header).

### `fixpack/src/hooks/useApi.ts` (complete file)
```ts
/**
 * useApi — API availability store + health probe (fixpack mirror of
 * src/hooks/useApi.ts). REFERENCE IMPLEMENTATION.
 *
 * Fixes the confirmed defect behind the status pill stuck on "Checking…"
 * (S1–S4) while the console shows three ERR_CONNECTION_TIMED_OUT (S6) and
 * the Event Log never advances past "Health probe started" (text-content.txt):
 * the previous probe issued fetch() with no timeout and did not reliably
 * settle state on rejection, so `status` stayed 'checking' forever.
 *
 * Guarantees of this implementation:
 *   1. Every probe SETTLES in <= PROBE_TIMEOUT_MS (AbortController + timer).
 *      'checking' is therefore a transient state, never a permanent one.
 *   2. No unhandled promise rejections: probeApiHealth() never throws.
 *   3. Race-safe: a monotonically increasing sequence number discards stale
 *      probe results (probe vs. manual refresh vs. user-action reports).
 *   4. Single writer: ALL API health transitions flow through applyResult(),
 *      including failures observed by user actions (reportApiOutcome), so a
 *      background probe can never contradict fresher user evidence.
 *   5. Honesty Contract preserved: 'offline' is a first-class, honest state —
 *      the UI keeps showing the amber CACHED badge / cached snapshot, exactly
 *      as it does today. Nothing here fabricates availability.
 *   6. Backoff: while offline, probes back off 5s -> 60s with jitter
 *      (src/lib/backoff). While online, re-check every ONLINE_RECHECK_MS.
 *   7. Singleton store + useSyncExternalStore: safe under React 19
 *      StrictMode double-mount; startApiMonitor() is idempotent and the
 *      monitor intentionally survives effect cleanups.
 */

/// <reference types="vite/client" />

import { useEffect, useSyncExternalStore } from 'react';
import { createBackoff } from '../lib/backoff';
import { logEvent } from './useEventLog';

export type ApiStatus = 'checking' | 'online' | 'offline';

export interface ApiState {
  status: ApiStatus;
  /** Last time any probe/user-action report settled (epoch ms). */
  lastCheckedAt: number | null;
  /** Last time the API was confirmed reachable (epoch ms). */
  lastOnlineAt: number | null;
  /** Consecutive failed health outcomes; drives backoff. Reset on success. */
  consecutiveFailures: number;
  /** Human-readable reason for the current offline state, if any. */
  lastError: string | null;
}

export interface ProbeResult {
  ok: boolean;
  /** 'OK' | 'HTTP 503' | 'timeout after 4000 ms' | '<network error message>'. */
  detail: string;
  latencyMs: number;
}

/* ------------------------------------------------------------------ config */

const envBase: unknown = import.meta.env.VITE_API_BASE_URL;
export const API_BASE: string =
  typeof envBase === 'string' && envBase.length > 0
    ? envBase
    : 'http://3.23.60.61:8000';

const HEALTH_PATH = '/health';
/** Hard ceiling for every probe. 'checking' can never outlive this. */
const PROBE_TIMEOUT_MS = 4_000;
/** Re-check cadence while healthy. */
const ONLINE_RECHECK_MS = 30_000;
/**
 * Offline retry cadence: 5s, 10s, 20s, ... capped at 60s, full jitter.
 * Instance lives at module scope so the attempt counter survives renders;
 * reset() is called on every confirmed success (see applyResult).
 */
const offlineBackoff = createBackoff({ baseMs: 5_000, maxMs: 60_000 });

/* ------------------------------------------------- store (module singleton) */

let state: ApiState = {
  status: 'checking',
  lastCheckedAt: null,
  lastOnlineAt: null,
  consecutiveFailures: 0,
  lastError: null,
};

const listeners = new Set<() => void>();

function setState(patch: Partial<ApiState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/** Cached reference between setState calls — required by useSyncExternalStore. */
function getSnapshot(): ApiState {
  return state;
}

/** Non-React read access (tests, imperative code). Mirrors the store snapshot. */
export function getApiState(): ApiState {
  return state;
}

/* ------------------------------------------------------- probe engine ----- */

/**
 * Ownership token. Incremented whenever a newer probe/report starts; any
 * result carrying an older token is discarded. Kills the probe-vs-refresh
 * and probe-vs-user-action races.
 */
let probeSeq = 0;
let inFlight: AbortController | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

/**
 * The ONLY function allowed to mutate API health state.
 * Logs transitions to the Event Log (offline = error once, recovery = info,
 * continued failure = throttled debug) so the log tells the truth without
 * spamming.
 */
function applyResult(seq: number, result: ProbeResult): ProbeResult {
  if (seq !== probeSeq) return result; // stale: a newer probe/report owns state

  const previous = state.status;

  if (result.ok) {
    setState({
      status: 'online',
      lastCheckedAt: Date.now(),
      lastOnlineAt: Date.now(),
      consecutiveFailures: 0,
      lastError: null,
    });
    if (previous !== 'online') {
      logEvent('info', `API reachable — health check OK (${result.latencyMs} ms)`);
    }
  } else {
    const consecutiveFailures = state.consecutiveFailures + 1;
    setState({
      status: 'offline',
      lastCheckedAt: Date.now(),
      consecutiveFailures,
      lastError: result.detail,
    });
    if (previous !== 'offline') {
      logEvent(
        'error',
        `API offline — health check failed: ${result.detail}. Displaying cached snapshot.`,
      );
    } else if (consecutiveFailures % 10 === 0) {
      logEvent(
        'debug',
        `Health probe still failing (${consecutiveFailures} consecutive): ${result.detail}`,
      );
    }
  }
  return result;
}

/**
 * One probe. NEVER rejects; ALWAYS settles within PROBE_TIMEOUT_MS.
 * Safe to call concurrently: starting a new probe aborts and supersedes the
 * previous one.
 */
export async function probeApiHealth(): Promise<ProbeResult> {
  const seq = ++probeSeq;

  if (inFlight) inFlight.abort(); // supersede; its result is discarded by seq check
  const controller = new AbortController();
  inFlight = controller;

  const startedAt = performance.now();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}${HEALTH_PATH}`, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    if (!response.ok) {
      return applyResult(seq, { ok: false, detail: `HTTP ${response.status}`, latencyMs });
    }
    return applyResult(seq, { ok: true, detail: 'OK', latencyMs });
  } catch (error: unknown) {
    const latencyMs = Math.round(performance.now() - startedAt);
    if (seq !== probeSeq) {
      // Aborted because a newer probe/refresh took over — do not touch state.
      return { ok: false, detail: 'superseded', latencyMs };
    }
    const detail =
      error instanceof DOMException && error.name === 'AbortError'
        ? `timeout after ${PROBE_TIMEOUT_MS} ms`
        : error instanceof Error
          ? error.message
          : 'unknown network error';
    return applyResult(seq, { ok: false, detail, latencyMs });
  } finally {
    clearTimeout(timeout);
    if (inFlight === controller) inFlight = null;
  }
}

/**
 * Feed an outcome observed by a USER ACTION (e.g. "Classify Ticket" fetch)
 * into the same state machine. Bumping probeSeq makes this fresher than any
 * scheduled probe, so a slow background probe cannot overwrite user evidence.
 * A failed user action marks the API offline immediately (honest), instead of
 * waiting for the next scheduled probe.
 */
export function reportApiOutcome(ok: boolean, detail: string): void {
  const seq = ++probeSeq;
  applyResult(seq, { ok, detail, latencyMs: 0 });
}

/* ------------------------------------------------------------ scheduling -- */

function scheduleNext(): void {
  if (retryTimer) clearTimeout(retryTimer);
  const delay =
    state.status === 'online' ? ONLINE_RECHECK_MS : offlineBackoff.next();
  retryTimer = setTimeout(() => {
    void runProbe();
  }, delay);
}

async function runProbe(): Promise<void> {
  try {
    await probeApiHealth();
  } finally {
    if (started) scheduleNext();
  }
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible' && state.status !== 'checking') {
    void runProbe(); // fresh evidence the moment the operator looks again
  }
}

function handleBrowserOnline(): void {
  void runProbe(); // OS/browser says the network is back — verify immediately
}

/**
 * Idempotent. Called from the useApi hook's mount effect; survives StrictMode
 * double-invoke by design (singleton monitor).
 */
export function startApiMonitor(): void {
  if (started) return;
  started = true;
  logEvent('debug', 'Health probe started');
  void runProbe();
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('online', handleBrowserOnline);
}

/** Test/HMR escape hatch. Production code never calls this. */
export function stopApiMonitor(): void {
  started = false;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  if (inFlight) inFlight.abort();
  inFlight = null;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('online', handleBrowserOnline);
}

/**
 * Manual refresh (header button, aria-label="Refresh data").
 * Bounded by design: 'checking' resolves to online/offline within
 * PROBE_TIMEOUT_MS, so the pill can never stick again.
 */
export async function refreshApiStatus(): Promise<ProbeResult> {
  setState({ status: 'checking', lastError: null });
  const result = await probeApiHealth();
  scheduleNext();
  return result;
}

/* ---------------------------------------------------------------- hook ---- */

export interface UseApiResult extends ApiState {
  apiBase: string;
  refresh: () => Promise<ProbeResult>;
  probe: () => Promise<ProbeResult>;
}

export function useApi(): UseApiResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    startApiMonitor();
    // No stopApiMonitor() cleanup: the monitor is an app-lifetime singleton.
    // Stopping on unmount would kill probing during StrictMode double-mounts.
  }, []);

  return {
    ...snapshot,
    apiBase: API_BASE,
    refresh: refreshApiStatus,
    probe: probeApiHealth,
  };
}
```

### `fixpack/src/lib/backoff.ts` (complete file — dependency)
```ts
/**
 * Exponential backoff with full jitter (AWS-style).
 *
 * REFERENCE IMPLEMENTATION (fixpack mirror of src/lib/backoff.ts).
 * The project context lists a backoff helper in src/lib — if the real file
 * already satisfies this contract, keep it and delete this one. This is the
 * contract src/hooks/useApi.ts (health probe) and fixpack/tests/lib/backoff.test.ts
 * are written against:
 *
 *   - createBackoff({ baseMs, maxMs, jitter?, random? }) → { next, reset, attempt }
 *   - next(): attempt n (0-based) → min(maxMs, baseMs * 2^n); with jitter
 *     enabled (default) delay = random() * capped ("full jitter").
 *   - random is INJECTABLE (seedable in tests); defaults to Math.random.
 *   - attempt(): number of next() calls since construction/reset.
 *   - reset(): attempt back to 0; next() returns the base delay again.
 *   - Never returns NaN/Infinity, even after 100+ attempts (cap guards overflow).
 */

export interface BackoffOptions {
  /** Delay for the first retry (attempt 0), before jitter. */
  baseMs: number;
  /** Hard cap for any computed delay, before jitter. */
  maxMs: number;
  /** Full jitter on/off. Default true. */
  jitter?: boolean;
  /** RNG returning [0, 1). Injected in tests; default Math.random. */
  random?: () => number;
}

export interface Backoff {
  /** Delay for the current attempt, then advance. Always finite, >= 0, <= maxMs. */
  next(): number;
  /** Back to attempt 0 (call after a success). */
  reset(): void;
  /** Attempts consumed since construction/reset. */
  attempt(): number;
}

/** Exponent ceiling: 2**30 dwarfs any sane maxMs, so the cap always wins. */
const MAX_EXPONENT = 30;

export function createBackoff(options: BackoffOptions): Backoff {
  const jitter = options.jitter ?? true;
  const random = options.random ?? Math.random;
  let attempts = 0;

  function cappedDelay(): number {
    const exponent = Math.min(attempts, MAX_EXPONENT);
    const raw = options.baseMs * Math.pow(2, exponent);
    // Math.min also swallows the Infinity case from huge baseMs values.
    return Math.min(options.maxMs, raw);
  }

  return {
    next(): number {
      const capped = cappedDelay();
      attempts += 1;
      if (!jitter) return capped;
      const delay = random() * capped;
      // Defensive: a hostile random() must never leak NaN/negative/Infinity.
      return Number.isFinite(delay) && delay > 0 ? delay : 0;
    },
    reset(): void {
      attempts = 0;
    },
    attempt(): number {
      return attempts;
    },
  };
}
```

### `fixpack/src/hooks/useEventLog.ts` (reference scaffold — dependency; keep real store if present)
```ts
/**
 * REFERENCE SCAFFOLD (fixpack mirror of src/hooks/useEventLog.ts).
 *
 * The real store exists in the project (Event Log panel renders "Dashboard
 * initialized" / "Health probe started" entries with All/Info/Debug/Error
 * filters). This scaffold exists so the useApi.ts reference implementation
 * compiles standalone. If the real file is present, KEEP IT and adapt only
 * the two integration points useApi needs:
 *   - a module-level `logEvent(level, message)` (or map to the real logger)
 *   - bounded entry storage (see MAX_ENTRIES)
 *
 * Design notes that apply to either version:
 *   - Module-level singleton + useSyncExternalStore: state lives outside
 *     React, so appends never depend on component lifecycle.
 *   - `getSnapshot` returns a cached array reference that only changes when
 *     the log actually changes — required by useSyncExternalStore, prevents
 *     infinite re-render loops.
 *   - Entries are capped (ring buffer). An unbounded log grows forever while
 *     the API is offline and eventually janks the Event Log panel.
 */

import { useSyncExternalStore } from 'react';

export type EventLevel = 'info' | 'debug' | 'error';

export interface EventLogEntry {
  id: string;
  /** Epoch milliseconds; format at render time (HH:MM:SS). */
  at: number;
  level: EventLevel;
  message: string;
}

const MAX_ENTRIES = 200;

let entries: EventLogEntry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

/** Append an entry. Newest first. Never throws — safe to call from catch blocks. */
export function logEvent(level: EventLevel, message: string): void {
  const entry: EventLogEntry = {
    id: `evt-${nextId}`,
    at: Date.now(),
    level,
    message,
  };
  nextId += 1;
  entries = [entry, ...entries].slice(0, MAX_ENTRIES);
  emit();
}

export function clearEvents(): void {
  entries = [];
  emit();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/** Must return the SAME reference between emits. */
function getSnapshot(): EventLogEntry[] {
  return entries;
}

export interface UseEventLogResult {
  entries: EventLogEntry[];
  log: typeof logEvent;
  clear: typeof clearEvents;
}

export function useEventLog(): UseEventLogResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { entries: snapshot, log: logEvent, clear: clearEvents };
}
```

**Wiring in the rest of the app (integration notes, [INFERRED] paths):**
- Header pill (`aria-label="Refresh data"` button in `dom.html`): `const { status, refresh } = useApi();` — `onClick={() => void refresh()}`. Render: `checking` → "Checking…", `online` → "API Online", `offline` → "API Offline" (token colors only).
- Classify Ticket / any user fetch: on settled failure call `reportApiOutcome(false, errMessage)`; on success `reportApiOutcome(true, 'OK')`. This makes the pill reflect user-visible truth immediately instead of waiting ≤60 s for the next scheduled probe.
- Keep the CACHED badge logic exactly as-is; it reads `status`/`lastOnlineAt`, which this store now maintains correctly.

**Acceptance (10-second check):**
1. With the API down, reload the dashboard: the pill shows "Checking…" for **≤ 4 s**, then flips to the offline state; Event Log gains `API offline — health check failed: timeout after 4000 ms. Displaying cached snapshot.`
2. Click the header refresh button: same ≤ 4 s bounded behavior; DevTools console shows **no** unhandled promise rejections.
3. Start the API: pill flips to online within one backoff cycle (≤ 60 s) or immediately on refresh; Event Log gains `API reachable — health check OK (… ms)`.

---

## FIX-L2 [P1] ECharts v6 modular build: `grid.containLabel` without `LegacyGridContainLabel` → console warning + ignored label-containment on every cartesian chart

**Evidence**
- S6 console: `[ECharts] Specified `grid.containLabel` but no `use(LegacyGridContainLabel)`;use `grid.outerBounds` instead.` (log.js:59). Warning string verified **verbatim** in `echarts@6.1.0` (`dist/echarts.common.js`).
- `dom.html`: two live chart instances (`_echarts_instance_` ×2, `<canvas>` ×2 — Threat Category Distribution bar chart + Model Footprint donut). The bar chart is cartesian → affected; any future line/accuracy chart is affected too.

**Defect.** Under ECharts v6 **modular** imports (`echarts/core` + `use(...)` — the documented setup here), `grid.containLabel: true` is a **no-op** unless the optional `LegacyGridContainLabel` installable is registered. Consequences: (1) a console warning on every chart init (reads as "unpolished" in any demo/judging); (2) axis labels are no longer contained — y-axis category/value labels can overflow or be clipped, contributing to the "generic/off" look.

**Root cause [CONFIRMED from evidence + verified against the installed package].** Verified on `echarts@6.1.0`:
- `types/dist/echarts.d.ts:2941`: `containLabel` is `@deprecated Use `grid.outerBounds` instead.` and the doc block states `containLabel: true` is **exactly equivalent** to `{ outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' }` (lines 2950–2973).
- `LegacyGridContainLabel` is exported from **`echarts/features`** (runtime-checked: it is `installLegacyGridContainLabel`, an installable function) — **not** from `echarts/components` (a wrong import path is the most common failed fix).

**Patch — BOTH options, recommendation: Option B.**

### Option A — stop-gap registration (keeps deprecated API alive)
In the single setup module, uncomment two marked lines:
```ts
import { LegacyGridContainLabel } from 'echarts/features'; // NOT 'echarts/components'
echarts.use([/* …existing…, */ LegacyGridContainLabel]);
```
Cost: one extra registered feature + the deprecated API stays. Use only if options cannot be touched today.

### Option B — RECOMMENDED: migrate options to the v6-native equivalent (zero registration, smaller bundle)
1. Add the central setup module below as `src/components/charts/echartsSetup.ts` (shipped as `fixpack/src/components/charts/echartsSetup.ts`). It is the **only** module allowed to call `echarts.use(...)`, exports the configured `echarts`, the `ECOption` union type, and `gridOuterBounds`.
2. In every cartesian chart option, replace:
```ts
// BEFORE (in each chart under src/components/charts/**)
grid: { left: 0, right: 8, top: 8, bottom: 0, containLabel: true },
```
```ts
// AFTER
import { echarts, gridOuterBounds } from './echartsSetup'; // adjust relative depth
import type { ECOption } from './echartsSetup';
const option: ECOption = {
  grid: { left: 0, right: 8, top: 8, bottom: 0, ...gridOuterBounds },
  // …unchanged…
};
```
3. Find every occurrence: `grep -rn "containLabel" src/` → all must be gone; `grep -rn "from 'echarts'" src/` → only `echartsSetup.ts` may import from `echarts/*` packages.

### `fixpack/src/components/charts/echartsSetup.ts` (complete file)
```ts
/**
 * Central ECharts setup — the ONLY module allowed to call `echarts.use(...)`.
 *
 * Rules for every file under src/components/charts/**:
 *   1. Import `echarts` and `ECOption` from this module — never from 'echarts',
 *      'echarts/core', or 'echarts/charts' directly. This keeps the modular
 *      (tree-shaken) build deterministic and the main chunk < 600 KB.
 *   2. Never set `grid.containLabel`. Under ECharts v6 modular imports it is a
 *      no-op that logs:
 *        "[ECharts] Specified `grid.containLabel` but no
 *         `use(LegacyGridContainLabel)`;use `grid.outerBounds` instead."
 *      Spread `gridOuterBounds` into every cartesian grid option instead
 *      (verified equivalent, see below).
 *
 * Verified against echarts@6.1.0:
 *   - types/dist/echarts.d.ts:2941 marks grid.containLabel "@deprecated Use
 *     `grid.outerBounds` instead" and documents that `containLabel: true` is
 *     exactly `{ outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' }`.
 *   - `LegacyGridContainLabel` is exported from 'echarts/features' (it is
 *     `installLegacyGridContainLabel`, an installable), NOT from
 *     'echarts/components'.
 */

import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

import type { ComposeOption } from 'echarts/core';
import type {
  BarSeriesOption,
  LineSeriesOption,
  PieSeriesOption,
} from 'echarts/charts';
import type {
  GridComponentOption,
  LegendComponentOption,
  TooltipComponentOption,
} from 'echarts/components';

/* --------------------------------------------------------------------------
 * OPTION A — compatibility shim (NOT recommended).
 *
 * Keeps legacy `grid.containLabel: true` working under ECharts v6 without
 * touching chart options. Costs one extra registered feature and keeps the
 * deprecated API alive. Uncomment ONLY as a stop-gap while options migrate:
 *
 *   import { LegacyGridContainLabel } from 'echarts/features';
 *   echarts.use([LegacyGridContainLabel]);
 *
 * Recommendation: use OPTION B (`gridOuterBounds` below) and delete every
 * `containLabel` occurrence. Zero registration, zero deprecation surface.
 * ------------------------------------------------------------------------ */

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);

/** Union option type for all registered charts/components. */
export type ECOption = ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | PieSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
>;

/**
 * OPTION B — recommended. ECharts v6-native replacement for
 * `containLabel: true`; functionally identical per echarts@6.1.0 type docs.
 *
 * Usage in any cartesian chart (bar / line):
 *   const option: ECOption = {
 *     grid: { ...gridOuterBounds, top: 8, right: 8, bottom: 0, left: 0 },
 *     ...
 *   };
 *
 * Spacing values stay where they live today (per-chart options or
 * src/lib/chartTokens.ts) — this constant carries only the v6 layout behavior.
 */
export const gridOuterBounds: Pick<
  GridComponentOption,
  'outerBoundsMode' | 'outerBoundsContain'
> = {
  outerBoundsMode: 'same',
  outerBoundsContain: 'axisLabel',
};

export { echarts };
```

**Acceptance (10-second check):** reload with DevTools open → the `[ECharts] Specified `grid.containLabel`…` warning is gone; Threat Category Distribution bars keep fully visible axis labels at narrow widths; `npm run build` main-chunk size is unchanged or smaller (Option B removes the need for the legacy feature).

---

## NOTE-L3 [NOT A DEFECT — do not file] `[vite] server connection lost. Polling for restart...` (S6)

**Evidence:** S6 console, between the ECharts warning and the network errors.
**Verdict:** environment/tooling event, **not an application bug**. This line is printed by `@vite/client` (dev-only, injected by the Vite dev server) when its HMR WebSocket drops — i.e. the dev server process stopped, crashed, or was killed (machine sleep, OOM, Ctrl+C in another terminal). It never ships in `npm run build` output. **Action:** none in app code; restart with `npm run dev`. If it recurs *while the dev server stays up*, then check the terminal running Vite for crashes — still not an app defect. Explicitly recorded here so nobody burns a finding slot on it.

---

# PART B — High-probability logic defects to CHECK once `src/` is available

Each row: grep/audit pattern → the defect it catches → reference fix. Apply in order; 1–5 are P0/P1 candidates, 6–10 harden perceived quality, 11–15 are correctness/edge polish. (All fixes below are token- and strict-safe; snippets are illustrative against the known architecture.)

### B-1. In-place mutation of store arrays (sort/reverse/splice)
- **Grep:** `grep -rn "\.sort(\|\.reverse(\|\.splice(" src/components src/hooks`
- **Defect:** `.sort()` mutates in place. If it runs on the array instance held by a singleton store, the store's snapshot identity breaks (`useSyncExternalStore` sees the same reference) → stale or torn renders; also destroys the source order other subscribers rely on.
- **Fix:** always sort a copy inside a memo: `const sorted = useMemo(() => [...tickets].sort(cmp), [tickets, cmp]);` with `cmp` imported from `src/lib/sort`.

### B-2. `getSnapshot` returning fresh objects (infinite re-render loop)
- **Grep:** `grep -rn "useSyncExternalStore" src/ -A3` and inspect every `getSnapshot`.
- **Defect:** `getSnapshot: () => ({...state})` or `() => entries.filter(...)` allocates per call → React re-renders forever ("The result of getSnapshot should be cached").
- **Fix:** module-level cached state replaced immutably on change; `getSnapshot` returns the cached reference (see `fixpack/src/hooks/useApi.ts` / `useEventLog.ts`). Derive filtered views in components via `useMemo`, not in `getSnapshot`.

### B-3. Subscription/timer/observer leaks
- **Grep:** `grep -rn "setInterval\|setTimeout\|addEventListener\|ResizeObserver\|echarts.init" src/`
- **Defect:** missing cleanup → duplicate timers after StrictMode double-mount, intervals running after unmount, chart instances never disposed (also explains a lingering tooltip element in `dom.html`: a stray absolutely-positioned tooltip node with `z-index:9999999` remains in the DOM).
- **Fix:** every effect returns cleanup: `clearInterval`, `removeEventListener`, `observer.disconnect()`, and for charts `chart.hideTip(); chart.dispose();`. App-lifetime singletons must be idempotent (`startApiMonitor()` pattern).

### B-4. Missing/extra `useEffect` dependencies
- **Grep:** `npx eslint src --rule '{"react-hooks/exhaustive-deps":"error"}'` (project lint must be green on this rule).
- **Defect:** stale closures reading old `tickets`/`status`/filters → UI that lags one action behind ("many things don't work correctly").
- **Fix:** complete the dep array; if a value is only needed inside, move logic to an event handler or store action instead of disabling the rule.

### B-5. Health-probe vs. user-action race (multiple writers to API status)
- **Grep:** `grep -rn "status.*online\|status.*offline\|setStatus" src/hooks src/components`
- **Defect:** probe, refresh button, and classify fetch each write status independently → pill flaps online/offline depending on which promise lands last; a slow scheduled probe can overwrite fresher user evidence.
- **Fix:** single writer. All outcomes flow through `applyResult()` guarded by the monotonic `probeSeq`; user actions call `reportApiOutcome(ok, detail)` (both in `fixpack/src/hooks/useApi.ts`). Verify no other module writes API status.

### B-6. Memoization gaps → re-render storms (Event Log appends re-render charts)
- **Grep:** `grep -rn "setOption\|React.memo\|useMemo" src/components | sort`
- **Defect:** every Event Log append emits to subscribers; if chart options are rebuilt inline each render, every log entry re-runs `setOption` on both charts → visible jank while offline probes keep logging.
- **Fix:** `React.memo` on chart components; `const option = useMemo(() => buildOption(data), [data]);`; separate `useEffect(() => { chart.setOption(option); }, [option])`. Log panel and charts subscribe to *different* stores — verify no chart component consumes `useEventLog`.

### B-7. Pagination clamp / off-by-one (S3 shows "Showing 1–5 of 6")
- **Grep:** `grep -rn "pageSize\|slice(\|Showing" src/components src/lib`
- **Defect:** classic bugs: `end = page*size` without `Math.min(total)`, page not clamped when filters shrink the list (empty page with "Showing 11–15 of 6"), or sort applied *after* slicing (page-local sort). Note: "Showing 1–5 of 6" itself is **correct** for page 1/size 5 — what must be verified is clamping on shrink and the empty case.
- **Fix:** `const start=(page-1)*size; const end=Math.min(start+size,total);` plus `useEffect(() => { if (total>0 && start>=total) setPage(Math.max(1, Math.ceil(total/size))); }, [total]);` and render `Showing 0 of 0` (not "1–0 of 0") when empty. Sort/filter **before** slice.

### B-8. Sort comparator ties & instability
- **Grep:** `grep -rn "sort\|compare" src/lib/sort.ts` (once available)
- **Defect:** comparator returning non-zero for equal keys, or no deterministic tie-break → rows shuffle between renders/refetches; `NaN` from bad subtraction breaks ordering silently.
- **Fix:** total order: primary key comparator, tie-break by ticket id (`a.id.localeCompare(b.id)`); never subtract possibly-undefined numbers — normalize first (`?? 0` / `?? ''`).

### B-9. Double-submit / rapid clicks on "Classify Ticket" (S4)
- **Grep:** `grep -rn "Classify\|isSubmitting\|disabled" src/components`
- **Defect:** no in-flight guard → double-click fires two POSTs; the slower response can overwrite the faster one; duplicate Event Log entries; button not disabled while pending.
- **Fix:** in-flight ref guard + `disabled={pending || status!=='online'}`; abort superseded requests (`AbortController`) and discard stale responses with a request-seq token (same pattern as the probe in FIX-L1). While offline the button must be disabled with an honest reason (`title="Unavailable — API offline"`) — never fake a result.

### B-10. Unicode / oversized / hostile input (Live Classification textarea, Ticket Query search)
- **Grep:** `grep -rn "new RegExp(\|\.match(\|encodeURIComponent" src/`
- **Defect:** user input interpolated into `new RegExp` → throws on `[`; 50 KB paste into fuzzy search → main-thread jank; un-normalized unicode (`é` vs `e + ́`) misses matches.
- **Fix:** escape before regex (`s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`), `trim().normalize('NFC')`, cap length (~2 000 chars) with a counter, debounce search ≥ 150 ms.

### B-11. CSV formula injection (Export CSV, visible in S2)
- **Grep:** `grep -rn "csv\|toCsv" src/lib`
- **Defect:** ticket subjects beginning with `=`, `+`, `-`, `@` are executed as formulas when the CSV opens in Excel/Sheets (real security-tooling embarrassment for a security product).
- **Fix:** prefix dangerous leading chars with `'`; quote every field with `"` and double internal quotes; strip `\r\n` inside cells. (Contract already expected by `fixpack/tests/lib/csv.test.ts`.)

### B-12. Relative-time re-render cadence ("2m ago" column, S2/S3)
- **Grep:** `grep -rn "setInterval\|Date.now()" src/components`
- **Defect:** a 1 s interval per row (or per table) re-renders the whole grid every second → constant layout/paint, battery drain.
- **Fix:** one 30 s ticker in a store (or context) providing `now`; rows format `relativeTime(t.ts, now)` from `src/lib/time` during render.

### B-13. Unbounded Event Log growth
- **Grep:** `grep -rn "push\|concat" src/hooks/useEventLog.ts` (once available)
- **Defect:** offline probe failures logged forever → array grows unbounded; render cost and memory climb during long offline windows.
- **Fix:** ring-buffer cap (200 entries, newest first) — see `fixpack/src/hooks/useEventLog.ts`; plus the throttled repeat-logging already in FIX-L1 (only every 10th consecutive failure logs at `debug`).

### B-14. Bell badge count ≠ Event Log count (S1 badge "3" vs. 2 entries)
- **Grep:** `grep -rn "badge\|unread\|notification" src/`
- **Defect:** badge hard-coded or counting a different source than the Event Log → the one number users trust most is wrong. (W-06 tracks the state-layer view; logic-side check is here.)
- **Fix:** derive badge from the same store: `entries.filter(e => e.level==='error' && !ack).length` or remove the badge until a real alert source exists — never a constant.

### B-15. `echarts.init` inside render / double init
- **Grep:** `grep -rn "echarts.init" src/components`
- **Defect:** init called in the component body (or an effect without empty/guarded deps) → duplicate instances per render, detached canvases, and tooltips that survive route changes (consistent with the stray tooltip node in `dom.html`).
- **Fix:** `useEffect(() => { const c = echarts.init(ref.current); return () => { c.hideTip(); c.dispose(); }; }, []);` then a separate effect for `setOption`. All imports via `echartsSetup.ts` (FIX-L2).

---

# PART C — MISSING EVIDENCE (what is needed, and what gets delivered in one pass)

**Needed:** `ticketsec-source.zip` (or the repo), specifically `src/hooks/*.ts`, `src/components/**`, `src/lib/**`, `package.json`, `vite.config.ts`, `tsconfig.json`, `public/cache/tickets-snapshot.json`. Optional but useful: `MODEL_CARD.md` (KPI "Awaiting eval" copy references it) and the FastAPI `/health` contract.

**Deliverable within one review pass after receipt:**
1. Confirm or replace every **[INFERRED]** tag above with exact `file:line` citations (FIX-L1 root-cause branch (a) vs (b); integration wiring notes).
2. Execute PART B as a concrete findings list — each item either closed ("checked, clean at file:line") or converted to a numbered FIX with patch.
3. Adapt the reference patches to the real store APIs (`useEventLog.log` signature, `chartTokens` exports, real `API_BASE` env name) and re-run `tsc --strict`.
4. Run the quality gates end-to-end: `npm run build` + `npm run lint` (expect 0/0) and report main-chunk size vs. the 600 KB budget.
5. Re-validate the Honesty Contract against the real cached-snapshot loader (`useTickets`) — CACHED badge timestamp source and "Unavailable — API offline" fallbacks.

---

# Appendix A — validation log (commands actually run)

```
# echarts API verification (echarts@6.1.0)
grep -n "outerBounds" node_modules/echarts/types/dist/echarts.d.ts   # lines 2941-2973
node -e "…echarts/features…"                                          # LegacyGridContainLabel === installLegacyGridContainLabel (function)
grep -m1 -o "Specified `grid.containLabel`…" dist/echarts.common.js # verbatim match with S6

# strict type-check of the 4 shipped files
tsc -p tsconfig.json        # strict + noUnusedLocals + noUnusedParameters → 0 errors

# backoff contract (mirrors fixpack/tests/lib/backoff.test.ts expectations)
node … backoff checks       # 10/10 PASS (doubling, cap, attempt, 0.5-jitter, reset, 120-attempt overflow, huge-base cap, default-jitter bounds)

# useApi probe state machine (vitest 4.1.10, node env, stubbed fetch)
vitest run probe.smoke.test.ts   # 6/6 PASS
```

# Appendix B — optional acceptance test for FIX-L1 (hand to W-04 if wanted)

`fixpack/tests/hooks/useApi.probe.test.ts` (passes as-is against the shipped reference; adapt the import shim to the real source layout):

```ts
/**
 * Smoke test for the useApi health-probe reference implementation.
 * Node env; fetch is stubbed. Verifies the P0 claims:
 *   1. Hanging fetch settles offline in <= PROBE_TIMEOUT_MS (no stuck 'checking').
 *   2. No unhandled rejections (vitest fails the run on any).
 *   3. Stale probe results are discarded (probe-vs-refresh race).
 *   4. reportApiOutcome feeds the same state machine.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getApiState,
  probeApiHealth,
  refreshApiStatus,
  reportApiOutcome,
} from './src/hooks/useApi';

type FetchLike = (input: unknown, init?: RequestInit) => Promise<Response>;

/** Mimics real fetch abort semantics for a request that never answers. */
const hangingFetch: FetchLike = (_input, init) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    });
  });

const okFetch: FetchLike = () =>
  Promise.resolve(new Response('{"status":"ok"}', { status: 200 }));

const http503Fetch: FetchLike = () =>
  Promise.resolve(new Response('down', { status: 503 }));

const rejectingFetch: FetchLike = () =>
  Promise.reject(new TypeError('fetch failed'));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('probeApiHealth', () => {
  it('settles OFFLINE within PROBE_TIMEOUT_MS when the server blackholes the request', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', hangingFetch);
    const probe = probeApiHealth();
    await vi.advanceTimersByTimeAsync(4_100);
    const result = await probe;
    expect(result.ok).toBe(false);
    expect(result.detail).toBe('timeout after 4000 ms');
    expect(getApiState().status).toBe('offline');
    expect(getApiState().lastError).toBe('timeout after 4000 ms');
  });

  it('settles OFFLINE on network rejection — and never throws', async () => {
    vi.stubGlobal('fetch', rejectingFetch);
    const result = await probeApiHealth();
    expect(result.ok).toBe(false);
    expect(result.detail).toBe('fetch failed');
    expect(getApiState().status).toBe('offline');
  });

  it('settles ONLINE on HTTP 200', async () => {
    vi.stubGlobal('fetch', okFetch);
    const result = await probeApiHealth();
    expect(result.ok).toBe(true);
    expect(getApiState().status).toBe('online');
    expect(getApiState().consecutiveFailures).toBe(0);
  });

  it('settles OFFLINE on non-OK HTTP status', async () => {
    vi.stubGlobal('fetch', http503Fetch);
    const result = await probeApiHealth();
    expect(result.ok).toBe(false);
    expect(result.detail).toBe('HTTP 503');
    expect(getApiState().status).toBe('offline');
  });
});

describe('probe vs manual refresh race', () => {
  it('a superseded probe cannot overwrite the newer result', async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockImplementationOnce(hangingFetch) // probe A: blackholed
      .mockImplementationOnce(okFetch); // manual refresh B: succeeds
    vi.stubGlobal('fetch', fetchMock);

    const probeA = probeApiHealth(); // starts, hangs
    const probeB = refreshApiStatus(); // supersedes A, succeeds
    const [resultA, resultB] = await Promise.all([probeA, probeB]);

    expect(resultA.detail).toBe('superseded'); // stale — discarded
    expect(resultB.ok).toBe(true);
    expect(getApiState().status).toBe('online'); // B wins, A never lands
  });
});

describe('reportApiOutcome (user-action evidence)', () => {
  it('marks offline on user-action failure and recovers on success', async () => {
    reportApiOutcome(false, 'network error during classify');
    expect(getApiState().status).toBe('offline');
    expect(getApiState().lastError).toBe('network error during classify');
    reportApiOutcome(true, 'OK');
    expect(getApiState().status).toBe('online');
  });
});
```
