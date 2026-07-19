// @vitest-environment jsdom
/**
 * storeIdentity.test.tsx (v2) — THE FIX-01 ROOT-CAUSE SUITE.
 *
 * Pass-1 inferred FIX-01's root cause as "probe fetch() without timeout never
 * settles" — REFUTED by the real code (a 10s AbortController timeout exists,
 * useApi.ts:127-136, and probeSingleEndpoint never throws, lines 138-155).
 *
 * The FIX-01 replacement is in place: the three singleton stores now replace
 * their snapshot object immutably on every mutation, so useSyncExternalStore
 * subscribers re-render correctly. These tests verify that behavior and are
 * GREEN under the fixed implementation.
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { checkHealth, useApi } from '../../src/hooks/useApi';
import { useEventLog } from '../../src/hooks/useEventLog';
import { useSettings, setApiBase } from '../../src/hooks/useSettings';
import { setTicketQuery, useTicketQuery } from '../../src/hooks/useTicketQuery';
import { addTicket, seedTickets, useTickets } from '../../src/hooks/useTickets';
import { enableActEnvironment, networkError } from '../flows/testUtils';

enableActEnvironment();

beforeEach(() => {
  localStorage.clear();
  seedTickets([]);
  setTicketQuery('');
  vi.stubGlobal('fetch', vi.fn(() => networkError()));
});

describe('BROKEN stores (mutated same-identity snapshot — FIX-01 mechanism)', () => {
  it(
    'FIX-01: useTicketQuery must propagate setTicketQuery to subscribers (immutable snapshot)',
    () => {
      const { result } = renderHook(() => useTicketQuery());
      act(() => setTicketQuery('trojan'));
      expect(result.current.query).toBe('trojan');
    },
  );

  it(
    'FIX-01: useApi must leave checking=false after a failed probe settles (the S1 stuck "Checking…" pill)',
    async () => {
      const { result } = renderHook(() => useApi());
      await act(async () => {
        await checkHealth();
      });
      expect(result.current.checking).toBe(false);
      expect(result.current.status).toBe('offline');
    },
  );

  it(
    'FIX-01: useEventLog must propagate appended entries (immutable snapshot)',
    () => {
      const { result } = renderHook(() => useEventLog(50));
      const before = result.current.logs.length;
      act(() => result.current.addInfo('probe entry'));
      expect(result.current.logs).toHaveLength(before + 1);
    },
  );

  it('documents the fixed behavior: mutation is published immediately (no stale snapshot)', async () => {
    const { result, rerender } = renderHook(() => useApi());
    // Let the mount-time probe fully settle (isProbing released) before continuing.
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    // Flip the store to live:
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        return url.endsWith('/health')
          ? Promise.resolve(new Response('{}', { status: 200 }))
          : Promise.reject(new TypeError('Failed to fetch'));
      }),
    );
    await act(async () => {
      await checkHealth();
    });
    // With immutable snapshots, subscribers re-render as soon as the mutation lands.
    expect(result.current.status).toBe('live');
    // A forced re-render still reads the same current state.
    rerender();
    expect(result.current.status).toBe('live');
  });
});

describe('HEALTHY stores (immutable snapshot — control group)', () => {
  it('useTickets propagates adds (array replaced immutably)', () => {
    const { result } = renderHook(() => useTickets());
    act(() => {
      addTicket({ subject: 's', category: 'Phishing', confidence: 0.9, status: 'Pending', assignedTo: 'Auto' });
    });
    expect(result.current.tickets).toHaveLength(1);
  });

  it('useSettings propagates setApiBase (settings object replaced)', () => {
    const { result } = renderHook(() => useSettings());
    act(() => setApiBase('http://localhost:9999'));
    expect(result.current.settings.apiBase).toBe('http://localhost:9999');
  });
});
