/**
 * fixpack-v2 — applies: FIX-02, FIX-03, FIX-15, FIX-19.
 * Original: src/lib/utils.ts (85 lines).
 *
 * Changes vs original:
 *  - CATEGORY_BG: 6 raw pastel rgba() literals → var(--color-cat-{1..6}-bg)
 *    (defined in the patched tokens.css; kills the raw-rgba leak, FIX-19).
 *  - CATEGORY_COLORS: unchanged references (var(--cat-N)) — the patched
 *    tokens.css now defines those aliases (FIX-03 root cause was: they were
 *    referenced but never defined → badge text painted fallback white).
 *  - SEVERITY_COLORS: 'info' key mapped var(--sev-info) → var(--sev-low);
 *    --sev-info does not exist in the canonical token set (FIX-02).
 *  - STATUS_COLORS: raw rgba + off-palette hex text (#5EEA9A neon-mint AA-fail,
 *    #F43F5E 3.57:1 AA-fail) → var(--status-{resolved)
 *    (FIX-15; every fg is ≥4.5:1 on its bg over card).
 *  - REMOVED generateTicketId() (dead code — zero call sites; real IDs come
 *    from the monotonic counter in src/hooks/useTickets.ts).
 *  - cn/truncate/extractLatencySeries/extractThroughputSeries unchanged.
 */

import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Canonical category order (1 Phishing … 6 False Positive). Exported so every
 * panel iterates categories in the same sequence as the token palette.
 */
export const CATEGORY_ORDER: readonly string[] = [
  'Phishing',
  'Malware',
  'Data Breach',
  'Unauthorized Access',
  'DDoS',
  'False Positive',
];

/**
 * Categorical palette mapped to CSS tokens --cat-1..6 (text/dot, 400-level).
 * Same category = same color in table badges, bar chart, and donut.
 * Order: 1 Phishing, 2 Malware, 3 Data Breach, 4 Unauthorized Access,
 *        5 DDoS, 6 False Positive.
 */
export const CATEGORY_COLORS: Record<string, string> = {
  Phishing: 'var(--cat-1)',
  Malware: 'var(--cat-2)',
  'Data Breach': 'var(--cat-3)',
  'Unauthorized Access': 'var(--cat-4)',
  DDoS: 'var(--cat-5)',
  'False Positive': 'var(--cat-6)',
};

/** Badge background tints — tokens, not literals (FIX-19). */
export const CATEGORY_BG: Record<string, string> = {
  Phishing: 'var(--color-cat-1-bg)',
  Malware: 'var(--color-cat-2-bg)',
  'Data Breach': 'var(--color-cat-3-bg)',
  'Unauthorized Access': 'var(--color-cat-4-bg)',
  DDoS: 'var(--color-cat-5-bg)',
  'False Positive': 'var(--color-cat-6-bg)',
};

/**
 * Category → severity mapping for the dense classification table.
 */
export const CATEGORY_SEVERITY: Record<string, 'critical' | 'high' | 'medium' | 'info'> = {
  Phishing: 'critical',
  Malware: 'critical',
  'Data Breach': 'critical',
  'Unauthorized Access': 'high',
  DDoS: 'medium',
  'False Positive': 'info',
};

export const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  info: 'Low',
};

/**
 * Severity dot colors. 'info' rows use the canonical --sev-low token
 * (no --sev-info exists; previously the var() stayed unresolved → the
 * severity column painted invisible dots, FIX-02).
 */
export const SEVERITY_COLORS: Record<string, string> = {
  critical: 'var(--sev-critical)',
  high: 'var(--sev-high)',
  medium: 'var(--sev-medium)',
  info: 'var(--sev-low)',
};

/** Status badge fg/bg token pairs — AA-measured in tokens.css (FIX-15). */
export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Resolved: { bg: 'var(--status-resolved-bg)', text: 'var(--status-resolved-fg)' },
  Escalated: { bg: 'var(--status-escalated-bg)', text: 'var(--status-escalated-fg)' },
  Pending: { bg: 'var(--status-pending-bg)', text: 'var(--status-pending-fg)' },
};

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function truncate(str: string, max: number): string {
  const chars = Array.from(str);
  if (chars.length <= max) return str;
  return chars.slice(0, max - 1).join('') + '…';
}

import type { PerformancePoint } from '../hooks/useApi';

export function extractLatencySeries(data: PerformancePoint[]): number[] {
  return data.map(p => p.latency_ms ?? 0).filter(v => v > 0);
}

export function extractThroughputSeries(data: PerformancePoint[]): number[] {
  return data.map(p => p.throughput ?? 0).filter(v => v > 0);
}
