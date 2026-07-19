# PATCHES_V2.md — Precise patches against the REAL source (Mission B, agent B)

Pass-1 reference patches converted into **full-replacement files** keyed to the
real architecture. Mirror root: `fixpack-v2/src/**` — overlay onto the repo
root (fixpack file = complete replacement of the same path).

**Source caveat (lead):** the archive PDF truncated lines >~143 chars with
"…". Every patched file that contained truncated lines has them reconstructed
and **flagged inline + below**. The real repo files are authoritative; verify
reconstructed chrome (class strings/paddings) against them before merging.

**Validation (this machine, overlay = originals + fixpack-v2):**
- `npx tsc --noEmit` (strict, no `any` allowed) → **exit 0**.
- `npx vite build` → **OK**; main chunk **278 KB** (<600 KB bar); ECharts lazy
  chunk 569 KB (separate, lazy-loaded).
- Overlay excluded: `model/eval_results.json` (PDF-truncated JSON — see
  Blockers), `tsconfig.app.json`/`tsconfig.node.json` (absent from archive).
- No new npm dependencies added. New source files justified in their headers.

---

## 1. Files delivered (28; tokens.css excluded — agent D owns it)

### NEW files (6)
| File | Lines | Purpose |
|---|---|---|
| `src/lib/backoff.ts` | 69 | FIX-01: jittered backoff 5s→60s (pass-1 reference ported 1:1) |
| `src/lib/paginate.ts` | 42 | FIX-28: single pure owner for pagination math |
| `src/lib/timeRange.ts` | 44 | FIX-26: pure `filterByTimeRange` (ranges = real options 1h/6h/24h/7d) |
| `src/hooks/useTimeRange.ts` | 53 | FIX-26: singleton store shared by Header + ClassificationTable |
| `src/components/ProvenanceBadge.tsx` | 47 | FIX-04: ONE badge component, binding matrix (live→none / cache→amber CACHED / none→none) |
| `src/components/SnapshotFooter.tsx` | 50 | FIX-27: ONE provenance footer; real timestamp only |

### REPLACED files (22)
| File | Lines | FIX-NN applied |
|---|---|---|
| `src/hooks/useApi.ts` | 481 | **FIX-01** (+ P0 store-snapshot root cause) |
| `src/hooks/useEventLog.ts` | 203 | **FIX-08** (+ P0 store-snapshot), `logEvent` export added |
| `src/hooks/useTicketQuery.ts` | 90 | store-snapshot (dead search) |
| `src/hooks/useTickets.ts` | 137 | FIX-27 support (`snapshotLoadedAt`) |
| `src/lib/echarts.ts` | 47 | **FIX-07** (`LegacyGridContainLabel` registered) |
| `src/lib/chartTokens.ts` | 98 | **FIX-03/12** muted mirror |
| `src/lib/exportCsv.ts` | 59 | **FIX-25** hardening |
| `src/lib/utils.ts` | 107 | **FIX-02/03/15/19** token rewiring |
| `src/components/ClassificationTable.tsx` | 526 | FIX-04/05/06/15/16/17/19/22/23/25/26/27/28 |
| `src/components/Header.tsx` | 550 | FIX-01/08/09/15/16/19/20/23/26/31 |
| `src/components/KpiCard.tsx` | 328 | FIX-09/11/15/16/19/30 |
| `src/components/ThreatBarChart.tsx` | 210 | **P0 FALLBACK removed**, FIX-03/04/12/19/23/27 |
| `src/components/ModelHealthDonut.tsx` | 186 | FIX-04/12/14/19/23/27 |
| `src/components/PerformanceLineChart.tsx` | 210 | FIX-04/10/12/19/23/27 |
| `src/components/SystemMonitor.tsx` | 154 | FIX-04/15/16/19/23/27 + honesty redesign |
| `src/components/EventLog.tsx` | 197 | FIX-10/16/19/21/27 |
| `src/components/LivePrediction.tsx` | 364 | FIX-13/15/16/19/20/23 |
| `src/components/Sidebar.tsx` | 280 | FIX-19/20/23/29/31 |
| `src/components/Footer.tsx` | 62 | FIX-15/23/24 (now wired into App) |
| `src/components/SettingsDrawer.tsx` | 281 | FIX-01-flow/15/16/19/20/23/31 |
| `src/components/ChartSkeleton.tsx` | 68 | FIX-19 |
| `src/components/HelpModal.tsx` | 120 | FIX-16/31 |
| `src/App.tsx` | ~420 | FIX-11/15/16/19/23/24/29 + log dedupe |

### Unchanged files intentionally NOT in the mirror
`ECharts.tsx` (wrapper fine), `Sparkline.tsx` (color prop; call sites fixed),
`useSettings.ts`, `useSettingsDrawer.ts` (snapshot-correct stores),
`formatRelativeTime.ts`, `main.tsx`, `tokens.css` (agent D), `index.css`
(recommend DELETION — see §4).

---

## 2. NEW P0 findings proven from the real source (were INFERRED in pass-1)

1. **P0 — `getSnapshot` same-reference defect (3 stores).** `useApi.ts` L107,
   `useEventLog.ts` L98, `useTicketQuery.ts` L25 all `return store;` — the
   SAME object mutated in place. `useSyncExternalStore` bails on `Object.is`,
   so subscribers never re-render. **This is the true root cause** of: the
   stuck "Checking…" pill (FIX-01/S1–S4), the bell-3-vs-log-2 desync
   (FIX-08), and the search box accepting keystrokes without filtering.
   Fixed by immutable state replacement in all three stores.
2. **P0 — fabricated chart data (Honesty Contract violation).**
   `ThreatBarChart.tsx` L7–14 hardcoded `FALLBACK` counts (Phishing 1847,
   Malware 1245, …) and seeded state with them (L34) — the S1 bars are fake
   data wearing a CACHED badge. Removed; honest empty state added.
3. **P1 — duplicate transition logging.** App.tsx L175–185 logged
   restored/lost transitions AND pass-1 FIX-01 puts them in the probe writer;
   App effect removed, single writer = `useApi.applyOutcome`.
4. **P1 — `SystemMonitor` fake utilization bars** (percent 100 when "live",
   0 when offline) and static '—' tiles even when live. Honest redesign:
   config facts labeled as config; API Latency = real last /health probe;
   Requests/min admits "No telemetry endpoint".
5. **P2 — dead code removed:** `generateTicketId` (utils.ts, zero call
   sites); `echarts-for-react` in package.json is never imported (see §4).

---

## 3. Per-file change map (FIX-NN → what changed → original line ranges)

### `src/hooks/useApi.ts` (orig 326) — FIX-01, export surface preserved
- L87–113 mutable `store` + `getSnapshot` → **immutable `state`** + `setState`.
- L69 `HEALTH_TIMEOUT_MS = 10_000` → `PROBE_TIMEOUT_MS = 4_000`.
- L114–124 `updateStatus` → **`applyOutcome(seq, …)` single writer** + seq-token
  race guard; EventLog transitions incl. initial checking→offline/cached
  (ERROR once, DEBUG every 10th, INFO on recovery) via new `logEvent`.
- L131–144 probe fns accept external `AbortSignal` (supersede aborts fetches).
- L170–201 `checkHealth` → superseding probe; never rejects; ≤4s settle.
- L203–216 scheduler → `createBackoff(5s→60s, full jitter)` offline /
  30s live; `visibilitychange`/`focus`/`online` re-probes kept.
- L219–247 `predict` → `reportApiOutcome` (user-action evidence supersedes).
- L249–283 `getStats/getPerformance/getClassifications` → also report outcome
  (fresh evidence) — cache fallback semantics unchanged.
- Kept: `probeApiBase` (pure, no state writes — Settings test), `getApiBase()`
  from `useSettings` (REAL wiring; pass-1's env-var base URL rejected),
  `ApiStatus = 'live'|'cached'|'offline'` + `checking` flag, `Diagnostics`.

### `src/hooks/useEventLog.ts` (orig 158) — FIX-08
- L81–99 store → immutable; L98 `getSnapshot` defect fixed.
- Entry cap: per-caller `maxEntries` ("first caller wins", could trim the
  100-entry panel to 50) → module `MAX_ENTRIES = 200`; param kept for compat.
- ADDED `logEvent(level, message)` (imperative writer for useApi).
- Same hook return shape (`logs, unreadCount, add*, markAllRead, bottomRef,
  renderLog`); unread still derived `logs > lastRead`.

### `src/hooks/useTicketQuery.ts` (orig 84) — store defect
- L25/31/37 mutations → immutable `setState`. Public API unchanged.

### `src/hooks/useTickets.ts` (orig 113) — FIX-27 support
- ADDED `snapshotLoadedAt` + `getSnapshotLoadedAt()` (set before
  `seedTickets` emit in `loadTicketSnapshot`). Rest unchanged. NOTE: snapshot
  JSON has no `generatedAt`; load time is the only honest timestamp (flagged
  for backend follow-up).

### `src/lib/echarts.ts` (orig 26) — FIX-07
- ADDED `LegacyGridContainLabel` from `echarts/features` to `use([…])`
  (Option A — registration, zero option changes; kills S6 warning, labels
  unclipped). Option B (`grid.outerBounds*`) documented as later alternative.

### `src/lib/chartTokens.ts` (orig 62) — FIX-03/12
- cat1–6 pastel 400-level → muted 600-level set (mirrors agent D
  `--color-cat-*`); ADDED catText1–6; sevLow aligned `#38BDF8`; donut model
  slice `#06B6D4` + `donutTrack #334155`; ADDED chrome mirrors
  (grid/axisLine/barTrack/tooltip*). All original export keys kept.

### `src/lib/exportCsv.ts` (orig 41) — FIX-25
- L3–9 `escapeCsvCell` → + formula-injection guard (`'`-prefix for `= + - @`).
- L25 join `'\n'` → `'\r\n'`; L27 Blob → + `'\uFEFF'` BOM.
- Wiring (ClassificationTable L16/L161–164/L193–214) **already existed** —
  no component change needed beyond keeping it.

### `src/lib/utils.ts` (orig 85) — FIX-02/03/15/19
- L29–36 `CATEGORY_BG` 6 rgba literals → `var(--color-cat-{1..6}-bg)`.
- L57–62 `SEVERITY_COLORS` `info: var(--sev-info)` → `var(--sev-low)`
  (canonical token set has no `--sev-info`).
- L64–68 `STATUS_COLORS` rgba+neon hex → `--status-{resolved,escalated,pending}-fg/-bg`.
- L77–79 `generateTicketId` REMOVED (dead code).
- `CATEGORY_COLORS` kept as `var(--cat-N)` — agent D now defines them.

### `src/components/ClassificationTable.tsx` (orig 377) — 15 FIX-NN
- L238 severity col **70→104**; L237 category **150→170**; th + overflow
  guard + `--density-table-head-h` (FIX-05/06).
- L266 dead `<a href="#">` → non-interactive mono span (FIX-22).
- L271–284 badge: `overflow:'visible'` → `maxWidth:'100%'` + ellipsis +
  `title` (FIX-06); severity cell = dot + text label (FIX-02 acceptance).
- L159 offline banner → `ProvenanceBadge` + `SnapshotFooter` (FIX-04/27);
  subtitle → 'Live API predictions' / 'Cached snapshot' (C-34).
- Rows pipeline: query → `filterByTimeRange` (shared store) → sort →
  `paginate()` (FIX-26/28); summary "Page X of Y" (C-40); time-cell full
  timestamp `title` (C-42); assignee full string + title (C-37).
- Truncated-line reconstructions: **L167–168** (root card chrome), **L298**
  (`{(row.confidence * 100).toFixed(0)}%`), **L315–316** (assignee/time
  cells), **L325** (pagination chrome), **L367** (footer chrome).

### `src/components/Header.tsx` (orig 442) — 11 FIX-NN
- L69–77 statusConfig → canonical labels 'Connecting to inference API…' /
  LIVE / CACHED / API OFFLINE + pill/status tokens (FIX-01/23).
- L150 `outline:'none'` REMOVED (FIX-20).
- Status tooltip: Esc close + conditional `aria-describedby` (FIX-09);
  Esc also closes dropdown + notifications.
- Time listbox → `useTimeRange` store; label `· cached data` suffix when
  cached (FIX-26); TIME_OPTIONS local → `TIME_RANGES` from lib.
- Bell badge → `--badge-count-*`/`--color-badge-alert-bg` tokens (FIX-15/16);
  z-index → tokens (FIX-31); rgba sweeps → ghost/tint tokens (FIX-19).
- Truncated reconstructions: **L70,74,76–77** (statusConfig), **L207,214–215,
  218** (endpoint rows), **L303,312** (listbox option handlers).

### `src/components/KpiCard.tsx` (orig 271) — FIX-09/11/15/16/19/30
- Tooltip: whole-card hover + `bottom:calc(100%+8px)` (painted over header,
  S1) → **focusable info button**, below-trigger placement inside the card,
  Esc/blur/leave/outside-pointerdown close, conditional `aria-describedby`
  (was permanently dangling). Pass-1's portal `Tooltip.tsx` deliberately NOT
  used (see §4).
- Stat block: 11px caps label / 28px `--font-size-kpi` value in
  `var(--font-metric)` + tabular-nums (FIX-11/30) / 11px sub-label.
- 4 badge variants → one `--badge-*` geometry + token triples.
- `sparklineColor` default `'#06B6D4'` → `chartColors.int8`.
- Truncated reconstructions: **L174** (hover handlers), **L262** (tooltip title).

### `src/components/ThreatBarChart.tsx` (orig 152) — P0 + FIX-03/04/12/19/23/27
- **L7–14 `FALLBACK` REMOVED**; state `[]`; honest empty state (title +
  why + auto-recovery note).
- L122 `cached = status !== 'live'` → per-panel `panelSource` +
  ProvenanceBadge + SnapshotFooter.
- `any` formatters → typed params; bar track/splitLine → chartTokens chrome;
  re-fetch when status → 'live'.
- Truncated reconstructions: **L130–131** (badge chrome), **L145** (card chrome).

### `src/components/ModelHealthDonut.tsx` (orig 144) — FIX-04/12/14/19/23/27
- Headroom slice `chartColors.tokenizerConfig` (#8B5CF6 loud violet) →
  `donutTrack` #334155; model slice now cyan via updated `modelInt8`.
- Graphic center labels `left:'25%'/'26%'` → `'34%'` (donut center) — F-14.
- CACHED badge + 'Snapshot: cached' caption REMOVED (static facts; false
  provenance); '8.73 MB' / '700 MB' unit spacing; `useApi` import dropped.
- Truncated reconstructions: **L122–123** (badge chrome), **L137** (card chrome).

### `src/components/PerformanceLineChart.tsx` (orig 187) — FIX-04/10/12/19/23/27
- `isCached` state (L25) + badge-when-empty contradiction (S2) → per-panel
  `panelSource`: badge only with cached points; honest empty state
  'No performance data available' + why (C-26/27).
- Grid/axis rgba literals → chartTokens chrome; re-fetch on recovery;
  SnapshotFooter.
- Truncated reconstructions: **L144–145** (axis config), **L180** (card chrome).

### `src/components/SystemMonitor.tsx` (orig 140) — FIX-04/15/16/19/23/27
- L99 `offline ? 'CACHED' : 'LIVE'` badge REMOVED (no cache source → matrix
  says no badge either way); honest tiles (§2.4); footer = real probe cadence
  ('Health probe … every 30s' / 'Retrying with jittered backoff (5s–60s)')
  replacing false 'Snapshot: cached' caption.
- Truncated reconstructions: **L83** (badge chrome), **L138** (card chrome).

### `src/components/EventLog.tsx` (orig 176) — FIX-10/16/19/21/27
- Filter chips → `role="group"` + `aria-pressed`; list → `role="log"`
  `aria-live="polite"` `aria-relevant="additions"` (FIX-21).
- 'End of log · N entries' terminator (FIX-10); 'Snapshot: cached' footer
  REMOVED (live session events — false provenance, FIX-27); level chip
  9px→11px (FIX-16); rgba → status/tint tokens (FIX-19).
- Truncated reconstructions: **L54** (header chrome), **L171** (footer chrome —
  region deleted anyway).

### `src/components/LivePrediction.tsx` (orig 266) — FIX-13/15/16/19/20/23
- L126–150 full-width `var(--accent-indigo)`/'#fff' button → 32px
  right-aligned `--color-accent-indigo-strong` + `--color-text-on-accent`;
  disabled when offline/empty/loading **with reason text**; double-submit
  guard. `!live` gating added (`status` from useApi).
- Subtitle state-aware (C-47); 'Ctrl + Enter to classify' (C-49); 'Try a
  sample' label (C-50); offline-honest empty state (C-52); textarea
  `outline:none` removed (FIX-20); chip `type="button"`.
- **Props contract `{onClassify,onError,onSubmit}` preserved** (App owns
  ticket-add + logging) — see §4 wrong-assumption #2.
- Truncated reconstructions: **L74,76,118–119,153,160–161,191,212–213,245,
  253–254,258–259** (panel chrome; title 'Live Classification' confirmed by
  evidence/text-content.txt).

### `src/components/Sidebar.tsx` (orig 270) — FIX-19/20/23/29/31
- L64 `width: 260` → `var(--layout-sidebar-w, 240px)` (see §4 #9 — agent D
  bound the token to 260px); L75 z 100 → token; L109 'Arm64 Guardian' →
  'Security Operations' (C-01); L186 placeholder → 'Search tickets…' (C-02);
  L196 `outline:'none'` removed; active/hover rgba → tokens; group labels
  10→11px; user card radius 10 → `--radius-md`.
- Truncated reconstruction: **L2** import tail `from 'lucide-react'` (fully
  determined by icon call sites).

### `src/components/Footer.tsx` (orig 26) — FIX-15/23/24
- Dead-code component revived + wired into App; API Docs keeps
  `target="_blank" rel="noreferrer"` + gains offline-aware `title` (C-55);
  copy C-54; links `--color-link`; Tailwind classes → token inline styles.

### `src/components/SettingsDrawer.tsx` (orig 252) — FIX-01-flow/15/16/19/20/23/31
- L35–46 `handleTest` probed the **saved** URL → probes the **draft**; on
  success saves + immediate `checkHealth()` re-probe. L31–33 blur-save of a
  changed URL also re-probes (was: next scheduled probe, up to 60s away).
- z 200 → `--z-overlay`; `outline:'none'` removed; knob '#fff' →
  `--color-text-on-accent`; version string de-'Guardian'ed.

### `src/components/ChartSkeleton.tsx` (orig 59) — FIX-19
- rgba placeholder fills → tint tokens. (Suspense chrome; not a fake-data
  skeleton.)

### `src/components/HelpModal.tsx` (orig 104) — FIX-16/31
- z 300 → `--z-overlay`; kbd font stack → `var(--font-numeric)`; shadow/radius
  tokens. Truncated reconstruction: **L~62** (`gap: 12`).

### `src/App.tsx` (orig 395) — FIX-11/15/16/19/23/24/29
- L366–381 inline footer (same-tab API Docs) → `<Footer />` (FIX-24).
- L272/285/300/324 KPI `iconBg` pastel rgba → `--color-icon-chip-bg`,
  `iconColor` → `--text-secondary` (FIX-11); sparkline `'#6366F1'/'#06B6D4'`
  → `chartColors.onnx/int8`; '8.73MB' → '8.73 MB' (C-16); footprint
  detail/tooltip (C-17/18).
- L175–185 status-transition effect REMOVED (single writer = useApi).
- L245 `marginLeft: 260` → `var(--layout-sidebar-w, 240px)`; page padding
  → `--layout-page-px`.
- Truncated reconstructions: **L22** (lazy import tail), **L245** (`zIndex: 1`),
  **L253** (`marginBottom: 4`), **L276–277/289–290** (badge ternaries:
  latency-down=positive, throughput-up=positive; tooltip notes), **L379–380**
  (footer anchors — region replaced by `<Footer />`).

---

## 4. WRONG pass-1 assumptions (explicit) + deviations

1. **Footer defect location.** Pass-1 patched `src/components/Footer.tsx` for
   the same-tab API Docs link. REAL: Footer.tsx was **dead code** and already
   had `target="_blank"`; the defect lived in **App.tsx L366–381**'s inline
   footer. Fix = wire `<Footer />` into App + polish Footer.
2. **LivePrediction ownership.** Pass-1's variant (SAMPLE_TICKETS, useTickets
   add, useEventLog) does NOT exist. REAL file is props-driven
   `{onClassify?, onError?, onSubmit?}` with `EXAMPLES` (3 chips); App owns
   ticket-add (`add(...)`) and EventLog writes. Patch preserves the props
   contract; FIX-13 applied inside the real shape.
3. **useApi shape.** Pass-1 assumed `status: 'checking'|'online'|'offline'`,
   env-var `API_BASE`, and a `logEvent` export in useEventLog. REAL:
   `'live'|'cached'|'offline'` + separate `checking`, `getApiBase()` from
   `useSettings`, `probeApiBase` export, `Diagnostics.endpoints`, and NO
   `logEvent`. FIX-01 ported onto the real model; `logEvent` ADDED to
   useEventLog; transition logging consolidated in the probe's single writer
   (App's duplicate effect removed — deviation from pass-1's "log inside
   useApi only" insofar as App kept data-event logs like 'Cached ticket
   snapshot loaded').
4. **Time options.** Pass-1 assumed 24h/7d/30d. REAL: 1h/6h/24h/7d —
   `timeRange.ts` matches the real listbox.
5. **CSV wiring.** Pass-1 assumed missing. REAL: already wired
   (`exportTicketsToCsv` + button). FIX-25 = library hardening only.
6. **Tooltip architecture.** Pass-1 shipped a portal `Tooltip.tsx`. Delivered
   instead: in-card below-trigger tooltip in KpiCard (no portal, no flip
   math, meets all FIX-09 acceptance points: Esc/leave/blur close, never
   overlaps header, focusable trigger, conditional describedby).
7. **`--spacing-6` "missing".** REAL tokens.css defines it. Not a defect.
8. **Category→palette order in F-04's table** (pass-1: Unauthorized Access
   = cat-3). REAL utils: Data Breach = cat-3, Unauthorized Access = cat-4.
   Real mapping kept everywhere.
9. **Sidebar width.** FIX-29 said 240px via `--density-sidebar-w`; agent D's
   tokens.css defines `--layout-sidebar-w: 260px` with a binding comment
   ("real Sidebar/App use 260"). Components reference the token; the width
   decision is agent D's lane. Token-fallback in components is 240px.
10. **`maxEntries` semantics (useEventLog).** Pass-1 scaffold kept per-caller
    caps; real "first caller wins" cap could trim the panel. Fixed with a
    module `MAX_ENTRIES = 200` (documented deviation).
11. **SnapshotFooter timestamp.** Snapshot JSON has no `generatedAt`; footer
    uses `useApi.lastSync` (when the cached data was last fetched live) else
    the real snapshot load time. Flagged for backend to add `generatedAt`.

## 5. Could NOT map / blocked

- **FIX-14/17/18/30 token sides**, **FIX-32** (Tailwind/@theme reconciliation),
  **FIX-33 token sweep**, global `:focus-visible` → owned by agent D's
  tokens.css (verified present: `--sev-*`, `--cat-*`, `--color-cat-*-bg/-text`,
  `--status-*`, `--badge-*`, `--pill-*`, `--tint-*`, `--z-*`, `--font-size-*`,
  `--tracking-*`, `--layout-*`, `--density-table-head-h`, `--caption-*`,
  `--color-icon-chip-bg`, `--color-control-ghost-bg`, `--color-link`,
  `--color-accent-indigo-strong`, `--color-text-on-accent`,
  `--color-badge-alert-bg`, `--shadow-popover`, `--font-metric`,
  `--font-size-kpi`). Components reference these names; with D's sheet the
  overlay resolves 100% of referenced tokens (checked every one).
- **`model/eval_results.json`** is PDF-truncated at L3/L18 (invalid JSON in
  the archive). Real repo file assumed valid; NOT patched (outside scope).
  Type-check used a scratch equivalent of its real shape (status PENDING).
- **`tsconfig.app.json` / `tsconfig.node.json`** referenced by tsconfig.json
  but ABSENT from the 53-file archive — build script `tsc -b` needs them.
  Flagged; not fabricatable.
- **`index.css`** is dead (imports tokens.css again; `main.tsx` imports
  tokens.css directly; nothing imports index.css). Recommend deletion —
  cannot express deletion in a file mirror; noted for the lead.
- **`echarts-for-react`** is in package.json but never imported (wrapper uses
  `echarts/core` directly). Recommend dropping the dep; package.json not
  patched (not in my assigned file set).
- **Vite build warning:** lightningcss "Unknown at rule: @theme" originates
  from agent D's tokens.css (their FIX-32 decision), not from my files.
- **Modal backdrops** (`SettingsDrawer` rgba(0,0,0,0.50), `HelpModal`
  rgba(0,0,0,0.60)) kept verbatim from the originals — no backdrop/scrim
  token exists in the token set; creating one is agent D's lane. No NEW raw
  values were introduced anywhere (swept: zero raw hex/rgba outside
  chartTokens.ts + var() fallbacks + comments; zero explicit `any`).
