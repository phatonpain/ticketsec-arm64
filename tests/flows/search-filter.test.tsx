// @vitest-environment jsdom
/**
 * Flow (b) v2 — Search text filters the tickets table.
 *
 * REAL selectors: sidebar input id "ticket-query-input", aria-label
 * "Search tickets", placeholder "Search tickets..." (Sidebar.tsx:232-241);
 * the query lives in the useTicketQuery store and is consumed by
 * ClassificationTable (substring match over id/subject/category/status/
 * assignedTo, lines 46-56). There is NO fuzzy search — the pass-1 fuzzy
 * suite is folded into these substring cases (see TEST_NOTES_V2).
 *
 * FIX-01: useTicketQuery now publishes an immutable snapshot, so typing in the
 * search box echoes and the table narrows in real time. These tests verify that
 * propagation.
 */

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  enableActEnvironment,
  installFetchMock,
  installJsdomStubs,
  offlineHandler,
} from './testUtils';

vi.mock('../../src/components/ECharts', async () => {
  const { createElement } = await import('react');
  return {
    ECharts: (props: { style?: Record<string, unknown> }) =>
      createElement('div', { 'data-testid': 'echart-stub', style: props.style }),
  };
});

enableActEnvironment();

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  installJsdomStubs();
  installFetchMock(offlineHandler());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function renderSettledApp() {
  const { App } = await import('../../src/App');
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText('TKT-8471');
  return user;
}

function nav() {
  return screen.getByRole('navigation', { name: /main navigation/i });
}

async function goToDetections(user: ReturnType<typeof userEvent.setup>) {
  const button = within(nav()).getByRole('button', { name: /detections/i });
  await user.click(button);
  await waitFor(() => expect(window.location.hash).toBe('#/detections'));
}

function searchBox(): HTMLElement {
  return screen.getByRole('textbox', { name: /search tickets/i });
}

describe('Flow (b): offline cached table (the GREEN honest baseline)', () => {
  it('serves the six cached snapshot rows (one per exact category) while offline', async () => {
    await renderSettledApp();
    // Subject cells truncate at 42 chars (ClassificationTable.tsx:266); the
    // full subject is on the cell's title attribute.
    expect(screen.getByTitle('Suspicious email asking for bank credentials')).toBeInTheDocument();
    expect(screen.getByText(/showing 1–6 of 6/i)).toBeInTheDocument();
    expect(screen.getAllByText('API OFFLINE').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Cached snapshot')).toBeInTheDocument();
  });

  it('the search input exists with its real a11y wiring', async () => {
    const user = await renderSettledApp();
    await goToDetections(user);
    const input = searchBox();
    expect(input).toHaveAttribute('id', 'ticket-query-input');
    expect(input).toHaveAttribute('placeholder', 'Search tickets…');
  });

  it('"/" focuses the search input (real shortcut, App.tsx:109-115)', async () => {
    const user = await renderSettledApp();
    await goToDetections(user);
    await user.keyboard('/');
    await waitFor(() => expect(searchBox()).toHaveFocus());
  });
});

describe('Flow (b): search narrows the table (FIX-01 immutable store)', () => {
  it(
    'FIX-01: typing "trojan" echoes in the input and narrows the table to TKT-8470',
    async () => {
      const user = await renderSettledApp();
      await goToDetections(user);
      await user.type(searchBox(), 'trojan');
      expect(searchBox()).toHaveValue('trojan'); // controlled input never echoes today
      expect(screen.getByTitle('Trojan horse detected in downloaded file')).toBeInTheDocument();
      expect(screen.queryByText('TKT-8471')).not.toBeInTheDocument();
      expect(screen.getByText(/showing 1–1 of 1/i)).toBeInTheDocument();
      expect(screen.getByText(/\(filtered from 6\)/i)).toBeInTheDocument();
    },
  );

  it(
    'FIX-01: case-insensitive multi-field match — "SECURITY TEAM" matches assignedTo (substring, not fuzzy)',
    async () => {
      const user = await renderSettledApp();
      await goToDetections(user);
      await user.type(searchBox(), 'SECURITY TEAM');
      expect(screen.getByText('TKT-8469')).toBeInTheDocument();
      expect(screen.getByText('TKT-8468')).toBeInTheDocument();
      expect(screen.queryByText('TKT-8471')).not.toBeInTheDocument();
    },
  );

  it(
    'FIX-01: a no-match query shows the honest empty state (no fabricated rows)',
    async () => {
      const user = await renderSettledApp();
      await goToDetections(user);
      await user.type(searchBox(), 'zzz-no-match');
      expect(screen.getByText('No tickets match your query.')).toBeInTheDocument();
      expect(screen.queryByText(/TKT-\d+/)).not.toBeInTheDocument();
    },
  );
});
