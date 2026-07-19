// @vitest-environment jsdom
/**
 * Flow (d) v2 — WAS "command-palette.test.tsx". **There is NO command
 * palette in the real app.** The complete shortcut set (App.tsx:94-130,
 * mirrored in HelpModal.tsx:11-16) is exactly:
 *   /   → focus the ticket-query input
 *   r/R → manual refresh (checkHealth + Event Log entry)
 *   ?   → open the Keyboard Shortcuts help modal
 *   Esc → close help / settings drawer
 * Shortcuts are ignored while typing (isTypingTarget, App.tsx:33-35).
 *
 * Four GREEN suites pin the real shortcuts. The MISSING FEATURE is asserted
 * plainly as it.fails: pressing Ctrl+K / Cmd+K must open a command palette —
 * nothing exists to open (no palette component, no handler anywhere in src/).
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

describe('real keyboard shortcuts (App.tsx:94-130)', () => {
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
    // The modal lists exactly the four real shortcuts — and no palette entry.
    expect(screen.getByText('Focus the ticket query search box')).toBeInTheDocument();
    expect(screen.getByText('Refresh API health and data')).toBeInTheDocument();
    expect(screen.getByText('Open this keyboard shortcuts help')).toBeInTheDocument();
    expect(screen.getByText('Close modals, drawers, and dropdowns')).toBeInTheDocument();
    expect(screen.queryByText(/command palette/i)).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shortcuts are ignored while typing in a text field (isTypingTarget guard)', async () => {
    const user = await renderSettledApp();
    // Let lazy charts mount and their data fetches settle before baselining.
    await screen.findAllByTestId('echart-stub');
    await act(async () => {});
    // Clicking focuses the textarea (jsdom also fires a window-focus probe — let it settle).
    await user.click(screen.getByRole('textbox', { name: /ticket text/i }));
    await act(async () => {});
    const before = fetchMock.calls.length;
    await user.keyboard('r');
    await act(async () => {});
    expect(fetchMock.calls.length).toBe(before); // no probe fired from the field
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.keyboard('?');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('command palette — MISSING FEATURE (stated plainly)', () => {
  it.fails(
    'MISSING FEATURE (no FIX assigned): Ctrl+K must open a command palette — no palette component or handler exists anywhere in src/',
    async () => {
      const user = await renderSettledApp();
      await user.keyboard('{Control>}k{/Control}');
      expect(
        screen.queryByRole('dialog', { name: /command palette/i }) ??
          screen.queryByRole('combobox', { name: /command/i }),
      ).not.toBeNull();
    },
  );

  it.fails(
    'MISSING FEATURE (no FIX assigned): Cmd+K (macOS) must open the same palette',
    async () => {
      const user = await renderSettledApp();
      await user.keyboard('{Meta>}k{/Meta}');
      expect(
        screen.queryByRole('dialog', { name: /command palette/i }) ??
          screen.queryByRole('combobox', { name: /command/i }),
      ).not.toBeNull();
    },
  );
});
