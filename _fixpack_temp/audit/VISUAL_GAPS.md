# W-01 — VISUAL GAP AUDIT — TicketSec Arm64 SOC Dashboard

Reference class: Splunk Enterprise Security / CrowdStrike Falcon / Datadog (dark mode).
Evidence: screenshots S1–S6 (`/mnt/agents/upload/`), `evidence/dom.html`, `evidence/inline-styles.txt` (314 records), `evidence/inlined-css.txt` (133 custom properties), `evidence/text-content.txt`, `evidence/a11y-attrs.txt`. Pixel colors sampled from S1/S3/S4 (values cited inline).

**Honesty Contract preserved everywhere:** no finding proposes fake data, live-implying skeletons, or hiding the offline/cached state. Empty-state fixes are honest chrome (icon + text + reduced dead space), never fabricated series.

Severity index:

| # | Sev | Finding |
|---|-----|---------|
| V-01 | P0 | Severity dots 100% invisible — `--sev-*` tokens referenced but never defined |
| V-02 | P0 | Category badge system broken — `--cat-1..5` undefined, hardcoded pastel tints, no 6th category color |
| V-03 | P0 | "Checking…" pill never settles — perpetual pulse while API is down (Honesty Contract risk) |
| V-04 | P1 | KPI cards do not read as enterprise stat blocks (giant "—", pastel icon chips, gappy mono) |
| V-05 | P1 | Threat Category bars are pastel candy (400-level fills) — reads consumer, not SOC |
| V-06 | P1 | Model Footprint donut: violet emphasis on the wrong slice + center/legend collision |
| V-07 | P1 | Classification Performance panel is ~80% dead space — unstructured empty state |
| V-08 | P1 | Event Log: 2 rows in a stretched ~600px card, 9px level badges |
| V-09 | P1 | "Classify Ticket" oversized saturated full-width indigo button; opacity-disabled state |
| V-10 | P1 | "Black hole" ghost controls + inverted elevation token (`--bg-elevated` darker than card) |
| V-11 | P1 | Status badges use pastel text (#5EEA9A); badge sizing system inconsistent (5 variants) |
| V-12 | P1 | Sub-legible type floor: 22× 10px + 3× 9px text runs |
| V-13 | P1 | Table header collision: "SEVERITY ⇅CONFIDENCE" (70px column) |
| V-14 | P1 | "Unauthorized Acces" clipped mid-word, no ellipsis (badge overflow:visible) |
| V-15 | P1 | Header gutter mismatch (28px vs 24px) + stuck tooltip overlapping page title |
| V-16 | P2 | JetBrains Mono for display metrics renders gappy ("8 . 73MB"); tooltip/chart chrome polish |
| V-17 | P2 | Sidebar micro-labels, radius scale drift, focus/disabled consistency |

---

## V-01 — P0 — Severity dots are 100% invisible (undefined `--sev-*` tokens)

**Evidence:** S2 + S3 — the SEVERITY column between CATEGORY and CONFIDENCE renders completely empty for all 5 rows (pixel scan S3 y=206, x=760–860: only card bg `#1E293B`). `evidence/inline-styles.txt` lines 377–378, 407–408, 437–438, 467–468, 497–498: `<span class="inline-block w-2 h-2 rounded-full"> background-color:var(--sev-critical)` / `var(--sev-high)` / `var(--sev-medium)`. `evidence/inlined-css.txt`: **zero definitions** for `--sev-critical|high|medium|low` (grep `--sev-` = no match in all 133 custom properties). `a11y-attrs.txt` 15–36: the spans carry `aria-label="Severity: Critical"` — the semantics exist, the pixels don't.

**Defect:** A core SOC signal (severity) is visually absent. An undefined `var()` in `background-color` computes to `transparent` (invalid at computed-value time → unset → initial).

**Root cause:** [CONFIRMED from evidence] tokens.css never defines `--sev-*`; the severity-dot component references tokens that don't exist. Naming drift: the codebase also defines `--color-cat-1` but references `--cat-1` (see V-02) — same class of bug. Which component file holds the reference: [INFERRED — needs src/ to confirm file:line] (`src/components/...` ticket table / `SeverityDot`).

**Patch (A — tokens.css, immediate fix):** add severity tokens + back-compat aliases (full file in `fixpack/src/styles/tokens.css.patch.md`):

```css
/* severity scale — enterprise muted, AA on --color-bg-card */
--color-sev-critical: #F43F5E;   /* rose-500  */
--color-sev-high:     #F97316;   /* orange-500 */
--color-sev-medium:   #F59E0B;   /* amber-500  */
--color-sev-low:      #38BDF8;   /* sky-400 — 6.83:1 on card */
--color-sev-none:     #64748B;   /* slate-500  */
/* back-compat aliases — fixes every existing var(--sev-*) reference */
--sev-critical: var(--color-sev-critical);
--sev-high:     var(--color-sev-high);
--sev-medium:   var(--color-sev-medium);
--sev-low:      var(--color-sev-low);
```

**Patch (B — dot geometry, reference impl [INFERRED file: `src/components/tickets/SeverityDot.tsx`]):** keep the dot but give it a visible ring so it reads at 8px on `#1E293B`:

```tsx
import type { CSSProperties, ReactElement } from 'react';

export function SeverityDot({ severity }: { severity: 'critical' | 'high' | 'medium' | 'low' }): ReactElement {
  const style: CSSProperties = {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: `var(--color-sev-${severity})`,
    boxShadow: '0 0 0 2px var(--color-bg-card)', // separation from row bg, no glow
    flexShrink: 0,
  };
  const label = `Severity: ${severity[0].toUpperCase()}${severity.slice(1)}`;
  return <span style={style} role="img" aria-label={label} title={label} />;
}
```

**Acceptance (10s):** reload dashboard → Recent Classifications shows a colored dot (red/orange/amber) in every SEVERITY cell; DevTools → Computed on a dot shows `background-color` resolving to a hex, not `transparent`.

---

## V-02 — P0 — Category badge system broken: undefined `--cat-*`, hardcoded pastel tints, missing 6th color

**Evidence:** S2/S3 — badges ("Phishing", "Malware", "Unauthorized Acces", "Data Breach", "DDoS") render **white text on a faint tinted chip with NO dot**. `inline-styles.txt` 371–374: `background-color:rgba(129,140,248,0.12);color:var(--cat-1)` + dot `background-color:var(--cat-1)`; same pattern for `--cat-2..5` with hardcoded tints `rgba(34,211,238,.12)`, `rgba(248,113,113,.12)`, `rgba(251,191,36,.12)`, `rgba(167,139,250,.12)`. `inlined-css.txt`: only `--color-cat-1:#818cf8` exists — **`--cat-1..5` (no `color-` prefix) are never defined**; `--cat-6` doesn't exist at all though the product has exactly 6 categories (Phishing, Malware, Unauthorized Access, Data Breach, DDoS, False Positive).

**Defect:** (a) dot invisible (`background-color` → transparent), (b) badge text falls back to inherited `#F8FAFC` instead of the category hue — chips look like identical grey pills, (c) tint colors are raw hardcoded rgba (token-rule violation) in pastel 400-level hues, (d) False Positive has no color token anywhere.

**Root cause:** [CONFIRMED from evidence] token name drift (`--color-cat-1` defined vs `--cat-1` referenced) + incomplete scale (5 of 6) + hardcoded rgba in the badge component. Badge component location: [INFERRED — needs src/].

**Patch (A — tokens.css):** full muted categorical system + aliases (see fixpack file):

```css
/* categorical identity — 600-level fills (enterprise, non-pastel) */
--color-cat-1: #6366F1; /* Phishing            — indigo-500 */
--color-cat-2: #0891B2; /* Malware             — cyan-600   */
--color-cat-3: #D97706; /* Data Breach         — amber-600  */
--color-cat-4: #E11D48; /* Unauthorized Access — rose-600   */
--color-cat-5: #7C3AED; /* DDoS                — violet-600 */
--color-cat-6: #64748B; /* False Positive      — slate-500  */
/* 400-level text variants — AA ≥4.5:1 on 12–16% tint over --color-bg-card */
--color-cat-1-text: #818CF8; /* 4.90:1 */
--color-cat-2-text: #22D3EE; /* 8.09:1 */
--color-cat-3-text: #FBBF24; /* 8.76:1 */
--color-cat-4-text: #FB7185; /* 5.44:1 */
--color-cat-5-text: #A78BFA; /* 5.38:1 */
--color-cat-6-text: #94A3B8; /* 5.71:1 */
/* chip backgrounds — single source of truth, no more inline rgba */
--color-cat-1-bg: rgba(99,102,241,0.16);
--color-cat-2-bg: rgba(8,145,178,0.18);
--color-cat-3-bg: rgba(217,119,6,0.18);
--color-cat-4-bg: rgba(225,29,72,0.18);
--color-cat-5-bg: rgba(124,58,237,0.18);
--color-cat-6-bg: rgba(100,116,139,0.18);
/* back-compat aliases — repairs existing var(--cat-N) references */
--cat-1: var(--color-cat-1-text);
--cat-2: var(--color-cat-2-text);
--cat-3: var(--color-cat-3-text);
--cat-4: var(--color-cat-4-text);
--cat-5: var(--color-cat-5-text);
--cat-6: var(--color-cat-6-text);
```

(Aliases point at the `-text` variants because every existing `var(--cat-N)` reference is a text/dot color on a dark tint; dots read correctly at 400-level, chips keep the tinted bg.)

**Patch (B — badge component, reference impl [INFERRED file: `src/components/tickets/CategoryBadge.tsx`]):**

```tsx
import type { CSSProperties, ReactElement } from 'react';

export type CategoryId = 1 | 2 | 3 | 4 | 5 | 6;

export function CategoryBadge({ id, name }: { id: CategoryId; name: string }): ReactElement {
  const chip: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 500,
    lineHeight: '18px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',          // fixes V-14 clip-without-ellipsis
    backgroundColor: `var(--color-cat-${id}-bg)`,
    color: `var(--color-cat-${id}-text)`,
  };
  const dot: CSSProperties = {
    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
    backgroundColor: `var(--color-cat-${id})`,
  };
  return (
    <span style={chip} title={name}>
      <span style={dot} aria-hidden="true" />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
    </span>
  );
}
```

**Acceptance (10s):** table category cells show a colored dot + hue-matched text (indigo Phishing, cyan Malware, red Unauthorized Access…); a "False Positive" row/badge renders slate, never unstyled.

---

## V-03 — P0 — "Checking…" pill never settles (perpetual indeterminate state)

**Evidence:** S1–S4 all show the header pill as "Checking…" with a pulsing grey dot; S6 shows 3× `ERR_CONNECTION_TIMED_OUT` to `3.23.60.61:8000` — the API is definitively offline, yet the UI still says "Checking…". `dom.html` (pill markup): `border:1px solid rgba(148,163,184,0.3);background:rgba(148,163,184,0.08);color:var(--text-muted);cursor:help` + dot `animation:1.2s ease-in-out infinite pulse`. Raw rgba = token violation; infinite pulse = false "working on it" signal.

**Defect:** The single most important honesty indicator in the header misrepresents system state — it implies an in-flight check minutes after all requests have timed out. Honesty Contract risk (state must be live / cached / unavailable).

**Root cause:** [INFERRED — needs src/ to confirm file:line] `useApi` health-probe never transitions out of `checking` on timeout (logic owner: W-02). [CONFIRMED from evidence] the pill has exactly one grey indeterminate style regardless of state; pulse runs forever.

**Patch (visual contract — reference impl [INFERRED file: `src/components/layout/StatusPill.tsx`]):** three settled, token-driven states. Logic: after 2 consecutive probe failures (or `PROBE_TIMEOUT_MS`), render `offline`.

```tsx
import type { CSSProperties, ReactElement } from 'react';

export type ApiState = 'live' | 'cached' | 'offline' | 'checking';

const STATE_STYLE: Record<ApiState, { label: string; color: string; border: string; bg: string; pulse: boolean }> = {
  live:     { label: 'Live',              color: 'var(--color-accent-emerald)', border: 'rgba(16,185,129,0.35)', bg: 'rgba(16,185,129,0.10)', pulse: false },
  cached:   { label: 'Cached snapshot',   color: 'var(--color-accent-amber)',   border: 'rgba(245,158,11,0.35)', bg: 'rgba(245,158,11,0.10)', pulse: false },
  offline:  { label: 'API offline',       color: 'var(--color-accent-rose)',    border: 'rgba(244,63,94,0.35)',  bg: 'rgba(244,63,94,0.10)',  pulse: false },
  checking: { label: 'Checking…',         color: 'var(--color-text-muted)',     border: 'var(--color-border-default)', bg: 'rgba(255,255,255,0.04)', pulse: true },
};

export function StatusPill({ state }: { state: ApiState }): ReactElement {
  const s = STATE_STYLE[state];
  const pill: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '4px 10px', borderRadius: 999,
    border: `1px solid ${s.border}`, background: s.bg,
    fontSize: 12, fontWeight: 600, lineHeight: '16px',
    color: s.color, whiteSpace: 'nowrap',
  };
  const dot: CSSProperties = {
    width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0,
    animation: s.pulse ? 'pulse 1.2s ease-in-out infinite' : 'none',
  };
  return (
    <span style={pill} role="status" aria-live="polite" title="API connectivity state">
      <span style={dot} aria-hidden="true" />{s.label}
    </span>
  );
}
```

Note: `cursor:help` removed (nothing to help with); `role="status"`/`aria-live` so state changes are announced. Pulse is allowed ONLY in the transient `checking` state and must stop once settled.

**Acceptance (10s):** with the API down, the pill reads "API offline" (rose, static) within one probe timeout; no infinite pulsing element remains in the header.

---

## V-04 — P1 — KPI cards do not read as enterprise stat blocks

**Evidence:** S1 — 4 cards (`--density-kpi-h:128px`), three showing a giant 28px "—" in muted grey as the dominant element; each card has a pastel-tinted 28px icon chip (indigo/cyan/emerald/violet 10% tints — `inline-styles.txt` 134/152/170/188: `rgba(99,102,241,0.1)`, `rgba(6,182,212,0.1)`, `rgba(16,185,129,0.1)`, `rgba(139,92,246,0.1)`); value `8.73MB` renders in JetBrains Mono with visibly gappy advance widths ("8 . 73MB"). Card structure per `inline-styles.txt` 128–198: label 10px uppercase → value 28px/600 mono → footer caption 11px; `justify-content:space-between` leaves a dead middle band when the value is "—".

**Defect:** Splunk/Datadog stat blocks read as: small caps label → one dominant value (sans, tabular) → delta/context line. Here the eye lands on four pastel icon chips and three giant dashes; the one real value (8.73MB) is typeset in a wide code font. Four different icon hues on one row = confetti, and duplicates the categorical palette with no semantic meaning.

**Root cause:** [CONFIRMED from evidence] dash uses the same 28px metric style as real values (inline 137–138: `font-size:28px;...;color:var(--text-muted)`); icon chips use per-card accent tints; metric font is `--font-numeric` (JetBrains Mono). [INFERRED — needs src/] `KpiCard.tsx` applies one value style for data and no-data states.

**Patch (reference impl [INFERRED file: `src/components/KpiCard.tsx`]):**

```tsx
import type { CSSProperties, ReactElement, ReactNode } from 'react';

const valueBase: CSSProperties = {
  fontFamily: 'var(--font-family-sans)',     // Inter, not mono — see V-16
  fontVariantNumeric: 'tabular-nums',
  fontSize: 26, fontWeight: 600, letterSpacing: '-0.4px', lineHeight: 1.15,
  color: 'var(--color-text-primary)',
};

export function KpiValue({ value, unit, unavailable }: { value: string | null; unit?: string; unavailable?: boolean }): ReactElement {
  if (value === null) {
    // honest empty metric — quiet, not a 28px void
    return (
      <span style={{ ...valueBase, fontSize: 20, color: 'var(--color-text-muted)', fontWeight: 500 }}>
        —
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: 0, marginLeft: 8, color: 'var(--color-text-muted)' }}>
          {unavailable ? 'Unavailable — API offline' : 'No data in snapshot'}
        </span>
      </span>
    );
  }
  return (
    <span style={valueBase}>
      {value}
      {unit !== undefined && (
        <span style={{ fontSize: 13, fontWeight: 500, marginLeft: 4, color: 'var(--color-text-secondary)' }}>{unit}</span>
      )}
    </span>
  );
}

export function KpiIcon({ children }: { children: ReactNode }): ReactElement {
  // neutral enterprise chip — one quiet treatment for all four cards
  const chip: CSSProperties = {
    width: 28, height: 28, borderRadius: 6, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.05)',            // token: --color-icon-chip-bg
    color: 'var(--color-text-secondary)',
  };
  return <span style={chip} aria-hidden="true">{children}</span>;
}
```

Keep `--density-kpi-h:128px` and the CACHED badge; move the badge to the value row only when a value exists (for the dash state keep it in the footer row — current S1 placement is fine).

**Acceptance (10s):** the three offline KPIs read as a small quiet "— Unavailable — API offline" instead of a giant dash; all four icon chips are identical neutral grey; `8.73MB` sets in Inter with tight tabular figures.

---

## V-05 — P1 — Threat Category bars are pastel candy

**Evidence:** S1, pixel-sampled fills: Phishing `#818cf8`, Malware `#22d3ee`, Unauthorized Access `#f87171`, Data Breach `#fbbf24`, DDoS `#a78bfa` (Tailwind 400-level pastels — explicitly banned by the design brief); rounded bar caps on a `#1e293b` full-width track. Bars carry five unrelated hues for a single metric (detection count) — hue is doing no work (categories are already labeled on the y-axis).

**Defect:** Multi-hue pastel fills on dark = "generic admin template". Splunk/Datadog single-series bars use one accent; categorical identity belongs to the badge/legend system (V-02).

**Root cause:** [INFERRED — needs src/ to confirm file:line] `src/components/charts/CategoryBarChart.tsx` (or chartTokens) maps `itemStyle.color` per category from a 400-level palette. [CONFIRMED from evidence] rendered colors are 400-level pastels, and no `--color-cat-*` 600-level ramp existed to use instead (V-02).

**Patch (reference impl — series config, token-driven):**

```ts
// src/components/charts/CategoryBarChart.tsx — inside the ECharts option builder [INFERRED file]
import { chartTokens } from '../../lib/chartTokens';

const series = {
  type: 'bar' as const,
  barWidth: 14,
  showBackground: true,
  backgroundStyle: { color: chartTokens.barTrack, borderRadius: 2 }, // rgba(255,255,255,0.04)
  itemStyle: { color: chartTokens.seriesAccent, borderRadius: 2 },   // var(--chart-series-onnx) #6366F1 — ONE accent
  emphasis: { itemStyle: { color: chartTokens.seriesAccentStrong } }, // #818CF8 on hover only
  label: {
    show: true, position: 'right' as const, distance: 6,
    fontFamily: chartTokens.fontMono, fontSize: 11,
    color: chartTokens.textSecondary, formatter: (p: { value: number }) => p.value.toLocaleString('en-US'),
  },
};
```

If per-category identity is truly wanted, use the NEW muted 600-level ramp from V-02 (`--color-cat-1..6`) — never the 400-level pastels. Either way: `borderRadius: 2` max (no stadium caps), track at 4% white, gridlines at 5% white.

**Acceptance (10s):** bars render in one confident indigo (or the muted 600 ramp), square-ish caps; no cyan/salmon/yellow pastel fills remain.

---

## V-06 — P1 — Model Footprint donut: violet emphasis on the wrong slice + center/legend collision

**Evidence:** S1 — the donut is ~98.8% saturated violet (pixel-sampled `#8b5cf6` = headroom slice) with a 1.2% indigo sliver (`#6366f1` = model). The visually loudest element of the dashboard is *empty memory*. Inside the hole, the strings "Model (INT8)" / "Memory headroom" + dots overlap the centered "8.73MB / Optimized" text (S1 crop: legend markers collide with center metric). `inline-styles.txt` 218–224: donut canvas 360×280 with absolutely-positioned tooltip.

**Defect:** Emphasis inversion (the boring 98.8% gets the accent) + illegible center label stack = broken chart craft.

**Root cause:** [INFERRED — needs src/ to confirm file:line] donut series assigns slice colors in data order from a categorical palette (slice 0 → violet), and `legend.orient:'vertical'` is placed inside the ring while a `graphic`/title center label is also rendered. [CONFIRMED from evidence] rendered violet = `--color-accent-violet #8B5CF6`.

**Patch (reference impl — `src/components/charts/FootprintDonut.tsx` / chartTokens [INFERRED file]):**

```ts
import { chartTokens } from '../../lib/chartTokens';

const option = {
  series: [{
    type: 'pie' as const,
    radius: ['64%', '82%'],
    center: ['50%', '50%'],
    avoidLabelOverlap: true,
    label: { show: false },
    labelLine: { show: false },
    itemStyle: { borderColor: chartTokens.cardBg, borderWidth: 2 },
    data: [
      // the metric under scrutiny gets the accent; the remainder goes neutral
      { name: 'Model (INT8)',     value: 8.73,   itemStyle: { color: chartTokens.seriesAccent } },   // #6366F1
      { name: 'Memory headroom',  value: 691.27, itemStyle: { color: chartTokens.donutTrack } },     // #334155 slate — quiet
    ],
  }],
  // legend OUT of the ring: right side, vertical, value-aligned (already partially there)
  legend: {
    orient: 'vertical' as const, right: 0, top: 'middle',
    icon: 'circle', itemWidth: 8, itemHeight: 8, itemGap: 12,
    textStyle: { color: chartTokens.textSecondary, fontSize: 11, fontFamily: chartTokens.fontSans },
  },
  // single center metric — two lines max, nothing else in the hole
  graphic: [{
    type: 'group', left: 'center', top: 'middle',
    children: [
      { type: 'text', style: { text: '8.73MB', fill: chartTokens.textPrimary, font: `600 20px ${chartTokens.fontSans}`, textAlign: 'center' }, top: -14 },
      { type: 'text', style: { text: 'of 700MB budget', fill: chartTokens.textMuted, font: `400 11px ${chartTokens.fontSans}`, textAlign: 'center' }, top: 10 },
    ],
  }],
};
```

Also drop the "Optimized" third line (it duplicated the headroom story inside the hole). Violet `#8B5CF6` should not appear on this dashboard as a data fill at all.

**Acceptance (10s):** donut reads as a thin indigo usage arc on a quiet slate ring; hole contains only "8.73MB / of 700MB budget"; no text overlaps.

---

## V-07 — P1 — Classification Performance panel is ~80% dead space

**Evidence:** S2 — panel (~7fr wide, ~330px tall) contains only two centered text lines ("Awaiting live performance data" / "Historical accuracy will appear once the API returns real metrics."). `inline-styles.txt` 237–242: `position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px;gap:8px` + 11px subline. No icon, no frame, no structure.

**Defect:** A blank cavern reads as "broken widget", not "honestly empty". Enterprise empty states are compact, structured, and clearly intentional.

**Root cause:** [CONFIRMED from evidence] empty state = bare absolutely-positioned text; panel has no min-height management. [INFERRED — needs src/] panel component doesn't differentiate empty vs populated layout height.

**Patch (reference impl [INFERRED file: `src/components/EmptyState.tsx`]):** honest chrome — icon + title + sub + dashed frame; NO skeleton bars, NO ghost axes (would imply incoming data):

```tsx
import type { CSSProperties, ReactElement, ReactNode } from 'react';

export function EmptyState({ icon, title, hint, minHeight = 180 }: {
  icon: ReactNode; title: string; hint: string; minHeight?: number;
}): ReactElement {
  const wrap: CSSProperties = {
    minHeight, margin: '0 20px 16px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
    border: '1px dashed var(--color-border-default)', borderRadius: 8,
    color: 'var(--color-text-muted)', textAlign: 'center', padding: '24px 16px',
  };
  return (
    <div style={wrap} role="status">
      <span style={{ color: 'var(--color-text-muted)', opacity: 0.5, display: 'flex' }} aria-hidden="true">{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{title}</span>
      <span style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 380 }}>{hint}</span>
    </div>
  );
}
```

And cap the panel: `min-height` of the chart region 320px → 200px when empty (`style={{ minHeight: isEmpty ? 200 : 320 }}`).

**Acceptance (10s):** the panel shows a compact dashed-frame empty state (~200px), visually deliberate; footer "Snapshot: cached" unchanged; no fake chart elements appear.

---

## V-08 — P1 — Event Log: 2 rows in a stretched ~600px card; 9px level badges

**Evidence:** S4 — the Event Log card fills the full height of its grid row (matching Live Predictions' `min-height:420px`, `inline-styles.txt` 576) but contains 2 entries; ~500px of empty `#1E293B` below. Inner list: `max-height:240px` (inline 554) so it never grows into the card. Level badges at `font-size:9px` (inline 560/568) — below enterprise legibility floor. Row separators `rgba(255,255,255,0.03)` (near-invisible).

**Defect:** A wall of dead card; log "chrome" (badges) unreadable at 9px.

**Root cause:** [INFERRED — needs src/ to confirm file:line] the dashboard grid stretches both cards in the row (`align-items:stretch` default) and the log card has no content-aware height; badge font-size hardcoded 9px. [CONFIRMED from evidence] 9px size, 240px inner cap, stretched card.

**Patch:**

1. Grid (dashboard layout [INFERRED file: `src/pages/Dashboard.tsx` or `App.tsx`]): add `alignItems: 'start'` to the 7fr/5fr grid row style so cards size to content; Live Predictions keeps its `minHeight: 420`.
2. Log card: remove dead space — inner list `maxHeight: 240` stays, but the card wraps it (`height: fit-content`); when ≤3 entries append one honest terminator row:

```tsx
// [INFERRED file: src/components/EventLog.tsx]
{entries.length <= 3 && (
  <div style={{
    padding: '8px 14px', fontSize: 11, fontFamily: 'var(--font-family-mono)',
    color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border-default)',
  }}>
    — End of log · {entries.length} {entries.length === 1 ? 'entry' : 'entries'} · new events appear here —
  </div>
)}
```

3. Level badge (tokens floor, see V-12): `font-size:10px; font-weight:700; letter-spacing:0.4px; padding:2px 6px; border-radius:3px; line-height:14px` — colors unchanged (emerald INFO / muted DEBUG / rose ERROR).

**Acceptance (10s):** Event Log card hugs its content (no 500px void), shows an "End of log" terminator; INFO/DEBUG badges legible at 10px.

---

## V-09 — P1 — "Classify Ticket" oversized saturated full-width button; weak disabled state

**Evidence:** S4 — a full-width, ~52px-tall, saturated `#6366F1` (opacity-0.6 → sampled `#474da9`) button dominates the right panel; white 13px/600 label + zap icon. `inline-styles.txt` 598: `width:100%;background:var(--accent-indigo);border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;cursor:not-allowed;opacity:0.6`. Splunk/Datadog primary actions are compact (28–32px), auto-width, right-aligned, and use a deeper primary; disabled state = desaturated surface, not opacity on the accent (opacity on a full-bleed button looks like a rendering bug).

**Defect:** Marketing-page CTA inside a SOC console; disabled state illegible and over-large.

**Root cause:** [CONFIRMED from evidence] `width:100%` + accent fill + `opacity:0.6` disabled. [INFERRED — needs src/] `LivePredictions.tsx` button styles.

**Patch (reference impl [INFERRED file: `src/components/Button.tsx` — or inline in LivePredictions]):**

```tsx
import type { CSSProperties, ReactElement, ReactNode } from 'react';

export function PrimaryButton({ disabled, children, onClick }: {
  disabled?: boolean; children: ReactNode; onClick?: () => void;
}): ReactElement {
  const style: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 32, padding: '0 14px', borderRadius: 6, border: '1px solid transparent',
    fontSize: 13, fontWeight: 600, lineHeight: 1,
    background: disabled ? 'rgba(255,255,255,0.06)' : 'var(--color-accent-indigo-strong)', // #4F46E5
    color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-on-accent)',           // #FFFFFF
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background-color 150ms',
  };
  return (
    <button type="button" style={style} disabled={disabled} onClick={onClick}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'var(--color-accent-indigo-strong-hover)'; }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.background = 'var(--color-accent-indigo-strong)'; }}>
      {children}
    </button>
  );
}
```

Placement: right-align in a footer row under the textarea (`display:flex;justify-content:flex-end`), not full-width. Add token `--color-accent-indigo-strong:#4F46E5` + `--color-accent-indigo-strong-hover:#4338CA` (white on `#4F46E5` = 6.29:1, AA). Keep the "Ctrl+Enter to submit" hint (good pro touch) but set it to 11px muted — it already is; fine.

**Acceptance (10s):** the action is a compact 32px right-aligned button; disabled state is a flat grey chip with muted label — clearly inactive, clearly deliberate.

---

## V-10 — P1 — "Black hole" ghost controls + inverted elevation token

**Evidence:** S2/S3/S4 — Export CSV, Previous/Next, sample chips render as near-black rectangles on the `#1E293B` card (chip pixel-sampled `#0b0f19` = `--color-bg-body`; `inline-styles.txt` 318/520/524/592/594: `background:var(--bg-body)`). Meanwhile `--color-bg-elevated:#111827` is **darker** than `--color-bg-card:#1E293B` (`inlined-css.txt`) — the elevation scale runs backwards, so anything "elevated" (tooltips, popovers, menus) sinks visually below the card.

**Defect:** Controls look like holes punched in the card; popovers can't rise above the surface. Datadog/CrowdStrike dark: higher elevation = lighter surface.

**Root cause:** [CONFIRMED from evidence] `--color-bg-elevated` value `#111827` < card `#1E293B` in lightness; ghost buttons reuse `--bg-body` as their fill.

**Patch (tokens.css — see fixpack):**

```css
--color-bg-elevated: #27324A;          /* lighter than card — tooltips/menus/popovers rise */
--color-control-ghost-bg: rgba(255,255,255,0.04);   /* ghost default: subtle lift, not a pit */
--color-control-ghost-bg-hover: rgba(255,255,255,0.08);
```

Ghost button reference style (Export CSV, pagination, chips [INFERRED files: `src/components/TicketTable.tsx`, `LivePredictions.tsx`]):

```tsx
const ghost: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  height: 28, padding: '0 10px', borderRadius: 6,
  border: '1px solid var(--color-border-default)',
  background: 'var(--color-control-ghost-bg)',
  color: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 500,
  cursor: 'pointer', transition: 'background-color 150ms, border-color 150ms',
};
// hover: background var(--color-control-ghost-bg-hover); border-color var(--color-border-hover)
// disabled: background transparent; color var(--color-text-muted); border-color var(--color-border-default); cursor not-allowed
```

**Acceptance (10s):** Export CSV / Previous / Next / sample chips read as subtle raised chips (4% white), not black rectangles; ECharts tooltip is visibly lighter than the card behind it.

---

## V-11 — P1 — Status badges: pastel text + 5 different badge geometries

**Evidence:** S3 pixel-sampled: "Resolved" text `#5eea9a` (emerald-300, pastel); `inline-styles.txt` 388/418/448/478/508: status chips `padding:2.5×? px-2.5 py-1 rounded text-[11px]` with text colors `rgb(94,234,154)`, `rgb(244,63,94)`, `rgb(245,158,11)` and bgs `rgba(...,0.12)`. Meanwhile: KPI CACHED badge `10px / padding:2px 6px` (140), panel CACHED badge `10px / padding:3px 8px` (256), log level badges `9px / padding:1px 5px` (560), filter chips `11px / padding:3px 10px` (544), category badges `12px / padding:2px 8px` (372). Five unrelated badge systems.

**Defect:** Inconsistent badge geometry reads un-designed; pastel green text on tint looks washed.

**Root cause:** [CONFIRMED from evidence] per-component ad-hoc badge styles; status text uses 300-level pastels.

**Patch (tokens.css + one Badge component [INFERRED file: `src/components/Badge.tsx`]):**

```css
/* status text — 400-level mid tones, AA on tint over card */
--color-status-ok-text:    #34D399;  /* 7.61:1 on card */
--color-status-ok-bg:      rgba(16,185,129,0.14);
--color-status-warn-text:  #FBBF24;  /* 8.76:1 */
--color-status-warn-bg:    rgba(245,158,11,0.14);
--color-status-err-text:   #FB7185;  /* 5.44:1 */
--color-status-err-bg:     rgba(244,63,94,0.14);
--color-status-neutral-text: var(--color-text-secondary);
--color-status-neutral-bg: rgba(148,163,184,0.12);
```

```tsx
import type { CSSProperties, ReactElement, ReactNode } from 'react';

type Tone = 'ok' | 'warn' | 'err' | 'neutral';
type Size = 'sm' | 'md';

export function Badge({ tone = 'neutral', size = 'md', children }: {
  tone?: Tone; size?: Size; children: ReactNode;
}): ReactElement {
  const style: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    borderRadius: 4, fontWeight: 600, textTransform: 'uppercase',
    fontSize: size === 'sm' ? 10 : 11,
    letterSpacing: size === 'sm' ? '0.4px' : '0.3px',
    padding: size === 'sm' ? '2px 6px' : '3px 8px',
    lineHeight: size === 'sm' ? '14px' : '16px',
    whiteSpace: 'nowrap',
    color: `var(--color-status-${tone}-text)`,
    background: `var(--color-status-${tone}-bg)`,
  };
  return <span style={style}>{children}</span>;
}
```

Map: CACHED → `warn/sm`, panel CACHED → `warn/md`, Resolved → `ok/md`, Escalated → `err/md`, Pending → `warn/md`, log INFO/DEBUG/ERROR → `ok|neutral|err/sm`. Category badges stay sentence-case (V-02 component) — only status/system badges uppercase.

**Acceptance (10s):** all badges snap to two sizes; "Resolved" text is a mid emerald (`#34D399`), not pastel; CACHED badges look identical everywhere.

---

## V-12 — P1 — Sub-legible type floor: 22× 10px + 3× 9px text runs

**Evidence:** `inline-styles.txt` font-size census: 9px ×3 (log level badges 560/568, notification count 114), 10px ×22 (KPI labels 132, sidebar section labels 18/38/58, CACHED badges 140/158/176, sort arrows 328, table-side captions 268), 11px ×33. The 9px runs are below any enterprise floor (Splunk min ≈ 11px; Datadog min ≈ 11px); 10px uppercase labels at `letter-spacing:1px` (sidebar) are borderline.

**Defect:** Micro-type reads as "unfinished small-print UI" and fails low-vision users even when contrast passes (WCAG 2.2 AA has no px floor, but 9px bold-caps is a de-facto legibility failure at 100% zoom).

**Root cause:** [CONFIRMED from evidence] ad-hoc px sizes, no label/badge type tokens.

**Patch (tokens.css — type scale tokens):**

```css
--font-size-label: 11px;    /* uppercase micro labels: KPI titles, table headers, section labels */
--font-size-badge: 10px;    /* smallest rendered text anywhere — badges only */
--font-size-caption: 11px;  /* panel footers, hints (replaces --caption-size, keep alias) */
```

Apply [INFERRED files]: log badges 9px→`var(--font-size-badge)` 10px; bell counter 9px→10px; KPI labels + sidebar section labels 10px→`var(--font-size-label)` 11px (sidebar `letter-spacing:1px`→`0.8px`); table headers already 11px — keep. Nothing in the app may render below 10px.

**Acceptance (10s):** DevTools computed-styles search finds zero `font-size` < 10px; sidebar "OVERVIEW/OPERATIONS/SYSTEM" and KPI titles visibly bump up.

---

## V-13 — P1 — Table header collision: "SEVERITY ⇅CONFIDENCE"

**Evidence:** S2 + S3 — header text "SEVERITY ⇅CONFIDENCE ⇅" run together. `inline-styles.txt` 337–343: severity `<th>` `width:70px` with sortable inner button `white-space:nowrap` (text "SEVERITY" + 4px gap + ⇅ icon ≈ 88px) → overflow bleeds into the next th (no `overflow:hidden` on th).

**Defect:** Two column headers visually merge — instantly reads "broken table".

**Root cause:** [CONFIRMED from evidence] column width (70px) < header content width (~88px); th has no clipping. [INFERRED — needs src/] column-width table in `TicketTable.tsx`.

**Patch [INFERRED file: `src/components/TicketTable.tsx`]:**

```tsx
// column widths — severity widened to fit "SEVERITY ⇅"
const COL = {
  id: 96, subject: '26%', category: 168, severity: 96,
  confidence: 120, status: 100, assigned: 116, time: 84,
} as const;

const th: CSSProperties = {
  padding: '0 12px', height: 36, boxSizing: 'border-box',
  fontSize: 'var(--font-size-label)', fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.5px', color: 'var(--color-text-muted)', textAlign: 'left',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',  // never bleed
};
```

(Header row height 44px `--density-widget-head-h` → 36px: enterprise table headers are shorter than panel headers; the 44px token belongs to panel title bars only.)

**Acceptance (10s):** "SEVERITY ⇅" and "CONFIDENCE ⇅" render as two fully separated headers with visible gap; all sort arrows aligned.

---

## V-14 — P1 — "Unauthorized Acces" clipped mid-word without ellipsis; "Security T…" overly tight

**Evidence:** S2/S3 — category badge shows "Unauthorized Acces" (hard cut, no ellipsis). `inline-styles.txt` 372: badge span `white-space:nowrap;overflow:visible;padding:2px 8px` inside `<td>` `overflow:hidden;text-overflow:ellipsis` — the badge itself has `overflow:visible`, so the td clips pixels instead of ellipsis-ing text. Also 431–432. `text-content.txt` 111 confirms full string is "Unauthorized Access". "Security T…" (110px col, inline 390) ellipsis-izes correctly but 110px is too tight for the two real values ("Security Team", "Auto").

**Defect:** Mid-word hard clip = the single cheapest-looking defect in the table.

**Root cause:** [CONFIRMED from evidence] badge `overflow:visible` + fixed 150px category column. Component file [INFERRED — needs src/].

**Patch:** (1) CategoryBadge reference impl in V-02 (adds `max-width:100%; overflow:hidden; text-overflow:ellipsis` + `title={name}`). (2) Column widths per V-13 (`category: 150→168px`, `assigned: 110→116px`). (3) Rule: every truncated string must carry `title` (table already does this for subject/td — extend to badges).

**Acceptance (10s):** worst case renders "Unauthorized Acc…" (ellipsis) with full text on hover — never a mid-word pixel cut.

---

## V-15 — P1 — Header gutter mismatch + stuck tooltip overlapping the page title

**Evidence:** S1 — an ECharts tooltip ("Latency data comes from the live metrics endpoint when available. Sparkline shows the last 24 points.") is frozen over the header/title area, overlapping "…nter" of "Security Operations Center". `inline-styles.txt` 84: header `padding:0px 28px`; 118: content `padding:20px 24px` — 28px vs 24px gutters, so the header's left edge never aligns with the content's left edge (visible at the KPI row vs breadcrumb). 210: tooltip node `z-index:9999999; visibility:hidden` — yet S1 shows it stuck visible.

**Defect:** (a) misaligned page gutters = subtle "off" feeling; (b) an orphaned tooltip floating over chrome = broken polish.

**Root cause:** [CONFIRMED from evidence] two different horizontal paddings. Tooltip: [INFERRED — needs src/] tooltip `hideDelay`/`alwaysShowContent` or a `mousemove` without `globalout` handler; also `confine:false` lets it escape the chart bounds over the header.

**Patch:**

1. tokens.css: `--layout-page-px: 24px` — header and main both consume it (header `padding: 0 var(--layout-page-px)`; main `padding: 20px var(--layout-page-px)`).
2. Chart tooltip config [INFERRED file: `src/lib/chartTokens.ts` / chart components]:

```ts
tooltip: {
  trigger: 'axis',
  confine: true,            // never escape the chart container over page chrome
  hideDelay: 80,
  backgroundColor: chartTokens.tooltipBg,      // var(--color-bg-elevated) — after V-10 fix it is lighter than card
  borderColor: chartTokens.tooltipBorder,      // var(--color-border-hover)
  borderWidth: 1,
  padding: [8, 10],
  textStyle: { color: chartTokens.textPrimary, fontSize: 11, fontFamily: chartTokens.fontMono },
  extraCssText: 'box-shadow: var(--shadow-popover); border-radius: 6px;',
},
```

Plus on unmount/`globalout`: `chart.dispatchAction({ type: 'hideTip' })` (ECharts API) so a tooltip can never outlive hover.

**Acceptance (10s):** breadcrumb, KPI row and panel grid share one 24px left edge; scrubbing a chart then leaving the page area leaves zero orphaned tooltips.

---

## V-16 — P2 — JetBrains Mono for display metrics ("8 . 73MB" gaps) + chart chrome polish

**Evidence:** S1 — KPI value and donut legend values ("8.73MB", "691.27MB") render in a wide mono with cavernous advance widths; the same string in the table ("96%") looks fine at 12–13px, so the issue is display-size mono. S6 console: `[ECharts] Specified grid.containLabel but no use(LegacyGridContainLabel); use grid.outerBounds instead` (log.js:59) — deprecated chart config. `inline-styles.txt` 138/174/192: values use `font-family:var(--font-numeric)`.

**Defect:** Big metrics look airy/informal; Splunk/Datadog set display metrics in the UI sans with tabular figures, reserving mono for IDs/timestamps/log streams. The ECharts warning means the grid option is ignored → axis labels may clip.

**Root cause:** [CONFIRMED from evidence] `--font-numeric` (JetBrains Mono) applied to 28px display values; deprecated `grid.containLabel` in chart options [INFERRED file: chart components / chartTokens].

**Patch:**

1. tokens.css: `--font-metric: var(--font-family-sans);` — KPI values, donut center, legend values switch to Inter + `font-variant-numeric: tabular-nums` (Inter's `tnum` keeps column alignment; brief's "tabular-nums on metrics" preserved). Keep mono for: ticket IDs, timestamps, log lines, latency/ms numerals ≤13px.
2. Chart grid [INFERRED file]: replace `grid: { containLabel: true }` with `grid: { left: 8, right: 24, top: 8, bottom: 0, outerBounds: { containLabel: true } }` per the console warning (ECharts 6 API); kills the warning and the clipping risk.
3. Chart text baseline: axis labels 11px `var(--color-text-muted)`, split lines `rgba(255,255,255,0.05)` (token `--chart-grid`), axis lines `rgba(255,255,255,0.08)`.

**Acceptance (10s):** "8.73MB" sets tight in Inter; console no longer shows the containLabel warning; y-axis category labels never clip.

---

## V-17 — P2 — Sidebar micro-labels, radius drift, small-consistency pass

**Evidence:** S1/S2 + `inline-styles.txt`: sidebar section labels `font-size:10px;letter-spacing:1px` (18/38/58); user card `border-radius:10px` (74) vs cards 8px; nav active `border-left:3px solid var(--accent-indigo)` + `rgba(99,102,241,0.1)` (raw rgba, token violation); header buttons 34×34 with `border-radius:8px` (102) vs other 6px controls; sidebar width 260px (4) for 13px nav items — slightly generous vs enterprise 232–240px.

**Defect:** Micro-inconsistencies accumulate into "generic template" feel.

**Root cause:** [CONFIRMED from evidence] mixed radius/padding values; raw rgba in nav. File locations [INFERRED — needs src/].

**Patch (tokens + values):**

```css
--radius-sm: 6px;   /* controls, inputs, badges */
--radius-md: 8px;   /* cards, panels, icon buttons — everything */
--layout-sidebar-w: 240px;
```

- Sidebar section labels → `font-size: var(--font-size-label); letter-spacing: 0.8px; padding: 12px 12px 6px`.
- Nav active bg → `background: var(--color-accent-indigo-bg)` (new token `rgba(99,102,241,0.12)`); keep the 3px indigo left bar (good enterprise pattern).
- User card `border-radius: 10px → var(--radius-md)`; header icon buttons `border-radius: var(--radius-sm)`; sidebar `width: var(--layout-sidebar-w)` and main `margin-left: var(--layout-sidebar-w)`.
- Bell counter badge: `font-size:10px; min-width:16px; height:16px; padding:0 4px; top:4px; right:4px` (was 9px/14px — nearly unreadable and crowded by the icon).

**Acceptance (10s):** radii are uniformly 6/8px; sidebar is 240px with 11px section labels; no raw `rgba(99,102,241` strings remain in nav markup.

---

## Cross-cutting: token-rule violations inventory (fuel for the fixpack)

Hardcoded raw values found in rendered markup (all banned by "tokens only"): `rgba(99,102,241,0.1/0.12)` ×3, `rgba(6,182,212,0.1)`, `rgba(16,185,129,0.08/0.1/0.12)`, `rgba(139,92,246,0.1)`, `rgba(148,163,184,0.08/0.1/0.25/0.3)`, `rgba(245,158,11,0.1/0.12/0.3)` ×9, `rgba(244,63,94,0.12)`, `rgba(251,191,36,0.12)`, `rgba(248,113,113,0.12)`, `rgba(167,139,250,0.12)`, `rgba(34,211,238,0.12)`, `rgba(129,140,248,0.12)`, `rgba(255,255,255,0.03/0.06)`, `rgb(94,234,154)`, `rgb(244,63,94)`, `rgb(245,158,11)`, ECharts tooltip `rgb(30,41,59)` / `rgb(100,116,139)`. Every one of these is replaced by a token in `fixpack/src/styles/tokens.css.patch.md`.
