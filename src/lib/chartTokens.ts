/**
 * fixpack-v2 — applies: FIX-03, FIX-12 (also feeds FIX-02 severity scale).
 * Original: src/lib/chartTokens.ts (62 lines).
 *
 * Static hex colors for ECharts canvas / SVG attribute rendering (canvas and
 * SVG presentation attributes cannot resolve var(); these mirror the semantic
 * tokens in src/styles/tokens.css — keep in sync; tokens.css stays the single
 * source of truth).
 *
 * Changes vs original:
 *  - cat1..6: pastel 400-level (#818cf8/#22d3ee/#fbbf24/#f87171/#a78bfa/#94a3b8)
 *    → muted 600-level enterprise set (#6366F1/#0891B2/#D97706/#E11D48/#7C3AED/#64748B),
 *    mirrors --color-cat-1..6. False Positive = slate, not pink (binding decision).
 *  - ADDED catText1..6 (400-level, AA on badge tints) mirroring --color-cat-*-text.
 *  - sevCritical/High/Medium/Low: aligned to the canonical severity scale
 *    (#F43F5E/#F97316/#F59E0B/#38BDF8); sevInfo kept as legacy alias of sevLow.
 *  - modelInt8 (donut model slice): #6366F1 → #06B6D4 (emphasis on the model
 *    slice, the actual story); tokenizerConfig renamed semantic: headroom slice
 *    now uses quiet donutTrack #334155 (was loud violet #8B5CF6).
 *  - ADDED chart chrome mirrors: grid, axisLine, barTrack, donutTrack,
 *    tooltipBg, tooltipBorder, accentStrong (hover/emphasis only).
 *  - KEPT every original export name (chartColors, categoryChartColors,
 *    severityChartColors) so existing chart components compile unchanged.
 */

export const chartColors = {
  // Performance line series (mirrors --chart-series-*)
  baseline: '#64748B',
  onnx: '#6366F1',
  int8: '#06B6D4',
  accentStrong: '#818CF8', // hover/emphasis only (mirrors --chart-series-accent-strong)
  indigoStrongHover: '#4338CA', // mirrors --color-accent-indigo-strong-hover

  // Model footprint donut (mirrors --color-accent-cyan / --chart-donut-track)
  modelInt8: '#06B6D4',
  baselineFp32: '#64748B',
  tokenizerConfig: '#8B5CF6', // legacy key, retained for import compatibility
  donutTrack: '#334155',

  // Categorical palette — 600-level, muted (mirrors --color-cat-1..6)
  // Order: 1 Phishing, 2 Malware, 3 Data Breach, 4 Unauthorized Access,
  //        5 DDoS, 6 False Positive (slate — neutral, reads as non-threat)
  cat1: '#6366F1',
  cat2: '#0891B2',
  cat3: '#D97706',
  cat4: '#E11D48',
  cat5: '#7C3AED',
  cat6: '#64748B',

  // 400-level text variants (mirrors --color-cat-*-text; AA on badge tints)
  catText1: '#A5B4FC', // FIXED: was #818CF8 — contrast on tint/card now 7.34:1
  catText2: '#22D3EE',
  catText3: '#FBBF24',
  catText4: '#FB7185',
  catText5: '#A78BFA',
  catText6: '#94A3B8',

  // Severity palette (mirrors --color-sev-*)
  sevCritical: '#FB7185', // FIXED: was #F43F5E — contrast on card now 5.44:1
  sevHigh: '#F97316',
  sevMedium: '#F59E0B',
  sevLow: '#38BDF8',
  sevInfo: '#38BDF8', // legacy alias of sevLow

  // Chart chrome (mirrors --chart-*)
  grid: 'rgba(255, 255, 255, 0.05)',
  axisLine: 'rgba(255, 255, 255, 0.08)',
  barTrack: 'rgba(255, 255, 255, 0.04)',
  tooltipBg: '#27324A',
  tooltipBorder: 'rgba(255, 255, 255, 0.10)',

  // Text / utility (mirrors --color-text-* / --color-bg-card)
  textPrimary: '#F8FAFC',
  textMuted: '#8292A8',
  cardBg: '#1E293B',
} as const;

/**
 * Ordered array for charts that need a consistent categorical sequence.
 * Same category = same color in table badges, bar chart, and donut.
 */
export const categoryChartColors = [
  chartColors.cat1,
  chartColors.cat2,
  chartColors.cat3,
  chartColors.cat4,
  chartColors.cat5,
  chartColors.cat6,
] as const;

/**
 * Severity palette as an ordered array (critical → low).
 */
export const severityChartColors = [
  chartColors.sevCritical,
  chartColors.sevHigh,
  chartColors.sevMedium,
  chartColors.sevLow,
] as const;
