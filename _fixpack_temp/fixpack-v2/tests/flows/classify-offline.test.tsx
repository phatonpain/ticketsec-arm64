// @vitest-environment jsdom
/**
 * Flow (a) v2 — Classify submit while OFFLINE → honest error path.
 *
 * The most important Honesty Contract guardrail: when the API is unreachable,
 * submitting a ticket must surface an explicit failure, render NO fabricated
 * prediction, and write a REAL Event Log entry.
 *
 * REAL selectors (confirmed in source + evidence): textarea aria-label
 * "Ticket text" (LivePrediction.tsx:89), button "Classify Ticket" (:153),
 * panel id "live-prediction" (:57), error box title "Classification failed"
 * (:167), sample chips (:17-21), heading "Event Log" (EventLog.tsx:56).
 *
 * RED BY DESIGN (it.fails): the error path updates only the mutated useApi /
 * useEventLog singletons → subscribers never re-render (FIX-01 mechanism,
 * proven in hooks/storeIdentity.test.tsx). So today: no error box, button
 * stuck on "Classifying…", log entry invisible. These tests flip green with
 * the FIX-01 store replacement. The fetch-level honesty assertions are GREEN
 * today (no fabricated request/response anywhere).
 */

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CATEGORIES } from '../lib/fixtures';
import {
  enableActEnvironment,
  installFetchMock,
  installJsdomStubs,
  offlineHandler,
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
  vi.resetModules();
  localStorage.clear();
  installJsdomStubs();
  fetchMock = installFetchMock(offlineHandler());
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

async function renderSettledApp() {
  const App = await freshApp();
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText('TKT-8471'); // cached snapshot seeded → table populated
  return user;
}

describe('Flow (a): classify submit while offline', () => {
  it('submit is disabled until text is entered (evidenced disabled state)', async () => {
    const user = await renderSettledApp();
    const submit = screen.getByRole('button', { name: /classify ticket/i });
    expect(submit).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: /ticket text/i }), 'hello');
    expect(submit).toBeEnabled();
  });

  it('offline submit really POSTs to /predict and fabricates NOTHING (GREEN honesty)', async () => {
    const user = await renderSettledApp();
    await user.type(
      screen.getByRole('textbox', { name: /ticket text/i }),
      'Trojan horse detected in downloaded file',
    );
    await user.click(screen.getByRole('button', { name: /classify ticket/i }));

    // The request went out to the real classify endpoint…
    const predictCalls = fetchMock.requests.filter((r) => r.url.endsWith('/predict'));
    expect(predictCalls).toHaveLength(1);
    expect(predictCalls[0]?.init?.method).toBe('POST');
    // …and no category/confidence was invented anywhere in the panel.
    const panel = livePredictionPanel();
    for (const category of CATEGORIES) {
      expect(within(panel).queryByText(category, { exact: true })).not.toBeInTheDocument();
    }
    expect(within(panel).queryByText(/\b\d{1,3}(?:\.\d)?%/)).not.toBeInTheDocument();
  });

  it.fails(
    'FIX-01: offline submit must surface the honest "Classification failed" error box (never rendered — store-identity bail-out)',
    async () => {
      const user = await renderSettledApp();
      await user.type(screen.getByRole('textbox', { name: /ticket text/i }), 'trojan horse detected');
      await user.click(screen.getByRole('button', { name: /classify ticket/i }));
      await within(livePredictionPanel()).findByText(/classification failed/i, undefined, { timeout: 750 });
    },
  );

  it.fails(
    'FIX-01: the button must show "Classifying…" feedback while a prediction is in flight (no loading feedback today — the submit-time local setStates bail out, so no re-render ever reads loading=true)',
    async () => {
      const user = await renderSettledApp();
      // Make the prediction hang so the loading state is observable.
      fetchMock.setHandler((url) =>
        url.endsWith('/predict') ? new Promise<Response>(() => undefined) : offlineHandler()(url),
      );
      await user.type(screen.getByRole('textbox', { name: /ticket text/i }), 'ddos attack pattern');
      await user.click(screen.getByRole('button', { name: /classify ticket/i }));
      await screen.findByRole('button', { name: /classifying…/i }, { timeout: 750 });
    },
  );

  it.fails(
    'FIX-01: a REAL Event Log entry is appended for the failed classification (written to the store, never displayed)',
    async () => {
      const user = await renderSettledApp();
      await user.type(screen.getByRole('textbox', { name: /ticket text/i }), 'multiple failed login attempts');
      await user.click(screen.getByRole('button', { name: /classify ticket/i }));
      // App.handleClassifyError → addError('Classification failed · <msg>') (App.tsx:202-204)
      await screen.findByText(/classification failed ·/i, undefined, { timeout: 750 });
    },
  );

  it.fails(
    'EXPOSED-06: the log entry must carry the REAL network error, not the fallback — LivePrediction.tsx:48 reads a stale `error` closure → "API request failed"',
    async () => {
      const user = await renderSettledApp();
      await user.type(screen.getByRole('textbox', { name: /ticket text/i }), 'data export without approval');
      await user.click(screen.getByRole('button', { name: /classify ticket/i }));
      // Correct behavior: 'Classification failed · Failed to fetch'.
      // Real behavior (even after FIX-01 republishes stores): the async
      // continuation uses the render-time `error` (null → fallback string).
      await screen.findByText(/classification failed · failed to fetch/i, undefined, { timeout: 750 });
    },
  );

  it('sample chips classify immediately (POST body carries the chip text)', async () => {
    const user = await renderSettledApp();
    await user.click(screen.getByRole('button', { name: /trojan horse detected in downloaded file/i }));
    const predictCalls = fetchMock.requests.filter((r) => r.url.endsWith('/predict'));
    expect(predictCalls).toHaveLength(1);
    expect(predictCalls[0]?.init?.body).toBe(
      JSON.stringify({ text: 'trojan horse detected in downloaded file' }),
    );
  });
});
