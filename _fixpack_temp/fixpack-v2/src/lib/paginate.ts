/**
 * NEW FILE (fixpack-v2) — applies: FIX-28.
 * Justification for adding: single pure owner for pagination math so the row
 * slice, the "Showing x–y of z" summary and the Previous/Next disabled flags
 * can never drift apart (and the page clamps after filtering). Zero deps.
 */

export interface PageResult<T> {
  readonly items: readonly T[];
  /** 1-based, clamped into [1, pageCount]. */
  readonly page: number;
  readonly pageCount: number;
  readonly total: number;
  /** 1-based index of first visible row, 0 when total === 0. */
  readonly from: number;
  /** 1-based index of last visible row, 0 when total === 0. */
  readonly to: number;
  readonly hasPrev: boolean;
  readonly hasNext: boolean;
}

export function paginate<T>(all: readonly T[], requestedPage: number, pageSize: number): PageResult<T> {
  const total = all.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  return {
    items: all.slice(start, end),
    page,
    pageCount,
    total,
    from: total === 0 ? 0 : start + 1,
    to: end,
    hasPrev: page > 1,
    hasNext: page < pageCount,
  };
}

export function pageSummary(result: PageResult<unknown>): string {
  return result.total === 0 ? 'No results' : `Showing ${result.from}–${result.to} of ${result.total}`;
}
