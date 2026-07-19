// @vitest-environment jsdom
/**
 * Phase 4 QA — Honesty Matrix across the 5 primary views.
 *
 * Verifies that the cross-cutting API-status chrome (Header status pill,
 * Last-sync caption, cached-data suffix) tells the truth in every view
 * for the three API states: live, cached, offline.
 *
 * View-specific data honesty is exercised by existing suites:
 *   - classify-offline.test.tsx (Predictions view)
 *   - search-filter.test.tsx (Detections cached table)
 *   - useApi.test.tsx / useApiLogging.test.tsx (store transitions)
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SNAPSHOT_JSON } from '../lib/fixtures';
import {
  enableActEnvironment,
  installFetchMock,
  installJsdomStubs,
  jsonResponse,
  networkError,
  type FetchMock,
} from './testUtils';

vi.mock('../../src/components/ECharts', async () => {
  const { createElement } = await import('react');
  return {
    ECharts: (props: { style?: Record<string, unknown> }) =>
      createElement('div', { 'data-testid': 'echart-stub', style: props.style }),
  };
});

enableActEnvironment();

let fetchMock: FetchMock;

const VIEWS = ['Detections', 'Threat Analytics', 'Model Registry', 'System Health'] as const;

function liveHandler() {
  const stats = [{ category: 'Phishing', count: 12 }];
  const perf = [{ time: '2026-07-17T13:00:00Z', baseline: 40, onnx: 12, int8: 8 }];
  const classifications = [
    {
      id: 'TKT-9001',
      subject: 'Live classification sample',
      category: 'Phishing',
      confidence: 0.95,
      status: 'Resolved' as const,
      assignedTo: 'Auto',
      createdAt: '2026-07-18T12:00:00Z',
    },
  ];
  return (url: string) => {
    if (url.includes('/health') || url.endsWith('/') || url.includes('/docs')) {
      return Promise.resolve(jsonResponse({ status: 'ok' }));
    }
    if (url.includes('/api/v1/stats/categories')) return Promise.resolve(jsonResponse(stats));
    if (url.includes('/api/v1/performance/history')) return Promise.resolve(jsonResponse(perf));
    if (url.includes('/api/v1/classifications')) return Promise.resolve(jsonResponse(classifications));
    if (url.includes('/cache/tickets-snapshot.json')) return Promise.resolve(jsonResponse(SNAPSHOT_JSON));
    return networkError();
  };
}

function cachedHandler() {
  return (url: string) => {
    if (url.includes('/cache/tickets-snapshot.json')) return Promise.resolve(jsonResponse(SNAPSHOT_JSON));
    return networkError();
  };
}

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  installJsdomStubs();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function freshApp() {
  const mod = await import('../../src/App');
  return mod.App;
}

async function renderSettledApp(handler: (url: string) => Promise<Response>) {
  fetchMock = installFetchMock(handler);
  window.location.hash = '#/dashboard';
  const App = await freshApp();
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(screen.queryByText('Connecting to inference API…')).not.toBeInTheDocument(), {
    timeout: 5_000,
  });
  return user;
}

async function navigateTo(label: string, user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: label }));
}

describe('Honesty Matrix — live state', () => {
  it('shows LIVE status, Last sync, and no cached suffix in every view', async () => {
    const user = await renderSettledApp(liveHandler());
    const pills = screen.queryAllByText('LIVE');
    expect(pills.length).toBeGreaterThan(0);
    expect(screen.getByText(/Last sync:/)).toBeInTheDocument();
    expect(screen.queryByText(/· cached data/)).not.toBeInTheDocument();

    for (const label of VIEWS) {
      await navigateTo(label, user);
      await waitFor(() => expect(screen.queryAllByText('LIVE').length).toBeGreaterThan(0), { timeout: 3_000 });
      expect(screen.getByText(/Last sync:/)).toBeInTheDocument();
      expect(screen.queryAllByText('API OFFLINE')).toHaveLength(0);
    }
  });
});

describe('Honesty Matrix — cached state', () => {
  it('shows CACHED status and cached-data suffix; never claims LIVE', async () => {
    // First establish a live connection so the API cache is populated.
    const user = await renderSettledApp(liveHandler());
    await waitFor(() => expect(screen.queryAllByText('LIVE').length).toBeGreaterThan(0), { timeout: 5_000 });

    // Now make the API unreachable. The cached data remains, so the status
    // should flip to CACHED rather than OFFLINE.
    fetchMock.setHandler(cachedHandler());
    await user.click(screen.getAllByRole('button', { name: 'Refresh data' })[0]);
    await waitFor(() => expect(screen.queryAllByText('CACHED').length).toBeGreaterThan(0), { timeout: 5_000 });
    expect(screen.getByText(/· cached data/)).toBeInTheDocument();
    expect(screen.queryAllByText('LIVE')).toHaveLength(0);
    expect(screen.queryAllByText('API OFFLINE')).toHaveLength(0);

    for (const label of VIEWS) {
      await navigateTo(label, user);
      await waitFor(() => expect(screen.queryAllByText('CACHED').length).toBeGreaterThan(0), { timeout: 3_000 });
      expect(screen.queryAllByText('LIVE')).toHaveLength(0);
    }
  });
});

describe('Honesty Matrix — offline state', () => {
  it('shows API OFFLINE and no live/cached claims when no cache exists', async () => {
    fetchMock = installFetchMock(() => networkError());
    window.location.hash = '#/dashboard';
    const App = await freshApp();
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(screen.queryAllByText('API OFFLINE').length).toBeGreaterThan(0), { timeout: 5_000 });
    expect(screen.queryAllByText('LIVE')).toHaveLength(0);
    expect(screen.queryAllByText('CACHED')).toHaveLength(0);

    for (const label of VIEWS) {
      await navigateTo(label, user);
      await waitFor(() => expect(screen.queryAllByText('API OFFLINE').length).toBeGreaterThan(0), { timeout: 3_000 });
      expect(screen.queryAllByText('LIVE')).toHaveLength(0);
    }
  });
});
