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

function makeTicket(id: string, iso: string): Ticket {
  return {
    id,
    subject: 'sample',
    category: 'Phishing',
    confidence: 0.9,
    status: 'Resolved',
    assignedTo: 'Auto',
    createdAt: new Date(iso),
    source: 'live',
  };
}

describe('TimelineChart empty state', () => {
  it('renders the standard EmptyState when no tickets exist', () => {
    render(<TimelineChart tickets={[]} />);
    expect(screen.getByText('Collecting live detections')).toBeInTheDocument();
    expect(
      screen.getByText('Submit a ticket to populate this chart.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Live Predictions →' })).toBeInTheDocument();
  });

  it('renders the EmptyState for a single-day series (invisible symbol-less point)', () => {
    const tickets: Ticket[] = [makeTicket('TKT-1', '2026-07-19T12:00:00Z')];
    render(<TimelineChart tickets={tickets} />);
    expect(screen.getByText('Collecting live detections')).toBeInTheDocument();
    expect(screen.queryByTestId('echart-stub')).not.toBeInTheDocument();
  });

  it('renders the ECharts stub when tickets span at least two days', () => {
    const tickets: Ticket[] = [
      makeTicket('TKT-1', '2026-07-18T12:00:00Z'),
      makeTicket('TKT-2', '2026-07-19T12:00:00Z'),
    ];
    render(<TimelineChart tickets={tickets} />);
    expect(screen.queryByText('Collecting live detections')).not.toBeInTheDocument();
    expect(screen.getByTestId('echart-stub')).toBeInTheDocument();
  });
});
