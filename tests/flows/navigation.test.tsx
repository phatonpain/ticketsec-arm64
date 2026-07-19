// @vitest-environment jsdom
/**
 * M1 — Real hash-based navigation: sidebar items switch views, hash syncs,
 * aria-current moves, unknown hash falls back to dashboard, back/forward works.
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
  window.location.hash = '';
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
  return { user, App };
}

function currentViewButton(label: string) {
  const nav = screen.getByRole('navigation', { name: /main navigation/i });
  return within(nav).getByRole('button', { name: label });
}

describe('M1: hash-synced view router', () => {
  it('defaults to Dashboard when no hash is present', async () => {
    await renderSettledApp();
    expect(screen.getByRole('heading', { name: /security operations center/i, level: 1 })).toBeInTheDocument();
    expect(currentViewButton('Dashboard')).toHaveAttribute('aria-current', 'page');
  });

  it('clicking Detections switches view, updates hash and aria-current', async () => {
    const { user } = await renderSettledApp();
    await user.click(currentViewButton('Detections'));
    await waitFor(() => expect(window.location.hash).toBe('#/detections'));
    expect(screen.getByRole('heading', { name: /detections/i, level: 1 })).toBeInTheDocument();
    expect(currentViewButton('Detections')).toHaveAttribute('aria-current', 'page');
    expect(currentViewButton('Dashboard')).not.toHaveAttribute('aria-current');
  });

  it('clicking Live Predictions renders the classify panel', async () => {
    const { user } = await renderSettledApp();
    await user.click(currentViewButton('Live Predictions'));
    await waitFor(() => expect(window.location.hash).toBe('#/predictions'));
    expect(screen.getByRole('heading', { name: /live predictions/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /ticket text/i })).toBeInTheDocument();
  });

  it('clicking Threat Analytics renders both chart panels', async () => {
    const { user } = await renderSettledApp();
    await user.click(currentViewButton('Threat Analytics'));
    await waitFor(() => expect(window.location.hash).toBe('#/threat-analytics'));
    expect(screen.getByRole('heading', { name: /threat analytics/i, level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('No category data available')).toBeInTheDocument();
    expect(await screen.findByText('No performance data available')).toBeInTheDocument();
  });

  it('clicking Model Registry renders real committed ML artifacts', async () => {
    const { user } = await renderSettledApp();
    await user.click(currentViewButton('Model Registry'));
    await waitFor(() => expect(window.location.hash).toBe('#/model-registry'));
    expect(screen.getByRole('heading', { name: /model registry/i, level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /model card/i })).toBeInTheDocument();
    expect(screen.getByText(/overall accuracy/i)).toBeInTheDocument();
  });

  it('clicking System Health renders the expanded health view', async () => {
    const { user } = await renderSettledApp();
    await user.click(currentViewButton('System Health'));
    await waitFor(() => expect(window.location.hash).toBe('#/system-health'));
    expect(screen.getByRole('heading', { name: /system health/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/probe status/i)).toBeInTheDocument();
  });

  it('Settings stays a drawer action and does NOT set aria-current', async () => {
    const { user } = await renderSettledApp();
    await user.click(currentViewButton('Settings'));
    await waitFor(() => expect(screen.getByRole('dialog', { name: /settings/i })).toBeInTheDocument());
    expect(currentViewButton('Settings')).not.toHaveAttribute('aria-current');
  });

  it('unknown hash falls back to Dashboard and normalizes to #/dashboard', async () => {
    window.location.hash = '#/unknown-view';
    await renderSettledApp();
    await waitFor(() => expect(window.location.hash).toBe('#/dashboard'));
    expect(screen.getByRole('heading', { name: /security operations center/i, level: 1 })).toBeInTheDocument();
  });

  it('browser back/forward navigates between views', async () => {
    const { user } = await renderSettledApp();
    await user.click(currentViewButton('Detections'));
    await waitFor(() => expect(window.location.hash).toBe('#/detections'));

    window.history.back();
    await waitFor(() => expect(window.location.hash).toBe('#/dashboard'));
    await waitFor(() => expect(screen.getByRole('heading', { name: /security operations center/i })).toBeInTheDocument());

    window.history.forward();
    await waitFor(() => expect(window.location.hash).toBe('#/detections'));
    await waitFor(() => expect(screen.getByRole('heading', { name: /detections/i })).toBeInTheDocument());
  });
});
