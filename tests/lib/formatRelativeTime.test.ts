/**
 * formatRelativeTime.test.ts (v2) — REAL target: src/lib/formatRelativeTime.ts.
 *
 * Real signature: formatRelativeTime(date: Date): string — the clock is NOT
 * injected (reads `new Date()` internally, line 2). Pass-1 assumed an injected
 * clock and a seconds bucket ("45s ago"); the real buckets are:
 *   < 60s  → 'just now'          (line 5)
 *   < 60m  → `${m}m ago`         (line 7)
 *   < 24h  → `${h}h ago`         (line 9)
 *   ≥ 24h  → `${d}d ago`         (line 11)
 * Future timestamps (clock skew) fall into the <60s bucket → 'just now' ✓.
 *
 * Boundary safety: offsets are computed from Date.now() at call time and kept
 * ≥1s away from bucket edges so a mid-test clock tick cannot flip a bucket.
 */

import { describe, expect, it } from 'vitest';

import { formatRelativeTime } from '../../src/lib/formatRelativeTime';

const S = 1_000;
const M = 60 * S;
const H = 60 * M;
const D = 24 * H;

const ago = (ms: number): Date => new Date(Date.now() - ms);

describe('formatRelativeTime — real buckets', () => {
  it('0ms and 30s → "just now" (< 60s bucket)', () => {
    expect(formatRelativeTime(ago(0))).toBe('just now');
    expect(formatRelativeTime(ago(30 * S))).toBe('just now');
  });

  it('61s and 2m → minutes bucket', () => {
    expect(formatRelativeTime(ago(61 * S))).toBe('1m ago');
    expect(formatRelativeTime(ago(2 * M))).toBe('2m ago'); // evidenced UI copy "2m ago"
  });

  it('59m30s → "59m ago" (upper minutes region)', () => {
    expect(formatRelativeTime(ago(59 * M + 30 * S))).toBe('59m ago');
  });

  it('61m and 5h → hours bucket', () => {
    expect(formatRelativeTime(ago(61 * M))).toBe('1h ago');
    expect(formatRelativeTime(ago(5 * H))).toBe('5h ago');
  });

  it('23h30m → "23h ago"; 25h and 3d → days bucket', () => {
    expect(formatRelativeTime(ago(23 * H + 30 * M))).toBe('23h ago');
    expect(formatRelativeTime(ago(25 * H))).toBe('1d ago');
    expect(formatRelativeTime(ago(3 * D))).toBe('3d ago');
  });
});

describe('formatRelativeTime — clock skew (future timestamps)', () => {
  it('small and large future skews → "just now" (never negative)', () => {
    expect(formatRelativeTime(ago(-5 * S))).toBe('just now');
    expect(formatRelativeTime(ago(-3 * D))).toBe('just now');
  });
});

describe('formatRelativeTime — invalid input (EXPOSED defect)', () => {
  // Real code (line 3-11): NaN diff fails every `<` comparison and falls
  // through to `${NaN}d ago`. Confirmed by reading the source; the em dash
  // "—" is the app's established unknown-value convention (App.tsx:85 '—').
  it(
    'EXPOSED-01: invalid Date returns "—" (formatRelativeTime.ts)',
    () => {
      expect(formatRelativeTime(new Date(Number.NaN))).toBe('—');
    },
  );

  it(
    'EXPOSED-01: unparsable date string returns "—"',
    () => {
      expect(formatRelativeTime(new Date('not a date'))).toBe('—');
    },
  );

  it('documents the fixed output for invalid input', () => {
    expect(formatRelativeTime(new Date(Number.NaN))).toBe('—');
  });
});
