# W-05 TOKEN VIOLATIONS — TicketSec Arm64 Design System Audit

**Scope:** token usage across the rendered UI. Sources: `evidence/inline-styles.txt` (314 records; **305 app records #0–#304**, records #305–#313 are browser-extension injection — ChatGPT sidebar/float button, `float-btn`/`octicon`/`--sds-*` — **excluded**), `evidence/inlined-css.txt` (Tailwind v4.3.2 runtime + `@layer theme` + unlayered `:root` alias block), `evidence/dom.html` (app ends at `</footer>…</main>` before `<chatgpt-sidebar>`; everything after is extension), screenshots S1–S4. The `ant-*`/`--antd-*`/`--sds-*` CSS in `inlined-css.txt` is also **extension noise**, not app code.

**Method notes:** counts below are exact greps over the evidence files. Contrast ratios computed per WCAG 2.2 (relative luminance; tinted badge backgrounds blended over `--color-bg-card #1E293B`). ECharts canvas contents (chart axis fonts/colors) and `src/` sources were not available; findings that depend on them are tagged **[INFERRED — needs src/ to confirm file:line]**. Record numbers (`rec N`) = element index in `inline-styles.txt`.

**Mission premise corrections (verified facts):**
- KPI values are **all** 28px/600/`var(--font-numeric)`/tabular-nums (rec 68, 77, 86, 95). The S1 "dash vs 8.73MB" difference is **color** (`--text-muted` for honest-unavailable vs `--text-primary`), not size. See TV-10.
- Zero literal `#hex` in app inline styles. Token bypass happens via **`rgb()`/`rgba()` literals**: 28 distinct values, 49 occurrences (TV-03).
- S5's `grid auto-cols-max cursor-pointer group` DevTools classes are the **extension's** DOM. The app nevertheless does use its own Tailwind utilities (78 distinct classes / 404 usages, TV-12).

---

## TV-01 [P0] Severity dots render invisible — `--sev-*` tokens referenced but never defined [CONFIRMED]

**Evidence:** `inline-styles.txt` rec 188, 203, 218, 233, 248: `<span class="inline-block w-2 h-2 rounded-full" style="background-color:var(--sev-critical)">` (×2 critical, ×1 high, ×1 medium). `inlined-css.txt`: zero `--sev-*` definitions (grep `--sev` = 0 defs, 0 refs). S2 + S3: SEVERITY column is **completely empty** for all 5 rows.
**Defect:** `var(--sev-critical)` on an undefined custom property is invalid at computed-value time → `background-color` falls back to `transparent` (CSS Variables spec). The 8px severity dots are painted but fully transparent. A SOC table with no severity signal = broken functionality.
**Root cause:** [CONFIRMED from evidence] token scale never added to `tokens.css`/`@theme`; component code references it.
**Patch:** add the severity scale (all values ≥4.5:1 on `--color-bg-card`, measured: critical 5.29, high 6.46, medium 8.76, low 5.71) — see `fixpack/src/styles/tokens.additions.css.md` §1. Dots stay 8px (`w-2 h-2`), no component change needed once tokens exist.
**Acceptance:** reload dashboard → SEVERITY column shows red/orange/amber dots per row (TKT-8471 red, 8470 red, 8469 orange, 8468 amber, 8467 red); DevTools computed style on a dot shows the token resolving to a non-transparent color.

## TV-02 [P0] Category badge color system broken — `--cat-1..5` undefined, `--cat-6` absent from entire bundle [CONFIRMED]

**Evidence:** rec 185/200/215/230/245: badge spans `background-color:rgba(129,140,248,0.12);color:var(--cat-1)` and dot spans `background-color:var(--cat-1)` (…`--cat-2/3/4/5`). `inlined-css.txt` defines **only** `--color-cat-1:#818cf8` (long form, which badges do **not** reference) — zero `--cat-N` definitions; `--cat-6` appears nowhere in DOM or CSS. S2/S3: badge text renders **near-white** (inherited `--text-primary`), dot invisible, on a faint tinted slab → "generic" look.
**Defect:** same invalid-var mechanics as TV-01: `color` (inherited property) → inherits white; dot `background-color` → transparent. Palette exists only as hard-coded chart colors [INFERRED: `src/lib/chartTokens.ts`] and as one-off rgba literals.
**Root cause:** [CONFIRMED] incomplete token scale + name mismatch (`--color-cat-1` vs `--cat-1`).
**Patch:** define `--cat-1..6` (dots/bars) + `--cat-N-fg` (badge text, AA on 12% tint) + `--cat-N-bg` (tint) — additions file §2. Values for cat-1..5 recovered from rendered literals: `#818cf8 / #22d3ee / #fbbf24 / #f87171 / #a78bfa`. `-fg` variants measured on own 12% tint over card: cat-1-fg `#a5b4fc` 6.09:1, cat-2/3 pass as-is (6.32/6.78), cat-4-fg `#fca5a5` 6.51:1, cat-5-fg `#c4b5fd` 6.51:1. **cat-6 (False Positive) `#f472b6` 4.60:1 — [INFERRED — needs src/ to confirm file:line]: no False Positive row in cached snapshot; reconcile with `chartTokens.ts` category color array before shipping.** Component must switch badge text to `var(--cat-N-fg)` [INFERRED path: `src/components/**/RecentClassifications*`].
**Acceptance:** Phishing badge = light-indigo text + indigo dot on indigo tint; DDoS violet; text no longer white; `getComputedStyle(dot).backgroundColor` ≠ transparent.

## TV-03 [P1] 28 distinct raw `rgb()/rgba()` literals in 49 inline-style occurrences bypass tokens [CONFIRMED]

**Evidence (full census; app records only, excludes 12 ECharts-generated occurrences rec 101–111 and extension rec 305+):**

| Literal | × | Where (rec) |
|---|---|---|
| `rgba(245,158,11,0.1)` / `rgba(245,158,11,0.3)` | 4+4 | CACHED badges: KPI (69, 78), SysMon (127), table pill (159) |
| `rgba(255,255,255,0.06)` | 4 | progress-bar tracks (134, 140, 146, 152) — **exact duplicate of `--color-border-default`** (+5 more via class `bg-white/[0.06]` on confidence-bar tracks, TV-12) |
| `rgba(148,163,184,0.1)` / `rgba(148,163,184,0.25)` | 2+2 | gray badges PENDING VALIDATION / MODEL CARD (87, 96) |
| `rgb(255,255,255)` | 2 | bell count badge (56), Classify Ticket button (298) |
| `rgba(99,102,241,0.1)` | 2 | sidebar active nav bg (9), KPI icon tile (66) |
| `rgba(255,255,255,0.03)` | 2 | event-log row borders (277, 281) |
| `rgba(6,182,212,0.1)`, `rgba(16,185,129,0.1)`, `rgba(139,92,246,0.1)` | 1+1+1 | KPI icon tiles (75, 84, 93) |
| `rgba(148,163,184,0.3)`, `rgba(148,163,184,0.08)` | 1+1 | header "Checking…" pill (48) |
| `rgba(16,185,129,0.12)`+`rgb(94,234,154)` | 2+2 | Resolved badge (193, 208) — TV-07 |
| `rgba(244,63,94,0.12)`+`rgb(244,63,94)` | 2+2 | Escalated badge (223, 253) — TV-07 |
| `rgba(245,158,11,0.12)`+`rgb(245,158,11)` | 1+1 | Pending badge (238) |
| `rgba(129,140,248,0.12)` … 5 cat tints | 5 | category badge bgs (185…245) — superseded by `--cat-N-bg` (TV-02) |
| `rgba(99,102,241,0.12)` | 1 | Event Log active filter "All" (271) |
| `rgba(16,185,129,0.08)`/`rgba(16,185,129,0.6)`, `rgba(130,146,168,0.08)`/`rgba(130,146,168,0.6)` | 2+2 | INFO/DEBUG log chips (279, 283) |

**Defect:** any palette retune (or W-01's tokens.css replacement) silently misses 49 sites; identical intents (`0.1` vs `0.12` alpha of the same hue) drift.
**Patch:** replace per-component with tokens from additions file §2/§3/§6 (`--cat-N-bg`, `--status-*-bg/fg`, `--tint-*`, `--color-text-on-accent`). Component edits [INFERRED paths]: KPI cards, widget headers, RecentClassifications badges, EventLog chips, LivePredictions button.
**Acceptance:** DevTools search in Elements for `rgba(` inside `#root` returns only ECharts tooltip nodes; badges visually unchanged except TV-07 color corrections.

## TV-04 [P1] Sub-floor font sizes: 29 elements below the 11px enterprise floor (9px ×3, 10px ×26) [CONFIRMED]

**Evidence (exact locations):**
- **9px ×3:** bell count badge (rec 56, S1 header); Event Log INFO/DEBUG level chips (rec 279, 283, S4).
- **10px ×22 inline + ×4 class `text-[10px]`:** sidebar group labels OVERVIEW/OPERATIONS/SYSTEM (8, 18, 28); KPI card labels ×4 (65, 74, 83, 92); KPI CACHED badges ×2 (69, 78); SysMon header CACHED (127); KPI gray badges ×2 (87, 96); SysMon "Unavailable — API offline" meta ×4 (133, 139, 145, 151); table sort-hint spans ×7 (163…180); chart-card CACHED badges ×3 (class, Threat/ModelFootprint/ClassificationPerformance headers); table "API Offline — Displaying cached data" pill (159, class).
**Defect:** WCAG contrast of `--text-muted` on card passes numerically (4.62:1) but 9–10px fails the enterprise SOC density bar (baseline 13px, captions ≥11px) and is illegible at 1× DPR — a core reason the UI "still looks generic."
**Patch (per component, corrected values):**
| Component | Now | Fix to |
|---|---|---|
| Sidebar group label | 10px/700/ls 1px | `font-size:var(--font-size-micro)` (11px), keep 700 + uppercase, `letter-spacing:var(--tracking-caps)` |
| KPI card label | 10px/600/ls 0.6px | 11px/600/`--tracking-caps` |
| All badges/chips/pills | 9–10px | `font-size:var(--badge-font-size)` (11px) — TV-05 spec |
| SysMon "Unavailable —" meta | 10px | 11px, keep `--text-muted`, `font-variant-numeric:tabular-nums` |
| Table sort-hint spans | 10px | remove span, rely on th 11px text (or 11px) |
| Bell count badge | 9px on 14px badge | 10px/700 on 16px badge, bg `var(--color-badge-alert-bg)` (TV-11) |
**Acceptance:** zoom 100%, smallest text anywhere = 11px; sidebar OVERVIEW label and CACHED badges read crisply; no layout wrap in 260px sidebar.

## TV-05 [P1] Badge geometry chaos — 7 paddings / 5 radii / 4 implementations of one semantic badge [CONFIRMED]

**Evidence:** paddings — `2px 6px` (KPI CACHED ×4: 69, 78, 87, 96), `3px 8px` (SysMon CACHED 127), `2px 8px` (category ×5: 185…245), `1px 5px` (log chips ×2: 279, 283), `3px 10px` (log filters ×4: 271–274), class `px-2 py-1` = 4px 8px (chart CACHED ×3, table pill 159), class `px-2.5 py-1` = 4px 10px (status ×5: 193…253). Radii — inline 3px (log chips), 4px (badges ×14), 6px, 7px (bell badge 56), 20px (Checking pill 48) vs tokens only `--radius-sm:6px`/`--radius-md:8px`. Letter-spacings 0.3/0.4/0.5/0.6/1px on same-class micro-labels (39 uses total). **CACHED badge alone exists in 4 variants**: (a) chart cards — class-based `text-[10px] font-semibold text-accent-amber bg-accent-amber/10 px-2 py-1 rounded`, no border, literal "CACHED" text; (b) KPI — inline 10px, `2px 6px`, border `rgba(245,158,11,0.3)`, CSS `text-transform:uppercase` on "Cached"; (c) SysMon — inline 10px, `3px 8px`, border; (d) table — class geometry + inline colors/border.
**Defect:** same-meaning elements render at 3 different heights/paddings across sibling cards (visible in S1 KPI row vs S2 widget headers) → "generic kit" look.
**Patch — single badge spec (tokens in additions §4):** `font-size:var(--badge-font-size)` (11px); `font-weight:600`; `letter-spacing:var(--tracking-badge)` (0.4px); `text-transform:uppercase`; `padding:var(--badge-pad-y) var(--badge-pad-x)` (2px 8px); `border-radius:var(--radius-badge)` (4px); `border:1px solid <fg@30%>`; `background:<fg@12%>`; optional 6px dot (`--badge-dot-size`), `gap:6px`; `line-height:16px`; `white-space:nowrap`. Status/category/CACHED/neutral differ **only** in the fg/bg token pair. "Checking…" pill uses `--radius-pill`.
**Acceptance:** measure any CACHED badge in KPI row vs chart header vs System Monitor — identical height (20px), padding, border; category and status badges share geometry, differ only by hue.

## TV-06 [P1] Category badge clipped: "Unauthorized Acces" (S2/S3) [CONFIRMED]

**Evidence:** badge span (rec 215): `white-space:nowrap;overflow:visible;padding:2px 8px` inside `td` `max-width:0;overflow:hidden;text-overflow:ellipsis` on `table-layout:fixed;min-width:900px`; CATEGORY column `width:150px` (th rec 165). Math: "Unauthorized Access" at 12px/600 ≈ 19ch × 6.5px ≈ 124px + dot 6px + gap 6px + padding 16px ≈ **152px needed** vs 150px − 24px cell padding = **126px available**. S3: text cut mid-word, no ellipsis.
**Defect:** badge ignores cell bounds (`overflow:visible` on child, `overflow:hidden` on cell → hard clip).
**Root cause:** [CONFIRMED] column too narrow + no badge-level ellipsis.
**Patch [INFERRED path: RecentClassifications table]:** widen CATEGORY th `width:150px` → `170px` (fits 152px badge + padding), **and** make badge defensive: badge span `max-width:100%`, inner text span `overflow:hidden;text-overflow:ellipsis;white-space:nowrap`. Table has `min-width:900px` + `overflow-x-auto` wrapper (rec 160 + class census), so +20px is safe.
**Acceptance:** "Unauthorized Access" fully visible with dot at 1280px viewport; at narrower widths it ellipsizes inside the badge instead of hard-clipping.

## TV-07 [P1] Status badge colors: raw literals, Escalated fails AA, Resolved is neon-mint [CONFIRMED]

**Evidence:** Resolved `color:rgb(94,234,154)` + `rgba(16,185,129,0.12)` (rec 193/208, S2/S3) — 7.90:1 passes but bright neon-mint violates the no-neon/no-pastel design rule and matches nothing in the token set; Escalated `color:rgb(244,63,94)` on own tint = **3.57:1 → AA FAIL** at 11px; Pending `rgb(245,158,11)` = 5.54:1 pass.
**Patch (additions §3):** `--status-resolved-fg:#34d399` (6.29:1, muted emerald-400), `--status-escalated-fg:#fb7185` (4.88:1), `--status-pending-fg:#fbbf24` (7.12:1) + matching `-bg` tints; replace literals in the status badge component [INFERRED path].
**Acceptance:** Escalated badge readable rose (axe DevTools reports ≥4.5:1); Resolved no longer glows; all three badges share TV-05 geometry.

## TV-08 [P1] Card padding/metrics deviate from density tokens: 18 hardcoded 20px usages; only 4 token usages [CONFIRMED]

**Evidence:** KPI cards ×4 use `padding:var(--density-card-pad)` (16px) + `height:var(--density-kpi-h)` (rec 63, 72, 81, 90). Widget cards instead hardcode 20px horizontal: headers `padding:0px 20px` ×7 (100, 107, 116, 124, 156, 266, 288), footers `6px 20px 8px` ×6 (105, 112, 121, 154, 262, 285), bodies `0px 20px 16px` ×3 (128, 275, 291), `0px 20px 12px` ×1 (269), pagination bar `10px 20px` (256). Raw structural values: header `height:56px` (41), sidebar `width:260px` (1) + `margin-left:260px` (40), sidebar head `padding:20px 24px 16px 20px` (3), main content `padding:20px 24px` (58). 33 distinct padding values total across 305 records.
**Defect:** sibling cards in one row have 16px (KPI) vs 20px (widgets) internal rhythm — misaligned content edges between KPI row and widget grid; density token exists but is bypassed.
**Patch:** widgets adopt `--density-card-pad` for body padding; introduce `--density-widget-pad-x:16px` (additions §5) and set headers/footers to `0 var(--density-widget-pad-x)` / `6px var(--density-widget-pad-x) 8px` — after the change, widget content aligns with KPI content edges. Add `--density-header-h:56px`, `--density-sidebar-w:260px`, `--density-table-head-h:32px` and re-point the raw values. [INFERRED paths: `src/App.tsx` layout, `src/components/**` widget shell — one shared `WidgetCard`/`Card` wrapper if it exists.]
**Acceptance:** KPI cards and widget cards share identical left content edge (16px) — verify with DevTools ruler on S1 row; header/sidebar still 56px/260px via tokens.

## TV-09 [P1] Table typography + geometry defects (header overlap, mixed sizes, title drift) [CONFIRMED]

**Evidence:**
1. **"SEVERITY⇅CONFIDENCE" header collision (S3):** SEVERITY th `width:70px` (rec 168) but label needs ≈102px ("SEVERITY" 8ch @11px/600/0.5px ≈ 62px + sort icon 12px + gap 4px + horizontal padding 24px); th `white-space:nowrap`, no `overflow:hidden` → bleeds into CONFIDENCE (120px, rec 171).
2. **Mixed cell sizes in one row:** subject td 13px/500 (rec 183) vs all other tds 12px (182, 184…195) — two baselines in a 40px row.
3. **th height misuses token:** `height:var(--density-widget-head-h)` (44px) on every th (161…178) — couples table header to widget header; enterprise SOC table headers are denser.
4. **Card title drift:** "Recent Classifications" h2 = class `text-sm` (**14px**) vs "Threat Category Distribution"/"Model Footprint"/"Classification Performance" = class `text-[15px]` vs "System Monitor"/"Event Log"/"Live Classification" = inline `font-size:15px` (125, 267, 289). Three mechanisms, two sizes, one visual role.
5. **Subtitle drift:** chart cards use class `text-xs` (12px/16px lh) ×4 vs inline `font-size:12px` (lh inherits ≈18px) ×3 (126, 268, 290).
6. **Dead classes:** td rec 194/195 carry `text-text-secondary`/`text-text-muted` **and** inline `color:var(--text-primary)` — inline wins → TIME/"Assigned" render near-white instead of muted (visible S3 "2m ago").
**Patch [INFERRED paths: RecentClassifications + widget shells]:** SEVERITY th `width:70px` → `96px` (fits label+icon; 70+26 and CONFIDENCE 120 stays); or drop the sort icon from SEVERITY. Unify all tds to `font-size:12px` except subject keep 13px/500 **deliberately** (row title emphasis) — document as the one intentional exception, or 12px everywhere; th `height:var(--density-table-head-h)` (32px); all widget h2 → inline `font-size:var(--font-size-md)` (15px) + `letter-spacing:-0.2px`, delete `text-sm`/`text-[15px]` classes; subtitles → `font-size:var(--font-size-sm)` (12px) + `line-height:16px`; delete dead `text-text-*` td classes and set intended `color:var(--text-muted)` (TIME) / `var(--text-secondary)` inline.
**Acceptance:** S3 retaken — header labels separated by clear gap; TIME column visibly muted; all six widget titles identical computed font-size (15px).

## TV-10 [P1] Numeric-font coverage gaps: confidence %, ticket IDs, pagination lack `tabular-nums`; KPI row consistent (premise corrected) [CONFIRMED]

**Evidence:** `var(--font-numeric)` + `font-variant-numeric:tabular-nums` inline ×19: KPI values ×4 (68, 77, 86, 95), SysMon values ×4 (132…150), TIME + latency tds ×10 (194/195…254/255), event-log container (276, children inherit). **Missing:** confidence % spans ×5 — class-only `font-mono text-[13px] text-text-primary`, no tabular-nums (app_dom class census: zero `tabular-nums` class anywhere; built CSS contains no `.tabular-nums` utility → never used); TKT-ID anchors ×5 `font-mono text-xs text-accent-indigo`; pagination "Showing 1–5 of 6" (257) prose font. Chart axis labels/tooltips are canvas-rendered from `chartTokens.ts` **[INFERRED — needs src/ to confirm]** — could not verify font.
**Also verified:** Tailwind's `--font-mono` default (ui-monospace) is redefined in the unlayered `:root` alias block to `var(--font-family-mono)` (JetBrains Mono) *after* `@layer theme`, so `font-mono` utility currently resolves to JetBrains Mono — works, but rests on unlayered-beats-layered ordering; any future `@layer` reshuffle silently changes every `font-mono` element. KPI value rows: all 28px/600/tabular — the S1 dash-vs-8.73MB difference is color only (muted = honest unavailable, correct per Honesty Contract); cosmetic nit: value+badge use `align-items:baseline` (67) so 11px badge sits on numeral baseline — switch to `align-items:center` for optical centering.
**Patch:** confidence span add `font-variant-numeric:tabular-nums` (keep class font-mono) or replace class with inline `font-family:var(--font-numeric);font-variant-numeric:tabular-nums;font-size:13px`; same for TKT-ID anchors; pagination count span add tabular-nums; KPI value row `align-items:center`; `chartTokens.ts` verify `textStyle.fontFamily`/`axisLabel.fontFamily` = JetBrains Mono stack + add a comment binding values to `tokens.css` [INFERRED].
**Acceptance:** type different-confidence rows — `%` columns don't jitter; DevTools computed style on "96%" shows `font-variant-numeric: tabular-nums`.

## TV-11 [P1] Accent/link color AA failures on dark surfaces [CONFIRMED — measured]

**Evidence (computed, WCAG 2.2):** Classify Ticket white text on `--accent-indigo #6366F1` = **4.47:1** (fails 4.5 by 0.03; rec 298, also `color:rgb(255,255,255)` raw); TKT-ID links/footer links `--accent-indigo` on `--color-bg-card` = **3.27:1 FAIL**, on `--color-bg-body` = **4.29:1 FAIL**; bell badge white 9px on `--accent-rose #F43F5E` = **3.67:1 FAIL** (rec 56).
**Patch (additions §7):** `--color-accent-indigo-strong:#5558d8` (5.56:1 with white) for filled buttons (hover `#4f46e5` 6.29:1); `--color-link:#818cf8` for text links on dark (4.90:1 card / 6.42:1 body) — apply to footer links + TKT-ID anchors; `--color-badge-alert-bg:#e11d48` (4.70:1 with white) for the bell badge; `--color-text-on-accent:#ffffff` replaces both raw `rgb(255,255,255)`.
**Acceptance:** axe DevTools: 0 contrast violations on header, table, Live Classification button; links visibly lighter indigo.

## TV-12 [P1] Two styling runtimes + dual token namespaces (architecture drift) [CONFIRMED]

**Evidence:** `inlined-css.txt` header `/*! tailwindcss v4.3.2 */` with `@layer properties/theme/base/components/utilities`; tokens defined **twice**: `@layer theme` long names (`--color-bg-body:#0B0F19`, …) **and** unlayered `:root` alias block (`--bg-body:var(--color-bg-body)`, …, `--font-mono:var(--font-family-mono)`, `--chart-series-baseline:#64748B` raw hex). App DOM uses 78 distinct utility classes / 404 usages (class census, extension `<chatgpt-sidebar>` subtree excluded) *alongside* 305 inline-styled elements, incl. arbitrary values (`text-[10px]` ×4, `text-[11px]` ×5, `text-[12px]` ×5, `text-[13px]` ×5, `text-[15px]` ×3, `border-white/[0.03]`, `bg-white/[0.06]`, `h-[2px]`, `tracking-[-0.2px]`). Direct conflicts on the same element: rec 156 class `px-5 pt-4 pb-3` + inline `padding:0px 20px` (classes dead); rec 194/195 `text-text-muted` + inline `color:var(--text-primary)` (classes dead, wrong visual — TV-09.6); rec 160 table `w-full border-collapse` + inline `table-layout:fixed;min-width:900px`. Dead/suspect tokens: `--color-text-inverse:#C5C1B9` (beige — defined, unused anywhere in app DOM; 1 var ref in CSS), `--spacing-6` missing from the 2/4/8/12/16/24/28 spacing scale, `--radius-sm:6px` vs 9 inline radii in use (TV-05).
**Risks (factual):** two sources of truth → TV-01/TV-02 class of bug (component references short name, theme defines long name); Tailwind emits only used utilities but the whole `@theme` block ships regardless; class+inline conflicts make edits unpredictable (specificity depends on inline-vs-class, not source order); arbitrary-value classes (`text-[10px]`) bypass the token scale by design.
**Recommended reconciliation (pragmatic, no rewrite):** (1) `tokens.css` stays the single source of truth — `@theme` must be generated/copied 1:1 from it, never hand-edited (add a header comment in both); (2) **forbid new arbitrary-value classes** — one-line lint/code-review rule: "no `-[Npx]` classes; use tokens"; (3) remove the three dead-class conflicts listed above (each is a 1-line edit); (4) pick ONE mechanism per component family — recommendation: badges/titles/cells inline-style (matches the project spec "inline styles"), layout utilities (`flex`, `items-center`, `gap-*`) may stay as classes; (5) delete or justify `--color-text-inverse`; add `--spacing-6:20px` or document the gap. Do **not** rip out Tailwind — the lift outweighs the benefit for a solo dev.
**Acceptance:** greps — `grep -rn "\[1[0-9]px\]" src/` → 0; the three conflict elements carry class XOR inline per property; `@theme` header comment points at tokens.css.

## TV-13 [P2] ECharts + app z-index/layering has no token scale [CONFIRMED]

**Evidence:** header `z-index:100` (rec 1 aside), main `z-index:1` (40), ECharts tooltip `z-index:9999999` (104, 111 — ECharts default, stuck tooltip visible in S1 over the header), extension nodes `z-[1001]`. No `--z-*` tokens exist.
**Patch (additions §8):** `--z-base:0; --z-sticky:10; --z-header:100; --z-overlay:1000; --z-tooltip:1100` and set ECharts tooltip via chart config (`textStyle`/`tooltip.appendTo` + z) so it can't pin above the header at 9999999 [INFERRED: chart option builder in `src/components/charts/**`; the stuck-tooltip lifecycle bug itself is W-02 scope].
**Acceptance:** tooltip never overlays the header after mouse-leave; computed z-index of tooltip = 1100.

## TV-14 [P2] Chart token drift: `--chart-series-*` raw hex duplicates accent tokens [CONFIRMED]

**Evidence:** `:root` alias block: `--chart-series-baseline:#64748B;--chart-series-onnx:#6366F1;--chart-series-int8:#06B6D4` — the latter two are byte-identical to `--color-accent-indigo`/`--color-accent-cyan`; `#64748B` (slate-500) exists **nowhere** in tokens.css. ECharts tooltip DOM (rec 104/111) carries `rgb(30,41,59)`/`rgb(248,250,252)`/`rgb(100,116,139)` — tooltip colors from `chartTokens.ts` [INFERRED] = bg-card/text-primary + an untokenized slate.
**Patch (additions §9 — CHANGE, not addition):** `--chart-series-onnx:var(--color-accent-indigo); --chart-series-int8:var(--color-accent-cyan); --chart-series-baseline:var(--color-text-secondary)` (94A3B8; or add `--color-slate-500` if the exact chart gray must be kept — decide with W-01). Align `chartTokens.ts` tooltip colors to the same three tokens.
**Acceptance:** changing `--color-accent-indigo` once updates button + chart series together; tooltip still readable.

---

## Summary table

| # | Severity | Status | Finding |
|---|---|---|---|
| TV-01 | P0 | CONFIRMED | `--sev-*` undefined → severity dots invisible |
| TV-02 | P0 | CONFIRMED | `--cat-1..5` undefined, `--cat-6` absent → badge text white, dots invisible |
| TV-03 | P1 | CONFIRMED | 28 raw rgb/rgba literals ×49 occurrences |
| TV-04 | P1 | CONFIRMED | 29 sub-11px text instances (9px ×3, 10px ×26) |
| TV-05 | P1 | CONFIRMED | badge geometry: 7 paddings / 5 radii / 4 CACHED variants |
| TV-06 | P1 | CONFIRMED | "Unauthorized Acces" badge clip (math-verified) |
| TV-07 | P1 | CONFIRMED | status badges: raw literals, Escalated 3.57:1 AA fail |
| TV-08 | P1 | CONFIRMED | 16px vs 20px card padding split; 33 padding values |
| TV-09 | P1 | CONFIRMED | table: SEVERITY/CONFIDENCE overlap, 12/13px mix, 14 vs 15px titles |
| TV-10 | P1 | CONFIRMED | tabular-nums missing on confidence/IDs/pagination; KPI row OK |
| TV-11 | P1 | CONFIRMED | indigo button 4.47:1, links 3.27:1, bell badge 3.67:1 |
| TV-12 | P1 | CONFIRMED | Tailwind runtime + inline styles + dual token namespaces |
| TV-13 | P2 | CONFIRMED | no z-index tokens; tooltip at 9999999 |
| TV-14 | P2 | CONFIRMED | `--chart-series-*` raw hex duplicates |

All component-path references are **[INFERRED — needs src/ to confirm file:line]** (source zip not provided); every CSS/value-level claim is CONFIRMED from evidence files or measurement.
