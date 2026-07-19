// @vitest-environment jsdom
/**
 * useApiBackoff.test.tsx (v2) — the REAL backoff in useApi.ts.
 *
 * Pass-1 assumed src/lib/backoff.ts (createBackoff with injected RNG jitter).
 * Reality (useApi.ts:105-111, 345-351):
 *   - online re-checks every ONLINE_RECHECK_MS (30s)
 *   - offline retries use createBackoff({ baseMs: 5_000, maxMs: 60_000 })
 *     with full jitter
 *   - consecutive failures are tracked by the backoff instance itself
 *
 * Probes per checkHealth round: 3 (/health, /, /docs — runHealthProbe:216).
 * With a FRESH module (per-test vi.resetModules + dynamic import; React and
 * other node_modules deps are externalized by vitest, so they stay single):
 *   Math.random stubbed to 0.5 makes full-jitter delays deterministic:
 *   t=0     mount      → 3 calls
 *   t=2.5s  1st retry  → 6 calls (delay = 0.5 × 5_000)
 *   t=7.5s  2nd retry  → 9 calls (delay = 0.5 × 10_000)
 *   t=17.5s 3rd retry  → 12 calls (delay = 0.5 × 20_000)
 *   t=37.5s 4th retry  → 15 calls (delay = 0.5 × 40_000)
 *   t=67.5s cap        → 18 calls (delay = 0.5 × 60_000)
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableActEnvironment, networkError } from '../flows/testUtils';

enableActEnvironment();

const S = 1_000;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Fresh useApi module per test (clean singleton counters/timers).
 *  Backoff jitter uses Math.random; stub it to 0.5 so the schedule is
 *  deterministic (full jitter → delay = 0.5 × cappedDelay).
 */
async function freshApi() {
  vi.resetModules();
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  return import('../../src/hooks/useApi');
}

describe('probe timeout — settles (refutes "never settles"; refines FIX-01)', () => {
  it('a hanging fetch is aborted at 10s and the probe lock is released', async () => {
    const { checkHealth } = await freshApi();
    const signals: AbortSignal[] = [];
    // Faithful hang: never settles on its own, rejects on abort (browser semantics).
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.signal) signals.push(init.signal);
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError')),
          );
        });
      }),
    );

    const first = checkHealth();
    expect(signals).toHaveLength(3);
    expect(signals.every((s) => !s.aborted)).toBe(true);

    await vi.advanceTimersByTimeAsync(10 * S);
    await first; // settles — refutes the pass-1 "probe never settles" guess
    expect(signals.every((s) => s.aborted)).toBe(true); // AbortController fired

    // Lock released → a second probe round starts immediately (3 more calls).
    const secondMock = vi.fn(() => networkError());
    vi.stubGlobal('fetch', secondMock);
    await checkHealth();
    expect(secondMock).toHaveBeenCalledTimes(3);
  });
});

describe('auto-recovery backoff schedule — real, deterministic (jitter stubbed)', () => {
  it('probe rounds land at 2.5s, 7.5s, 17.5s, 37.5s, 67.5s (0.5×5s/10s/20s/40s/60s)', async () => {
    const { useApi } = await freshApi();
    const fetchMock = vi.fn(() => networkError());
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useApi());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0); // flush mount probe microtasks
    });
    expect(fetchMock).toHaveBeenCalledTimes(3); // mount: immediate checkHealth

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_500);
    });
    expect(fetchMock).toHaveBeenCalledTimes(6); // 1st retry: 0.5 × 5_000

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(9); // 2nd retry: 0.5 × 10_000

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(12); // 3rd retry: 0.5 × 20_000

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(15); // 4th retry: 0.5 × 40_000

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(18); // cap: 0.5 × 60_000
  });

  it('does not probe again before the jittered backoff elapses', async () => {
    const { useApi } = await freshApi();
    const fetchMock = vi.fn(() => networkError());
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useApi());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_499);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3); // still only the mount round
  });
});
