// @vitest-environment jsdom
/**
 * D1 — ModelPerformancePanel render tests.
 *
 * Verifies that the panel renders accuracy from eval_results.json and falls
 * back to the committed t4g.micro latency benchmark when the API has no live
 * performance history.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ModelPerformancePanel } from '../../src/components/ModelPerformancePanel';
import {
  enableActEnvironment,
  installFetchMock,
  installJsdomStubs,
  offlineHandler,
} from '../flows/testUtils';

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

describe('ModelPerformancePanel offline fallback', () => {
  it('renders accuracy from eval_results.json with provenance', async () => {
    render(<ModelPerformancePanel />);
    expect(await screen.findByText('92.94%')).toBeInTheDocument();
    expect(screen.getByText('from eval_results.json')).toBeInTheDocument();
  });

  it('falls back to committed t4g.micro latency benchmark when API has no history', async () => {
    render(<ModelPerformancePanel />);
    expect(await screen.findByText('0.22ms')).toBeInTheDocument();
    expect(screen.getByText('Offline benchmark')).toBeInTheDocument();
  });

  it('renders throughput as unavailable with honest caption', async () => {
    render(<ModelPerformancePanel />);
    expect(await screen.findByText('—')).toBeInTheDocument();
    expect(screen.getByText('Last known · cached snapshot')).toBeInTheDocument();
  });

  it('mentions every artifact source in the footer', async () => {
    render(<ModelPerformancePanel />);
    expect(await screen.findAllByText(/eval_results\.json/)).toHaveLength(2);
    expect(screen.getAllByText(/latency_t4g_micro\.json/)).toHaveLength(1);
  });
});
