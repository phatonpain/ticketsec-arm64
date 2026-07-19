// @vitest-environment jsdom
/**
 * Flow (d) v3 — M5: command palette implemented (F-01).
 *
 * Real shortcuts (App.tsx):
 *   Ctrl/Cmd+K → open command palette
 *   /          → focus the ticket-query input
 *   r/R        → manual refresh (checkHealth + Event Log entry)
 *   ?          → open the Keyboard Shortcuts help modal
 *   Esc        → close modals, drawers, dropdowns, and palette
 * Shortcuts are ignored while typing (isTypingTarget, App.tsx).
 */

import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  enableActEnvironment,
  installFetchMock,
  installJsdomStubs,
  offlineHandler,
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

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  installJsdomStubs();
  window.location.hash = '#/dashboard';
  fetchMock = installFetchMock(offlineHandler());
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

describe('real keyboard shortcuts (App.tsx)', () => {
  it('Ctrl+K opens the command palette', async () => {
    const user = await renderSettledApp();
    await user.keyboard('{Control>}k{/Control}');
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: /command palette/i })).toBeInTheDocument(),
    );
  });

  it('Cmd+K (macOS) opens the same command palette', async () => {
    const user = await renderSettledApp();
    await user.keyboard('{Meta>}k{/Meta}');
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: /command palette/i })).toBeInTheDocument(),
    );
  });

  it('"/" focuses the ticket-query input', async () => {
    const user = await renderSettledApp();
    await user.keyboard('/');
    await waitFor(() => expect(screen.getByRole('textbox', { name: /search tickets/i })).toHaveFocus());
  });

  it('"r" triggers a manual refresh — a new 3-endpoint probe round', async () => {
    const user = await renderSettledApp();
    const before = fetchMock.calls.length;
    await user.keyboard('r');
    await waitFor(() => {
      expect(fetchMock.calls.length - before).toBeGreaterThanOrEqual(3);
    });
    expect(fetchMock.calls.some((u) => u.endsWith('/health'))).toBe(true);
  });

  it('"?" opens the Keyboard Shortcuts modal; Escape closes it', async () => {
    const user = await renderSettledApp();
    await user.keyboard('?');
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'help-title');
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Open the command palette')).toBeInTheDocument();
    expect(screen.getByText('Focus the ticket query search box')).toBeInTheDocument();
    expect(screen.getByText('Refresh API health and data')).toBeInTheDocument();
    expect(screen.getByText('Open this keyboard shortcuts help')).toBeInTheDocument();
    expect(screen.getByText('Close modals, drawers, and dropdowns')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shortcuts are ignored while typing in a text field (isTypingTarget guard)', async () => {
    const user = await renderSettledApp();
    // M8-PHASE1: Live Prediction textarea now lives in the Predictions view.
    await user.click(screen.getByRole('button', { name: /live predictions/i }));
    const textarea = screen.getByRole('textbox', { name: /ticket text/i });
    await user.click(textarea);
    await act(async () => {});
    await user.keyboard('r');
    await act(async () => {});
    expect(textarea).toHaveValue('r');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.keyboard('?');
    await act(async () => {});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('command palette interactions', () => {
  it('filters commands while typing and runs the selected action with Enter', async () => {
    const user = await renderSettledApp();
    await user.keyboard('{Control>}k{/Control}');
    const input = await screen.findByRole('textbox', { name: /command palette search/i });
    await user.type(input, 'settings');
    await waitFor(() => expect(screen.getByRole('option', { name: /open settings/i })).toBeInTheDocument());
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /command palette/i })).not.toBeInTheDocument());
    // Opening settings leaves the settings drawer dialog visible.
    expect(screen.getByRole('dialog', { name: /settings/i })).toBeInTheDocument();
  });

  it('closes the palette with Escape', async () => {
    const user = await renderSettledApp();
    await user.keyboard('{Control>}k{/Control}');
    await screen.findByRole('dialog', { name: /command palette/i });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /command palette/i })).not.toBeInTheDocument());
  });
});
