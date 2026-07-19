// @vitest-environment jsdom
/**
 * M3 — ThreatBarChart renders the standard EmptyState when no category data
 * exists; chart chrome is not shown.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThreatBarChart } from '../../src/components/ThreatBarChart';
import {
  enableActEnvironment,
  installFetchMock,
  installJsdomStubs,
  networkError,
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
  installFetchMock(() => networkError());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ThreatBarChart empty state', () => {
  it('shows the standard empty state when the API/cache has no categories', async () => {
    render(<ThreatBarChart />);
    expect(await screen.findByText('No category data available')).toBeInTheDocument();
    expect(screen.getByText(/Detections are computed by the inference API/)).toBeInTheDocument();
    expect(screen.getByText('Populates automatically when the inference API reconnects.')).toBeInTheDocument();
    expect(screen.queryByTestId('echart-stub')).not.toBeInTheDocument();
  });
});
