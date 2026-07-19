// @vitest-environment jsdom
/**
 * Flow (c) v3 — M8-PHASE1: with page size 20, the six cached snapshot rows
 * now fit on a single page. Pagination controls are still present and
 * correctly disabled when everything fits.
 */

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
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

describe('Flow (c): pagination over cached snapshot rows', () => {
  it('page 1: all 6 rows, "Showing 1–6 of 6", Previous and Next disabled', async () => {
    await renderSettledApp();
    expect(screen.getByText(/showing 1–6 of 6/i)).toBeInTheDocument();
    expect(screen.getByText(/^page 1 of 1 · 20 per page$/i)).toBeInTheDocument();
    expect(screen.getByText('TKT-8471')).toBeInTheDocument();
    expect(screen.getByText('TKT-8466')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^next$/i })).toBeDisabled();
  });
});
