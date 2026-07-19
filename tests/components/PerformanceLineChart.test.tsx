// @vitest-environment jsdom
/**
 * M3 — PerformanceLineChart renders the standard EmptyState when no performance
 * data exists; chart chrome (axes/legend) is not shown.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PerformanceLineChart } from '../../src/components/PerformanceLineChart';
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

describe('PerformanceLineChart empty state', () => {
  it('shows the standard empty state when the API/cache has no performance points', async () => {
    render(<PerformanceLineChart />);
    expect(await screen.findByText('No performance data available')).toBeInTheDocument();
    expect(screen.getByText(/Accuracy history is served by the inference API/)).toBeInTheDocument();
    expect(screen.getByText('Offline eval results live in Model Registry →.')).toBeInTheDocument();
    expect(screen.queryByTestId('echart-stub')).not.toBeInTheDocument();
  });
});
