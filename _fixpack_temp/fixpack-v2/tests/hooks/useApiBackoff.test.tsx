// @vitest-environment jsdom
/**
 * useApiBackoff.test.tsx (v2) — the REAL backoff, inline in useApi.ts.
 *
 * Pass-1 assumed src/lib/backoff.ts (createBackoff with injected RNG jitter).
 * Reality (useApi.ts:208-215):
 *   delay = BASE_RECOVERY_INTERVAL_MS (30s) × min(2^consecutiveFailures, 10)
 *   consecutiveFailures capped at 6 (line 185) → effective cap 10× → 300s
 *   NO jitter (deterministic), NO exported factory — so the schedule is
 *   tested through observable probe timing with fake timers.
 *
 * Probes per checkHealth round: 3 (/health, /, /docs — runHealthProbe:158).
 * With a FRESH module (per-test vi.resetModules + dynamic import; React and
 * other node_modules deps are externalized by vitest, so they stay single):
 *   t=0 mount → 3 · t=30s → 6 · t=150s → 9 · t=390s → 12 · t=690s → 15 · t=990s → 18
 *
 * This suite ALSO refutes the pass-1 FIX-01 root-cause guess: the probe DOES
 * settle — a hanging fetch is aborted at HEALTH_TIMEOUT_MS=10s (lines
 * 127-136) and isProbing is released. The stuck "Checking…" pill is the
 * store-identity bail-out (storeIdentity.test.tsx), not a hung probe.
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

/** Fresh useApi module per test (clean singleton counters/timers). */
async function freshApi() {
  vi.resetModules();
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

describe('auto-recovery backoff schedule — real, deterministic (no jitter)', () => {
  it('probe rounds land at 30s, 150s, 390s, 690s, 990s (30s×1,4,8,10,10 after the first)', async () => {
    const { useApi } = await freshApi();
    const fetchMock = vi.fn(() => networkError());
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useApi());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0); // flush mount probe microtasks
    });
    expect(fetchMock).toHaveBeenCalledTimes(3); // mount: immediate checkHealth

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * S);
    });
    expect(fetchMock).toHaveBeenCalledTimes(6); // 1st recovery: 30s × min(2^0,10)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120 * S);
    });
    expect(fetchMock).toHaveBeenCalledTimes(9); // failures=2 → ×4 = 120s

    await act(async () => {
      await vi.advanceTimersByTimeAsync(240 * S);
    });
    expect(fetchMock).toHaveBeenCalledTimes(12); // failures=3 → ×8 = 240s

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300 * S);
    });
    expect(fetchMock).toHaveBeenCalledTimes(15); // failures=4 → ×16→capped 10 = 300s

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300 * S);
    });
    expect(fetchMock).toHaveBeenCalledTimes(18); // cap holds: every 300s thereafter
  });

  it('does not probe again before the backoff elapses', async () => {
    const { useApi } = await freshApi();
    const fetchMock = vi.fn(() => networkError());
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useApi());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_999);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3); // still only the mount round
  });
});
