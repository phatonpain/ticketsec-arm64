// @vitest-environment jsdom
/**
 * D1 — ModelRegistry render tests.
 *
 * Verifies that all registry sections render committed artifacts rather than
 * pending empty states.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ModelRegistry } from '../../src/components/ModelRegistry';
import { enableActEnvironment, installJsdomStubs } from '../flows/testUtils';

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
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ModelRegistry committed artifact rendering', () => {
  it('renders Model Card metadata (size, sha, quantization delta)', async () => {
    render(<ModelRegistry />);
    expect(await screen.findByText('Model Card')).toBeInTheDocument();
    expect(screen.getByText(/0\.38 MB/)).toBeInTheDocument();
    expect(screen.getByText(/401[\s,]?872 bytes/i)).toBeInTheDocument();
    expect(screen.getByText(/\+0\.16 pp vs sklearn baseline/)).toBeInTheDocument();
  });

  it('renders Accuracy panel with 92.94%', async () => {
    render(<ModelRegistry />);
    expect(await screen.findByText('Accuracy & Eval')).toBeInTheDocument();
    expect(screen.getByText('92.94%')).toBeInTheDocument();
    expect(screen.getByText('609')).toBeInTheDocument();
  });

  it('renders Latency panel with p50/p95 from t4g.micro', async () => {
    render(<ModelRegistry />);
    expect(await screen.findByText('Latency on Graviton')).toBeInTheDocument();
    expect(screen.getByText('0.24ms')).toBeInTheDocument();
    expect(screen.getByText('0.29ms')).toBeInTheDocument();
    expect(screen.getByText(/n=100/)).toBeInTheDocument();
  });

  it('does not show pending empty states for ready artifacts', async () => {
    render(<ModelRegistry />);
    await screen.findByText('Model Card');
    expect(screen.queryByText('Model card pending')).not.toBeInTheDocument();
    expect(screen.queryByText('Eval results pending')).not.toBeInTheDocument();
    expect(screen.queryByText('Latency benchmarks pending')).not.toBeInTheDocument();
    expect(screen.queryByText('Confusion matrix pending')).not.toBeInTheDocument();
    expect(screen.queryByText('Probe suite pending')).not.toBeInTheDocument();
  });
});
