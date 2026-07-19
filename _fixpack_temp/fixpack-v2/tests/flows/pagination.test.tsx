// @vitest-environment jsdom
/**
 * Flow (c) v2 — Next/Previous pagination over the six cached snapshot rows
 * (page size 5). Verifies FIX-28's claim (pagination math is correct) against
 * the REAL components with REAL selectors:
 *   'Previous'/'Next' buttons, 'Showing A–B of N', 'Page N'
 *   (ClassificationTable.tsx:329-368). All pagination state is local
 *   useState, so this flow is fully GREEN even with the broken stores.
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
  it('page 1: 5 rows, "Showing 1–5 of 6", Previous disabled, Next enabled', async () => {
    await renderSettledApp();
    expect(screen.getByText(/showing 1–5 of 6/i)).toBeInTheDocument();
    expect(screen.getByText(/^page 1$/i)).toBeInTheDocument();
    expect(screen.getByText('TKT-8471')).toBeInTheDocument();
    expect(screen.queryByText('TKT-8466')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^next$/i })).toBeEnabled();
  });

  it('Next shows the 6th row ("Showing 6–6 of 6") and disables itself', async () => {
    const user = await renderSettledApp();
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByText(/showing 6–6 of 6/i)).toBeInTheDocument();
    expect(screen.getByText(/^page 2$/i)).toBeInTheDocument();
    expect(screen.getByText('TKT-8466')).toBeInTheDocument();
    expect(screen.queryByText('TKT-8471')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^next$/i })).toBeDisabled();
  });

  it('Previous returns to page 1', async () => {
    const user = await renderSettledApp();
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /previous/i }));
    expect(screen.getByText(/showing 1–5 of 6/i)).toBeInTheDocument();
    expect(screen.getByText('TKT-8471')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
  });
});
