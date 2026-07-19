/**
 * utils.test.ts (v2) — REAL target: src/lib/utils.ts (the only "pure" lib
 * module besides exportCsv/formatRelativeTime; there is NO sort.ts/filter.ts/
 * fuzzy.ts/ids.ts/backoff.ts in the real tree).
 *
 * Covers: CATEGORY_COLORS / CATEGORY_BG / CATEGORY_SEVERITY / SEVERITY_LABEL /
 * SEVERITY_COLORS / STATUS_COLORS key systems, truncate, formatNumber,
 * extractLatencySeries / extractThroughputSeries, cn, generateTicketId.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CATEGORY_BG,
  CATEGORY_COLORS,
  CATEGORY_SEVERITY,
  SEVERITY_COLORS,
  SEVERITY_LABEL,
  STATUS_COLORS,
  cn,
  extractLatencySeries,
  extractThroughputSeries,
  formatNumber,
  generateTicketId,
  truncate,
} from '../../src/lib/utils';
import type { PerformancePoint } from '../../src/hooks/useApi';
import { CATEGORIES, STATUSES } from './fixtures';

describe('category/severity/status key systems', () => {
  it('CATEGORY_COLORS + CATEGORY_BG cover exactly the six spec categories', () => {
    expect(Object.keys(CATEGORY_COLORS).sort()).toEqual([...CATEGORIES].sort());
    expect(Object.keys(CATEGORY_BG).sort()).toEqual([...CATEGORIES].sort());
  });

  it('CATEGORY_SEVERITY covers exactly the six categories with the real mapping', () => {
    expect(Object.keys(CATEGORY_SEVERITY).sort()).toEqual([...CATEGORIES].sort());
    // Real mapping (utils.ts:32-39) — severity is DERIVED from category.
    expect(CATEGORY_SEVERITY.Phishing).toBe('critical');
    expect(CATEGORY_SEVERITY.Malware).toBe('critical');
    expect(CATEGORY_SEVERITY['Data Breach']).toBe('critical');
    expect(CATEGORY_SEVERITY['Unauthorized Access']).toBe('high');
    expect(CATEGORY_SEVERITY.DDoS).toBe('medium');
    expect(CATEGORY_SEVERITY['False Positive']).toBe('info');
  });

  it('SEVERITY_LABEL/SEVERITY_COLORS cover every severity rank used', () => {
    for (const sev of Object.values(CATEGORY_SEVERITY)) {
      expect(SEVERITY_LABEL[sev]).toBeTruthy();
      expect(SEVERITY_COLORS[sev]).toBeTruthy();
    }
    expect(Object.keys(SEVERITY_LABEL).sort()).toEqual(['critical', 'high', 'info', 'medium']);
  });

  it('STATUS_COLORS covers exactly the three real TicketStatus values', () => {
    expect(Object.keys(STATUS_COLORS).sort()).toEqual([...STATUSES].sort());
    for (const s of STATUSES) {
      expect(STATUS_COLORS[s].bg).toBeTruthy();
      expect(STATUS_COLORS[s].text).toBeTruthy();
    }
  });
});

describe('truncate', () => {
  it('returns short strings unchanged (incl. exact boundary)', () => {
    expect(truncate('abc', 3)).toBe('abc');
    expect(truncate('ab', 3)).toBe('ab');
  });
  it('truncates to max-1 chars + ellipsis', () => {
    expect(truncate('abcdef', 4)).toBe('abc…');
    expect(truncate('abcdef', 4)).toHaveLength(4);
  });
  it('BMP unicode (accents, CJK) truncates cleanly', () => {
    expect(truncate('Évasion détectée', 8)).toBe('Évasion…');
  });

  it.fails(
    'EXPOSED-04: truncate slices UTF-16 code units — splits surrogate pairs into mojibake on astral chars (utils.ts:66-67)',
    () => {
      // '🚨' is 2 UTF-16 units; slice(0, 3) keeps 1.5 emoji → lone surrogate.
      expect(truncate('🚨🚨🚨🚨🚨', 4)).toBe('🚨🚨🚨…');
    },
  );
});

describe('formatNumber', () => {
  it('formats with en-US grouping', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(0)).toBe('0');
  });
});

describe('chart series extractors', () => {
  const point = (latency_ms?: number, throughput?: number): PerformancePoint => ({
    time: '2026-07-17T13:00:00Z',
    baseline: 0,
    onnx: 0,
    int8: 0,
    latency_ms,
    throughput,
  });

  it('extractLatencySeries keeps positive values in order, drops 0/undefined', () => {
    // NOTE: zeros are dropped (utils.ts:81) — a real 0ms sample would vanish
    // from the sparkline. Pinned as current behavior.
    expect(extractLatencySeries([point(12), point(0), point(undefined), point(7)])).toEqual([12, 7]);
  });
  it('extractThroughputSeries keeps positive values in order, drops 0/undefined', () => {
    expect(extractThroughputSeries([point(undefined, 100), point(5, 0), point(1)])).toEqual([100]);
  });
  it('empty input → empty series', () => {
    expect(extractLatencySeries([])).toEqual([]);
    expect(extractThroughputSeries([])).toEqual([]);
  });
});

describe('cn (clsx wrapper)', () => {
  it('joins truthy class values', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });
});

describe('generateTicketId (EXPOSED defects — dead code, utils.ts:70-76)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('produces the TKT-#### shape', () => {
    expect(generateTicketId()).toMatch(/^TKT-\d{4}$/);
  });

  it.fails(
    'EXPOSED-02: not unique — constant RNG yields duplicate ids (Math.random 4-digit space, ~1/9000 collision per draw)',
    () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const a = generateTicketId();
      const b = generateTicketId();
      expect(new Set([a, b]).size).toBe(2); // real code: both are TKT-1500
    },
  );

  it.fails(
    'EXPOSED-02: not monotonic — descending RNG draws yield descending ids',
    () => {
      const spy = vi.spyOn(Math, 'random');
      spy.mockReturnValueOnce(0.9).mockReturnValueOnce(0.1);
      const a = generateTicketId(); // TKT-1900
      const b = generateTicketId(); // TKT-1100
      expect(a < b).toBe(true); // real code: TKT-1900 > TKT-1100
    },
  );

  it('documents that generateTicketId is dead code (no caller in src/)', () => {
    // Verified by grep: the only reference is its own definition. The live ID
    // path is the monotonic counter in useTickets.ts (see hooks/useTickets.test.ts).
    expect(typeof generateTicketId).toBe('function');
  });
});
