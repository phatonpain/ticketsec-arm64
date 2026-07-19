// @vitest-environment jsdom
/**
 * M3 — Event Log hygiene: deduplication, unread count, level badge.
 */
import '@testing-library/jest-dom/vitest';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enableActEnvironment } from '../flows/testUtils';

enableActEnvironment();

async function freshEventLog() {
  vi.resetModules();
  const mod = await import('../../src/hooks/useEventLog');
  return mod;
}

describe('useEventLog deduplication', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('collapses consecutive identical (level, message) entries into one entry with a ×N badge', async () => {
    const { useEventLog } = await freshEventLog();
    const { result } = renderHook(() => useEventLog());
    const initialLength = result.current.logs.length;

    act(() => {
      result.current.addError('Metrics endpoint unreachable — retrying with backoff');
      result.current.addError('Metrics endpoint unreachable — retrying with backoff');
      result.current.addError('Metrics endpoint unreachable — retrying with backoff');
    });

    const added = result.current.logs.length - initialLength;
    expect(added).toBe(1);
    expect(result.current.logs[0].count).toBe(3);
  });

  it('does not collapse entries when level or message differs', async () => {
    const { useEventLog } = await freshEventLog();
    const { result } = renderHook(() => useEventLog());
    const initialLength = result.current.logs.length;

    act(() => {
      result.current.addError('Metrics endpoint unreachable — retrying with backoff');
      result.current.addDebug('Health probe still failing (2 consecutive): TypeError');
      result.current.addError('Metrics endpoint unreachable — retrying with backoff');
    });

    const added = result.current.logs.length - initialLength;
    expect(added).toBe(3);
    expect(result.current.logs[0].count).toBe(1);
  });

  it('unread count reflects real entries, not duplicated occurrences', async () => {
    const { useEventLog } = await freshEventLog();
    const { result } = renderHook(() => useEventLog());
    const before = result.current.unreadCount;

    act(() => {
      result.current.addInfo('Cached ticket snapshot loaded');
      result.current.addInfo('Cached ticket snapshot loaded');
    });

    expect(result.current.unreadCount).toBe(before + 1);
    expect(result.current.logs[0].count).toBe(2);
  });

  it('markAllRead resets unread count to zero', async () => {
    const { useEventLog } = await freshEventLog();
    const { result } = renderHook(() => useEventLog());

    act(() => result.current.addInfo('An event'));
    expect(result.current.unreadCount).toBeGreaterThan(0);

    act(() => result.current.markAllRead());
    expect(result.current.unreadCount).toBe(0);
  });
});
