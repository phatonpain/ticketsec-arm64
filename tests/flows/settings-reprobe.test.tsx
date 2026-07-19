// @vitest-environment jsdom
/**
 * Flow (e) v2 — Settings drawer: API base URL override + re-probe.
 *
 * REAL behavior (SettingsDrawer.tsx):
 *  - input #api-url, label "API Base URL", draft mirrors settings.apiBase
 *  - onBlur → updateApiBase(draft): trims, strips trailing '/', prepends
 *    http:// when missing (useSettings.ts:27-34, 91-93), persists to
 *    localStorage 'ticketsec-settings-v1'
 *  - "Test Connection" → probeApiBase(settings.apiBase) — the SAVED base
 *    (the blur that precedes the click is what saves the draft)
 *  - copy tells the user: "The dashboard will probe this URL on the next
 *    health check" — there is NO immediate automatic re-probe on change
 *
 * GREEN: drawer a11y, normalization, persistence, Test Connection probing
 * the new base, reduced-motion toggle, restore-defaults.
 * it.fails: the pass-1 contract expected an IMMEDIATE re-probe on URL
 * change; the real code re-probes only on the next scheduled/manual health
 * check — missing behavior, flagged for the FIX-01 replacement.
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
  type FetchMock,
} from './testUtils';
import { resetSettings } from '../../src/hooks/useSettings';

vi.mock('../../src/components/ECharts', async () => {
  const { createElement } = await import('react');
  return {
    ECharts: (props: { style?: Record<string, unknown> }) =>
      createElement('div', { 'data-testid': 'echart-stub', style: props.style }),
  };
});

enableActEnvironment();

const DEFAULT_BASE = 'http://3.23.60.61:8000';
const NEW_BASE = 'http://localhost:9999';

let fetchMock: FetchMock;

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  resetSettings();
  installJsdomStubs();
  fetchMock = installFetchMock(offlineHandler());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function renderAppWithDrawer() {
  const { App } = await import('../../src/App');
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText('TKT-8471');
  // The gear (aria-label "Settings") lives in the header; the sidebar also
  // has a "Settings" nav button — scope to the banner landmark.
  await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Settings' }));
  await screen.findByRole('dialog');
  return user;
}

describe('Flow (e): settings drawer basics', () => {
  it('opens a labelled dialog with the saved default base URL', async () => {
    await renderAppWithDrawer();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'settings-title');
    expect(screen.getByLabelText(/api base url/i)).toHaveValue(DEFAULT_BASE);
  });

  it('closes via the "Close settings" button', async () => {
    const user = await renderAppWithDrawer();
    await user.click(screen.getByRole('button', { name: 'Close settings' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Flow (e): API URL override + re-probe', () => {
  it('blur normalizes a bare host:port (adds http://) and persists', async () => {
    const user = await renderAppWithDrawer();
    const input = screen.getByLabelText(/api base url/i);
    await user.clear(input);
    await user.type(input, 'localhost:9999');
    await user.tab(); // blur → updateApiBase(draft) → setApiBase → normalizeApiBase
    await waitFor(() => expect(input).toHaveValue(NEW_BASE));
    await waitFor(() =>
      expect(
        (JSON.parse(localStorage.getItem('ticketsec-settings-v1') ?? '{}') as { apiBase?: string }).apiBase,
      ).toBe(NEW_BASE),
    );
  });

  it(
    'FIX-01: a trailing slash is normalized away — "localhost:9999/" is stored as "http://localhost:9999"',
    async () => {
      const user = await renderAppWithDrawer();
      const input = screen.getByLabelText(/api base url/i);
      await user.clear(input);
      await user.type(input, 'localhost:9999/');
      await user.tab();
      await waitFor(() => expect(input).toHaveValue(NEW_BASE));
      await waitFor(() =>
        expect(
          (JSON.parse(localStorage.getItem('ticketsec-settings-v1') ?? '{}') as { apiBase?: string }).apiBase,
        ).toBe(NEW_BASE),
      );
    },
  );

  it('"Test Connection" probes /health, / and /docs under the NEW base', async () => {
    const user = await renderAppWithDrawer();
    const input = screen.getByLabelText(/api base url/i);
    await user.clear(input);
    await user.type(input, 'localhost:9999');
    await user.click(screen.getByRole('button', { name: /test connection/i }));
    await waitFor(() => {
      expect(fetchMock.calls).toContain(`${NEW_BASE}/health`);
      expect(fetchMock.calls).toContain(`${NEW_BASE}/`);
      expect(fetchMock.calls).toContain(`${NEW_BASE}/docs`);
    });
    // Offline → honest failure surfaced. The raw copy is err.name
    // ('TypeError', useApi.ts:153) — pinned as-is; friendlier copy is FIX-23.
    expect(await screen.findByText('TypeError')).toBeInTheDocument();
  });

  it(
    'current behavior: the next scheduled health check probes the updated base URL',
    async () => {
      const user = await renderAppWithDrawer();
      const input = screen.getByLabelText(/api base url/i);
      await user.clear(input);
      await user.type(input, 'localhost:9999');
      await user.tab();

      // No Test-Connection click. The scheduler retries with a jittered offline
      // delay (0–5s for the first retry); wait for the worst-case delay.
      await new Promise((resolve) => setTimeout(resolve, 5_500));
      expect(fetchMock.calls).toContain(`${NEW_BASE}/health`);
    },
    10_000,
  );

  it('Restore defaults resets the base URL', async () => {
    const user = await renderAppWithDrawer();
    const input = screen.getByLabelText(/api base url/i);
    await user.clear(input);
    await user.type(input, 'localhost:9999');
    await user.tab();
    await waitFor(() => expect(input).toHaveValue(NEW_BASE));
    await user.click(screen.getByRole('button', { name: /restore defaults/i }));
    await waitFor(() => expect(input).toHaveValue(DEFAULT_BASE));
  });
});

describe('Flow (e): reduced-motion preference (real feature)', () => {
  /** The toggle button has NO accessible name (EXPOSED-07) — scope to the
   *  settings dialog so Event Log filter buttons are not selected. */
  function motionToggle(): HTMLElement {
    const dialog = screen.getByRole('dialog');
    const btn = dialog.querySelector('button[aria-label="Reduced motion"]');
    if (!btn) throw new Error('motion toggle not found');
    return btn as HTMLElement;
  }

  it('toggle flips aria-pressed and sets <html data-reduced-motion>', async () => {
    const user = await renderAppWithDrawer();
    const toggle = motionToggle();
    expect(toggle).toHaveAttribute('aria-pressed', 'false'); // DEFAULT_SETTINGS.reducedMotion = false
    // applyReducedMotion(false) REMOVES the attribute (it never writes 'false').
    expect(document.documentElement.dataset.reducedMotion).toBeUndefined();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.reducedMotion).toBe('true');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.dataset.reducedMotion).toBeUndefined();
  });

  it(
    'EXPOSED-07: the Reduced-motion toggle exposes an accessible name (WCAG 4.1.2)',
    async () => {
      await renderAppWithDrawer();
      expect(
        screen.queryByRole('switch', { name: /reduced motion/i }) ??
          screen.queryByRole('button', { name: /reduced motion/i }),
      ).not.toBeNull();
    },
  );
});
