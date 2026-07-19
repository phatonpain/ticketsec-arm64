# TicketSec Arm64 — FIX PACK v2 (precise, source-verified)

**Second pass.** Real source analyzed (53 files, 6,017 lines, from `ticketsec-source.pdf`). Every pass-1 [INFERRED] is now resolved to file:line; pass-1 wrong assumptions are explicitly corrected below.
**Validation:** patched tree compiled `tsc --noEmit --strict` **0 errors**; `vite build` **OK** — main chunk **278 KB** (<600 KB bar), ECharts lazy chunk 569 KB; test suites **102 green / 27 expected-fail / 0 unexpected** (129 tests, real code).
**Apply from `fixpack-v2/` ONLY.** The pass-1 `fixpack/` directory is SUPERSEDED (its tokens patch and useApi reference were built on corrected assumptions).
**Detail docs:** `audit/LOGIC_FIXES_V2.md` (15-item checklist + N-01…N-19) · `audit/PATCHES_V2.md` (per-file change map) · `audit/TOKENS_ROOTCAUSE.md` (theme↔tokens verdict) · `audit/TEST_NOTES_V2.md` (mapping + expected-fail registry) · pass-1 docs kept for narrative.
**Source caveat:** the PDF truncated 89 lines >143 chars; patches touching them are flagged `NOTE:` in the files and in PATCHES_V2.md — re-diff against the untruncated repo.

---

## ⚠️ HEADLINE CORRECTION — the real root cause of "Checking…" stuck forever

Pass-1 blamed a missing probe timeout. **Wrong.** The real probe has a 10 s `AbortController` timeout (`src/hooks/useApi.ts:69,126-135`), always settles (`:199-203`), and already backs off 30→300 s (`:74-75,206-213`).
**The true P0:** `getSnapshot()` returns the **mutable store singleton** (`useApi.ts:107-109`, `useEventLog.ts:99-101`, `useTicketQuery.ts:24-26`). `useSyncExternalStore` compares with `Object.is` — same reference, so React **never re-renders after mount**. The UI froze on `checking:true` (`useApi.ts:85` → `Header.tsx:69-70`), the bell froze at 3, and search/pagination looked dead. One mechanism, three "unrelated" symptoms. Reproduced by `tests/hooks/storeIdentity.test.tsx`.

---

## P0 — broken functionality / Honesty Contract risk

### FIX-01 [P0 — ROOT CAUSE CORRECTED] — Frozen stores: mutable getSnapshot singleton
Evidence: file:line above; S1–S4 symptoms all explained by it.
Apply: `fixpack-v2/src/hooks/useApi.ts` (481 lines — immutable snapshots in `emit()`, keeps the real 10 s timeout + backoff; integrates N-03 predict-failure→offline, N-04 refresh-during-probe, N-05 anti-flap) + `fixpack-v2/src/hooks/useEventLog.ts` (203) + `fixpack-v2/src/hooks/useTicketQuery.ts` (90). Pill states `LIVE`/`CACHED`/`API OFFLINE` in `Header.tsx` (550).
Acceptance: `storeIdentity.test.tsx` green; block the API → pill settles "API OFFLINE" ≤10 s with a real ERROR log entry; bell equals unread; search filters live.

### FIX-02 [P0 — CONFIRMED precise] — `--sev-*` never defined → invisible severity dots
Evidence: refs `src/lib/utils.ts:48-53` → rendered `ClassificationTable.tsx:289,294`; zero definitions in real `tokens.css`.
Apply: `fixpack-v2/src/styles/tokens.css` (428 lines, 215 definitions — full severity scale incl. **`--sev-info`**, which both pass-1 files missed; False Positive rows would have stayed broken).
Acceptance: every row shows colored severity dot + label.

### FIX-03 [P0 — CONFIRMED precise] — `--cat-1..6` never defined → broken category badges
Evidence: refs `src/lib/utils.ts:11-18` → `ClassificationTable.tsx:262-264`, `LivePrediction.tsx:53`; only `--color-cat-*` existed. Also: `chartTokens.ts` hardcoded the OLD palette (canvas can't resolve `var()`) — D2 blocker.
Apply: tokens.css v2 (alias bridge `--cat-N` → muted `--color-cat-N-*` system) + `fixpack-v2/src/lib/chartTokens.ts` (98 — mirrors new tokens) + `utils.ts` (107).
Acceptance: six badges + bars + donut share identical hues; no white-text badges.

### FIX-04 [P0 — CONFIRMED precise] — CACHED badge contradicting "Unavailable" content
Evidence: `SystemMonitor.tsx:100`; two divergent badge implementations in DOM. Matrix binding: live → none · cached → amber + timestamp · offline-no-cache → "Unavailable", NO badge.
Apply: `fixpack-v2/src/components/ProvenanceBadge.tsx` (NEW, 47) + SystemMonitor (154 — fake utilization bars replaced by honest tiles) + table/charts panels.
Acceptance: API down → System Monitor badge-free "Unavailable — API offline"; table keeps amber CACHED + timestamp.

### FIX-34 [P0 — NEW, pass 2] — ThreatBarChart rendered FABRICATED data under the CACHED badge
Evidence: `ThreatBarChart.tsx:7-14,34` — hardcoded FALLBACK dataset; **the S1 bars (1,847 / 1,245 / 982…) were fake.** Direct Honesty Contract violation.
Apply: `fixpack-v2/src/components/ThreatBarChart.tsx` (210) — fallback deleted; renders store data or the honest unavailable state.
Acceptance: API down + no snapshot → chart shows the honest empty state, never invented bars.

### FIX-35 [P0 — NEW, pass 2] — `predict()` failure never marks the API offline
Evidence: `useApi.ts:242-245` — a failed classify left status `live` (stale-live risk).
Apply: integrated in useApi v2 (single-writer `applyResult` + `reportApiOutcome`); verify N-04/N-05 follow-ons landed (diffs in LOGIC_FIXES_V2 if your tree diverges).
Acceptance: classify with API down → honest error + status flips offline; no stale-live.

### FIX-36 [P0 — NEW, pass 2] — CSV formula injection
Evidence: `exportCsv.ts:3-9` (B-13) — cells starting `= + - @` unescaped.
Apply: `fixpack-v2/src/lib/exportCsv.ts` (59) — RFC-4180 + formula-prefix guard; `exportCsv.test.ts` covers it.
Acceptance: export a ticket whose subject starts with `=HYPERLINK(` → cell is prefixed/escaped in Excel.

### FIX-37 [P0 — VERIFY IN REPO] — `tsc -b` build may be broken: tsconfig project files missing
Evidence: archive's `tsconfig.json` references `tsconfig.app.json` / `tsconfig.node.json`, neither in the 53 files. If truly absent, `npm run build` fails.
Apply: confirm in the real repo; if missing, add both (standard Vite React-TS contents — spec in PATCHES_V2.md).
Acceptance: `npm run build` exits 0 on a clean clone.

---

## P1 — visual/UX defects (now file-precise)

### FIX-05 [P1] — SEVERITY⇅CONFIDENCE header overlap
Evidence: `ClassificationTable.tsx:242` (70 px column vs content box). Apply: fixpack-v2 `ClassificationTable.tsx` (526): SEVERITY 104 px, clipped-th guard, 36 px head, `aria-sort`. Acceptance: 8 headers legible at 1366 px; real sorts.

### FIX-06 [P1] — "Unauthorized Acces" badge guillotine
Evidence: same file, badge cell ~126 px vs 152 px needed. Apply: column 170 px + badge ellipsis + `title` (in the 526-line replacement). Acceptance: full category name or ellipsis + hover text.

### FIX-07 [P1] — ECharts 6 `grid.containLabel` warning
Evidence: S6 console; real registration point `src/lib/echarts.ts` (25 lines). Apply: `fixpack-v2/src/lib/echarts.ts` (47) — **Option A applied**: `LegacyGridContainLabel` registered from `echarts/features` at the real registration point (Option B/outerBounds documented in LOGIC_FIXES as the v6-idiomatic alternative). Acceptance: console clean; labels unclipped at 1366/1440/1920.

### FIX-08 [P1 — REFUTED AS STATED] — Bell "3" was NOT hardcoded
Evidence: `Header.tsx:341-361` — unread IS store-derived; the 3-vs-2 mismatch was the FIX-01 frozen store. Apply: none beyond FIX-01 (`useEventLog` immutable now drives it); badge hides at 0 (Header v2). Acceptance: badge always equals unread count.

### FIX-09 [P1] — KPI tooltip stuck open + dangling `aria-describedby`
Evidence: `KpiCard.tsx:245-270` + `:175-176` (PDF-truncated tail, flagged). Apply: `fixpack-v2/src/components/KpiCard.tsx` (328) — mount on hover/focus, Esc close, `useId` wiring, viewport-confined. Acceptance: Esc/leave closes; never overlays header.

### FIX-10 [P1] — Dead-space panels (Classification Performance, Event Log)
Apply: `fixpack-v2/src/components/PerformanceLineChart.tsx` (210) + `EventLog.tsx` (197) — honest EmptyState (what/why/next), "End of log" terminator, reduced min-heights. No fake data, no skeletons. Acceptance: intentional empty states; zero dead scroll.

### FIX-11 [P1] — KPI cards → enterprise stat blocks
Apply: KpiCard v2 + tokens (`--font-size-kpi`, label caps, tabular values). Acceptance: single baseline; honest-muted dash for nulls.

### FIX-12 [P1] — Candy chart palette + donut emphasis inversion
Apply: chartTokens v2 + ThreatBarChart/ModelHealthDonut v2 — muted `--color-cat-*`; donut model slice accent, headroom quiet baseline; center-label/legend collision fixed (`ModelHealthDonut.tsx:89,102` vs `:63`). Acceptance: badges/bars/donut hues identical.

### FIX-13 [P1] — "Classify Ticket" geometry + silent disabled
Note: real component is props-driven (`{onClassify,onError,onSubmit}`) — pass-1's SAMPLE_TICKETS assumption was wrong. Apply: `fixpack-v2/src/components/LivePrediction.tsx` (364) — 32 px primary `--color-accent-indigo-strong`, disabled states explain themselves, offline error path honest, stale-`error` closure fixed (EXPOSED-06, original `:48`). Acceptance: offline submit → honest error + EventLog entry (flow test green).

### FIX-14 [P1] — Elevation inversion / ghost controls
Apply: tokens v2 (elevated > card > body) + control tokens. Acceptance: no #0B0F19 "holes" on cards.

### FIX-15 [P1] — Badge chaos + contrast failures
Evidence: Escalated 3.57:1, links 3.27:1, bell 3.67:1 (measured pass 1). Apply: ProvenanceBadge + `--status-*`/`--badge-*`/`--color-link`/`--color-badge-alert-bg` tokens (all ≥4.5:1) + sweep across the 22 replaced files. Acceptance: axe contrast = 0.

### FIX-16 [P1] — 9/10 px type floor
Apply: tokens v2 scale (11 px micro floor) + sweeps (Sidebar group labels, log chips, KPI labels). Acceptance: nothing <10 px rendered.

### FIX-17 [P1] — tabular-nums gaps
Apply: sweeps in table/IDs/pagination (utils v2 + ClassificationTable v2). Acceptance: digit-aligned numerics.

### FIX-18 [P1 — CORRECTED] — Spacing drift (but `--spacing-6` EXISTS)
Pass-1 claimed `--spacing-6` missing — wrong; real drift = 33 distinct paddings + hardcoded 20 px widgets + raw 56/260 px structure. Apply: tokens v2 structure tokens + sweeps. Acceptance: paddings resolve to density tokens.

### FIX-19 [P1] — 49 raw rgba literals
Apply: swept in the 22 replaced files (B validation: zero raw hex/rgba outside chartTokens + documented `var()` fallbacks). Acceptance: component grep clean.

### FIX-20 [P1 — CORRECTED COUNT] — Focus killers: `outline:none` ×4 (not ×3)
Evidence: `Sidebar.tsx:199`, `Header.tsx:152`, `SettingsDrawer.tsx:128`, `LivePrediction.tsx:99`. Apply: removed in v2 files; global `:focus-visible` rules. Acceptance: visible ring on every Tab stop.

### FIX-21 [P1] — Event Log chips / live region
Evidence: `EventLog.tsx:66-86`. Apply: EventLog v2 — `aria-pressed`, `role=log` polite (batched), labelled group. Acceptance: SR announces state + new entries; axe clean.

### FIX-22 [P1] — Dead `href="#"` ticket links
Evidence: `ClassificationTable.tsx:270`. Apply: ClassificationTable v2 — real action or honest non-link. Acceptance: no `#` no-ops.

### FIX-23 [P1] — Microcopy canonical vocabulary
Apply: COPY_FIXES table applied across v2 files (App 416, Header 550, KpiCard 328, LivePrediction 364, SystemMonitor 154…): `LIVE` / `CACHED SNAPSHOT from <timestamp>` / `API OFFLINE`; subtitle "Security Operations". Acceptance: one term per state; no live-promising copy while offline.

---

## P2 — polish (updated)

### FIX-24 [P2 — CORRECTED LOCATION] — Footer "API Docs" same-tab to offline host
Real link lives in `App.tsx:384` (inline footer; `Footer.tsx` was DEAD CODE). Apply: App v2 + Footer v2 wired (62); new tab + offline tooltip. Acceptance: app state preserved on click.

### FIX-25 [P2 — DOWNGRADED] — CSV wiring already existed
Real wiring was present; remaining work = the FIX-36 injection hardening + full-column export (exportCsv v2). Acceptance: export matches filtered rows.

### FIX-26 [P2 — CORRECTED] — Time filter: real options 1h/6h/24h/7d + dropdown was DEAD
Evidence: N-17 — the select had no handler. Apply: NEW `lib/timeRange.ts` (44) + `hooks/useTimeRange.ts` (53) — pure filter over live+cache, "· cached data" label. Acceptance: range change filters rows in both states.

### FIX-27 [P2] — Snapshot footers single-source
Apply: NEW `components/SnapshotFooter.tsx` (50) + panel sweep; "Cached snapshot from <timestamp>". Acceptance: one component; no provenance on live-session panels.

### FIX-28 [P2] — Pagination verified correct; hardened
Apply: NEW `lib/paginate.ts` (42) — single math owner + clamp-after-filter (suite green). Acceptance: filter below current page → clamps, never blank.

### FIX-29 [P2 — CORRECTED] — Sidebar: keep 260 px (pass-1's 240 was wrong)
Evidence: real layout bound to 260 px; pass-1 token `--layout-sidebar-w:240` contradicted source — corrected. Apply: tokens v2 (`--layout-sidebar-w:260px`) + label-size sweep. Acceptance: no layout shift; 11 px group labels.

### FIX-30 [P2, optional] — `--font-metric` (Inter tnum) for 28 px display metrics
Unchanged, optional; JetBrains Mono retained for code/IDs/timestamps.

### FIX-31 [P2] — z-index scale
Apply: tokens v2 (`--z-header/dropdown/overlay/tooltip`). Acceptance: tooltip > overlay > header.

### FIX-32 [P2 — VERDICT ISSUED] — "theme.css vs tokens.css drift": the user's question, answered
**There is no theme.css.** `index.css` = 1 import line; the split is INTERNAL to `tokens.css`: Tailwind v4 `@theme` defines `--color-sev-*`/`--color-cat-*` while components consume bridged `--sev-*`/`--cat-*` that were never created (Cause A = the actual defect) — PLUS the dual-source drift (Cause B = contributing) — PLUS a third hex copy in `chartTokens.ts`. Fixing drift alone wouldn't render dots; defining aliases alone wouldn't prevent recurrence — tokens v2 does both, and adds `@theme static` (v4.3 tree-shaking had silently dropped 29 of 71 custom props incl. all `--color-sev-*`, killing `.duration-instant` transitions in production — T-NEW). Full mechanism + decisions D1–D5 in `audit/TOKENS_ROOTCAUSE.md`.

### FIX-33 [P2] — Remaining copy sweep
Unit spacing "8.73 MB", `…`, Arm64 casing, "Page 1 of 2", "Requests/min" — applied in v2 files per COPY_FIXES.

---

## Second-pass additions (new defects the real code exposed)

### FIX-38 [P1] — `addTicket` accepts duplicate explicit IDs; explicit IDs don't advance `nextId`
Evidence: `useTickets.ts:57-64` (test-reproduced → React key collisions). Apply: `fixpack-v2/src/hooks/useTickets.ts` (137). Acceptance: `useTickets.test.ts` green; 10k unique IDs, 2^31-safe.

### FIX-39 [P1 — OPEN MICRO-FIX] — `normalizeApiBase` keeps trailing slashes
Evidence: `useSettings.ts:48-57` (test-reproduced: `host/` → probes hit `host//health`, protocol edge case). Apply: one-line strip in the real file (diff in TEST_NOTES_V2); not in the 28-file set — apply manually. Acceptance: settings-reprobe suite green.

### FIX-40 [P2 batch] — Test-exposed polish (originals): `formatRelativeTime` → "NaNd ago" on invalid (`formatRelativeTime.ts:3-11`); dead colliding `generateTicketId` (`utils.ts:70-76`); `truncate` splits surrogate pairs (`utils.ts:66-67`); lexicographic ID sort `TKT-10000`<`TKT-9999` (`ClassificationTable.tsx:28`); unnamed reduced-motion toggle, WCAG 4.1.2 (`SettingsDrawer.tsx:192-195`). Apply: utils/formatRelativeTime/ClassificationTable/SettingsDrawer v2 files. Acceptance: corresponding suites green.

### FIX-41 [P1 — DECISION REQUIRED] — Command palette (Ctrl+K) does NOT exist
Evidence: pass-1 assumed it; real code has 4 other working shortcuts (suite green) but no palette — 2 plainly-labelled expected-fail tests document the gap. Decide: build the palette (scope: ~1 component + shortcut) or amend the "keyboard shortcuts" guarantee copy. Judges will try Ctrl+K on a SOC dashboard.

---

## (a) Ordered command list (coding CLI)

```bash
git checkout -b fixpack/v2-enterprise && npm run build 2>&1 | tail -3   # baseline (see FIX-37 if tsc -b fails)
# 1. Verify build config presence (FIX-37): ls tsconfig.app.json tsconfig.node.json postcss.config.*
# 2. Foundation: cp fixpack-v2/src/styles/tokens.css src/styles/tokens.css
# 3. Frozen-store P0: cp fixpack-v2/src/hooks/{useApi,useEventLog,useTicketQuery,useTickets}.ts src/hooks/
# 4. Honesty: cp fixpack-v2/src/components/{ThreatBarChart,ProvenanceBadge,SystemMonitor,SnapshotFooter}.tsx src/components/
# 5. UI fixes: cp fixpack-v2/src/components/{ClassificationTable,Header,KpiCard,EventLog,LivePrediction,Sidebar,Footer,HelpModal,ChartSkeleton,PerformanceLineChart,ModelHealthDonut}.tsx src/components/
# 6. Lib + app shell: cp fixpack-v2/src/lib/*.ts src/lib/ && cp fixpack-v2/src/{App.tsx,hooks/useTimeRange.ts} src/ # (useTimeRange → src/hooks/)
# 7. Micro-fix: apply FIX-39 one-liner to src/hooks/useSettings.ts
# 8. Housekeeping: delete dead src/index.css? (verify import graph first); drop unused dep echarts-for-react (one-line justification: ECharts.tsx uses echarts/core directly)
# 9. Tests: npm i -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom && cp -r fixpack-v2/tests/ tests/
# 10. Gates:
npx vitest run      # expect: 102+ green, only documented expected-fails
npm run build       # tsc -b + vite; main chunk < 600 KB (fixpack build measured 278 KB)
npm run lint        # oxlint 0/0
npx axe http://localhost:5173   # 0 violations
```

## (b) Regression checklist — 10 never-regress guarantees
1. Honest badges per the state→badge matrix (FIX-04/34). 2. Silent EventLog offline (real ERROR entries only). 3. Real table sort (suite). 4. Monotonic IDs (suite incl. 2^31 + dup-explicit-id guard). 5. Unified useApi status (FIX-01 immutable store). 6. Shortcuts work + documented (4 verified; palette = FIX-41 decision). 7. ARIA on all interactives (aria-pressed, named toggles). 8. axe 0 violations. 9. Main chunk <600 KB (278 KB measured). 10. Cached snapshot system + timestamp (SnapshotFooter).

## (c) Still need from you
1. **Untruncated repo** (89 PDF-truncated lines; flagged `NOTE:`) — or just confirm the flagged lines match.
2. **Confirm presence of `tsconfig.app.json`, `tsconfig.node.json`, `postcss.config.*`** (absent from archive → FIX-37/D5).
3. **Decisions:** D1–D5 in TOKENS_ROOTCAUSE (Tailwind stays reconciled — recommended), FIX-41 palette build-vs-amend, False Positive = slate (already applied in tokens v2).
4. `model/eval_results.json` is invalid JSON **in the archive** (truncation) — assumed fine in repo; ml-engineer pass needs the real one.
