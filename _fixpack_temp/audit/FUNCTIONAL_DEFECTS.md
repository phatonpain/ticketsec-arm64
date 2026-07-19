# W-02 — FUNCTIONAL DEFECTS (interaction-engineer)

Scope: everything that "doesn't work" in the TicketSec Arm64 dashboard, verified against the
saved runtime DOM (`evidence/dom.html`, 184 KB, scripts stripped), `evidence/a11y-attrs.txt`,
`evidence/inlined-css.txt` (121 defined custom properties), `evidence/text-content.txt`, and
screenshots S1–S6. The real `src/` was NOT provided, so every patch is a **complete reference
implementation** keyed to the known architecture. Findings whose code-level root cause cannot be
seen in evidence are tagged **[INFERRED — needs src/ to confirm file:line]**; everything else is
**[CONFIRMED from evidence]**.

Honesty Contract preserved throughout: no patch fabricates data, hides the offline state, or adds
skeletons that imply live data. Offline stays loud and explicit.

## A11y / interactivity quantification (app DOM only, extension nodes excluded)

Counted in `evidence/dom.html` up to `</footer>` (168,236 chars). The 4 `float-btn` /
`chat-gpt-query-model-wrapper` entries in `a11y-attrs.txt` lines 45–48 and the
`MaxListenersExceededWarning` in S6 are **browser-extension noise, not the app**.

| Kind | Count | Accessible name? |
|---|---|---|
| `<button>` | 31 | yes (text content, or `aria-label` on the 3 icon-only header buttons) |
| `<a>` | 7 | 5 are dead `href="#"` ticket links (**F-09**); 2 external (F-10) |
| `<input>` | 1 | `aria-label="Search tickets"` ✓ |
| `<textarea>` | 1 | `aria-label="Ticket text"` ✓ |
| `<select>` | 0 | — ("Last 24 hours" is a button+listbox pattern) |
| `div[role=button][tabindex=0]` | 1 | status pill — text name ✓, activation keyboard handling unverifiable [INFERRED] |
| `tr[tabindex=0]` | 5 | row activation handler unverifiable [INFERRED] |

Total focusable/interactive: **46**. ARIA usage: `aria-label` ×10 (5 of them on invisible
severity dots — see F-02), `aria-sort` ×8 (correct: `descending` on Time, `none` elsewhere),
`aria-expanded`/`aria-haspopup` ×1 (time-range), `aria-current` ×1, `aria-disabled` ×2,
`aria-describedby` ×5 (4 KPI cards + status pill), `aria-hidden` ×21 (icons ✓).
Missing: `aria-pressed` on filter chips (F-13), `role=log`/`aria-live` on the log (F-13),
`aria-haspopup` on the bell (F-07), visible focus on 3 controls with inline `outline:none`
that beats the global `:focus-visible` rule (F-12).

## Findings index

| # | Sev | Title | Root cause |
|---|---|---|---|
| F-01 | **P0** | Health probe never settles — pill stuck "Checking…" forever, no ERROR log entry | INFERRED code / CONFIRMED behavior |
| F-02 | **P0** | Severity column renders invisible dots — `--sev-*` tokens used but never defined | CONFIRMED |
| F-03 | P1 | Category badge colors broken (`--cat-*` undefined) + badge clipped mid-word ("Unauthorized Acces") | CONFIRMED |
| F-04 | P1 | `SEVERITY ⇅CONFIDENCE ⇅` header overlap (70 px column, nowrap, no overflow guard) | CONFIRMED |
| F-05 | P1 | KPI tooltip stuck open over header/h1; no dismiss, no collision handling, not keyboard-reachable | CONFIRMED visual / INFERRED code |
| F-06 | P1 | System Monitor shows CACHED badge while all 4 metrics are "Unavailable — API offline" | CONFIRMED |
| F-07 | P1 | Bell badge "3 unread" desyncs from Event Log (2 entries) | CONFIRMED desync / INFERRED code |
| F-08 | P1 | ECharts 6: `grid.containLabel` silently ignored (console warning, S6) | CONFIRMED |
| F-09 | P1 | Ticket-ID links are dead `href="#"` anchors | CONFIRMED markup / INFERRED handler |
| F-10 | P2 | Footer "API Docs" navigates the tab away to the offline API (no `target=_blank`) | CONFIRMED |
| F-11 | P2 | "Classify Ticket" silently disabled — offline reason not stated; chips lack `type=button` | CONFIRMED markup |
| F-12 | P2 | Focus indicator suppressed on search input / textarea / status pill | CONFIRMED |
| F-13 | P2 | Event Log: filter chips without `aria-pressed`, no `role=log`/`aria-live` | CONFIRMED markup |
| F-14 | P2 | Model Footprint donut: center value overlaps slice labels | CONFIRMED visual |
| F-15 | P2 | Export CSV wiring unverifiable → complete implementation supplied | INFERRED |
| F-16 | P2 | "Last 24 hours" listbox only verifiable in closed state → complete implementation supplied | INFERRED |

**Verified NOT defects:** pagination "Previous" is correctly `disabled aria-disabled=true` +
`cursor:not-allowed` on page 1 (dom.html `<button disabled aria-disabled=true …>Previous</button>`);
`lang=en` and `<title>` present (S5/upload HTML); `aria-sort` states correct; icon-only header
buttons all have `aria-label`; sample chips and filter chips are real `<button>` elements.

---

## F-01 — P0 — Health probe never settles; status pill stuck on "Checking…"

**Evidence.** S1–S4 (13:33:45 → 13:34:14) and the DOM capture (13:38:05) all show the pill as
`Checking…` with the pulsing-dot animation still running — ≥ 4.5 minutes without settling.
Locator: dom.html `<div tabindex=0 role=button aria-describedby=status-tooltip …cursor:help…>…Checking…</div>`
with `animation:1.2s ease-in-out 0s infinite normal none running pulse` on the dot. S6 shows
`ERR_CONNECTION_TIMED_OUT` for `3.23.60.61:8000/health` already at 13:34:57 — the rejection
happened but the UI state never changed. Event Log (S4, dom.html `id=event-log`) contains only
`INFO Dashboard initialized` and `DEBUG Health probe started` — **no failure entry was ever logged**.

**Defect.** The health probe hangs or swallows rejection: the store stays in its initial
`checking` state forever. Consequences: (a) the header permanently claims an indeterminate state —
a status-honesty violation in spirit (the rest of the UI already knows it is offline and shows
cached data); (b) no ERROR entry reaches the Event Log; (c) the `aria-describedby=status-tooltip`
target never announces a resolved state.

**Root cause.** [INFERRED — needs src/ to confirm file:line] `useApi` starts `fetch(API + '/health')`
without an `AbortController` timeout and/or without a `.catch` that writes the terminal `offline`
state. Chrome's TCP-connect timeout is minutes long; even after the network stack rejects
(seen in S6), nothing transitions the store, so the pill and log never update.

**Repro.** 1. Start the app with the API unreachable. 2. Observe the header pill. 3. Wait past the
console `ERR_CONNECTION_TIMED_OUT`. 4. Pill still reads "Checking…"; Event Log has no ERROR entry.

**Patch 1 of 4 — `src/lib/backoff.ts` (new file, pure; no deps):**

```ts
/** Exponential backoff helpers for retry loops. Pure and fully testable. */

export interface BackoffOptions {
  /** First retry delay. Default 1000 ms. */
  readonly baseMs?: number;
  /** Hard ceiling for any single delay. Default 30_000 ms. */
  readonly capMs?: number;
  /** Add ±25% jitter to avoid thundering-herd retries. Default true. */
  readonly jitter?: boolean;
}

/** Delay before retry `attempt` (0-based): base * 2^attempt, capped, jittered. */
export function nextDelay(attempt: number, opts: BackoffOptions = {}): number {
  const { baseMs = 1000, capMs = 30_000, jitter = true } = opts;
  const exp = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt));
  if (!jitter) return exp;
  const spread = exp * 0.25;
  return Math.round(exp - spread + Math.random() * spread * 2);
}

/** setTimeout as a promise; rejects with an AbortError if `signal` fires first. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
```

**Patch 2 of 4 — `src/hooks/useEventLog.ts` (complete file; singleton store, React 19):**

```ts
import { useSyncExternalStore } from 'react';

export type LogLevel = 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';

export interface LogEntry {
  readonly id: string;
  readonly ts: number;
  readonly level: LogLevel;
  readonly message: string;
}

const MAX_ENTRIES = 200;

let entries: readonly LogEntry[] = [];
let lastReadAt = 0;
let seq = 0;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

/** Append an entry. Module-level so non-React code (probes, fetchers) can log too. */
export function logEvent(level: LogLevel, message: string): void {
  seq += 1;
  const entry: LogEntry = { id: `evt-${Date.now()}-${seq}`, ts: Date.now(), level, message };
  entries = [...entries, entry].slice(-MAX_ENTRIES);
  emit();
}

export function markAllRead(): void {
  lastReadAt = Date.now();
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getEntries(): readonly LogEntry[] {
  return entries;
}

let unreadCache = 0;
let cacheEntries: readonly LogEntry[] | null = null;
let cacheReadAt = -1;
function getUnread(): number {
  if (cacheEntries !== entries || cacheReadAt !== lastReadAt) {
    cacheEntries = entries;
    cacheReadAt = lastReadAt;
    unreadCache = entries.reduce((n, e) => (e.ts > lastReadAt ? n + 1 : n), 0);
  }
  return unreadCache;
}

export interface EventLogApi {
  readonly entries: readonly LogEntry[];
  /** Entries newer than the last markAllRead() — single source of truth for the bell badge. */
  readonly unread: number;
  readonly log: typeof logEvent;
  readonly markAllRead: typeof markAllRead;
}

export function useEventLog(): EventLogApi {
  const snapshot = useSyncExternalStore(subscribe, getEntries);
  const unread = useSyncExternalStore(subscribe, getUnread);
  return { entries: snapshot, unread, log: logEvent, markAllRead };
}
```

**Patch 3 of 4 — `src/hooks/useApi.ts` (complete file; probe ALWAYS settles):**

```ts
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { logEvent } from './useEventLog';
import { nextDelay, sleep } from '../lib/backoff';

export const API_BASE_URL = 'http://3.23.60.61:8000';

/** Probe must give up quickly; Chrome's own TCP timeout is minutes — far too long for a status pill. */
const HEALTH_TIMEOUT_MS = 5_000;
const RETRY_CAP_MS = 60_000;

export type HealthStatus = 'checking' | 'online' | 'offline';

export interface HealthState {
  readonly status: HealthStatus;
  /** Epoch ms of the last finished probe (success or failure); null while the first probe runs. */
  readonly lastCheckedAt: number | null;
  readonly consecutiveFailures: number;
}

let state: HealthState = { status: 'checking', lastCheckedAt: null, consecutiveFailures: 0 };
const listeners = new Set<() => void>();

function setState(next: HealthState): void {
  state = next;
  listeners.forEach((l) => l());
}

/** fetch that always settles within `timeoutMs`. */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs: number = HEALTH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  // Respect a caller-provided signal too.
  const upstream = init.signal;
  const onUpstreamAbort = (): void => controller.abort();
  upstream?.addEventListener('abort', onUpstreamAbort, { once: true });
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
    upstream?.removeEventListener('abort', onUpstreamAbort);
  }
}

function describeFailure(err: unknown): string {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return `timeout after ${HEALTH_TIMEOUT_MS} ms`;
  }
  if (err instanceof TypeError) return 'connection failed'; // fetch network error
  return err instanceof Error ? err.message : 'unknown error';
}

/** One probe. Never throws; ALWAYS settles the store to online|offline and logs transitions. */
export async function probeOnce(): Promise<HealthStatus> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/health`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const was = state.status;
    setState({ status: 'online', lastCheckedAt: Date.now(), consecutiveFailures: 0 });
    if (was !== 'online') logEvent('INFO', 'Health probe succeeded — API online');
    return 'online';
  } catch (err) {
    const reason = describeFailure(err);
    const failures = state.consecutiveFailures + 1;
    const was = state.status;
    setState({ status: 'offline', lastCheckedAt: Date.now(), consecutiveFailures: failures });
    if (was !== 'offline') {
      logEvent('ERROR', `Health probe failed (${reason}) — API offline; showing cached snapshot`);
    } else if (failures % 10 === 0) {
      logEvent('DEBUG', `Health probe still failing after ${failures} attempts (${reason})`);
    }
    return 'offline';
  }
}

let loopController: AbortController | null = null;

async function probeLoop(signal: AbortSignal): Promise<void> {
  for (;;) {
    const result = await probeOnce();
    const delay =
      result === 'online'
        ? RETRY_CAP_MS // steady-state re-check cadence
        : nextDelay(state.consecutiveFailures, { baseMs: 2_000, capMs: RETRY_CAP_MS });
    try {
      await sleep(delay, signal);
    } catch {
      return; // stopped
    }
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function getState(): HealthState {
  return state;
}

export interface ApiHook extends HealthState {
  readonly apiBaseUrl: string;
  /** Manual re-probe (header refresh button / pill click). */
  readonly refresh: () => Promise<HealthStatus>;
}

export function useApi(): ApiHook {
  const snapshot = useSyncExternalStore(subscribe, getState);
  // Idempotent: React StrictMode's double effect invocation still starts exactly one loop.
  useEffect(() => {
    startProbeLoop();
  }, []);
  const refresh = useCallback(() => probeOnce(), []);
  return { ...snapshot, apiBaseUrl: API_BASE_URL, refresh };
}

function startProbeLoop(): void {
  if (loopController) return;
  loopController = new AbortController();
  logEvent('DEBUG', 'Health probe started');
  void probeLoop(loopController.signal);
}
```

**Patch 4 of 4 — `src/components/StatusPill.tsx` (complete file; honest terminal states):**

```ts
import type { CSSProperties, JSX } from 'react';
import { useApi } from '../hooks/useApi';
import { Tooltip } from './Tooltip';

const pillBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 12px',
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  fontFamily: 'inherit',
  background: 'transparent',
};

const dotBase: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  display: 'inline-block',
  marginRight: 6,
  flexShrink: 0,
};

export function StatusPill(): JSX.Element {
  const { status, lastCheckedAt, refresh } = useApi();

  const visual =
    status === 'checking'
      ? {
          label: 'Checking…',
          color: 'var(--text-muted)',
          border: '1px solid rgba(148,163,184,0.3)',
          background: 'rgba(148,163,184,0.08)',
          pulse: true,
          tip: 'Probing the API health endpoint…',
        }
      : status === 'online'
        ? {
            label: 'API Online',
            color: 'var(--accent-emerald)',
            border: '1px solid rgba(16,185,129,0.3)',
            background: 'rgba(16,185,129,0.08)',
            pulse: false,
            tip: 'Live data. Click to re-check.',
          }
        : {
            label: 'API Offline',
            color: 'var(--accent-rose)',
            border: '1px solid rgba(244,63,94,0.3)',
            background: 'rgba(244,63,94,0.08)',
            pulse: false,
            tip: 'API unreachable — displaying the cached snapshot. Click to retry now.',
          };

  const checked =
    lastCheckedAt === null
      ? 'Not checked yet.'
      : `Last checked ${new Date(lastCheckedAt).toLocaleTimeString('en-GB', { hour12: false })}.`;

  return (
    <Tooltip content={`${visual.tip} ${checked}`}>
      <button
        type="button"
        onClick={() => {
          void refresh();
        }}
        aria-live="polite"
        style={{ ...pillBase, color: visual.color, border: visual.border, background: visual.background }}
      >
        <span
          style={{
            ...dotBase,
            background: visual.color,
            animation: visual.pulse ? 'pulse 1.2s ease-in-out infinite' : 'none',
          }}
        />
        {visual.label}
      </button>
    </Tooltip>
  );
}
```

**Acceptance (10 s).** With the API unreachable, load the app: within ~5 s the pill flips from
"Checking…" to a rose **API Offline**, the Event Log gains
`ERROR Health probe failed (timeout after 5000 ms) — API offline; showing cached snapshot`,
and clicking the pill re-probes. No infinite "Checking…".

---

## F-02 — P0 — Severity column renders nothing: `--sev-*` tokens used but never defined

**Evidence.** S3: the SEVERITY column is blank in all 5 rows. dom.html row markup:
`<span class="inline-block w-2 h-2 rounded-full" title="Severity: Critical" aria-label="Severity: Critical" style=background-color:var(--sev-critical)></span>`.
`var(--sev-critical)` ×3, `var(--sev-high)` ×1, `var(--sev-medium)` ×1 are referenced in the DOM,
but `evidence/inlined-css.txt` (121 custom properties) defines **no `--sev-*` and no
`--color-sev-*` at all** (grep: zero matches). An unresolved `var()` makes `background-color`
invalid at computed-value time → the 8 px dot is fully transparent → the column is visually empty.
The data exists only in the `title`/`aria-label` tooltip layer.

**Defect.** A whole data column is invisible — broken table functionality, and the severity-sort
button (F-04) sorts a column the user cannot see.

**Root cause.** [CONFIRMED from evidence] tokens.css defines the `--color-*` primitives and an
alias layer (`--bg-body`, `--accent-indigo`, …) but never added severity aliases, while
`TicketsTable` emits `var(--sev-*)`.

**Patch.** Append to `src/styles/tokens.css` (the same block that defines `--bg-body` aliases;
hex values allowed here per the tokens rule — nowhere else):

```css
/* --- Severity aliases (FIX F-02): referenced by TicketsTable as var(--sev-*) --- */
:root {
  --sev-critical: var(--color-accent-rose);    /* #F43F5E */
  --sev-high: var(--color-accent-orange);      /* #F97316 */
  --sev-medium: var(--color-accent-amber);     /* #F59E0B */
  --sev-low: var(--color-accent-cyan);         /* #06B6D4 */
}

/* Visually-hidden but screen-reader-available text (used by the severity dot cell). */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
```

The render side (dot + `.sr-only` text) ships in the `TicketsTable` patch under F-04.

**Acceptance (10 s).** Reload: each row shows a colored severity dot (red/orange/amber/cyan);
DevTools → computed `background-color` of a dot resolves to an rgb value, not transparent.

---

## F-03 — P1 — Category badge text/dot colors broken (`--cat-*` undefined) + badge clipped mid-word

**Evidence.** dom.html: badge `<span … style="background-color:rgba(129,140,248,0.12);color:var(--cat-1);white-space:nowrap;overflow:visible;padding:2px 8px"><span class="w-1.5 h-1.5 rounded-full" style=background-color:var(--cat-1)></span>Phishing</span>`.
The DOM references `var(--cat-1)`…`var(--cat-5)` (2× each); inlined-css.txt defines **only
`--color-cat-1`** and **no `--cat-N` aliases and no `--color-cat-2…6`** → badge text falls back to
inherited color and the 6 px leading dot is invisible for every category. Additionally S3 shows
the "Unauthorized Access" badge clipped to "Unauthorized Acces" with the badge background cut
mid-glyph: the badge has `overflow:visible` inside a `<td>` that has `overflow:hidden`, and the
CATEGORY column is `width:150px` (th) — "Unauthorized Access" needs ≈155 px of badge width +
24 px cell padding.

**Defect.** (a) All category badges render with the same fallback text color and no dot —
categories are indistinguishable by color; (b) the longest category name is guillotined by its own
cell.

**Root cause.** [CONFIRMED from evidence] Missing `--cat-*` aliases + missing `--color-cat-2…6`
primitives in tokens.css; column width and badge overflow never sized for the longest of the six
canonical categories ("Unauthorized Access").

**Patch.** Append to `src/styles/tokens.css` (same alias block):

```css
/* --- Category aliases (FIX F-03): referenced by TicketsTable as var(--cat-N) --- */
:root {
  --color-cat-2: #22D3EE; /* Malware — cyan (matches existing badge bg rgba(34,211,238,0.12)) */
  --color-cat-3: #F87171; /* Unauthorized Access — rose (matches rgba(248,113,113,0.12)) */
  --color-cat-4: #FBBF24; /* Data Breach — amber (matches rgba(251,191,36,0.12)) */
  --color-cat-5: #A78BFA; /* DDoS — violet (matches rgba(167,139,250,0.12)) */
  --color-cat-6: #34D399; /* False Positive — emerald; MUST equal chartTokens.ts series 6 */

  --cat-1: var(--color-cat-1);
  --cat-2: var(--color-cat-2);
  --cat-3: var(--color-cat-3);
  --cat-4: var(--color-cat-4);
  --cat-5: var(--color-cat-5);
  --cat-6: var(--color-cat-6);
}
```

Badge layout fix ships inside the `TicketsTable` patch (F-04): CATEGORY column widened to
176 px, badge gets `max-width:100%; overflow:hidden` and its text span gets
`text-overflow:ellipsis`, so a long name ellipsizes inside the pill instead of being guillotined
by the cell.

**Acceptance (10 s).** Each category badge shows its own color + colored dot; "Unauthorized
Access" fits (or degrades to a clean "Unauthorized Acc…" fully inside the badge background).

---

## F-04 — P1 — Table header overlap: `SEVERITY ⇅CONFIDENCE ⇅` (column too narrow, nowrap, no overflow guard)

**Evidence.** S3 close-up: "SEVERITY ⇅CONFIDENCE ⇅" run together. dom.html:
`<table class="w-full border-collapse" style=table-layout:fixed;min-width:900px>` with th widths
`90px / 26% / 150px / 70px / 120px / 100px / 110px / 80px`. The severity th is `width:70px` with
`padding:6px 12px` → 46 px content box, while the header button (`white-space:nowrap`, no
`overflow:hidden`) needs ≈67 px for "SEVERITY ⇅" at 11 px/600/0.5 ls → ~21 px bleed into the
CONFIDENCE header. [CONFIRMED from evidence]

**Defect.** Two sortable headers collide visually; the overlap also makes the sort affordance look
broken ("interface barely improved — still generic").

**Root cause.** [CONFIRMED] Fixed table layout with a severity column sized for an 8 px dot
(70 px) but labeled with a full-length uppercase header; no `overflow` guard on the th.

**Patch — `src/components/TicketsTable.tsx` (complete file; also delivers the F-02 severity dot,
the F-03 badge fix, the F-09 ticket-link fix, and wires F-15 CSV export):**

```ts
import { useMemo, useState } from 'react';
import type { CSSProperties, JSX, KeyboardEvent } from 'react';
import { downloadCsv, toCsv } from '../lib/csv';

export type TicketCategory =
  | 'Phishing'
  | 'Malware'
  | 'Unauthorized Access'
  | 'Data Breach'
  | 'DDoS'
  | 'False Positive';

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
export type TicketStatus = 'Resolved' | 'Escalated' | 'Pending';

export interface TicketRow {
  readonly id: string;
  readonly subject: string;
  readonly category: TicketCategory;
  readonly severity: Severity;
  /** 0–100 */
  readonly confidence: number;
  readonly status: TicketStatus;
  readonly assignedTo: string;
  /** epoch ms; rendered as relative time */
  readonly ts: number;
}

const CATEGORY_VAR: Record<TicketCategory, string> = {
  Phishing: 'var(--cat-1)',
  Malware: 'var(--cat-2)',
  'Unauthorized Access': 'var(--cat-3)',
  'Data Breach': 'var(--cat-4)',
  DDoS: 'var(--cat-5)',
  'False Positive': 'var(--cat-6)',
};

const SEVERITY_VAR: Record<Severity, string> = {
  Critical: 'var(--sev-critical)',
  High: 'var(--sev-high)',
  Medium: 'var(--sev-medium)',
  Low: 'var(--sev-low)',
};

const SEVERITY_RANK: Record<Severity, number> = { Critical: 3, High: 2, Medium: 1, Low: 0 };

type SortKey = 'id' | 'subject' | 'category' | 'severity' | 'confidence' | 'status' | 'assignedTo' | 'ts';
type SortDir = 'asc' | 'desc';

interface Column {
  readonly key: SortKey;
  readonly label: string;
  readonly width: string;
  readonly sortable: boolean;
}

/* F-04 fix: severity widened 70→96px (fits "SEVERITY ⇅" at 11px/0.5ls within padding),
   category widened 150→176px (fits "Unauthorized Access" badge), min-width raised accordingly. */
const COLUMNS: readonly Column[] = [
  { key: 'id', label: 'Ticket ID', width: '96px', sortable: true },
  { key: 'subject', label: 'Subject', width: '26%', sortable: true },
  { key: 'category', label: 'Category', width: '176px', sortable: true },
  { key: 'severity', label: 'Severity', width: '96px', sortable: true },
  { key: 'confidence', label: 'Confidence', width: '128px', sortable: true },
  { key: 'status', label: 'Status', width: '104px', sortable: true },
  { key: 'assignedTo', label: 'Assigned To', width: '128px', sortable: true },
  { key: 'ts', label: 'Time', width: '88px', sortable: true },
];

const STATUS_STYLE: Record<TicketStatus, CSSProperties> = {
  Resolved: { backgroundColor: 'color-mix(in srgb, var(--accent-emerald) 12%, transparent)', color: 'var(--accent-emerald)' },
  Escalated: { backgroundColor: 'color-mix(in srgb, var(--accent-rose) 12%, transparent)', color: 'var(--accent-rose)' },
  Pending: { backgroundColor: 'color-mix(in srgb, var(--accent-amber) 12%, transparent)', color: 'var(--accent-amber)' },
};

const thStyle: CSSProperties = {
  padding: '6px 12px',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: 'var(--text-muted)',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  height: 'var(--density-widget-head-h)',
  boxSizing: 'border-box',
  overflow: 'hidden', // F-04 guard: a header can never bleed into its neighbour again
};

const thButton: CSSProperties = {
  padding: 0,
  font: 'inherit',
  color: 'inherit',
  textTransform: 'inherit',
  letterSpacing: 'inherit',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  maxWidth: '100%',
};

const tdStyle: CSSProperties = {
  padding: '0 12px',
  fontSize: 12,
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: 0,
  height: 'var(--density-row-h)',
  boxSizing: 'border-box',
};

function relativeTime(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function compareRows(a: TicketRow, b: TicketRow, key: SortKey): number {
  switch (key) {
    case 'severity':
      return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    case 'confidence':
      return a.confidence - b.confidence;
    case 'ts':
      return a.ts - b.ts;
    default:
      return String(a[key]).localeCompare(String(b[key]));
  }
}

export interface TicketsTableProps {
  readonly rows: readonly TicketRow[];
  readonly pageSize?: number;
  /** Called when a ticket id is activated (click / Enter). Replaces the dead href="#". */
  readonly onOpenTicket?: (row: TicketRow) => void;
}

export function TicketsTable({ rows, pageSize = 5, onOpenTicket }: TicketsTableProps): JSX.Element {
  const [sortKey, setSortKey] = useState<SortKey>('ts');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const now = Date.now();

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const c = compareRows(a, b, sortKey);
      return sortDir === 'asc' ? c : -c;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const from = sorted.length === 0 ? 0 : safePage * pageSize + 1;
  const to = Math.min(sorted.length, (safePage + 1) * pageSize);

  const toggleSort = (key: SortKey): void => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const exportCsv = (): void => {
    // Exports the FULL filtered/sorted dataset, not just the visible page.
    const csv = toCsv(
      ['Ticket ID', 'Subject', 'Category', 'Severity', 'Confidence', 'Status', 'Assigned To', 'Time'],
      sorted.map((r) => [
        r.id,
        r.subject,
        r.category,
        r.severity,
        `${r.confidence}%`,
        r.status,
        r.assignedTo,
        new Date(r.ts).toISOString(),
      ]),
    );
    downloadCsv('recent-classifications.csv', csv);
  };

  const onRowKey = (row: TicketRow) => (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === 'Enter' && onOpenTicket) onOpenTicket(row);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end', padding: '0 20px 10px' }}>
        <button
          type="button"
          onClick={exportCsv}
          disabled={sorted.length === 0}
          title="Export filtered results as CSV"
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 6,
            border: '1px solid var(--border-default)', background: 'var(--bg-body)',
            color: 'var(--text-secondary)', fontSize: 12,
            cursor: sorted.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}
        >
          Export CSV
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ tableLayout: 'fixed', minWidth: 1000, width: '100%', borderCollapse: 'collapse' }}>
          <colgroup>
            {COLUMNS.map((c) => (
              <col key={c.key} style={{ width: c.width }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={c.sortable && sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  style={thStyle}
                >
                  {c.sortable ? (
                    <button type="button" onClick={() => toggleSort(c.key)} style={thButton}>
                      {c.label}
                      <span style={{ fontSize: 10, color: sortKey === c.key ? 'var(--text-primary)' : 'var(--text-muted)' }} aria-hidden="true">
                        {sortKey === c.key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No tickets in the cached snapshot.
                </td>
              </tr>
            )}
            {pageRows.map((r) => (
              <tr
                key={r.id}
                tabIndex={0}
                onClick={() => onOpenTicket?.(r)}
                onKeyDown={onRowKey(r)}
                style={{ height: 'var(--density-row-h)', borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: onOpenTicket ? 'pointer' : 'default' }}
              >
                <td style={tdStyle}>
                  {/* F-09: real button instead of <a href="#"> */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTicket?.(r);
                    }}
                    style={{
                      padding: 0, background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'var(--font-numeric)', fontSize: 12, color: 'var(--accent-indigo)',
                    }}
                  >
                    {r.id}
                  </button>
                </td>
                <td style={{ ...tdStyle, fontSize: 13, fontWeight: 500 }} title={r.subject}>
                  {r.subject}
                </td>
                <td style={tdStyle}>
                  {/* F-03: badge ellipsizes INSIDE the pill; color-mix keeps colors token-driven */}
                  <span
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 4,
                      fontSize: 12, fontWeight: 600, letterSpacing: '0.2px', padding: '2px 8px',
                      maxWidth: '100%', overflow: 'hidden', boxSizing: 'border-box',
                      backgroundColor: `color-mix(in srgb, ${CATEGORY_VAR[r.category]} 12%, transparent)`,
                      color: CATEGORY_VAR[r.category],
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, backgroundColor: CATEGORY_VAR[r.category] }} aria-hidden="true" />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.category}</span>
                  </span>
                </td>
                <td style={tdStyle}>
                  {/* F-02: dot now has a defined token + sr-only text alternative */}
                  <span
                    title={`Severity: ${r.severity}`}
                    style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: SEVERITY_VAR[r.severity] }}
                  />
                  <span className="sr-only">{`Severity: ${r.severity}`}</span>
                </td>
                <td style={tdStyle}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-numeric)', fontVariantNumeric: 'tabular-nums', fontSize: 13, minWidth: 32 }}>
                      {r.confidence}%
                    </span>
                    <span style={{ width: 48, height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden', display: 'inline-block' }}>
                      <span style={{ display: 'block', height: '100%', borderRadius: 1, background: 'var(--accent-emerald)', width: `${r.confidence}%` }} />
                    </span>
                  </span>
                </td>
                <td style={tdStyle}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, ...STATUS_STYLE[r.status] }}>
                    {r.status}
                  </span>
                </td>
                <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontFamily: 'var(--font-numeric)', fontVariantNumeric: 'tabular-nums' }} title={r.assignedTo}>
                  {r.assignedTo}
                </td>
                <td style={{ ...tdStyle, color: 'var(--text-muted)', fontFamily: 'var(--font-numeric)', fontVariantNumeric: 'tabular-nums' }}>
                  {relativeTime(r.ts, now)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', borderTop: '1px solid var(--border-default)' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {sorted.length === 0 ? 'Showing 0 of 0' : `Showing ${from}–${to} of ${sorted.length}`}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            disabled={safePage === 0}
            aria-disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-default)',
              background: 'var(--bg-body)', fontSize: 12, fontFamily: 'inherit',
              color: safePage === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: safePage === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            Previous
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Page {safePage + 1}</span>
          <button
            type="button"
            disabled={safePage >= pageCount - 1}
            aria-disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-default)',
              background: 'var(--bg-body)', fontSize: 12, fontFamily: 'inherit',
              color: safePage >= pageCount - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: safePage >= pageCount - 1 ? 'not-allowed' : 'pointer',
            }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Patch — `src/lib/csv.ts` (new file, pure + one DOM download helper; no deps):**

```ts
/** CSV helpers. Pure builder + a thin browser download wrapper. */

export type CsvValue = string | number | boolean | null;

function escapeCell(value: CsvValue): string {
  const s = value === null ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC-4180-ish CSV with CRLF row endings. */
export function toCsv(headers: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) lines.push(row.map(escapeCell).join(','));
  return lines.join('\r\n');
}

/** Triggers a client-side download. BOM included so Excel opens UTF-8 correctly. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

**Acceptance (10 s).** Headers read "SEVERITY ⇅ | CONFIDENCE ⇅" with clear separation at any
viewport width; severity dots visible in every row; clicking "Ticket ID" no longer appends `#` to
the URL; "Export CSV" downloads a 7-line CSV (header + 6 cached tickets).

---

## F-05 — P1 — KPI tooltip stuck OPEN over the header/h1; no dismiss, no collision handling, keyboard-inaccessible

**Evidence.** S1: a tooltip reading "Latency data comes from the live metrics endpoint when
available. Sparkline shows the last 24 points." hangs over the breadcrumb and the "Security
Operations Center" h1 (only "…nter" of the title is visible). It belongs to the MODEL LATENCY KPI
card: dom.html shows all 4 KPI cards carry React-19 `useId`-based description hooks
(`aria-describedby=_r_0_-model-latency`, `_r_1_-throughput`, `_r_2_-model-accuracy`,
`_r_3_-model-footprint`) and the status pill has `aria-describedby=status-tooltip` — but **no
element with any of those ids exists in the DOM**, i.e. tooltips render ad-hoc (portal) when open
and the open state survived long enough to be photographed. The trigger is the whole card `<div>`
with **no `tabindex`**, so keyboard users can never summon or dismiss it, and there is no visible
focus target. [CONFIRMED visual + markup; INFERRED — needs src/ — that the component lacks
pointer-leave/Esc/outside-dismiss and flip/collision logic.]

**Defect.** (a) Tooltip can stick open over the sticky header and page title; (b) placed at the
card's top edge it collides with the header instead of flipping below; (c) keyboard/screen-reader
users have no way to reach the content (WCAG 1.4.13 / 2.1.1).

**Root cause.** [INFERRED — needs src/ to confirm file:line] Custom tooltip that opens on trigger
hover without: hide-on-pointerleave for the portal content, `Escape` handling, outside
`pointerdown` dismissal, viewport-collision flip, or a focusable trigger.

**Repro.** 1. Hover the MODEL LATENCY card/info icon. 2. Move the pointer away / press Esc /
click elsewhere. 3. Tooltip stays (S1).

**Patch 1 of 2 — `src/components/Tooltip.tsx` (complete file; no deps; portal + flip + Esc +
outside-dismiss + focusable-trigger contract):**

```ts
import { cloneElement, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, JSX, ReactElement, ReactNode } from 'react';

export interface TooltipProps {
  readonly content: ReactNode;
  readonly children: ReactNode;
  /** Preferred side; flips automatically when there is not enough room. */
  readonly side?: 'top' | 'bottom';
  readonly openDelayMs?: number;
}

interface Pos {
  readonly top: number;
  readonly left: number;
  readonly side: 'top' | 'bottom';
}

const GAP = 8;
const VIEWPORT_PAD = 8;

const bubbleStyle: CSSProperties = {
  position: 'fixed',
  zIndex: 200,
  maxWidth: 260,
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid var(--border-default)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-secondary)',
  fontSize: 12,
  lineHeight: 1.45,
  pointerEvents: 'none', // never traps the mouse; cannot get "stuck" by hover
};

/**
 * Accessible tooltip.
 * - Trigger wrapped in display:contents span: no layout impact, valid HTML for any child.
 * - Opens on hover (with delay) AND keyboard focus; closes on leave, blur, Esc,
 *   outside pointerdown, scroll and resize — it can never linger over the header.
 * - Portal to <body> with fixed positioning + automatic top/bottom flip and
 *   horizontal clamping, so it never renders off-viewport or under the sticky header.
 */
export function Tooltip({ content, children, side = 'top', openDelayMs = 120 }: TooltipProps): JSX.Element {
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);

  const clearTimer = useCallback((): void => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  }, []);

  const show = useCallback((): void => {
    clearTimer();
    openTimer.current = window.setTimeout(() => setOpen(true), openDelayMs);
  }, [clearTimer, openDelayMs]);

  const hide = useCallback((): void => {
    clearTimer();
    setOpen(false);
    setPos(null);
  }, [clearTimer]);

  // Position (and flip) once the bubble exists so we can measure it.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = wrapRef.current?.firstElementChild;
    const bubble = bubbleRef.current;
    if (!(trigger instanceof HTMLElement) || !bubble) return;
    const t = trigger.getBoundingClientRect();
    const b = bubble.getBoundingClientRect();
    const wantTop = side === 'top';
    const roomAbove = t.top - GAP - b.height >= VIEWPORT_PAD;
    const roomBelow = window.innerHeight - t.bottom - GAP - b.height >= VIEWPORT_PAD;
    const finalSide: 'top' | 'bottom' = wantTop ? (roomAbove || !roomBelow ? 'top' : 'bottom') : roomBelow || !roomAbove ? 'bottom' : 'top';
    const top = finalSide === 'top' ? Math.max(VIEWPORT_PAD, t.top - GAP - b.height) : Math.min(window.innerHeight - b.height - VIEWPORT_PAD, t.bottom + GAP);
    const centered = t.left + t.width / 2 - b.width / 2;
    const left = Math.min(Math.max(VIEWPORT_PAD, centered), window.innerWidth - b.width - VIEWPORT_PAD);
    setPos({ top, left, side: finalSide });
  }, [open, side]);

  // Global dismissal: Esc, outside pointerdown, scroll, resize.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        hide();
      }
    };
    const onPointerDown = (e: PointerEvent): void => {
      if (wrapRef.current && e.target instanceof Node && !wrapRef.current.contains(e.target)) hide();
    };
    const onScroll = (): void => hide();
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, hide]);

  useEffect(() => clearTimer, [clearTimer]);

  // aria-describedby goes on the trigger itself (not the events wrapper).
  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, { 'aria-describedby': open ? id : undefined })
    : children;

  return (
    <>
      <span
        ref={wrapRef}
        style={{ display: 'contents' }}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {trigger}
      </span>
      {open &&
        createPortal(
          <div
            ref={bubbleRef}
            id={id}
            role="tooltip"
            data-side={pos?.side ?? side}
            style={{
              ...bubbleStyle,
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              visibility: pos ? 'visible' : 'hidden', // measure first, then reveal — no flicker
            }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
```

**Patch 2 of 2 — `src/components/KpiCard.tsx` (complete file; focusable info trigger, honest states):**

```ts
import type { CSSProperties, JSX, ReactNode } from 'react';
import { Tooltip } from './Tooltip';

export type KpiState = 'live' | 'cached' | 'pending' | 'unavailable';

export interface KpiCardProps {
  readonly label: string;
  /** Formatted primary value; pass '—' when there is no honest value to show. */
  readonly value: string;
  readonly state: KpiState;
  /** One-line provenance caption, e.g. "Last known latency · cached snapshot". */
  readonly caption: string;
  /** Explainer shown in the tooltip (what the metric is and where it comes from). */
  readonly info: string;
  readonly icon: ReactNode;
}

const badge: Record<KpiState, { text: string; style: CSSProperties } | null> = {
  live: null,
  cached: {
    text: 'Cached',
    style: { color: 'var(--accent-amber)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' },
  },
  pending: {
    text: 'Pending Validation',
    style: { color: 'var(--text-muted)', background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.25)' },
  },
  unavailable: {
    text: 'Unavailable',
    style: { color: 'var(--accent-rose)', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)' },
  },
};

function InfoIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export function KpiCard({ label, value, state, caption, info, icon }: KpiCardProps): JSX.Element {
  const b = badge[state];
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 8,
        padding: 'var(--density-card-pad)',
        height: 'var(--density-kpi-h)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {label}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Keyboard-reachable trigger replaces the old non-focusable whole-card hover area */}
          <Tooltip content={info}>
            <button
              type="button"
              aria-label={`About ${label.toLowerCase()}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 20, height: 20, borderRadius: 4, border: 'none',
                background: 'transparent', color: 'var(--text-muted)', cursor: 'help', padding: 0,
              }}
            >
              <InfoIcon />
            </button>
          </Tooltip>
          <span
            style={{
              width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(99,102,241,0.1)', color: 'var(--accent-indigo)', flexShrink: 0,
            }}
            aria-hidden="true"
          >
            {icon}
          </span>
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
        <span
          style={{
            fontSize: 28, fontWeight: 600, fontFamily: 'var(--font-numeric)', fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.5px', lineHeight: 1,
            color: state === 'live' ? 'var(--text-primary)' : 'var(--text-muted)',
          }}
        >
          {value}
        </span>
        {b && (
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, ...b.style }}>
            {b.text}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{caption}</span>
      </div>
    </div>
  );
}
```

**Acceptance (10 s).** Hover or Tab-focus the ⓘ icon on MODEL LATENCY: tooltip opens beside the
card (flips below the header when there is no room above); moving the pointer away, pressing Esc,
scrolling, or clicking anywhere closes it immediately; it can never be photographed stuck over the
h1 again.

---

## F-06 — P1 — System Monitor: CACHED badge contradicts four "Unavailable — API offline" metrics

**Evidence.** S2 + dom.html (`id=system-monitor`): header badge is hardcoded amber
`<span …>CACHED</span>` while every metric row renders `—` + `Unavailable — API offline` with
0%-width bars; the card footer still says "Snapshot: cached".

**Defect.** Two different honesty states on one card. Per the Honesty Contract, CACHED means "you
are looking at snapshot data"; here there IS no snapshot data for these four metrics, so the badge
overstates the data state. The Classification Performance card has the same smell ("CACHED" +
"Awaiting live performance data" — no cached series exists).

**Root cause.** [CONFIRMED markup; INFERRED — needs src/ — that] the badge is a static string
instead of a function of the card's actual data state.

**Patch — `src/components/SystemMonitor.tsx` (complete file; badge derives from data state):**

```ts
import type { CSSProperties, JSX } from 'react';

export type DataState = 'live' | 'cached' | 'unavailable';

export interface SystemMetrics {
  /** 0–100 percent, or null when unknown. */
  readonly cpuPct: number | null;
  /** 0–100 percent, or null when unknown. */
  readonly memPct: number | null;
  /** ms, or null when unknown. */
  readonly apiLatencyMs: number | null;
  /** requests/min, or null when unknown. */
  readonly requestsPerMin: number | null;
}

export interface SystemMonitorProps {
  readonly metrics: SystemMetrics;
  /** Where `metrics` came from. The badge renders THIS, never a hardcoded string. */
  readonly dataState: DataState;
}

const BADGE: Record<DataState, { text: string; style: CSSProperties } | null> = {
  live: null,
  cached: {
    text: 'Cached',
    style: { color: 'var(--accent-amber)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' },
  },
  unavailable: {
    text: 'Unavailable',
    style: { color: 'var(--text-muted)', background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.25)' },
  },
};

interface RowProps {
  readonly label: string;
  readonly display: string | null; // formatted value, or null = unknown
  readonly pct: number | null; // bar fill 0–100, or null
  readonly barColor: string;
}

function MetricRow({ label, display, pct, barColor }: RowProps): JSX.Element {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
        <span
          style={{
            fontSize: 18, fontFamily: 'var(--font-numeric)', fontVariantNumeric: 'tabular-nums',
            fontWeight: 600, letterSpacing: '-0.3px',
            color: display === null ? 'var(--text-muted)' : 'var(--text-primary)',
          }}
        >
          {display ?? '—'}
        </span>
        {display === null && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: 'auto', textAlign: 'right' }}>
            Unavailable — API offline
          </span>
        )}
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div
          style={{ height: '100%', borderRadius: 2, background: barColor, width: `${pct ?? 0}%`, transition: 'width 200ms' }}
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct ?? 0}
          aria-label={label}
        />
      </div>
    </div>
  );
}

export function SystemMonitor({ metrics, dataState }: SystemMonitorProps): JSX.Element {
  const badge = BADGE[dataState];
  return (
    <section
      id="system-monitor"
      aria-label="System Monitor"
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8,
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ height: 'var(--density-widget-head-h)', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.2px', margin: 0 }}>System Monitor</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '1px 0 0' }}>ARM64 infrastructure resources</p>
        </div>
        {badge && (
          <span style={{ fontSize: 10, fontWeight: 600, borderRadius: 4, padding: '3px 8px', ...badge.style }}>{badge.text}</span>
        )}
      </div>
      <div style={{ padding: '0 20px 16px', flex: '1 1 0%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 28px' }}>
          <MetricRow label="CPU (Neoverse N1)" display={metrics.cpuPct === null ? null : `${metrics.cpuPct}%`} pct={metrics.cpuPct} barColor="var(--accent-indigo)" />
          <MetricRow label="Memory (RAM)" display={metrics.memPct === null ? null : `${metrics.memPct}%`} pct={metrics.memPct} barColor="var(--accent-emerald)" />
          <MetricRow label="API Latency" display={metrics.apiLatencyMs === null ? null : `${metrics.apiLatencyMs} ms`} pct={null} barColor="var(--text-muted)" />
          <MetricRow label="Requests / Min" display={metrics.requestsPerMin === null ? null : String(metrics.requestsPerMin)} pct={null} barColor="var(--text-muted)" />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 20px 8px', borderTop: '1px solid var(--border-default)' }}>
        <span style={{ fontSize: 'var(--caption-size)', color: 'var(--caption-color)' }}>
          {dataState === 'live' ? 'Snapshot: live' : dataState === 'cached' ? 'Snapshot: cached' : 'Snapshot: none — API offline'}
        </span>
      </div>
    </section>
  );
}
```

Caller rule (one line, wherever the card is fed): `dataState` is `'live'` only when the last
metrics fetch succeeded, `'cached'` only when snapshot values actually exist, else
`'unavailable'`. Same derivation applies to the Classification Performance card.

**Acceptance (10 s).** With the API offline and no cached metrics, the card shows a muted
**Unavailable** badge and "Snapshot: none — API offline"; the amber CACHED badge appears only when
real cached values are on screen.

---

## F-07 — P1 — Bell badge "3 unread" desyncs from the Event Log (2 entries)

**Evidence.** S1–S4 header: badge "3", `aria-label="Notifications, 3 unread"` (a11y-attrs.txt
line 9; dom.html `<button aria-label="Notifications, 3 unread">…<span …>3</span>`). The Event Log
(S4, dom.html `id=event-log`, text-content.txt lines 141–146) contains exactly 2 entries
(INFO + DEBUG). No popover/dropdown node exists under the bell in the DOM and the button has no
`aria-haspopup`.

**Defect.** The unread count is not derived from the event store — it shows a phantom "3" that
can never be cleared by reading the 2-entry log. Trust-erosion in the one widget whose job is
attention routing.

**Root cause.** [INFERRED — needs src/ to confirm file:line] Hardcoded or stale unread value
instead of `useEventLog().unread`; bell panel either missing or not wired to the store.

**Patch — `src/components/HeaderBell.tsx` (complete file; count = store unread, panel = store tail):**

```ts
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import { useEventLog } from '../hooks/useEventLog';
import type { LogLevel } from '../hooks/useEventLog';

const LEVEL_COLOR: Record<LogLevel, string> = {
  INFO: 'var(--accent-emerald)',
  DEBUG: 'var(--text-muted)',
  WARN: 'var(--accent-amber)',
  ERROR: 'var(--accent-rose)',
};

const panelStyle: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  right: 0,
  width: 320,
  maxHeight: 320,
  overflowY: 'auto',
  background: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 8,
  zIndex: 120,
};

export function HeaderBell(): JSX.Element {
  const { entries, unread, markAllRead } = useEventLog();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Esc + outside pointerdown dismissal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e: PointerEvent): void => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const toggle = (): void => {
    setOpen((v) => {
      const next = !v;
      if (next) markAllRead(); // opening the panel acknowledges everything shown
      return next;
    });
  };

  const recent = entries.slice(-8).reverse();

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={toggle}
        aria-label={unread === 0 ? 'Notifications, no unread' : `Notifications, ${unread} unread`}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border-default)',
          background: 'transparent', color: 'var(--text-secondary)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10.268 21a2 2 0 0 0 3.464 0" />
          <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
        </svg>
        {unread > 0 && (
          <span
            style={{
              position: 'absolute', top: 6, right: 6, minWidth: 14, height: 14, borderRadius: 7,
              background: 'var(--accent-rose)', color: 'var(--color-white)', fontSize: 9, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
            }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications" style={panelStyle}>
          {recent.length === 0 && (
            <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>No events yet.</div>
          )}
          {recent.map((e) => (
            <div
              key={e.id}
              style={{
                display: 'flex', gap: 10, alignItems: 'center', padding: '8px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: 12,
                fontFamily: 'var(--font-numeric)', fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span style={{ color: 'var(--text-muted)', opacity: 0.7, minWidth: 62 }}>
                {new Date(e.ts).toLocaleTimeString('en-GB', { hour12: false })}
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.4px', color: LEVEL_COLOR[e.level], minWidth: 38 }}>
                {e.level}
              </span>
              <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.message}>
                {e.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Acceptance (10 s).** Fresh load with 2 log entries → badge reads "2"; click the bell → panel
lists those 2 entries and the badge disappears (marked read); when the F-01 probe fails, a new
ERROR entry increments the badge to "1" again.

---

## F-08 — P1 — ECharts 6: `grid.containLabel` silently ignored (console warning)

**Evidence.** S6 console: `[ECharts] Specified 'grid.containLabel' but no
'use(LegacyGridContainLabel)'; use 'grid.outerBounds' instead. (log.js:59)`.

**Defect.** The app (echarts/core with explicit `use(...)` registration) passes
`grid: { containLabel: true }`, which ECharts 6 ignores unless the legacy feature is registered —
so axis labels ("Unauthorized Access", the longest one) may clip at the chart edge, and the
console carries a permanent warning that masks real errors.

**Root cause.** [CONFIRMED from console; INFERRED — needs src/ — the exact chart module] Missing
`LegacyGridContainLabel` registration after the ECharts 5→6 upgrade.

**Patch — `src/components/charts/chartSetup.ts` (new file; single echarts entry point — every
chart imports from here instead of registering piecemeal):**

```ts
/**
 * Central ECharts bundle. Import { echarts } from here — never from 'echarts/core' directly,
 * so component/feature registration happens exactly once.
 * No new dependency: everything below ships inside the existing `echarts` package.
 */
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  AriaComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
// FIX F-08: restores grid.containLabel behavior under ECharts 6 (same package, no new dep).
import { LegacyGridContainLabel } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  GraphicComponent,
  AriaComponent,
  LegacyGridContainLabel,
  CanvasRenderer,
]);

export { echarts };

/**
 * Canvas fallback colors mirroring tokens.css primitives. Used ONLY when a CSS
 * variable cannot be resolved (e.g. chart rendered before stylesheets load).
 * If src/lib/chartTokens.ts exports a palette, import from there instead and
 * delete this constant — it must never diverge from tokens.css.
 */
export const CANVAS_FALLBACK = {
  textPrimary: '#F8FAFC', // --color-text-primary
  textSecondary: '#94A3B8', // --color-text-secondary
  textMuted: '#8292A8', // --color-text-muted
  accentViolet: '#8B5CF6', // --color-accent-violet
} as const;

/** Resolve a CSS custom property to a concrete color for canvas rendering. */
export function resolveToken(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v === '' ? fallback : v;
}
```

**Acceptance (10 s).** Console no longer shows the `[ECharts] … containLabel` line; the bar
chart's "Unauthorized Access" y-axis label renders fully inside the card.

---

## F-09 — P1 — Ticket-ID links are dead `href="#"` anchors

**Evidence.** a11y-attrs.txt lines 13/18/23/28/33 + dom.html: five `<a href=# class="font-mono
text-xs text-accent-indigo hover:underline">TKT-84xx</a>`. No router exists in the app (sidebar
nav is `<button>`s), so these cannot deep-link anywhere; activation either appends `#` to the URL
+ scrolls to top, or is a no-op. [CONFIRMED markup; INFERRED — needs src/ — whether a click
handler with `preventDefault` exists.]

**Patch.** Shipped inside the F-04 `TicketsTable.tsx`: the id cell is now a real
`<button type="button">` invoking `onOpenTicket(row)` (also fired by row `Enter` key), and
`exportCsv`/`onOpenTicket` are the only activation paths — no `<a href="#">` remains.

**Acceptance (10 s).** Clicking TKT-8471 does not change the URL hash and (with a handler wired)
opens the ticket detail; Tab → Enter on a row does the same.

---

## F-10 — P2 — Footer "API Docs" navigates the tab away to the offline API

**Evidence.** dom.html footer: `<a href=http://3.23.60.61:8000/docs …>API Docs</a> ·
<a href=https://github.com/phatonpain/ticketsec-arm64 …>GitHub</a>` — no `target`, no `rel`.
S6 shows `ERR_CONNECTION_TIMED_OUT … 3.23.60.61:8000/docs` — activating the link loads a dead
page in the same tab and the user loses the SPA.

**Defect.** One click destroys the app session while the API is down (the normal state during
this infra issue). GitHub link likewise replaces the app.

**Patch — `src/App.tsx` footer (snippet; state comes from `useApi()`):**

```tsx
const { status } = useApi();
// …
<footer style={{ borderTop: '1px solid var(--border-default)', padding: '16px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
  TicketSec Arm64 Guardian | AWS Graviton Deployment | ONNX Runtime ·{' '}
  <a
    href="http://3.23.60.61:8000/docs"
    target="_blank"
    rel="noopener noreferrer"
    title={status === 'offline' ? 'API offline — docs unavailable until the API recovers' : 'Open API documentation in a new tab'}
    style={{ color: 'var(--accent-indigo)', textDecoration: 'none' }}
  >
    API Docs{status === 'offline' ? ' (offline)' : ''}
  </a>{' '}
  ·{' '}
  <a
    href="https://github.com/phatonpain/ticketsec-arm64"
    target="_blank"
    rel="noopener noreferrer"
    style={{ color: 'var(--accent-indigo)', textDecoration: 'none' }}
  >
    GitHub
  </a>
</footer>
```

**Acceptance (10 s).** Both footer links open in new tabs; the dashboard tab stays put; while
offline the docs link is labeled "API Docs (offline)" with an explanatory title.

---

## F-11 — P2 — "Classify Ticket" silently disabled; sample chips lack `type=button`

**Evidence.** dom.html `id=live-prediction`: submit button `<button disabled …cursor:not-allowed;opacity:0.6>Classify Ticket</button>` with no reason given anywhere on the panel;
the three sample chips are `<button>` **without** `type=` (2 of 3 also missing an explicit
`border` shorthand, a separate cosmetic inconsistency: `border-color` set but no `border-style`).
[CONFIRMED markup; INFERRED — needs src/ — whether disabled is because the textarea is empty,
because the API is offline, or both.]

**Defect.** Silent disablement violates the Honesty Contract's spirit: the user cannot tell
whether the button is dead because of empty input or because the API is offline.

**Patch — `src/components/LivePredictions.tsx` (complete file; explicit offline reason + honest
error path):**

```ts
import { useState } from 'react';
import type { CSSProperties, JSX, KeyboardEvent } from 'react';
import { API_BASE_URL, fetchWithTimeout, useApi } from '../hooks/useApi';
import { logEvent } from '../hooks/useEventLog';
import type { TicketCategory } from './TicketsTable';

const SAMPLES: readonly string[] = [
  'suspicious email asking for bank credentials',
  'trojan horse detected in downloaded file',
  'multiple failed login attempts from unknown IP',
];

interface ClassifyResponse {
  readonly category: TicketCategory;
  readonly confidence: number; // 0–1 from the API
}

const chipStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--text-secondary)',
  background: 'var(--bg-body)',
  border: '1px solid var(--border-default)',
  borderRadius: 4,
  padding: '4px 8px',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

export function LivePredictions(): JSX.Element {
  const { status } = useApi();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ClassifyResponse | null>(null);
  const [failed, setFailed] = useState(false);

  const offline = status !== 'online';
  const canSubmit = text.trim().length > 0 && !busy && !offline;

  const submit = async (): Promise<void> => {
    if (!canSubmit) return;
    setBusy(true);
    setFailed(false);
    setResult(null);
    try {
      const res = await fetchWithTimeout(
        `${API_BASE_URL}/classify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text.trim() }),
        },
        8_000,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ClassifyResponse;
      setResult(data);
      logEvent('INFO', `Ticket classified as ${data.category} (${Math.round(data.confidence * 100)}%)`);
    } catch {
      // Honest failure: say so, log it, never invent a prediction.
      setFailed(true);
      logEvent('ERROR', 'Classification request failed — API offline');
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <section
      id="live-prediction"
      aria-label="Live Classification"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 420 }}
    >
      <div style={{ height: 'var(--density-widget-head-h)', padding: '0 20px', display: 'flex', alignItems: 'center', boxSizing: 'border-box' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Live Classification</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '1px 0 0' }}>Submit a ticket for real-time prediction</p>
        </div>
      </div>
      <div style={{ padding: '0 20px 16px', flex: '1 1 0%', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <textarea
          rows={4}
          aria-label="Ticket text"
          placeholder="Paste ticket subject or body here…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          style={{
            width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-default)',
            borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--text-primary)',
            fontFamily: 'var(--font-primary)', resize: 'none', boxSizing: 'border-box',
          }}
        />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -4 }}>Ctrl+Enter to submit</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SAMPLES.map((s) => (
            <button key={s} type="button" style={chipStyle} onClick={() => setText(s)}>
              {s}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => {
            void submit();
          }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'var(--accent-indigo)', color: 'var(--color-white)', border: 'none', borderRadius: 6,
            padding: '8px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.6,
          }}
        >
          {busy ? 'Classifying…' : 'Classify Ticket'}
        </button>
        {/* The disabled reason is always stated — never a silent dead button. */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }} aria-live="polite">
          {offline
            ? 'Unavailable — API offline. Classification requires the live model endpoint.'
            : text.trim().length === 0
              ? 'Enter ticket text (or pick a sample) to enable classification.'
              : ' '}
        </div>
        <div
          aria-live="polite"
          style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 0', color: 'var(--text-muted)', textAlign: 'center' }}
        >
          {result && (
            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
              <strong>{result.category}</strong>
              <span style={{ fontFamily: 'var(--font-numeric)', fontVariantNumeric: 'tabular-nums' }}>
                {` — ${Math.round(result.confidence * 100)}%`}
              </span>
            </div>
          )}
          {failed && <div style={{ fontSize: 12, color: 'var(--accent-rose)' }}>Classification unavailable — API offline.</div>}
          {!result && !failed && <span style={{ fontSize: 12 }}>Submit a ticket to see the real-time prediction result.</span>}
        </div>
      </div>
    </section>
  );
}
```

**Acceptance (10 s).** With the API offline the caption under the button reads "Unavailable — API
offline. Classification requires the live model endpoint."; picking a sample fills the textarea
but the button stays honestly disabled with the same explanation; chips are `type=button`.

---

## F-12 — P2 — Focus indicator suppressed on three keyboard-reachable controls

**Evidence.** inlined-css.txt has a global `:focus-visible{outline:2px solid
var(--color-accent-indigo);outline-offset:2px}` — but dom.html carries inline `outline:none` on
the ticket-search `<input>`, the prediction `<textarea>`, and the status pill
`div[role=button][tabindex=0]`. Inline styles beat every selector, so Tab-ing onto these three
controls shows **no** focus ring (WCAG 2.4.7 Focus Visible). All other buttons/links are fine.

**Patch — `src/styles/tokens.css` (append; keep inline `outline:none` for mouse, restore ring for keyboard):**

```css
/* FIX F-12: inline outline:none wins over the global :focus-visible rule;
   re-assert the ring with !important ONLY for keyboard focus on these controls. */
input:focus-visible,
textarea:focus-visible,
[role='button']:focus-visible {
  outline: 2px solid var(--color-accent-indigo) !important;
  outline-offset: 2px;
}
```

**Acceptance (10 s).** Tab through the header and sidebar: the search input, the status pill, and
the textarea each show the 2 px indigo ring when reached by keyboard (and only by keyboard).

---

## F-13 — P2 — Event Log: chips without `aria-pressed`, log without live-region semantics

**Evidence.** dom.html `id=event-log`: filter chips are `<button type=button>All/Info/Debug/Error</button>`
with only visual active styling (indigo background on "All"); the entries container is a plain
`<div>` with `max-height:240px;overflow:auto`. New entries (e.g. the F-01 probe ERROR) are never
announced to screen readers, and chip state is not conveyed. Handlers/state themselves look real
(active style present) — [INFERRED — needs src/ — to confirm filtering actually re-renders].

**Patch — `src/components/EventLog.tsx` (complete file):**

```ts
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import { useEventLog } from '../hooks/useEventLog';
import type { LogLevel } from '../hooks/useEventLog';

type Filter = 'ALL' | LogLevel;
const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'INFO', label: 'Info' },
  { value: 'DEBUG', label: 'Debug' },
  { value: 'ERROR', label: 'Error' },
];

const LEVEL_STYLE: Record<LogLevel, CSSProperties> = {
  INFO: { color: 'var(--accent-emerald)', background: 'rgba(16,185,129,0.08)', borderLeft: '2px solid rgba(16,185,129,0.6)' },
  DEBUG: { color: 'var(--text-muted)', background: 'rgba(130,146,168,0.08)', borderLeft: '2px solid rgba(130,146,168,0.6)' },
  WARN: { color: 'var(--accent-amber)', background: 'rgba(245,158,11,0.08)', borderLeft: '2px solid rgba(245,158,11,0.6)' },
  ERROR: { color: 'var(--accent-rose)', background: 'rgba(244,63,94,0.08)', borderLeft: '2px solid rgba(244,63,94,0.6)' },
};

export function EventLog(): JSX.Element {
  const { entries } = useEventLog();
  const [filter, setFilter] = useState<Filter>('ALL');
  const listRef = useRef<HTMLDivElement>(null);

  const visible = filter === 'ALL' ? entries : entries.filter((e) => e.level === filter);

  // Keep the newest entry in view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible.length]);

  return (
    <section
      id="event-log"
      aria-label="Event Log"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ height: 'var(--density-widget-head-h)', padding: '0 20px', display: 'flex', alignItems: 'center', boxSizing: 'border-box' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Event Log</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '1px 0 0' }}>System activity stream</p>
        </div>
      </div>
      <div style={{ padding: '0 20px 12px' }}>
        <div role="group" aria-label="Filter log by level" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.value)}
                style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 4,
                  border: '1px solid var(--border-default)', cursor: 'pointer', fontFamily: 'inherit',
                  background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ padding: '0 20px 16px', flex: '1 1 0%', minHeight: 0 }}>
        <div
          ref={listRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          style={{
            background: 'var(--bg-body)', border: '1px solid var(--border-default)', borderRadius: 8,
            padding: '8px 0', maxHeight: 240, overflow: 'auto',
            fontFamily: 'var(--font-numeric)', fontVariantNumeric: 'tabular-nums',
            fontSize: 11, lineHeight: 1.5, color: 'var(--text-secondary)',
          }}
        >
          {visible.length === 0 && (
            <div style={{ padding: '3px 14px', color: 'var(--text-muted)' }}>No {filter === 'ALL' ? '' : filter.toLowerCase() + ' '}entries yet.</div>
          )}
          {visible.map((e) => (
            <div
              key={e.id}
              title={e.message}
              style={{ padding: '3px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <span style={{ color: 'var(--text-muted)', opacity: 0.7, minWidth: 64 }}>
                {new Date(e.ts).toLocaleTimeString('en-GB', { hour12: false })}
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.4px', padding: '1px 5px', borderRadius: 3, minWidth: 38, textAlign: 'center', ...LEVEL_STYLE[e.level] }}>
                {e.level}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.message}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

**Acceptance (10 s).** Clicking "Debug" hides the INFO entry and the chip exposes
`aria-pressed="true"`; when the F-01 probe fails, the ERROR row appears at the bottom without
manual refresh and is announced via the live region.

---

## F-14 — P2 — Model Footprint donut: center value overlaps slice labels

**Evidence.** S1: the donut center shows "8.73MB" colliding with "Model (INT8)", "Memory
headroom" and "Optimized" strings — per-slice `label`/`emphasis` center text fighting a static
center overlay.

**Root cause.** [CONFIRMED visual; INFERRED — needs src/ — exact option] Pie series labels
enabled (`label.show`/`label.position:'center'` on emphasis) while a separate center
graphic/title also renders.

**Patch — `src/components/charts/ModelFootprintChart.tsx` (complete file; one center label only,
legend right, tokens resolved for canvas):**

```ts
import { useEffect, useRef } from 'react';
import { CANVAS_FALLBACK, echarts, resolveToken } from './chartSetup';
import type { JSX } from 'react';

type ChartInstance = ReturnType<typeof echarts.init>;

export interface ModelFootprintChartProps {
  /** MB */
  readonly modelMb: number;
  /** MB */
  readonly headroomMb: number;
  /** MB */
  readonly budgetMb: number;
}

export function ModelFootprintChart({ modelMb, headroomMb, budgetMb }: ModelFootprintChartProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ChartInstance | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const chart = echarts.init(hostRef.current);
    chartRef.current = chart;
    const onResize = (): void => chart.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption({
      aria: { enabled: true, description: `Model footprint donut. INT8 artifact ${modelMb} megabytes of a ${budgetMb} megabyte budget, ${headroomMb} megabytes headroom.` },
      tooltip: { trigger: 'item', valueFormatter: (v: unknown) => `${String(v)}MB` },
      legend: {
        orient: 'vertical',
        right: 8,
        top: 'middle',
        textStyle: { color: resolveToken('--text-secondary', CANVAS_FALLBACK.textSecondary), fontSize: 11 },
        itemWidth: 10,
        itemHeight: 10,
      },
      // Donut shifted left so the legend never overlaps the ring.
      series: [
        {
          type: 'pie',
          radius: ['62%', '80%'],
          center: ['36%', '50%'],
          avoidLabelOverlap: true,
          label: { show: false },          // FIX F-14: no per-slice labels…
          labelLine: { show: false },
          emphasis: { label: { show: false } }, // …and no emphasis center label fighting the overlay
          data: [
            { name: 'Model (INT8)', value: modelMb, itemStyle: { color: resolveToken('--accent-violet', CANVAS_FALLBACK.accentViolet) } },
            { name: 'Memory headroom', value: headroomMb, itemStyle: { color: 'rgba(148,163,184,0.25)' } },
          ],
        },
      ],
      // Single authoritative center readout.
      graphic: [
        {
          type: 'text',
          left: '29%',
          top: '44%',
          style: {
            text: `${modelMb}MB`,
            fill: resolveToken('--text-primary', CANVAS_FALLBACK.textPrimary),
            fontSize: 20,
            fontWeight: 600,
            fontFamily: 'JetBrains Mono, monospace',
          },
        },
        {
          type: 'text',
          left: '29.5%',
          top: '54%',
          style: {
            text: `of ${budgetMb}MB`,
            fill: resolveToken('--text-muted', CANVAS_FALLBACK.textMuted),
            fontSize: 11,
          },
        },
      ],
    });
  }, [modelMb, headroomMb, budgetMb]);

  return <div ref={hostRef} role="img" aria-label={`Model footprint: ${modelMb}MB of ${budgetMb}MB budget`} style={{ width: '100%', height: 320 }} />;
}
```

**Acceptance (10 s).** Donut center shows a single "8.73MB / of 700MB" readout with no overlapping
text; hovering slices highlights without spawning center labels; legend sits fully to the right.

---

## F-15 — P2 — "Export CSV" wiring unverifiable

**Evidence.** dom.html: `<button type=button title="Export filtered results as CSV">…Export CSV</button>`
exists; scripts are stripped so the click path cannot be traced. [INFERRED — needs src/.]

**Patch.** Complete implementation supplied: `src/lib/csv.ts` (F-04) + the wired button in
`TicketsTable.tsx` (`exportCsv`, exports the full sorted set — 6 cached rows — not just page 1).

**Acceptance.** As F-04: one click → `recent-classifications.csv` (7 lines, quoted subjects,
ISO timestamps).

---

## F-16 — P2 — "Last 24 hours" dropdown: only the closed state is verifiable

**Evidence.** dom.html: `<button aria-haspopup=listbox aria-expanded=false …>Last 24 hours⌄</button>`
inside a `position:relative` wrapper; no listbox node exists in the capture. Whether options open,
select, or re-filter the dashboard cannot be confirmed. [INFERRED — needs src/.]

**Patch — `src/components/TimeRangeSelect.tsx` (complete, controlled, keyboard-correct listbox;
wire `value`/`onChange` to `useSettings`):**

```ts
import { useEffect, useRef, useState } from 'react';
import type { JSX, KeyboardEvent } from 'react';

export interface TimeRangeOption {
  readonly value: string;
  readonly label: string;
}

export const TIME_RANGES: readonly TimeRangeOption[] = [
  { value: '1h', label: 'Last hour' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
];

export interface TimeRangeSelectProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options?: readonly TimeRangeOption[];
}

export function TimeRangeSelect({ value, onChange, options = TIME_RANGES }: TimeRangeSelectProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent): void => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const openList = (): void => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const choose = (v: string): void => {
    onChange(v);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openList();
      return;
    }
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(options[active].value);
    }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Time range: ${current.label}`}
        onClick={() => (open ? setOpen(false) : openList())}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6,
          border: '1px solid var(--border-default)', background: 'var(--bg-card)',
          color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        {current.label}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Time range"
          aria-activedescendant={`tr-opt-${options[active].value}`}
          tabIndex={-1}
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', right: 0, minWidth: 160, margin: 0,
            padding: 4, listStyle: 'none', background: 'var(--bg-card)',
            border: '1px solid var(--border-default)', borderRadius: 8, zIndex: 120,
          }}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`tr-opt-${o.value}`}
              role="option"
              aria-selected={o.value === value}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(o.value)}
              style={{
                padding: '6px 10px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
                color: o.value === value ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: i === active ? 'rgba(99,102,241,0.12)' : 'transparent',
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Acceptance (10 s).** Click (or Space/↓ on) "Last 24 hours": a listbox opens with Last hour /
Last 24 hours / Last 7 days; arrows move the highlight, Enter selects and refocuses the button,
Esc closes without changing the value, and `aria-expanded` tracks the open state.

---

## Patch validation (performed on this deliverable)

All 15 complete files above were extracted verbatim from this document and compiled with
`typescript@latest`, `react@19` + `@types/react@19`, `echarts@6.1.0` under:
`strict, noUnusedLocals, noUnusedParameters, noFallthroughCasesInSwitch, verbatimModuleSyntax,
jsx: react-jsx, moduleResolution: bundler` → **tsc exit 0, zero errors**. Zero `any` in patch
code (grep-verified). Zero new dependencies — `LegacyGridContainLabel` and all chart imports ship
inside the already-used `echarts` package; every other patch uses only React + the DOM.
Token compliance: no raw hex in components except the single documented `CANVAS_FALLBACK` mirror
in `chartSetup.ts` (delete when importing the palette from `src/lib/chartTokens.ts`); the earlier
`#fff` literals were replaced with `var(--color-white)`; badge fills use
`color-mix(in srgb, var(--cat-N) 12%, transparent)` instead of hardcoded rgba.

## Integration checklist (where each patch lands)

1. `src/styles/tokens.css` — append the F-02/F-03 alias block and the F-12 focus rule (both are
   pure additions; nothing existing is overridden).
2. `src/hooks/useEventLog.ts`, `src/hooks/useApi.ts`, `src/lib/backoff.ts` — replace/create;
   then delete any ad-hoc probe code in `App.tsx` and render `<StatusPill />` (F-01) and
   `<HeaderBell />` (F-07) in the header.
3. `src/components/Tooltip.tsx` + `KpiCard.tsx` — replace the KPI grid cards; the stuck-tooltip
   markup (`aria-describedby` on non-focusable card divs) disappears with them (F-05).
4. `src/components/TicketsTable.tsx` + `src/lib/csv.ts` — replace the Recent Classifications card
   body (F-02/F-03/F-04/F-09/F-15 in one swap).
5. `src/components/SystemMonitor.tsx` — pass `dataState` from the fetch layer (F-06).
6. `src/components/EventLog.tsx` — replace the Event Log card (F-13).
7. `src/components/charts/chartSetup.ts` — single echarts entry; migrate existing charts to import
   `{ echarts }` from it (kills F-08); `ModelFootprintChart.tsx` replaces the donut (F-14).
8. `src/components/LivePredictions.tsx`, `TimeRangeSelect.tsx`, footer snippet (F-11/F-16/F-10).

## Could NOT diagnose (evidence needed)

- **Sidebar navigation** (Cases, Detections, Threat Analytics, Ticket Query, Live Predictions,
  Model Registry, System Health, API Metrics, Settings): all are `<button type=button>` with no
  router in evidence; whether they switch views or are dead cannot be determined without `src/`.
  If any is unimplemented, it must be visibly disabled with a reason — not silently dead.
- **Ticket Query search input**: rendered with `value` (controlled) but result rendering is
  unverifiable; `useTicketQuery` exists per architecture.
- **Export CSV / sort / pagination handlers**: markup is correct; click paths unverifiable
  (scripts stripped). Complete implementations supplied regardless (F-04/F-15).
- **Exact failing line of the health probe**: mechanism proven by behavior (S6 + 4 stale
  screenshots + log without an ERROR entry), file:line needs `src/`.
- **Bell count "3"**: proven not to equal the 2 log entries; the actual source (hardcoded vs
  stale store) needs `src/`.
- **KPI tooltip component identity**: its open-state DOM is absent from the capture (portal
  renders only while open), so the fix is supplied as a full replacement component rather than a
  line edit.
- **`/classify` request/response contract**: assumed `{text} → {category, confidence∈[0,1]}` in
  `LivePredictions.tsx`; adjust the two type lines if the API differs (backend OpenAPI at
  `/docs` is unreachable — S6).
- **ECharts warning origin**: confirmed from S6; which chart file sets `grid.containLabel` needs
  `src/` — the `chartSetup.ts` registration fixes it globally regardless of call site.

## Evidence appendix (locators)

| Finding | Locator |
|---|---|
| F-01 | dom.html `<div tabindex=0 role=button aria-describedby=status-tooltip …>Checking…</div>`; S6 `/health ERR_CONNECTION_TIMED_OUT`; dom.html `id=event-log` (2 entries, no ERROR) |
| F-02 | dom.html `style=background-color:var(--sev-critical)` ×3 + `var(--sev-high)` ×1 + `var(--sev-medium)` ×1; inlined-css.txt: 0 `--sev-` definitions (121 tokens listed) |
| F-03 | dom.html `color:var(--cat-1)`…`var(--cat-5)`; inlined-css.txt: only `--color-cat-1` defined; th `width:150px` vs badge `overflow:visible`; S3 "Unauthorized Acces" |
| F-04 | dom.html `<table … style=table-layout:fixed;min-width:900px>`, severity th `width:70px`, button `white-space:nowrap`; S3 header run-together |
| F-05 | S1 tooltip over header/h1; dom.html `aria-describedby=_r_0_-model-latency` (×4 KPI) with no matching id in DOM; card div has no tabindex |
| F-06 | dom.html `id=system-monitor`: `<span …>CACHED</span>` + 4× `Unavailable — API offline` |
| F-07 | a11y-attrs.txt `('button','aria-label','Notifications, 3 unread')`; text-content.txt lines 141–146 (2 entries) |
| F-08 | S6 console log.js:59 |
| F-09 | a11y-attrs.txt lines 13/18/23/28/33 (`<a href=# …>` ×5) |
| F-10 | dom.html footer `<a href=http://3.23.60.61:8000/docs …>`; S6 `/docs` timeout |
| F-11 | dom.html `id=live-prediction` `<button disabled …>Classify Ticket</button>`; chips `<button>` without `type=` |
| F-12 | dom.html inline `outline:none` ×3 vs inlined-css.txt global `:focus-visible` rule |
| F-13 | dom.html `id=event-log` chips (no `aria-pressed`), container without `role=log` |
| F-14 | S1 donut center overlap |
| F-16 | dom.html `<button aria-haspopup=listbox aria-expanded=false>Last 24 hours` (no listbox node) |
