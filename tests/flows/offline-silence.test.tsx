// @vitest-environment jsdom
/**
 * Phase 4 QA — 60-second offline EventLog silence check.
 *
 * With the backend unreachable, the EventLog must contain zero fabricated
 * entries for 60 seconds. A fabricated entry is any log that falsely claims:
 *   - the API is reachable or restored,
 *   - a classification succeeded ("Inference OK"),
 *   - a classification failed when no classification was submitted,
 *   - cached data was loaded when it was not.
 *
 * Real retry/debug entries are expected and allowed.
 */
import '@testing-library/jest-dom/vitest';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  enableActEnvironment,
  installFetchMock,
  networkError,
  type FetchMock,
} from './testUtils';

enableActEnvironment();

let fetchMock: FetchMock;

const FABRICATION_PATTERNS = [
  /API reachable/i,
  /API connection restored/i,
  /Inference OK/i,
  /Classification failed/i,
  /Cached performance and classification data loaded/i,
  /Cached ticket snapshot loaded/i,
];

function fabricatedEntries(logs: Array<{ level: string; message: string }>) {
  return logs.filter((l) => FABRICATION_PATTERNS.some((re) => re.test(l.message)));
}

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  fetchMock = installFetchMock(() => networkError());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function freshModules() {
  const [{ checkHealth }, { useEventLog }] = await Promise.all([
    import('../../src/hooks/useApi'),
    import('../../src/hooks/useEventLog'),
  ]);
  return { checkHealth, useEventLog };
}

describe('60-second offline EventLog silence check', () => {
  it('adds no fabricated entries while the backend stays unreachable', async () => {
    vi.useFakeTimers();
    const { checkHealth, useEventLog } = await freshModules();
    const { result } = renderHook(() => useEventLog());

    // Trigger the first health probe. It fails (networkError) and logs the
    // honest offline transition once.
    await act(async () => {
      await checkHealth();
    });

    // Advance 60 seconds of scheduler time to cover multiple backoff retries.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    const fabricated = fabricatedEntries(result.current.logs);

    expect(fabricated).toHaveLength(0);
    // Sanity: the honest initial offline transition and/or retry debug entries exist.
    const messages = result.current.logs.map((l) => l.message);
    expect(
      messages.some((m) => /retrying with backoff|Health probe still failing|Metrics endpoint unreachable/i.test(m)),
    ).toBe(true);
  });
});
