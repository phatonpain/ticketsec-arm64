/**
 * testUtils.ts (v2) — shared helpers for the flow + component suites.
 *
 * Honesty Contract: the default handler reproduces the REAL production state —
 * the API (default http://3.23.60.61:8000, src/hooks/useSettings.ts:4) is
 * unreachable (S6: 3× ERR_CONNECTION_TIMED_OUT) while the cached snapshot
 * (public/cache/tickets-snapshot.json) keeps serving. Never fabricate live
 * API success unless the test itself overrides the handler.
 *
 * v2 changes vs pass-1:
 *  - offlineHandler serves the REAL snapshot shape (bare array with minutesAgo;
 *    pass-1 guessed { generatedAt, tickets }).
 *  - resetStores() uses the REAL store APIs (pass-1 assumed zustand
 *    `useX.getState().reset()` which does not exist).
 *  - installJsdomStubs(): scrollIntoView (jsdom lacks it; used by
 *    useEventLog.ts:131 and useTicketQuery.ts:54).
 */

import { vi } from 'vitest';

import { closeSettingsDrawer } from '../../src/hooks/useSettingsDrawer';
import { resetSettings } from '../../src/hooks/useSettings';
import { clearTicketQuery, setTicketQueryExpanded } from '../../src/hooks/useTicketQuery';
import { seedTickets } from '../../src/hooks/useTickets';
import { SNAPSHOT_JSON } from '../lib/fixtures';

export type FetchHandler = (url: string, init?: RequestInit) => Promise<Response>;

export interface FetchMock {
  /** Every URL fetched so far, in order. */
  readonly calls: string[];
  /** Every (url, init) pair, for method/body assertions. */
  readonly requests: Array<{ url: string; init?: RequestInit }>;
  setHandler(handler: FetchHandler): void;
}

/** Stub global fetch with a URL-recording mock. */
export function installFetchMock(initial: FetchHandler): FetchMock {
  const calls: string[] = [];
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  let handler = initial;
  const mock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    requests.push({ url, init });
    return handler(url, init);
  });
  vi.stubGlobal('fetch', mock);
  return {
    calls,
    requests,
    setHandler(next) {
      handler = next;
    },
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Network failure with browser semantics (what a timeout/refusal surfaces as). */
export function networkError(): Promise<never> {
  return Promise.reject(new TypeError('Failed to fetch'));
}

/**
 * Default OFFLINE handler: the cached snapshot resolves (REAL shape — bare
 * array of SnapshotTicket with minutesAgo), everything else fails like the
 * evidenced ERR_CONNECTION_TIMED_OUT. The app fetches the snapshot at the
 * relative path '/cache/tickets-snapshot.json' (useTickets.ts:68).
 */
export function offlineHandler(body: unknown = SNAPSHOT_JSON): FetchHandler {
  return (url) => {
    if (url.includes('/cache/tickets-snapshot.json')) {
      return Promise.resolve(jsonResponse(body));
    }
    return networkError();
  };
}

/**
 * Reset the singleton stores that expose reset/seed APIs.
 * NOT resettable (module-level, no API — documented gap):
 *   - useApi store (status/checking/diagnostics/cache, backoff counters)
 *   - useEventLog store (entries accumulate; tests must match specific
 *     messages, not counts/positions)
 * Vitest isolates modules per test FILE, so each suite starts from a fresh
 * singleton anyway; this reset is for multiple renders within one file.
 */
export function resetStores(): void {
  localStorage.clear();
  seedTickets([]); // tickets → [], nextId → 8467 (floor in seedTickets)
  clearTicketQuery();
  setTicketQueryExpanded(false);
  closeSettingsDrawer();
  resetSettings();
}

/** jsdom gaps the real code hits (scrollIntoView is not implemented). */
export function installJsdomStubs(): void {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
  }
}

/** React 19 act() environment flag (required when using act/renderHook). */
export function enableActEnvironment(): void {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
}
