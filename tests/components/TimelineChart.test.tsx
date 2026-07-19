// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimelineChart } from '../../src/components/TimelineChart';

vi.mock('../../src/components/ECharts', async () => {
  const { createElement } = await import('react');
  return {
    ECharts: (props: { style?: Record<string, unknown> }) =>
      createElement('div', { 'data-testid': 'echart-stub', style: props.style }),
  };
});
import type { Ticket } from '../../src/hooks/useTickets';

afterEach(() => {
  cleanup();
});

describe('TimelineChart empty state', () => {
  it('renders collecting EmptyState with a real count when no tickets exist', () => {
    render(<TimelineChart tickets={[]} />);
    expect(screen.getByText('Collecting live detections')).toBeInTheDocument();
    expect(screen.getByText(/0 detections so far/)).toBeInTheDocument();
    expect(screen.getByText(/Open the command palette/)).toBeInTheDocument();
  });

  it('renders the ECharts stub when tickets exist', () => {
    const tickets: Ticket[] = [
      {
        id: 'TKT-1',
        subject: 'phishing attempt',
        category: 'Phishing',
        confidence: 0.9,
        status: 'Resolved',
        assignedTo: 'Auto',
        createdAt: new Date('2026-07-19T12:00:00Z'),
        source: 'live',
      },
    ];
    render(<TimelineChart tickets={tickets} />);
    expect(screen.queryByText('Collecting live detections')).not.toBeInTheDocument();
  });
});
