# TicketSec Arm64 — Design Tokens

> Standalone design token reference for the TicketSec Arm64 prototype.  
> Use these values exclusively; no external token sheet is required.

## Hard rule

**Every color, spacing, radius, shadow, and type value used in the prototype must come from this file.** No invented hex codes, no extra px values, no system fonts outside the listed stacks.

## Typography

| Token | Value | Usage |
|---|---|---|
| `--font-family-sans` | Inter, -apple-system, BlinkMacSystemFont, sans-serif | UI labels, body text, buttons |
| `--font-family-mono` | JetBrains Mono, SF Mono, Fira Code, monospace | Numbers, IDs, timestamps, probabilities |
| `--font-metric` | var(--font-family-sans) | Display metrics (Inter + tabular-nums) |
| `--font-numeric` | JetBrains Mono... | Data streams / KPI values |
| `--font-size-micro` | 11px | Badges, group labels, meta — rendered floor |
| `--font-size-xs` | 11px | Same as micro |
| `--font-size-sm` | 12px | Body secondary, captions |
| `--font-size-base` | 13px | Default body text |
| `--font-size-md` | 14px | Emphasized body |
| `--font-size-lg` | 15px | Page/section titles |
| `--font-size-xl` | 20px | Large headlines |
| `--font-size-2xl` | 24px | Hero numbers |
| `--font-size-kpi` | 28px | KPI primary values |
| `--font-size-metric` | 32px | Very large metrics |
| `--font-size-label` | 11px | Uppercase micro labels (KPI titles, table headers) |
| `--font-size-badge` | 10px | Type floor exception — badges only |
| `--font-size-caption` | 11px | Panel footers, hints, timestamps |
| `--line-height-xs` | 16px | Tight lines |
| `--line-height-base` | 20px | Default |
| `--line-height-lg` | 24px | Comfortable |
| `--tracking-caps` | 0.6px | Uppercase micro labels |
| `--tracking-th` | 0.5px | Table header cells |
| `--tracking-title` | -0.2px | Card/page titles |
| `--tracking-kpi` | -0.5px | Large KPI numerals |

## Surfaces (dark elevation: lighter = higher)

| Token | Value | Usage |
|---|---|---|
| `--color-bg-body` | `#0B0F19` | App background |
| `--color-bg-sidebar` | `#0F172A` | Sidebar / input wells |
| `--color-bg-card` | `#1E293B` | Cards, panels, tables |
| `--color-bg-card-hover` | `#334155` | Row hover, interactive card hover |
| `--color-bg-input` | `#0F172A` | Form inputs |
| `--color-bg-elevated` | `#27324A` | Tooltips, popovers, modals, command palette |
| `--color-overlay-backdrop` | `rgba(0,0,0,0.60)` | Modal/drawer backdrop |

## Borders

| Token | Value | Usage |
|---|---|---|
| `--color-border-default` | `rgba(255,255,255,0.06)` | Default 1px borders |
| `--color-border-hover` | `rgba(255,255,255,0.10)` | Hover borders, tooltip borders |
| `--color-border-accent` | `rgba(99,102,241,0.30)` | Focus/accent borders |

## Text

| Token | Value | Usage |
|---|---|---|
| `--color-text-primary` | `#F8FAFC` | Headings, primary text |
| `--color-text-secondary` | `#94A3B8` | Secondary text |
| `--color-text-muted` | `#8292A8` | Timestamps, placeholders, disabled |
| `--color-text-inverse` | `#0B0F19` | Text on light/accent fills |
| `--color-text-on-accent` | `#FFFFFF` | Text on primary buttons |

## Brand / accents

| Token | Value | Usage |
|---|---|---|
| `--color-accent-indigo` | `#6366F1` | Active nav, selected rows, primary accent |
| `--color-accent-indigo-strong` | `#4F46E5` | Primary buttons (white text, 6.29:1) |
| `--color-accent-indigo-strong-hover` | `#4338CA` | Primary button hover |
| `--color-accent-indigo-bg` | `rgba(99,102,241,0.12)` | Nav active bg |
| `--color-accent-violet` | `#8B5CF6` | Reserved accent (not dashboard data fills) |
| `--color-accent-cyan` | `#06B6D4` | Model slice, secondary accent |
| `--color-accent-emerald` | `#10B981` | Success / OK |
| `--color-accent-rose` | `#F43F5E` | Errors / escalated |
| `--color-accent-amber` | `#F59E0B` | Cached badge, warnings |
| `--color-accent-orange` | `#F97316` | High severity, attention |
| `--color-link` | `#818CF8` | Text links on dark (4.90:1 on card) |

## Categorical identity (badges + charts)

Order: 1 Phishing, 2 Malware, 3 Data Breach, 4 Unauthorized Access, 5 DDoS, 6 False Positive.

| Token | Fill (600) | Text (400) | Background tint | Usage |
|---|---|---|---|---|
| cat-1 | `#6366F1` | `#A5B4FC` | `rgba(99,102,241,0.16)` | Phishing |
| cat-2 | `#0891B2` | `#22D3EE` | `rgba(8,145,178,0.18)` | Malware |
| cat-3 | `#D97706` | `#FBBF24` | `rgba(217,119,6,0.18)` | Data Breach |
| cat-4 | `#E11D48` | `#FB7185` | `rgba(225,29,72,0.18)` | Unauthorized Access |
| cat-5 | `#7C3AED` | `#A78BFA` | `rgba(124,58,237,0.18)` | DDoS |
| cat-6 | `#64748B` | `#94A3B8` | `rgba(100,116,139,0.18)` | False Positive |

## Severity scale (functional)

| Token | Value | Usage |
|---|---|---|
| `--color-sev-critical` | `#FB7185` | Critical severity rail/dot |
| `--color-sev-high` | `#F97316` | High severity |
| `--color-sev-medium` | `#F59E0B` | Medium severity |
| `--color-sev-low` | `#38BDF8` | Low severity |
| `--color-sev-info` | `#60A5FA` | Info / false positive alias |
| `--color-sev-none` | `#64748B` | None / neutral |

## Status badges

| Token | Text | Background | Usage |
|---|---|---|---|
| `--color-status-ok-text` | `#34D399` | `rgba(16,185,129,0.14)` | Resolved / healthy |
| `--color-status-warn-text` | `#FBBF24` | `rgba(245,158,11,0.14)` | Pending / cached |
| `--color-status-err-text` | `#FB7185` | `rgba(244,63,94,0.14)` | Escalated / error |
| `--color-status-neutral-text` | `#94A3B8` | `rgba(148,163,184,0.12)` | Neutral / auto |

## Honesty badges

| Token | Value | Usage |
|---|---|---|
| `--badge-cached-fg` | `#F59E0B` | CACHED badge text |
| `--badge-cached-bg` | `rgba(245,158,11,0.10)` | CACHED badge bg |
| `--badge-cached-border` | `rgba(245,158,11,0.30)` | CACHED badge border |
| `--badge-neutral-fg` | `#94A3B8` | PENDING / neutral text |
| `--badge-neutral-bg` | `rgba(148,163,184,0.10)` | PENDING bg |
| `--badge-neutral-border` | `rgba(148,163,184,0.25)` | PENDING border |
| `--pill-neutral-bg` | `rgba(148,163,184,0.08)` | Header status pill bg |
| `--pill-neutral-border` | `rgba(148,163,184,0.30)` | Header status pill border |

## Density

| Token | Value | Usage |
|---|---|---|
| `--density-row-h` | 40px | Table rows |
| `--density-card-pad` | 16px | Card/panel padding |
| `--density-card-gap` | 14px | Gap between cards |
| `--density-kpi-h` | 128px | KPI stat block height |
| `--density-widget-head-h` | 44px | Panel header |
| `--density-header-h` | 56px | Top header |
| `--density-sidebar-w` | 240px | Sidebar width |
| `--density-table-head-h` | 32px | Table header row |

## Layout

| Token | Value | Usage |
|---|---|---|
| `--layout-page-px` | 24px | Page horizontal gutter |
| `--layout-sidebar-w` | 240px | Sidebar width |

## Spacing

| Token | Value |
|---|---|
| `--spacing-1` | 2px |
| `--spacing-2` | 4px |
| `--spacing-3` | 8px |
| `--spacing-4` | 12px |
| `--spacing-5` | 16px |
| `--spacing-6` | 20px |
| `--spacing-7` | 24px |
| `--spacing-8` | 28px |

## Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 6px | Controls, inputs, icon buttons |
| `--radius-md` | 8px | Cards, panels |
| `--radius-lg` | 10px | Modals, drawers |
| `--radius-badge` | 4px | Badges/chips |
| `--radius-pill` | 999px | Pills |

## Shadow

| Token | Value | Usage |
|---|---|---|
| `--shadow-popover` | `0 4px 16px rgba(0,0,0,0.40)` | Popovers, dropdowns |

## Motion

| Token | Value | Usage |
|---|---|---|
| `--transition-duration-instant` | 150ms | Micro interactions |
| `--transition-duration-fast` | 200ms | Hover, focus |
| `--transition-timing-function-default` | `cubic-bezier(0.4,0,0.2,1)` | Default ease |

## ECharts colors (mirrored for canvas)

| Token | Value | Usage |
|---|---|---|
| `--chart-series-baseline` | `#64748B` | Baseline series |
| `--chart-series-onnx` | `#6366F1` | ONNX series |
| `--chart-series-int8` | `#06B6D4` | INT8 / model slice |
| `--chart-series-accent-strong` | `#818CF8` | Hover/emphasis |
| `--chart-grid` | `rgba(255,255,255,0.05)` | Chart gridlines |
| `--chart-axis` | `#8292A8` | Axis labels |
| `--chart-axis-line` | `rgba(255,255,255,0.08)` | Axis lines |
| `--chart-bar-track` | `rgba(255,255,255,0.04)` | Bar track when needed |
| `--chart-donut-track` | `#334155` | Donut remainder slice |
| `--chart-tooltip-bg` | `#27324A` | Tooltip background |
| `--chart-tooltip-border` | `rgba(255,255,255,0.10)` | Tooltip border |

## Z-index scale

| Token | Value | Usage |
|---|---|---|
| `--z-base` | 0 | Default |
| `--z-sticky` | 10 | Sticky headers |
| `--z-header` | 100 | Top header |
| `--z-overlay` | 1000 | Backdrop |
| `--z-tooltip` | 1100 | Tooltips / ECharts tooltip |

## Compact density mode (optional)

When `data-density="compact"` is applied to `<html>`:

| Token | Value |
|---|---|
| `--density-row-h` | 32px |
| `--density-card-pad` | 12px |
| `--density-card-gap` | 10px |
| `--density-kpi-h` | 108px |
| `--density-widget-head-h` | 38px |
| `--density-table-head-h` | 28px |
| `--layout-page-px` | 16px |
| `--font-size-base` | 12px |

## Prohibited patterns

- Gradients, glows, neon, pastel fills.
- Shadows above 8px blur.
- Text below 10px (badges are the only 10px exception).
- Hex literals not listed above.
