// @vitest-environment jsdom
/**
 * storeIdentity.test.tsx (v2) — THE FIX-01 ROOT-CAUSE SUITE.
 *
 * Pass-1 inferred FIX-01's root cause as "probe fetch() without timeout never
 * settles" — REFUTED by the real code (a 10s AbortController timeout exists,
 * useApi.ts:127-136, and probeSingleEndpoint never throws, lines 138-155).
 *
 * The REAL, code-confirmed root cause: three of the five singleton stores
 * mutate a module-level object and return THAT SAME OBJECT from getSnapshot:
 *   - useApi.ts:108-110        getSnapshot(): ApiStore        → return store
 *   - useEventLog.ts:99-101    getSnapshot(): EventLogStore   → return store
 *   - useTicketQuery.ts:24-26  getSnapshot(): TicketQueryStore→ return store
 * React's useSyncExternalStore compares snapshots with Object.is; a mutated
 * same-identity snapshot bails out → subscribers NEVER re-render on emit().
 * Blast radius (all evidenced in S1–S4):
 *   - Header pill stuck on "Checking…" (checking:true is the initial state)
 *   - Event Log frozen at the two initial entries
 *   - Ticket-query search box appears dead (controlled input never updates)
 *   - Classify button stuck on "Classifying…", error box never appears
 * Stores that replace their snapshot immutably DO propagate:
 *   - useTickets.ts:97-99 (array replaced, lines 51/61)
 *   - useSettings.ts:68-70 (settings object replaced, lines 91/98/105)
 *   - useSettingsDrawer.ts:22-24 (boolean primitive)
 *
 * The `it.fails` tests pin the CORRECT behavior; they flip green when the
 * FIX-01 replacement (immutable single-writer state machine) lands.
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
  it.fails(
    'FIX-01: useTicketQuery must propagate setTicketQuery to subscribers (getSnapshot returns the mutated store, useTicketQuery.ts:24-26)',
    () => {
      const { result } = renderHook(() => useTicketQuery());
      act(() => setTicketQuery('trojan'));
      expect(result.current.query).toBe('trojan');
    },
  );

  it.fails(
    'FIX-01: useApi must leave checking=false after a failed probe settles (the S1 stuck "Checking…" pill, useApi.ts:108-110)',
    async () => {
      const { result } = renderHook(() => useApi());
      await act(async () => {
        await checkHealth();
      });
      expect(result.current.checking).toBe(false);
      expect(result.current.status).toBe('offline');
    },
  );

  it.fails(
    'FIX-01: useEventLog must propagate appended entries (the frozen Event Log, useEventLog.ts:99-101)',
    () => {
      const { result } = renderHook(() => useEventLog(50));
      const before = result.current.logs.length;
      act(() => result.current.addInfo('probe entry'));
      expect(result.current.logs).toHaveLength(before + 1);
    },
  );

  it('documents the broken behavior: mutation lands in the store but is never published (stale snapshot until an unrelated re-render)', async () => {
    const { result, rerender } = renderHook(() => useApi());
    const statusAtMount = result.current.status; // 'offline' (fetch fails)
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
    // The store mutated, but subscribers were never notified-effectively:
    expect(result.current.status).toBe(statusAtMount); // stale — the bail-out
    // A forced re-render reads the CURRENT store (proves the mutation landed):
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
