# TOKENS ROOT-CAUSE REPORT — theme↔tokens drift vs FIX-02/03 (Mission D, second pass)

Source basis: REAL `src/` recovered from `ticketsec-source.pdf` (53 files, extracted to `/tmp/ticketsec-src/`). PDF truncates lines >~143 chars (affected lines noted; none change the verdict). Prior evidence (`evidence/inlined-css.txt`, `evidence/dom.html`, S1–S6) re-used for the served-bundle facts.

**VERDICT (5 lines):**
1. FIX-02 (invisible severity dots) and FIX-03 (uncolored category badges) are caused by **Cause A — 10 var() references to tokens that are defined NOWHERE**: `--sev-critical|high|medium|info` and `--cat-1..6` (CONFIRMED in real source `src/lib/utils.ts:12-17,49-52`).
2. The "theme.css vs tokens.css drift" as literally framed **does not exist**: there is no `theme.css`; `src/index.css` is one line (`@import './styles/tokens.css';`) and the Tailwind `@theme` block lives INSIDE `tokens.css`.
3. The drift that is REAL (Cause B) is an **internal namespace split**: values were added under `@theme` as `--color-sev-*`/`--color-cat-*` while components consume short aliases `--sev-*`/`--cat-*` that nobody ever defined — plus a third hardcoded copy in `src/lib/chartTokens.ts`.
4. Cause A is THE direct mechanical cause (fix = define the aliases); Cause B is the structural/contributing cause (why A shipped undetected). Fixing "drift" alone (renaming/unifying) without defining the aliases does NOT repair rendering; defining aliases without single-source discipline lets it recur.
5. Fix shipped: `fixpack-v2/src/styles/tokens.css` — all 96 current tokens preserved, aliases defined, `@theme static` against v4 tree-shaking, `--sev-info` gap (missed by BOTH first-pass fixpack files) closed.

---

## (a) Tokens referenced by components but NEVER defined — complete list [CONFIRMED]

Definitions searched: all of `src/**`, served bundle (`inlined-css.txt`, 57 emitted custom properties), rendered DOM. Zero definitions exist for any of these:

| # | Token | Defined? | Referenced at (declaration) | Rendered via (consumer) | Visual failure |
|---|---|---|---|---|---|
| 1 | `--sev-critical` | nowhere | `src/lib/utils.ts:49` (`SEVERITY_COLORS`) | `ClassificationTable.tsx:264` → severity dot `backgroundColor` (row 294-296) | dot transparent → **invisible** (S2/S3 empty SEVERITY column) |
| 2 | `--sev-high` | nowhere | `src/lib/utils.ts:50` | same path | invisible dot |
| 3 | `--sev-medium` | nowhere | `src/lib/utils.ts:51` | same path | invisible dot |
| 4 | `--sev-info` | nowhere | `src/lib/utils.ts:52` | same path (False Positive → 'info', `utils.ts:38`) | invisible dot — **and missed by both first-pass fixpack files** (they alias only `--sev-critical|high|medium|low`) |
| 5–10 | `--cat-1` … `--cat-6` | nowhere | `src/lib/utils.ts:12-17` (`CATEGORY_COLORS`) | `ClassificationTable.tsx:262` badge text `color` (:283) + dot `backgroundColor` (:289); `LivePrediction.tsx:53` result color | badge text falls back to inherited white; 6px dot invisible (S3 "white badge text", FIX-03) |

Mechanism of failure [CONFIRMED by CSS spec behavior, matches S2/S3]: `color: var(--undefined)` / `background-color: var(--undefined)` is **invalid at computed-value time** → property becomes `unset` → `color` inherits (white-ish badge text on pastel tint), `background-color` becomes `transparent` (dots vanish). No console error, no fallback — silent invisibility.

NOT actually undefined (PDF artifact): `--border-de` ×5 (`ClassificationTable.tsx:376`, `EventLog.tsx:175`, `PerformanceLineChart.tsx:185`, `SystemMonitor.tsx:140`, `ThreatBarChart.tsx:147`) — the source-archive generator cut those lines at ~143 chars mid-token; the real source reads `var(--border-default)`. Zero defect in the app here.

Near-misses that prove the rule:
- `--color-sev-*` / `--color-cat-1..6` ARE defined (in `@theme`) but have **zero** `var()` consumers in `src/**` — components never used the long names.
- `CATEGORY_SEVERITY` has no `low` key (`utils.ts:32-39`): the app severity domain is critical/high/medium/info — which is why `--sev-info` (not `--sev-low`) is the required fourth alias.

## (b) Namespace split — `@theme` vs `:root`, and what Tailwind v4.3 actually emits

Current `tokens.css` (236 lines) contains **two definition layers plus a third TS copy**:

| Layer | Count | Contents | Consumed by |
|---|---|---|---|
| `@theme { }` (`tokens.css:3-98`) | 71 | ALL raw values: `--color-*`, `--font-*`, `--font-size-*`, `--line-height-*`, `--density-*`, `--spacing-*`, `--radius-*`, `--transition-*`, `--color-cat-1..6`, `--color-sev-*`, `--caption-*` | Tailwind utility generation (`bg-bg-card`, `text-text-primary`, `duration-instant`, …) + runtime `var()` |
| `:root { }` (`tokens.css:100-133`) | 25 | short aliases `--bg-*`, `--border-*`, `--text-*`, `--accent-*`, `--font-primary`, `--font-mono`, `--chart-series-*` (literals) | inline styles in components |
| `src/lib/chartTokens.ts` | ~14 | hardcoded hex mirror (`cat1..6`, `sevCritical..`, series, text) | ECharts option objects (canvas can't resolve `var()`) |

**Tailwind v4 @theme mechanism (accurate for v4.3.2), evidence-backed:**

1. `@theme` variables are emitted as **real CSS custom properties on `:root` under `@layer theme`** — so `var(--color-bg-card)` in plain CSS/inline styles resolves at runtime. CONFIRMED: served CSS contains `@layer theme{:root,:host{ … --color-bg-body:#0B0F19; … }}` (`inlined-css.txt`).
2. **BUT emission is tree-shaken by default**: v4 emits only theme variables it detects as *used* (utility class generated, or the literal `--name` string seen by its scanner in source/CSS files). Of the 72 `@theme` vars, only **57 were emitted** in the observed bundle. NOT emitted: `--color-cat-2..6`, **all five `--color-sev-*`**, the whole `--font-size-*` ramp except `base`, all `--line-height-*` except `base`, `--spacing-6`, `--radius-lg`, `--transition-duration-instant/fast`, `--transition-timing-function-default`.
3. `--color-cat-1` was emitted only because the literal string `--color-cat-1` appears in a **comment** at `chartTokens.ts:18` ("Mirrors --color-cat-1..6") — the scanner is string-based. cat-2..6 don't literally appear anywhere → tree-shaken.
4. `@theme static` disables tree-shaking (always emit all); `@theme inline` does the opposite (substitute values at build, emit NO variables). Reference: Tailwind v4 docs, `@theme` options.
5. Smoking gun that default tree-shaking is a live hazard, not theory: the served CSS emits `.duration-instant{--tw-duration:var(--transition-duration-instant);transition-duration:var(--transition-duration-instant)}` (`inlined-css.txt`) while `--transition-duration-instant` itself was **tree-shaken out of `:root`** → `duration-instant` transitions silently compute to invalid/0s in production (`ClassificationTable.tsx:268` row hovers). **New finding T-NEW [P2]** — fixed in v2 by `@theme static`.

So: `@theme` DOES make vars available via `var()` — but only for names the scanner happened to see. The alias layer (`--sev-*`, `--cat-*`) was never written anywhere, in any layer; that absence is independent of Tailwind.

## (c) Verdict on the user's question — is theme↔tokens drift THE cause of FIX-02/03?

**No — not as literally framed; yes — as a contributing structural cause.**

- **Cause A — undefined tokens (DIRECT cause, CONFIRMED):** FIX-02/03 rendering failures are fully explained by 10 `var()` references with zero definitions. CSS error handling does the rest (transparent dots, inherited text color). The fix is mechanical: define `--sev-*` and `--cat-*` aliases. No Tailwind involvement required either way.
- **Cause B — dual/triple source-of-truth drift (CONTRIBUTING cause, CONFIRMED as existing):**
  - B1: two namespaces inside ONE file — `@theme --color-sev-*` vs consumed `--sev-*` — with no alias bridge. This is how A shipped: the palette "existed" (someone wrote it into `@theme`) but under names nothing consumed.
  - B2: `chartTokens.ts` hardcodes the same palette as hex (third copy) — it already diverges in role (canvas-only) and would diverge in value the moment either side is edited.
  - B3: spec drift — "inline styles" spec vs a full Tailwind v4 runtime (`tailwindcss@4.3.2` + `@tailwindcss/postcss` in `package.json`; utilities pervasive in all 18 components). This raised the maintenance surface (two styling systems to keep coherent) but did not itself break FIX-02/03.
  - B4 (drift consequence, not cause of FIX-02/03): v4 tree-shaking silently removed unreferenced `@theme` vars — breaks `duration-instant` today (T-NEW) and would break any future alias referencing a `--color-*` var the scanner can't see.
- Rigor check: if the team had "fixed drift" only (e.g., renamed everything to one convention) without defining the consumed names, S2/S3 would look IDENTICAL. Conversely, defining the 10 aliases with zero other changes makes FIX-02/03 pass acceptance immediately. Hence A = THE cause, B = the reason A existed and will recur.

---

## FINAL tokens.css — what shipped (`fixpack-v2/src/styles/tokens.css`, 429 lines, 215 definitions)

Merge rules applied (mission D2): (i) all 96 current tokens preserved (verified programmatically — none lost); (ii) first-pass patch system wins all conflicts; (iii) additions-file tokens appended except conflicting names; (iv) Tailwind kept coherent via `@theme static` (documented below).

**Value changes vs current file (16, all deliberate):**
- `--color-bg-elevated #111827→#27324A` (elevation was darker than card — inverted scale; tooltips/popovers must rise)
- `--color-text-inverse #C5C1B9→#0B0F19` (unusable beige)
- `--color-cat-1..6` → muted 600-level (`#6366F1 #0891B2 #D97706 #E11D48 #7C3AED #64748B`) — non-pastel enterprise scale; **requires chartTokens.ts mirror (D2)**
- `--color-sev-critical #f87171→#F43F5E`, `--color-sev-medium #eab308→#F59E0B`, `--color-sev-low #22c55e→#38BDF8` (muted severity ramp)
- `--color-sev-info` PRESERVED (`#60A5FA`, case-normalized) — the first-pass patch dropped it; it is load-bearing for `--sev-info`
- font stacks: quote style normalized only (non-semantic)

**Additions-file accounting (exact; supersedes the "68/15" estimate):** 80 tokens total in `tokens.additions.css.md` (68 line-anchored + 12 `--cat-N-fg|-bg` inline pairs).
- **SKIPPED — 20 conflicting names (patch system wins):** `--sev-critical|high|medium|low`, `--cat-1..6`, `--color-text-on-accent` (identical value anyway), `--color-accent-indigo-strong` (`#4F46E5` wins over `#5558D8`), `--color-accent-indigo-strong-hover` (`#4338CA` wins), `--font-size-sm|md|lg|xl` (current ramp kept: 12/14/15/20px), `--chart-series-baseline|onnx|int8` (literals kept; the var()-ification suggestion conflicts with the patch).
- **APPENDED — 60 names:** 48 literal tokens (status/badge/pill/tint/z/tracking/density/font/geometry sets) + 12 `--cat-N-fg`/`-bg` pairs appended **as aliases** into the patch's `--color-cat-*-text`/`-bg` system (appending the additions' literal 400-level tints would have re-created the very dual-source drift this file eliminates; names preserved so W-05 component patches still compile).
- Sidebar correction: additions `--density-sidebar-w: 260px` matches the REAL layout (`Sidebar.tsx:66 width:260`, `App.tsx main marginLeft:260`); patch's `--layout-sidebar-w` was drafted at 240px — **fixed to 260px** in v2 (real source wins).

**@theme decision (iv) — documented:** Tailwind v4 STAYS (removal would mean rewriting the 5 utility-using components off utilities; deferred to D1). Single source of truth = every raw value appears exactly once, in `@theme static`; `:root` holds aliases (`var()` refs) + utility-free contract tokens (badges, tints, chart chrome, z-scale). `static` is load-bearing: it guarantees emission of vars whose only consumer is an alias or a canvas-mirror — immune to the scanner tree-shaking that broke `duration-instant`.

## Resolution table — every `var(--x)` in `src/**` (ts/tsx) vs final tokens.css

35 distinct names referenced. **34/35 RESOLVED directly; 1/35 PDF artifact (`--border-de` → `--border-default`); 0 unresolved.**

| var() reference | Status in final tokens.css | Resolves to |
|---|---|---|
| `--sev-critical` `--sev-high` `--sev-medium` `--sev-info` | FIXED (were undefined) | `var(--color-sev-*)` → `#F43F5E #F97316 #F59E0B #60A5FA` |
| `--cat-1..6` | FIXED (were undefined) | `var(--color-cat-N-text)` → `#818CF8 #22D3EE #FBBF24 #FB7185 #A78BFA #94A3B8` |
| `--bg-body` `--bg-card` `--bg-card-hover`(class only) `--bg-input` `--bg-elevated` `--bg-sidebar` | OK | `:root` aliases → `@theme` colors |
| `--border-default` `--border-hover` `--border-accent`(class) | OK | aliases → border rgba set |
| `--text-primary` `--text-secondary` `--text-muted` | OK | aliases → text colors |
| `--accent-indigo/violet/cyan/emerald/rose/amber/orange` | OK | aliases → accent colors |
| `--density-row-h` `--density-card-pad` `--density-card-gap` `--density-kpi-h` `--density-widget-head-h` | OK | `@theme` density scale (40/16/14/128/44px) |
| `--caption-size` `--caption-color` | OK | `@theme` (11px / muted) |
| `--font-numeric` | OK | `@theme` JetBrains Mono stack |
| `--font-family-sans` `--font-family-mono` `--font-size-base` `--line-height-base` (inside tokens.css base layer) | OK | `@theme` |
| `--border-de` ×5 | artifact | `var(--border-default)` truncated by PDF at ~143 chars |

Tailwind-internal vars: **none referenced from `src/**` via `var()`.** Internal-only (generated CSS): `--tw-*` (per-utility state), default-theme `--font-sans`, `--font-mono`, `--color-white`, `--spacing`, `--text-xs`, `--text-sm`, `--font-weight-medium|semibold`, `--default-transition-*`, `--default-(mono-)font-family` — these back generated utilities (`text-xs`, `font-semibold`, `bg-white/[0.03]`, …) and never cross into component `var()` code. No action.

## What Felipe must decide

- **D1 — Tailwind: keep reconciled vs remove.** Recommendation: KEEP with `@theme static` (this file). Removal scope is smaller than first-pass assumed: only **5 components** actually use utility classes (`ModelHealthDonut.tsx`, `ClassificationTable.tsx`, `ThreatBarChart.tsx`, `Footer.tsx`, `PerformanceLineChart.tsx` — grep `className` across `src/**`); the other 13 are already pure inline styles. If spec purity ("inline styles only") is mandated, converting those 5 files + dropping `tailwindcss`/`@tailwindcss/postcss`/`autoprefixer` is a contained workstream — but zero user-visible gain vs the reconciled single-source file shipped here.
- **D2 — Mirror update (REQUIRED with this tokens.css, else new drift):** `src/lib/chartTokens.ts` still hardcodes the OLD 400-level cat hexes (`#818cf8…`) and old sev hexes; `utils.ts` `CATEGORY_BG`/`STATUS_COLORS` hardcode old rgba tints. ECharts canvas cannot resolve `var()` — either mirror the new literals in `chartTokens.ts` (documented duplication, add a comment pointing at tokens.css) or resolve via `getComputedStyle` at chart-init. Until then bars/donut (old palette) will mismatch badges (new palette) — FIX-03 acceptance criterion "bars/donut read muted and consistent with badges" depends on this.
- **D3 — Sidebar width:** canonical is 260px (real source). v2 sets both `--layout-sidebar-w` and `--density-sidebar-w` to 260; pick one name when component patches land.
- **D4 — Badge font floor:** patch `--font-size-badge: 10px` vs additions `--badge-font-size: 11px` (+10px bell-count exception) — both kept (distinct names); component patches must follow the additions' usage contract (11px badges; 10px only on the 16px bell count).
- **D5 — Build wiring (verify only):** the 53-file archive has NO `postcss.config.*` and `vite.config.ts` has no Tailwind plugin, yet `@import "tailwindcss"` compiled in the observed bundle → a postcss config exists in the repo but wasn't archived. Confirm it's committed.

## Acceptance (10-second checks after applying v2 tokens.css)

1. Reload → every Recent Classifications row shows a colored severity dot (False Positive row = blue `--sev-info`); category badges show colored dot + colored text (no white-on-tint).
2. DevTools → any badge → computed `color`/`background-color` are NOT `transparent`/inherited-white.
3. Console: no new warnings; `getComputedStyle(document.documentElement).getPropertyValue('--sev-info')` returns `#60A5FA`; same for `--cat-6`, `--transition-duration-instant` (proves `@theme static` emission).
4. Table row hover transition animates (duration-instant alive again).
5. `grep -RInE "#[0-9A-Fa-f]{6}|rgba?\(" src --include=*.tsx --include=*.ts | grep -v chartTokens.ts` shrinks as component patches (D2) land — tokens-only rule converges.
