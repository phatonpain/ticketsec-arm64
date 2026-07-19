// @vitest-environment jsdom
/**
 * M8-PHASE1 — Dashboard composition tests.
 *
 * Verifies the Splunk ES-style dashboard: analytics row (Threat Distribution,
 * Severity Mix, Model Footprint, Model Performance) and the hero classifications
 * table. Status/filter chrome is owned by the global Header and must NOT be
 * duplicated inside Dashboard.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Dashboard } from '../../src/components/Dashboard';
import { seedTickets } from '../../src/hooks/useTickets';
import {
  enableActEnvironment,
  installFetchMock,
  installJsdomStubs,
  offlineHandler,
} from '../flows/testUtils';

vi.mock('../../src/components/ECharts', async () => {
  const { createElement } = await import('react');
  return {
    ECharts: (props: { style?: Record<string, unknown> }) =>
      createElement('div', { 'data-testid': 'echart-stub', style: props.style }),
  };
});

enableActEnvironment();

beforeEach(() => {
  localStorage.clear();
  installJsdomStubs();
  installFetchMock(offlineHandler());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Dashboard composition', () => {
  it('renders the analytics row panels', async () => {
    render(<Dashboard />);
    expect(await screen.findByText('Threat Distribution')).toBeInTheDocument();
    expect(await screen.findByText('Severity Mix')).toBeInTheDocument();
    expect(await screen.findByText('Model Footprint')).toBeInTheDocument();
    expect(await screen.findByText('Model Performance')).toBeInTheDocument();
  });

  it('renders the hero classifications table', async () => {
    seedTickets((await import('../lib/fixtures')).snapshotTickets());
    render(<Dashboard />);
    expect(await screen.findByRole('button', { name: /export csv/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /ticket id/i })).toBeInTheDocument();
  });

  it('does not render the old KPI row, Event Log or Live Prediction panels', async () => {
    render(<Dashboard />);
    await screen.findByText('Threat Distribution');
    expect(screen.queryByText('MODEL LATENCY')).not.toBeInTheDocument();
    expect(screen.queryByText('Event Log')).not.toBeInTheDocument();
    expect(screen.queryByRole('log', { name: /event log/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Live Classification')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /ticket text/i })).not.toBeInTheDocument();
  });

  it('does not duplicate the global status/filter rail', async () => {
    render(<Dashboard />);
    await screen.findByText('Threat Distribution');
    // These are owned by Header.tsx, not Dashboard.tsx.
    expect(screen.queryByText(/Probe/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /refresh data/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /notifications/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /settings/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Synced/i)).not.toBeInTheDocument();
  });
});
