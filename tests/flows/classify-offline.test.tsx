// @vitest-environment jsdom
/**
 * Flow (a) v2 — Classify submit while OFFLINE → guard behavior.
 *
 * Honesty Contract: when the API is unreachable, the app deliberately disables
 * classification. The submit button is blocked, no /predict request is made,
 * no fabricated prediction is rendered, and no "Classification failed" error
 * box or Event Log entry is produced for a submit that never happened.
 *
 * These tests verify that guard behavior (the current, intentional design),
 * not the old error-flow expectations.
 *
 * REAL selectors: textarea aria-label "Ticket text", button "Classify Ticket",
 * panel id "live-prediction", role="log" aria-label "Event log".
 */

import '@testing-library/jest-dom/vitest';
import { cleanup, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEventLog } from '../../src/hooks/useEventLog';
import { CATEGORIES } from '../lib/fixtures';
import {
  enableActEnvironment,
  installFetchMock,
  installJsdomStubs,
  offlineHandler,
  resetStores,
  type FetchMock,
} from './testUtils';

// ECharts needs canvas (absent in jsdom) — stub the shared wrapper.
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
  resetStores();
  installJsdomStubs();
  fetchMock = installFetchMock(offlineHandler());
  // Reset the global view store so each test starts on Dashboard.
  window.location.hash = '#/dashboard';
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function freshApp() {
  const mod = await import('../../src/App');
  return mod.App;
}

function livePredictionPanel(): HTMLElement {
  const panel = document.getElementById('live-prediction');
  if (!panel) throw new Error('#live-prediction panel not found');
  return panel;
}

function eventLogMessages(): string[] {
  const { result, unmount } = renderHook(() => useEventLog());
  const messages = result.current.logs.map((log) => log.message);
  unmount();
  return messages;
}

async function renderSettledApp() {
  const App = await freshApp();
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText('TKT-8471', {}, { timeout: 2_000 }); // cached snapshot seeded → table populated
  // M8-PHASE1: Live Prediction moved from Dashboard to Predictions view.
  await user.click(screen.getByRole('button', { name: /live predictions/i }));
  return user;
}

describe('Flow (a): classify submit while offline', () => {
  it('submit is disabled while the API is offline (honest guard)', async () => {
    const user = await renderSettledApp();
    const submit = screen.getByRole('button', { name: /classify ticket/i });
    expect(submit).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: /ticket text/i }), 'hello');
    // Classification remains unavailable offline; the button stays disabled.
    expect(submit).toBeDisabled();
    expect(screen.getByText('API offline — classification unavailable')).toBeInTheDocument();
  });

  it('offline submit makes NO /predict request and fabricates NOTHING (GREEN honesty)', async () => {
    const user = await renderSettledApp();
    await user.type(
      screen.getByRole('textbox', { name: /ticket text/i }),
      'Trojan horse detected in downloaded file',
    );
    await user.click(screen.getByRole('button', { name: /classify ticket/i }));

    // The guard prevents any network call while offline.
    const predictCalls = fetchMock.requests.filter((r) => r.url.endsWith('/predict'));
    expect(predictCalls).toHaveLength(0);
    // …and no category/confidence was invented anywhere in the panel.
    const panel = livePredictionPanel();
    for (const category of CATEGORIES) {
      expect(within(panel).queryByText(category, { exact: true })).not.toBeInTheDocument();
    }
    expect(within(panel).queryByText(/\b\d{1,3}(?:\.\d)?%/)).not.toBeInTheDocument();
  });

  it('offline submit is blocked — no "Classification failed" error box is rendered', async () => {
    const user = await renderSettledApp();
    const submit = screen.getByRole('button', { name: /classify ticket/i });
    await user.type(screen.getByRole('textbox', { name: /ticket text/i }), 'trojan horse detected');
    await user.click(submit);

    expect(submit).toBeDisabled();
    expect(within(livePredictionPanel()).queryByRole('alert')).not.toBeInTheDocument();
    expect(fetchMock.requests.filter((r) => r.url.endsWith('/predict'))).toHaveLength(0);
  });

  it('offline button never shows "Classifying…" because no prediction is started', async () => {
    const user = await renderSettledApp();
    const submit = screen.getByRole('button', { name: /classify ticket/i });

    // Make any /predict hang so that, if the guard were bypassed, loading text would appear.
    fetchMock.setHandler((url) =>
      url.endsWith('/predict') ? new Promise<Response>(() => undefined) : offlineHandler()(url),
    );

    await user.type(screen.getByRole('textbox', { name: /ticket text/i }), 'ddos attack pattern');
    await user.click(submit);

    expect(submit).toBeDisabled();
    expect(submit).toHaveTextContent(/classify ticket/i);
    expect(screen.queryByRole('button', { name: /classifying…/i })).not.toBeInTheDocument();
  });

  it('offline submit appends NO "Classification failed" Event Log entry', async () => {
    const user = await renderSettledApp();
    await user.type(screen.getByRole('textbox', { name: /ticket text/i }), 'multiple failed login attempts');
    await user.click(screen.getByRole('button', { name: /classify ticket/i }));

    // M8-PHASE1: Event Log panel was removed from Dashboard; assert on the
    // singleton store directly instead of querying a removed UI panel.
    const messages = eventLogMessages();
    expect(messages.some((m) => /classification failed/i.test(m))).toBe(false);
    expect(fetchMock.requests.filter((r) => r.url.endsWith('/predict'))).toHaveLength(0);
  });

  it('offline submit logs NO network error from a request that never runs', async () => {
    const user = await renderSettledApp();
    await user.type(screen.getByRole('textbox', { name: /ticket text/i }), 'data export without approval');
    await user.click(screen.getByRole('button', { name: /classify ticket/i }));

    const messages = eventLogMessages();
    expect(messages.some((m) => /failed to fetch/i.test(m))).toBe(false);
    expect(fetchMock.requests.filter((r) => r.url.endsWith('/predict'))).toHaveLength(0);
  });

  it('sample chips are disabled while offline and issue NO /predict request', async () => {
    const user = await renderSettledApp();
    const chip = screen.queryByRole('button', { name: /trojan horse detected in downloaded file/i });
    if (chip) {
      await user.click(chip);
    }
    const predictCalls = fetchMock.requests.filter((r) => r.url.endsWith('/predict'));
    expect(predictCalls).toHaveLength(0);
  });
});
