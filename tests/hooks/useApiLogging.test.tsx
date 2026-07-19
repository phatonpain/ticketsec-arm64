// @vitest-environment jsdom
/**
 * M3 — useApi Event Log level routing: ERROR only on first offline transition,
 * subsequent retries as DEBUG; never claim "no cached data" when the ticket
 * snapshot may have loaded.
 */
import '@testing-library/jest-dom/vitest';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  enableActEnvironment,
  installFetchMock,
  jsonResponse,
  networkError,
  type FetchMock,
} from '../flows/testUtils';

enableActEnvironment();

let fetchMock: FetchMock;

beforeEach(() => {
  localStorage.clear();
  fetchMock = installFetchMock(() => networkError());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function freshModules() {
  vi.resetModules();
  const [{ checkHealth, predict }, { useEventLog }] = await Promise.all([
    import('../../src/hooks/useApi'),
    import('../../src/hooks/useEventLog'),
  ]);
  return { checkHealth, predict, useEventLog };
}

function errorMessages(logs: Array<{ level: string; message: string; count: number }>) {
  return logs.filter((l) => l.level === 'ERROR').map((l) => l.message);
}

function debugMessages(logs: Array<{ level: string; message: string; count: number }>) {
  return logs.filter((l) => l.level === 'DEBUG').map((l) => l.message);
}

describe('M3: offline logging level routing', () => {
  it('logs one ERROR on the first offline transition, then DEBUG for retries', async () => {
    const { checkHealth, useEventLog } = await freshModules();
    const { result } = renderHook(() => useEventLog());

    await act(async () => {
      await checkHealth();
    });
    const afterFirst = result.current.logs;
    expect(errorMessages(afterFirst)).toContain('Metrics endpoint unreachable — retrying with backoff');
    expect(errorMessages(afterFirst)).not.toContain('API unreachable — no cached data available');

    await act(async () => {
      await checkHealth();
    });
    const afterSecond = result.current.logs;
    expect(errorMessages(afterSecond).filter((m) => m.includes('Metrics endpoint')).length).toBe(1);
    expect(debugMessages(afterSecond).some((m) => m.startsWith('Health probe still failing'))).toBe(true);
  });

  it('resets the ERROR gate after the API becomes live, so the next outage logs ERROR again', async () => {
    const { checkHealth, predict, useEventLog } = await freshModules();
    const { result } = renderHook(() => useEventLog());

    await act(async () => {
      await checkHealth();
    });
    expect(errorMessages(result.current.logs)).toContain('Metrics endpoint unreachable — retrying with backoff');

    fetchMock.setHandler((url) =>
      url.endsWith('/predict')
        ? Promise.resolve(jsonResponse({ predicted_category: 'Phishing', confidence: 0.97 }))
        : networkError(),
    );
    await act(async () => {
      await predict('test');
    });

    await act(async () => {
      await checkHealth();
    });
    expect(errorMessages(result.current.logs).filter((m) => m.includes('Metrics endpoint')).length).toBe(2);
  });

  it('never logs the old false "no cached data available" copy', async () => {
    const { checkHealth, useEventLog } = await freshModules();
    const { result } = renderHook(() => useEventLog());

    await act(async () => {
      await checkHealth();
      await checkHealth();
      await checkHealth();
    });

    const messages = result.current.logs.map((l) => l.message);
    expect(messages).not.toContain('API unreachable — no cached data available');
    expect(messages).not.toContain('API connection lost — no cached data available');
  });
});
