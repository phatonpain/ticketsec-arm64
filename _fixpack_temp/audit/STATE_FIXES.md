# W-06 — State / Data-Flow Audit: Findings + Reference Patches

Scope: singleton stores (`useApi`, `useEventLog`, `useTickets`, `useSettings`, `useTicketQuery`) and every
surface that renders their state. Evidence base: S1–S6 screenshots + `evidence/dom.html` (rendered DOM),
`evidence/text-content.txt`, `evidence/a11y-attrs.txt`. Real `src/` was NOT provided — root causes that
require file:line are tagged **[INFERRED — needs src/ to confirm file:line]**; everything observed directly
in the rendered DOM/screenshots is tagged **[CONFIRMED from evidence]**. All patches are complete reference
implementations keyed to the known architecture (React 19, TS strict, no `any`, tokens only, no new deps).

Timeline anchor for all findings: Event Log timestamps `13:19:50` (init + probe start, text-content.txt
lines 141–146); screenshots taken `13:33:45`–`13:34:57` → the app sat in its broken state for **~14 minutes**.

---

## F1 — P0 — Status pill stuck on "Checking…" forever (useApi never settles to `offline`)

**Evidence**
- S1–S4: header pill reads "Checking…" with pulsing muted dot in every screenshot.
- dom.html @12977: pill markup — `<div tabindex=0 role=button aria-describedby=status-tooltip …color:var(--text-muted)…><span …animation:…pulse…></span>Checking…</div>`.
- S6 console: 3× `ERR_CONNECTION_TIMED_OUT` for `3.23.60.61:8000/health`, `/`, `/docs` → the browser *did*
  terminate the failed requests; the app had rejection events to react to.
- text-content.txt lines 141–146: Event Log contains `DEBUG Health probe started` as the **last** entry —
  no "probe failed / using cache / offline" entry ever appears in 14 min.
- Meanwhile the cached branch demonstrably ran: table rendered from snapshot (S2/S3, TKT-8471…8467),
  panels show cached content. So the *data* fallback path executed while the *status* path did not.

**Desync mechanism**
The status rendered by the header pill is not the same truth as the data surfaces. Data surfaces settled
(cached snapshot loaded, "Unavailable — API offline" rendered), but the status value feeding the pill never
left `'checking'`.

**Root cause** — mechanism [CONFIRMED from evidence]; exact line [INFERRED — needs src/ to confirm file:line].
Ranked candidates:
1. **(Most likely) The probe's failure path never writes the status the pill reads.** The cached fallback
   runs (snapshot is loaded — proven by the populated table), but the rejection handler updates data fields
   only, and `status = 'offline'|'cached'` lives only in the success branch or is never called. Fits all
   evidence: fallback executed, pill untouched, no failure log entry.
2. **Pill subscribes to a different status field than the data surfaces** (e.g. panels read
   `dataSource === 'cache'` while the pill reads a `health: 'unknown'` that nothing mutates). Equivalent
   fix: one status union, one subscriber.
3. **(Ruled out) Infinite retry that resets to `checking`.** S6 shows exactly 3 network errors across the
   whole session; a retry loop would emit repeated `ERR_CONNECTION_TIMED_OUT` over 14 minutes. Also the
   probe promise *did* reject (browser-level timeout), so "promise never resolves" is not the mechanism —
  the rejection is simply not propagated to status.

**Patch — corrected useApi status state machine (complete reference implementation)**

State machine: `checking → live | cached | offline`. `checking` is re-enterable only via an explicit
`probe()` call (refresh button, settings override). Every probe **always settles exactly once**; every
transition logs to the Event Log (which also fixes the missing "probe failed" log entry).

`src/hooks/useApi.ts`:
```ts
import { useSyncExternalStore } from 'react';
import { logEvent } from './useEventLog';
import { getApiBaseUrl } from './useSettings';

/** Unified API/data provenance status. THE single source of truth — pill, badges,
 *  panels and footers all derive from this, never from local state. */
export type ApiStatus = 'checking' | 'live' | 'cached' | 'offline';
/** Where the data currently on screen came from. */
export type DataSource = 'live' | 'cache' | 'none';

export interface SnapshotMeta {
  /** ISO-8601 timestamp embedded in public/cache/tickets-snapshot.json */
  readonly generatedAt: string;
}

export interface ApiState {
  readonly status: ApiStatus;
  readonly source: DataSource;
  /** epoch ms of the last successful health probe, null if never live */
  readonly lastLiveAt: number | null;
  /** snapshot metadata when source === 'cache', else null */
  readonly snapshot: SnapshotMeta | null;
  /** consecutive probe failures (diagnostics) */
  readonly failures: number;
}

const PROBE_TIMEOUT_MS = 6_000;
const SNAPSHOT_URL = '/cache/tickets-snapshot.json';

let state: ApiState = {
  status: 'checking',
  source: 'none',
  lastLiveAt: null,
  snapshot: null,
  failures: 0,
};

const listeners = new Set<() => void>();

function emit(patch: Partial<ApiState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ApiState {
  return state;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, cache: 'no-store' });
  } finally {
    window.clearTimeout(timer);
  }
}

interface SnapshotFileShape {
  generatedAt?: unknown;
}

async function loadSnapshotMeta(): Promise<SnapshotMeta | null> {
  try {
    const res = await fetchWithTimeout(SNAPSHOT_URL, PROBE_TIMEOUT_MS);
    if (!res.ok) return null;
    const body: SnapshotFileShape = await res.json();
    return typeof body.generatedAt === 'string'
      ? { generatedAt: body.generatedAt }
      : { generatedAt: 'unknown' };
  } catch {
    return null;
  }
}

let inFlight: Promise<void> | null = null;

/** (Re)probe the API. ALWAYS settles status to live | cached | offline.
 *  Safe to call concurrently — duplicate calls join the in-flight probe. */
export function probe(): Promise<void> {
  if (inFlight === null) {
    inFlight = runProbe().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function runProbe(): Promise<void> {
  emit({ status: 'checking' });
  logEvent('DEBUG', 'Health probe started');
  try {
    const res = await fetchWithTimeout(`${getApiBaseUrl()}/health`, PROBE_TIMEOUT_MS);
    if (!res.ok) throw new Error(`health check HTTP ${res.status}`);
    emit({ status: 'live', source: 'live', lastLiveAt: Date.now(), failures: 0 });
    logEvent('INFO', 'API reachable — live data');
    return;
  } catch {
    // fall through to the cache branch — a rejected probe must still settle status
  }
  const snapshot = await loadSnapshotMeta();
  if (snapshot !== null) {
    emit({ status: 'cached', source: 'cache', snapshot, failures: state.failures + 1 });
    logEvent('INFO', 'API unreachable — displaying cached snapshot');
  } else {
    emit({ status: 'offline', source: 'none', snapshot: null, failures: state.failures + 1 });
    logEvent('ERROR', 'API offline — no cached snapshot available');
  }
}

/** Boot once from App.tsx: useEffect(() => { void probe(); }, []); */
export function useApi(): ApiState & { readonly probe: () => Promise<void> } {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { ...current, probe };
}
```

`src/components/StatusPill.tsx` (header pill — derives ONLY from `useApi`, fixes F8 tooltip at the same time):
```tsx
import { useCallback, useEffect, useId, useState } from 'react';
import { useApi, type ApiStatus } from '../hooks/useApi';

const LABEL: Record<ApiStatus, string> = {
  checking: 'Checking…',
  live: 'Live',
  cached: 'Cached',
  offline: 'Offline',
};

const TOOLTIP: Record<ApiStatus, string> = {
  checking: 'Probing the API health endpoint…',
  live: 'Connected to the API — data is live.',
  cached: 'API unreachable — showing the cached snapshot. Click to retry.',
  offline: 'API offline and no cached snapshot available. Click to retry.',
};

const DOT_COLOR: Record<ApiStatus, string> = {
  checking: 'var(--text-muted)',
  live: 'var(--accent-emerald)',
  cached: 'var(--accent-amber)',
  offline: 'var(--accent-rose)',
};

export function StatusPill(): JSX.Element {
  const { status, probe } = useApi();
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <div style={{ position: 'relative' }}>
      <div
        tabIndex={0}
        role="button"
        aria-describedby={open ? tooltipId : undefined}
        aria-label={`API status: ${LABEL[status]}. ${TOOLTIP[status]}`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={close}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onClick={() => {
          close();
          void probe();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 12px',
          borderRadius: 20,
          border: '1px solid var(--border-default)',
          background: 'var(--bg-card)',
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          color: DOT_COLOR[status],
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: DOT_COLOR[status],
            display: 'inline-block',
            marginRight: 6,
            flexShrink: 0,
            animation: status === 'checking' ? 'pulse 1.2s ease-in-out infinite' : 'none',
          }}
        />
        {LABEL[status]}
      </div>
      {open && (
        <div
          id={tooltipId}
          role="tooltip"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 200,
            maxWidth: 260,
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid var(--border-default)',
            background: 'var(--bg-elevated)',
            color: 'var(--text-secondary)',
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          {TOOLTIP[status]}
        </div>
      )}
    </div>
  );
}
```

**Acceptance (10 s)**
1. With API offline: load the page → within ≤ 7 s the pill leaves "Checking…" and shows amber **Cached**
   (snapshot present) — and the Event Log gains "API unreachable — displaying cached snapshot".
2. Click the pill → it returns to "Checking…" and settles again within ≤ 7 s (never stuck).
3. Start a local mock on the configured URL → click pill → pill turns green **Live**; Event Log logs it.
4. `grep -n "setStatus\|emit(" src/hooks/useApi.ts` — status is written in the catch/fallback path too.

---

## F2 — P0 (honesty-adjacent) — CACHED badge shown on panels with NO cached data

**Evidence**
- S2 + text-content.txt: System Monitor header carries `CACHED` (line 63) while all four rows render
  "—" + "Unavailable — API offline" (lines 64–75). Classification Performance carries `CACHED` (line 57)
  while its body says "Awaiting live performance data" (line 58) — i.e. there is no cached performance data.
- dom.html: 4 uppercase `CACHED` badges; badge on Classification Performance @`>CACHED<` occurrence 2 sits
  directly above the empty-state body.
- Bonus inconsistency [CONFIRMED from evidence]: badges 0–2 are Tailwind classes
  (`text-accent-amber bg-accent-amber/10 px-2 py-1 rounded`, no border); badge 3 (System Monitor) is inline
  styles **with** `border:1px solid rgba(245,158,11,0.3)`. Two badge implementations, two looks.

**Defect**
Per the Honesty Contract, `live` / `cached` / `offline-no-cache` are distinct states. A CACHED badge asserts
"this panel is showing snapshot data". On System Monitor and Classification Performance that assertion is
false — the badge overstates data availability. This is a soft Honesty-Contract violation: not fabricated
data, but a fabricated *provenance claim*.

**Root cause** [INFERRED — needs src/ to confirm file:line]: the badge is keyed to the global API status
("API is down ⇒ stamp CACHED everywhere") instead of to each panel's actual data provenance
(`source === 'cache'` AND the panel holds cached rows). Panels with no cached counterpart inherit a badge
they did not earn.

**Corrected state → badge matrix**

| Panel data state | Badge | Body | Footer |
|---|---|---|---|
| `live` | none (provenance is the default) — optional subtle emerald `LIVE` | live data | none |
| `cached` (snapshot rows exist for this panel) | amber `CACHED` | cached data | `Snapshot: cached · generated <ts>` |
| `offline-no-cache` (API down, no cached rows for this panel) | **NO badge** | `Unavailable — API offline` / honest empty copy | **NO snapshot footer** |
| `checking` (transient, ≤ probe timeout) | none | neutral `Connecting…` (no skeleton implying live data) | none |

Applied to the current screenshot: Threat Category Distribution, Model Footprint, Recent Classifications,
KPI Latency/Throughput → keep `CACHED`. **System Monitor → remove CACHED. Classification Performance →
remove CACHED.**

**Patch — single badge + provenance gate**

`src/components/ProvenanceBadge.tsx`:
```tsx
import type { DataSource } from '../hooks/useApi';

interface ProvenanceBadgeProps {
  /** Provenance of the data THIS panel is actually displaying — never the global API state. */
  readonly source: DataSource;
}

/** Renders the amber CACHED badge iff the panel is really showing snapshot data.
 *  live → null (no badge). none → null (the empty state speaks for itself). */
export function ProvenanceBadge({ source }: ProvenanceBadgeProps): JSX.Element | null {
  if (source !== 'cache') return null;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.3px',
        textTransform: 'uppercase',
        padding: '2px 6px',
        borderRadius: 4,
        color: 'var(--accent-amber)',
        background: 'color-mix(in srgb, var(--accent-amber) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent-amber) 30%, transparent)',
      }}
    >
      Cached
    </span>
  );
}
```

Panel wiring pattern (each panel computes its own provenance — reference for System Monitor, the panel
currently mis-badged in S2):
```tsx
import { useApi, type DataSource } from '../hooks/useApi';
import { ProvenanceBadge } from './ProvenanceBadge';
import { SnapshotFooter } from './SnapshotFooter';

export interface MonitorMetrics {
  readonly cpuPct: number;
  readonly memPct: number;
  readonly apiLatencyMs: number;
  readonly requestsPerMin: number;
}

interface SystemMonitorPanelProps {
  readonly liveMetrics: MonitorMetrics | null;
  readonly cachedMetrics: MonitorMetrics | null;
}

const ROWS: ReadonlyArray<{ readonly label: string; readonly value: (m: MonitorMetrics) => string }> = [
  { label: 'CPU (Neoverse N1)', value: (m) => `${m.cpuPct}%` },
  { label: 'Memory (RAM)', value: (m) => `${m.memPct}%` },
  { label: 'API Latency', value: (m) => `${m.apiLatencyMs}ms` },
  { label: 'Requests / Min', value: (m) => String(m.requestsPerMin) },
];

/** Badge, body AND footer all derive from panelSource — never from global API status alone. */
export function SystemMonitorPanel({ liveMetrics, cachedMetrics }: SystemMonitorPanelProps): JSX.Element {
  const { source: apiSource } = useApi();
  const metrics = apiSource === 'live' ? liveMetrics : cachedMetrics;
  const panelSource: DataSource =
    apiSource === 'live' && liveMetrics !== null ? 'live' : metrics !== null ? 'cache' : 'none';

  return (
    <section
      id="system-monitor"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          height: 'var(--density-widget-head-h)',
          padding: '0 var(--density-card-pad)',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
            System Monitor
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>ARM64 infrastructure resources</p>
        </div>
        <ProvenanceBadge source={panelSource} />
      </div>
      <div style={{ padding: '0 var(--density-card-pad) var(--density-card-pad)' }}>
        {ROWS.map((row) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              height: 'var(--density-row-h)',
              borderTop: '1px solid var(--border-default)',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.label}</span>
            {metrics !== null ? (
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-numeric)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {row.value(metrics)}
              </span>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Unavailable — API offline</span>
            )}
          </div>
        ))}
      </div>
      <SnapshotFooter source={panelSource} />
    </section>
  );
}
```
(`SnapshotFooter` now takes the panel's provenance — see updated F4.)

**Acceptance (10 s)**
1. API offline: System Monitor and Classification Performance headers show **no** CACHED badge; bodies keep
   their honest "Unavailable — API offline" / "Awaiting live performance data" copy.
2. Threat chart, Model Footprint, Recent Classifications keep the amber CACHED badge.
3. All badges pixel-identical (one component): `grep -rn "CACHED" src/components | wc -l` → `1`
   (inside `ProvenanceBadge.tsx`).

---

## F3 — P1 — Bell badge "3 unread" vs Event Log's 2 entries (counter not store-derived)

**Evidence**
- S1: bell badge shows **3**.
- dom.html @14372: `<button aria-label="Notifications, 3 unread"…>…<span …background:var(--accent-rose)…>3</span></button>`.
- a11y-attrs.txt line 9: `('button', 'aria-label', 'Notifications, 3 unread', '')`.
- Same DOM: `#event-log` contains exactly **2** entries — `INFO Dashboard initialized`,
  `DEBUG Health probe started` (verified by parsing the `#event-log` segment; S4 agrees).

**Desync mechanism**
The unread counter is not a function of the Event Log entries. There are 2 log entries and the badge says 3.

**Root cause** [INFERRED — needs src/ to confirm file:line] — the rendered DOM proves the desync but not
which of these lines causes it, ranked:
1. Counter is a separate `useState` seeded with a nonzero initial value (e.g. `useState(3)`) and
   incremented by a path that double-counts or was left from development.
2. Counter counts a different stream (e.g. alerts) than the log the panel renders — either way it must be
   derived, not maintained.

**Patch — useEventLog as the single source, unread derived**

`src/hooks/useEventLog.ts`:
```ts
import { useSyncExternalStore } from 'react';

export type EventLevel = 'INFO' | 'DEBUG' | 'ERROR';

export interface EventEntry {
  readonly id: string;
  /** epoch ms */
  readonly at: number;
  readonly level: EventLevel;
  readonly message: string;
  readonly read: boolean;
}

interface EventLogState {
  readonly entries: readonly EventEntry[];
  /** derived — always entries.filter(!read).length, maintained eagerly so
   *  useSyncExternalStore snapshots stay referentially stable */
  readonly unreadCount: number;
}

const MAX_ENTRIES = 200;

let state: EventLogState = { entries: [], unreadCount: 0 };
let nextId = 1;

const listeners = new Set<() => void>();

function emit(next: EventLogState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): EventLogState {
  return state;
}

/** Non-React logger — safe to call from any store/module (useApi imports this). */
export function logEvent(level: EventLevel, message: string): void {
  const entry: EventEntry = {
    id: `evt-${nextId}`,
    at: Date.now(),
    level,
    message,
    read: false,
  };
  nextId += 1;
  const entries = [entry, ...state.entries].slice(0, MAX_ENTRIES);
  emit({ entries, unreadCount: entries.reduce((n, e) => (e.read ? n : n + 1), 0) });
}

/** Mark every entry read — call when the notification panel / event log is opened. */
export function markAllRead(): void {
  if (state.unreadCount === 0) return;
  emit({
    entries: state.entries.map((e) => (e.read ? e : { ...e, read: true })),
    unreadCount: 0,
  });
}

export function useEventLog(): EventLogState & { readonly markAllRead: () => void } {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { ...current, markAllRead };
}
```

`src/components/NotificationBell.tsx`:
```tsx
import { useEventLog } from '../hooks/useEventLog';

interface NotificationBellProps {
  /** opens the notification panel / navigates to the event log */
  readonly onOpen: () => void;
}

export function NotificationBell({ onOpen }: NotificationBellProps): JSX.Element {
  const { unreadCount, markAllRead } = useEventLog();

  const handleClick = (): void => {
    markAllRead();
    onOpen();
  };

  return (
    <button
      type="button"
      aria-label={unreadCount === 0 ? 'Notifications, no unread' : `Notifications, ${unreadCount} unread`}
      onClick={handleClick}
      style={{
        width: 34,
        height: 34,
        borderRadius: 8,
        border: '1px solid var(--border-default)',
        background: 'transparent',
        color: 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: '150ms',
        position: 'relative',
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10.268 21a2 2 0 0 0 3.464 0" />
        <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
      </svg>
      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            minWidth: 14,
            height: 14,
            borderRadius: 7,
            background: 'var(--accent-rose)',
            color: 'var(--text-inverse)',
            fontSize: 9,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            fontFamily: 'var(--font-numeric)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {unreadCount}
        </span>
      )}
    </button>
  );
}
```

**Acceptance (10 s)**
1. Fresh load with 2 log entries → badge reads **2**, aria-label "Notifications, 2 unread".
2. Trigger a re-probe (click status pill) → a new log entry appears and the badge increments by exactly 1.
3. Open the notification panel → badge disappears (`unreadCount === 0` ⇒ no badge rendered).
4. `grep -rn "useState(3)\|unread" src/components/NotificationBell* src/hooks/useEventLog*` — no seeded
   literal remains; badge text is `unreadCount` only.

---

## F4 — P1 — "Snapshot: cached" footer hand-rendered by 6 panels independently

**Evidence**
- dom.html: exactly **6** occurrences of `Snapshot: cached`, each a per-panel footer:
  `#threat-chart`, `#model-health`, `#performance-chart`, `#system-monitor`, classifications table,
  `#event-log` (text-content.txt lines 48, 53, 60, 76, 134, 147; S2/S4 show them).
- Structural drift already present [CONFIRMED from evidence]: the `#model-health` footer uses
  `justify-content:space-between` with an extra trailing span; the other five use
  `justify-content:flex-end`. Same component, two layouts.
- Semantic drift present too: Event Log shows "Snapshot: cached" although log entries are live session
  events, not snapshot data — the footer is copy-pasted, not reasoned about.

**Defect**
Six hardcoded copies of provenance copy. Any future change (timestamp, wording, live/cached switch) must be
made 6 times; panels can and already do disagree. A panel could claim "Snapshot: cached" while the store is
`live` — an honesty risk by construction.

**Root cause** [CONFIRMED from evidence]: no shared component — each panel renders its own literal
`<span>Snapshot: cached</span>` instead of reading `useApi().source`/`snapshot`.

**Patch — single source**

`src/components/SnapshotFooter.tsx`:
```tsx
import { useApi, type DataSource } from '../hooks/useApi';

interface SnapshotFooterProps {
  /** Provenance of the data THIS panel displays — footer renders only for 'cache'. */
  readonly source: DataSource;
}

function formatSnapshotTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ms));
}

/** The ONLY snapshot footer in the app. Timestamp comes from the store; the decision
 *  to render comes from the panel's own provenance — panels never write provenance copy. */
export function SnapshotFooter({ source }: SnapshotFooterProps): JSX.Element | null {
  const { snapshot } = useApi();
  if (source !== 'cache' || snapshot === null) return null;
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        padding: '6px var(--density-card-pad) 8px',
        borderTop: '1px solid var(--border-default)',
      }}
    >
      <span style={{ fontSize: 'var(--caption-size)', color: 'var(--caption-color)' }}>
        Snapshot: cached · generated {formatSnapshotTime(snapshot.generatedAt)}
      </span>
    </div>
  );
}
```

Migration: in `#threat-chart`, `#model-health`, `#performance-chart`, `#system-monitor` and the
classifications table, delete the hand-written footer div and render `<SnapshotFooter source={panelSource} />`
as the card's last child. **Remove it entirely from Event Log** — session log entries are not snapshot data,
so the log panel must not render the component at all.

**Acceptance (10 s)**
1. `grep -rn "Snapshot: cached" src/` → exactly **1** hit, inside `SnapshotFooter.tsx`.
2. API offline: the five data panels show identical footers including the snapshot's `generatedAt`
   timestamp; Event Log shows none.
3. All footers aligned the same way (one component, one layout).

---

## F5 — P2 — "Last 24 hours" filter: behavior over cached data undefined [INFERRED — needs src/ to confirm]

**Evidence**
- S1 + dom.html @14041: the control is a `<button aria-haspopup=listbox aria-expanded=false>Last 24 hours</button>`.
  The listbox was never opened in the captured session; with scripts stripped there is no handler to inspect.
- All visible tickets are relative-dated ("2m ago"…"18m ago", text-content.txt lines 101–129), i.e. within
  24 h, so even a working filter is a visual no-op over the current snapshot.

**Defect (latent)**
Unknown whether selecting a range (a) filters the cached snapshot client-side, (b) refetches (impossible
while offline → silent no-op), or (c) does nothing. (b) and (c) are dishonest UI: a control that implies
agency it does not have.

**Root cause** [INFERRED — needs src/ to confirm file:line]: filter likely wired only to the live query
path (`useTickets`/`useTicketQuery`), bypassed when the store serves `source === 'cache'`.

**Expected honest behavior (spec)**
1. Range filtering is a **pure client-side function applied to whatever dataset is on screen**, live or
   cached — same code path for both.
2. When `source === 'cache'`, the control keeps working over the snapshot AND the header makes scope
   explicit: append a muted `· cached data` suffix to the button label (or a caption next to it).
3. Tickets older than the range are filtered out of table, category chart and counts; the pagination
   summary ("Showing x–y of z") reflects the filtered total.

**Patch**

`src/lib/timeRange.ts`:
```ts
export type TimeRange = '24h' | '7d' | '30d';

export const TIME_RANGE_LABEL: Record<TimeRange, string> = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
};

const RANGE_MS: Record<TimeRange, number> = {
  '24h': 86_400_000,
  '7d': 604_800_000,
  '30d': 2_592_000_000,
};

/** Pure filter — applied to live tickets AND the cached snapshot identically. */
export function filterByTimeRange<T extends { readonly createdAt: number }>(
  items: readonly T[],
  range: TimeRange,
  now: number,
): T[] {
  const cutoff = now - RANGE_MS[range];
  return items.filter((item) => item.createdAt >= cutoff);
}
```

`src/components/TimeRangeLabel.tsx` (render inside the existing `aria-haspopup="listbox"` button):
```tsx
import { useApi } from '../hooks/useApi';
import { TIME_RANGE_LABEL, type TimeRange } from '../lib/timeRange';

interface TimeRangeLabelProps {
  readonly range: TimeRange;
}

/** Range label with explicit provenance suffix — the filter works over the snapshot
 *  while offline, and the UI says so (Honesty Contract). */
export function TimeRangeLabel({ range }: TimeRangeLabelProps): JSX.Element {
  const { source } = useApi();
  return (
    <span>
      {TIME_RANGE_LABEL[range]}
      {source === 'cache' && <span style={{ color: 'var(--text-muted)' }}>&nbsp;· cached data</span>}
    </span>
  );
}
```

**Acceptance (10 s)**
1. With API offline, switch to "Last 24 hours" → button label shows "Last 24 hours · cached data".
2. Snapshot containing a ticket older than the range → it disappears from table + chart; "Showing …" total
   drops accordingly.
3. `grep -n "filterByTimeRange" src/hooks/useTickets.ts src/hooks/useTicketQuery.ts` → the pure fn is used
   in the shared selector, not only in the live branch.

---

## F6 — P2 — Pagination math "Showing 1–5 of 6": VERIFIED CONSISTENT (no defect; hardening patch)

**Evidence**
- S3 + text-content.txt line 130: "Showing 1–5 of 6".
- dom.html @159272: `<button disabled aria-disabled=true …cursor:not-allowed>Previous</button>
  <span>Page 1</span><button aria-disabled=false …cursor:pointer>Next</button>`.

**Verdict** [CONFIRMED from evidence]: math is correct for 6 items at page size 5 — page 1 shows items
1–5, Previous disabled on the first page, Next enabled (page 2 exists with item 6). No desync between the
summary string, the button states and the row count (5 rows rendered: TKT-8471…8467). **No P0/P1 defect.**

**Residual risk** [INFERRED]: the string, the slice and the button disables are likely computed separately
in the component; drift appears the day page size changes or a filter empties page 2 while the user sits on
it (page index not clamped after filtering — classic desync: "Page 2" with "Showing 0–0 of 3").

**Hardening patch — one pure function owns the math**

`src/lib/paginate.ts`:
```ts
export interface PageResult<T> {
  readonly items: readonly T[];
  /** 1-based, clamped into [1, pageCount] */
  readonly page: number;
  readonly pageCount: number;
  readonly total: number;
  /** 1-based index of first visible row, 0 when total === 0 */
  readonly from: number;
  /** 1-based index of last visible row, 0 when total === 0 */
  readonly to: number;
  readonly hasPrev: boolean;
  readonly hasNext: boolean;
}

export function paginate<T>(all: readonly T[], requestedPage: number, pageSize: number): PageResult<T> {
  const total = all.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  return {
    items: all.slice(start, end),
    page,
    pageCount,
    total,
    from: total === 0 ? 0 : start + 1,
    to: end,
    hasPrev: page > 1,
    hasNext: page < pageCount,
  };
}

export function pageSummary(result: PageResult<unknown>): string {
  return result.total === 0 ? 'No results' : `Showing ${result.from}–${result.to} of ${result.total}`;
}
```

Component contract: `paginate()` output drives the row slice, the summary string, and both button
`disabled` flags; when the filtered total shrinks, `useTicketQuery` writes the clamped `page` back into its
state so the URL/store never holds an out-of-range page.

**Acceptance (10 s)**
1. Page 1 of 6 @ size 5: "Showing 1–5 of 6", Previous disabled, Next enabled (matches current DOM).
2. Click Next → "Showing 6–6 of 6", Previous enabled, Next disabled.
3. Type a query in the sidebar search that matches 1 ticket while on page 2 → view clamps to page 1,
   "Showing 1–1 of 1" (no empty page 2).

---

## F7 — P0(flow) — Settings API-override → re-probe: no evidence; acceptance test + grep patterns

**Evidence**
- None available: the captured session never opened Settings (gear button exists in header,
  `aria-label="Settings"`, a11y-attrs.txt line 10) and `src/` is absent. The flow's existence and wiring
  are unverifiable today — flagged for verification on src/ arrival.

**Expected flow (spec)**
1. Settings persists `apiBaseUrl` (useSettings; localStorage-backed override, default
   `http://3.23.60.61:8000`).
2. Saving the override calls `probe()` from useApi (F1) → status re-enters `checking` → settles
   `live | cached | offline` per the state machine.
3. Event Log records `DEBUG API endpoint updated — re-probing health` followed by the probe outcome entry.
4. The manual Refresh button (`aria-label="Refresh data"`, dom.html) calls the same `probe()`.

**Grep patterns to verify once src/ arrives**
```bash
# 1. Where the base URL lives and who reads it
grep -rn "apiBaseUrl\|baseUrl\|VITE_API" src/
# 2. Settings setter triggers a re-probe (this import/call is the whole fix)
grep -n "probe\|reprobe" src/hooks/useSettings.ts src/components/Settings*.tsx
# 3. Probe writes status in BOTH success and failure paths
grep -n "status" src/hooks/useApi.ts
# 4. Refresh button is wired to probe(), not location.reload()
grep -n "Refresh data" -A6 src/components/*.tsx
# 5. No second status source
grep -rn "Checking…\|'checking'" src/          # → only useApi.ts + StatusPill.tsx
```

**Acceptance test (once src/ exists)**
1. Point the override at a local mock (`http://localhost:9000`) → Save → pill shows "Checking…" then green
   **Live** within ≤ 7 s; Event Log shows the re-probe pair of entries.
2. Point it back at the dead IP → Save → pill settles amber **Cached**; no stuck "Checking…".
3. Reload the page → the override persists (localStorage) and the boot probe uses it.

---

## F8 — P1 — Stuck tooltip over header + dangling `aria-describedby`

**Evidence**
- S1: a tooltip card ("Latency data comes from the live metrics endpoint when available. Sparkline shows
  the last 24 points.") is rendered under the breadcrumb, overlapping the page title, with nothing hovered.
- dom.html: status pill carries `aria-describedby=status-tooltip`, but **no element with
  `id="status-tooltip"` exists anywhere in the DOM** (verified by search; `role="tooltip"` also absent) —
  a dangling ARIA reference [CONFIRMED from evidence].

**Defect / root cause** — dangling reference [CONFIRMED]; stuck visibility [INFERRED — needs src/ to confirm
file:line]: tooltip visibility appears detached from hover/focus state (rendered once, never unmounted on
pointer leave), and the descriptor id is referenced whether or not the tooltip node exists.

**Patch**: covered by the `StatusPill` reference implementation in F1 — tooltip mounts only while `open`
(hover/focus), unmounts on leave/blur/Escape, `aria-describedby` is set only when the node exists, and the
id comes from `useId()`. The KPI info tooltips (owner of the S1 artifact) must use the same pattern; extract
the popover into one shared `InfoTooltip` if more than two call sites exist.

**Acceptance (10 s)**
1. Load page, hover nothing → no tooltip visible anywhere.
2. Tab to the status pill → tooltip appears, `aria-describedby` resolves to an existing id
   (DevTools: `document.getElementById(pill.getAttribute('aria-describedby'))` → element, not `null`).
3. Move focus away / press Escape → tooltip unmounts; the attribute is removed.

---

## Cross-cutting store notes (for the fix implementer)

- **One status, many readers.** After F1+F2, `useApi().status`/`source` is read by: StatusPill,
  ProvenanceBadge (via per-panel `panelSource`), SnapshotFooter, the time-filter label suffix, and panel
  empty states. Nothing else may hold a copy of "are we online".
- **Boot sequence**: `App.tsx` → `useEffect(() => { void probe(); }, [])` → Event Log gets
  "Dashboard initialized" then "Health probe started" then exactly one outcome entry. The current capture
  stops after entry #2 — that missing third entry is the fingerprint of F1.
- **No new dependencies** in any patch above (React 19 built-ins only: `useSyncExternalStore`, `useId`).
- **Tokens only**: patches reference `var(--accent-amber|emerald|rose|indigo)`, `var(--text-*)`,
  `var(--border-default)`, `var(--bg-card|elevated)`, `var(--density-card-pad)`,
  `var(--caption-size|--caption-color)`, `var(--font-numeric)` — all present in tokens.css per
  evidence/inlined-css.txt. Badge alpha backgrounds use `color-mix()` on tokens (no raw rgba).
- **Honesty Contract preserved**: no patch fabricates data, adds skeletons, or hides the offline state;
  F2 removes an overclaim, F4/F5 make provenance labels strictly store-derived.
