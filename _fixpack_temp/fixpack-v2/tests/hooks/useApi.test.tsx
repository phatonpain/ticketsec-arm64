// @vitest-environment jsdom
/**
 * useApi.test.tsx (v2) — REAL target: src/hooks/useApi.ts.
 *
 * Pass-1 assumed src/lib/backoff.ts (createBackoff); the real backoff lives
 * inline in scheduleNextProbe (lines 208-215) — covered in
 * hooks/useApiBackoff.test.tsx. THIS suite covers the exported API surface:
 * probeApiBase / checkHealth / predict / getStats / getPerformance /
 * getClassifications — with the Honesty Contract front and center.
 *
 * Reading store state: the useApi store is a mutated singleton whose
 * getSnapshot returns the same object (see storeIdentity.test.tsx), so
 * subscribers don't re-render on emit. State is therefore read through a
 * FRESH renderHook mount — the initial render always reads the current store.
 * (Mount side effect — one checkHealth + auto-recovery arm — is harmless to
 * these assertions and jsdom teardown clears the timers.)
 *
 * Test order is significant (module singleton): checkHealth-offline runs
 * BEFORE any cache fill; predict-success runs LAST.
 */

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  checkHealth,
  getClassifications,
  getPerformance,
  getStats,
  predict,
  probeApiBase,
  useApi,
  type CategoryStats,
  type PerformancePoint,
} from '../../src/hooks/useApi';
import {
  enableActEnvironment,
  installFetchMock,
  jsonResponse,
  networkError,
  type FetchMock,
} from '../flows/testUtils';

enableActEnvironment();

const BASE = 'http://3.23.60.61:8000'; // real default (useSettings.ts:4)

let fetchMock: FetchMock;

beforeEach(() => {
  fetchMock = installFetchMock(() => networkError());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Current store state via a fresh hook mount (initial render reads store). */
function currentApiState() {
  const { result } = renderHook(() => useApi());
  return result.current;
}

describe('probeApiBase — three-endpoint health probe (S6: /health, /, /docs)', () => {
  it('probes /health, / and /docs under the given base', async () => {
    await probeApiBase(BASE);
    expect(fetchMock.calls).toEqual([`${BASE}/health`, `${BASE}/`, `${BASE}/docs`]);
  });

  it('all endpoints failing → ok:false with the first failure error surfaced', async () => {
    const result = await probeApiBase(BASE);
    expect(result.ok).toBe(false);
    expect(result.endpoints).toHaveLength(3);
    expect(result.endpoints.every((e) => !e.ok)).toBe(true);
    // Real code surfaces err.name (useApi.ts:153) — 'TypeError' for a network
    // failure. Raw, but honest (copy is FIX-23 territory; pinned as-is).
    expect(result.error).toBe('TypeError');
  });

  it('any single healthy endpoint → online (ok:true)', async () => {
    fetchMock.setHandler((url) =>
      url.endsWith('/health') ? Promise.resolve(jsonResponse({ status: 'ok' })) : networkError(),
    );
    const result = await probeApiBase(BASE);
    expect(result.ok).toBe(true);
    expect(result.error).toBeNull();
    expect(result.endpoints.find((e) => e.ok)?.url).toBe(`${BASE}/health`);
  });

  it('HTTP 500 on all → ok:false with "HTTP 500" errors', async () => {
    fetchMock.setHandler(() => Promise.resolve(jsonResponse({}, 500)));
    const result = await probeApiBase(BASE);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('HTTP 500');
  });
});

describe('checkHealth — offline honesty (no cache yet)', () => {
  it('failed probe → status "offline" (NOT "cached"), diagnostics populated', async () => {
    await checkHealth();
    const state = currentApiState();
    expect(state.status).toBe('offline'); // hasAnyCache() === false → offline (useApi.ts:122)
    expect(state.checking).toBe(false); // the probe DID settle (10s timeout exists)
    expect(state.diagnostics.lastProbe).toBeInstanceOf(Date);
    expect(state.diagnostics.endpoints).toHaveLength(3);
    expect(state.diagnostics.lastError).toBe('TypeError');
  });

  it('concurrent checkHealth calls are guarded (isProbing, useApi.ts:175)', async () => {
    await Promise.all([checkHealth(), checkHealth(), checkHealth()]);
    expect(fetchMock.calls).toHaveLength(3); // one probe round, not three
  });
});

describe('data getters — cache fallback honesty', () => {
  const STATS: CategoryStats[] = [
    { category: 'Phishing', count: 12 },
    { category: 'DDoS', count: 3 },
  ];
  const PERF: PerformancePoint[] = [
    { time: '2026-07-17T13:00:00Z', baseline: 40, onnx: 12, int8: 8, latency_ms: 8.2, throughput: 120 },
  ];

  it('empty cache + failure → empty arrays, never fabricated data', async () => {
    await expect(getStats()).resolves.toEqual([]);
    await expect(getPerformance()).resolves.toEqual([]);
    await expect(getClassifications()).resolves.toEqual([]);
  });

  it('successful fetch fills the cache; later failure serves the CACHED copy', async () => {
    fetchMock.setHandler((url) => {
      if (url.includes('/api/v1/stats/categories')) return Promise.resolve(jsonResponse(STATS));
      if (url.includes('/api/v1/performance/history')) return Promise.resolve(jsonResponse(PERF));
      return networkError();
    });
    await expect(getStats()).resolves.toEqual(STATS);
    await expect(getPerformance()).resolves.toEqual(PERF);

    fetchMock.setHandler(() => networkError());
    await expect(getStats()).resolves.toEqual(STATS); // cached fallback (useApi.ts:263)
    await expect(getPerformance()).resolves.toEqual(PERF);
    await expect(getClassifications()).resolves.toEqual([]); // never succeeded → still empty
  });

  it('with cache present, a failed probe flips status to "cached" (amber CACHED state)', async () => {
    await checkHealth();
    expect(currentApiState().status).toBe('cached'); // useApi.ts:122
  });
});

describe('predict — classify path honesty', () => {
  it('POSTs { text } to <base>/predict', async () => {
    fetchMock.setHandler((url) =>
      url.endsWith('/predict')
        ? Promise.resolve(jsonResponse({ predicted_category: 'Phishing', confidence: 0.97, processing_time_ms: 8.4 }))
        : networkError(),
    );
    await predict('suspicious email asking for bank credentials');
    const req = fetchMock.requests.find((r) => r.url.endsWith('/predict'));
    expect(req?.init?.method).toBe('POST');
    expect(req?.init?.body).toBe(JSON.stringify({ text: 'suspicious email asking for bank credentials' }));
  });

  it('success returns the API result and flips status live (lastSync set)', async () => {
    fetchMock.setHandler((url) =>
      url.endsWith('/predict')
        ? Promise.resolve(jsonResponse({ predicted_category: 'Malware', confidence: 0.88 }))
        : networkError(),
    );
    const res = await predict('trojan horse detected in downloaded file');
    expect(res?.predicted_category).toBe('Malware');
    const state = currentApiState();
    expect(state.status).toBe('live');
    expect(state.lastSync).toBeInstanceOf(Date);
  });

  it('network failure → null (NO fabricated category/confidence), real error stored', async () => {
    const res = await predict('multiple failed login attempts from unknown IP');
    expect(res).toBeNull();
    expect(currentApiState().error).toBe('Failed to fetch');
  });

  it('HTTP 500 → null with "HTTP 500" error', async () => {
    fetchMock.setHandler(() => Promise.resolve(jsonResponse({}, 500)));
    const res = await predict('ddos attack pattern detected on edge router');
    expect(res).toBeNull();
    expect(currentApiState().error).toBe('HTTP 500');
  });
});
