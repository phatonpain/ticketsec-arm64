/**
 * NEW FILE (fixpack-v2) — applies: FIX-26.
 * Justification for adding: the "Last 24 hours" listbox needs one pure filter
 * applied IDENTICALLY to live rows and the cached snapshot (Honesty Contract:
 * the control keeps working offline and says so). Zero dependencies.
 *
 * Options match the existing Header listbox (src/components/Header.tsx).
 */

export type TimeRange = '1h' | '6h' | '24h' | '7d';

export const TIME_RANGES: readonly TimeRange[] = ['1h', '6h', '24h', '7d'];

export const TIME_RANGE_LABEL: Record<TimeRange, string> = {
  '1h': 'Last 1 hour',
  '6h': 'Last 6 hours',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
};

export const DEFAULT_TIME_RANGE: TimeRange = '24h';

const RANGE_MS: Record<TimeRange, number> = {
  '1h': 3_600_000,
  '6h': 21_600_000,
  '24h': 86_400_000,
  '7d': 604_800_000,
};

/**
 * Pure filter — applied to live tickets AND the cached snapshot through the
 * same code path. `createdAt` accepts Date or epoch ms.
 */
export function filterByTimeRange<T extends { readonly createdAt: Date | number }>(
  items: readonly T[],
  range: TimeRange,
  now: number = Date.now(),
): T[] {
  const cutoff = now - RANGE_MS[range];
  return items.filter(item => {
    const ts = item.createdAt instanceof Date ? item.createdAt.getTime() : item.createdAt;
    return ts >= cutoff;
  });
}
