// @vitest-environment jsdom
/**
 * Header.test.tsx (v2) — REAL Header (status pill, refresh, time listbox,
 * notification bell, settings gear, status tooltip).
 *
 * Findings verified against the real code:
 *  - FIX-01: the pill is stuck on 'Checking…' — CONFIRMED, but the mechanism
 *    is the store-identity bail-out (useApi getSnapshot returns the mutated
 *    store), NOT a hung probe. The it.fails test is the S1 reproduction.
 *  - FIX-08: the bell unread count IS correctly derived from the event-log
 *    store (Header.tsx:12 uses useEventLog's unreadCount) — the pass-1
 *    "seeded/duplicated counter" guess is REFUTED. Bell behavior is green.
 *  - FIX-26: the time-range listbox is purely cosmetic — selecting an option
 *    changes label text only (no data refetch). Pinned as current behavior.
 *
 * Fresh modules per test (vi.resetModules + dynamic import) so the singleton
 * stores start clean; node_modules deps (react, RTL) are externalized by
 * vitest and remain single instances.
 */

import '@testing-library/jest-dom/vitest';
import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  enableActEnvironment,
  installFetchMock,
  installJsdomStubs,
  networkError,
  type FetchMock,
} from '../flows/testUtils';

enableActEnvironment();

let fetchMock: FetchMock;

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  installJsdomStubs();
  fetchMock = installFetchMock(() => networkError());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function freshHeader() {
  const mod = await import('../../src/components/Header');
  return mod.Header;
}

describe('status pill', () => {
  it('initial render shows "Checking…" (initial store state)', async () => {
    const Header = await freshHeader();
    render(<Header />);
    expect(screen.getByText('Checking…')).toBeInTheDocument();
  });

  it.fails(
    'FIX-01 (S1 reproduction): pill must flip to "System Offline" after the failed probe settles — it never does (store-identity bail-out)',
    async () => {
      const Header = await freshHeader();
      render(<Header />);
      await screen.findByText('System Offline', undefined, { timeout: 750 });
    },
  );

  it('hovering the pill opens the Connection Diagnostics tooltip', async () => {
    const Header = await freshHeader();
    const user = userEvent.setup();
    render(<Header />);
    const pill = screen.getByText('Checking…');
    await user.hover(pill);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Connection Diagnostics');
    await user.unhover(pill);
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  });
});

describe('refresh button', () => {
  it('aria-label "Refresh data"; clicking issues a new 3-endpoint probe round', async () => {
    const Header = await freshHeader();
    const user = userEvent.setup();
    render(<Header />);
    const before = fetchMock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Refresh data' }));
    const delta = fetchMock.calls.length - before;
    expect(delta).toBe(3); // /health, /, /docs
    expect(fetchMock.calls.some((u) => u.endsWith('/health'))).toBe(true);
  });
});

describe('notification bell (FIX-08 refuted: count IS store-derived)', () => {
  it('shows the unread count from the log store and marks all read on open', async () => {
    const Header = await freshHeader();
    const user = userEvent.setup();
    render(<Header />);
    // Two INITIAL_LOGS entries ('Health probe started', 'Dashboard initialized'),
    // lastRead=0 in cleared storage → 2 unread.
    const bell = screen.getByRole('button', { name: /notifications, 2 unread/i });
    expect(bell).toHaveTextContent('2');

    await user.click(bell); // opens panel + markAllRead
    expect(await screen.findByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Health probe started')).toBeInTheDocument();
    expect(screen.getByText('Dashboard initialized')).toBeInTheDocument();
    // Badge cleared after opening (count 0 → hidden, aria-label without count).
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });
});

describe('time-range listbox (FIX-26: cosmetic over cached data)', () => {
  it('switches the label and issues NO data refetch (pinned current behavior)', async () => {
    const Header = await freshHeader();
    const user = userEvent.setup();
    render(<Header />);
    await user.click(screen.getByRole('button', { name: /last 24 hours/i }));
    const listbox = await screen.findByRole('listbox');
    const before = fetchMock.calls.length;
    await user.click(screen.getByRole('option', { name: 'Last 1 hour' }));
    expect(screen.getByRole('button', { name: /last 1 hour/i })).toBeInTheDocument();
    expect(listbox).not.toBeInTheDocument();
    expect(fetchMock.calls.length).toBe(before); // no probe, no refetch
  });
});

describe('settings gear', () => {
  it('aria-label "Settings" opens the settings drawer store', async () => {
    vi.resetModules();
    const Header = await freshHeader();
    const { useSettingsDrawer } = await import('../../src/hooks/useSettingsDrawer');
    const user = userEvent.setup();
    render(<Header />);
    const drawer = renderHook(() => useSettingsDrawer());
    expect(drawer.result.current).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(drawer.result.current).toBe(true); // boolean snapshot propagates
  });
});
