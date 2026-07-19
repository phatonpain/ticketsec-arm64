// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, act } from '@testing-library/react';
import { afterEach, afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

beforeAll(() => {
  // Suppress React's expected error logging for the intentional throws below.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
});

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('boom');
  }
  return <div data-testid="child">healthy</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary title="Test View">
        <div data-testid="child">healthy</div>
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders a fallback when a child throws', () => {
    const { rerender } = render(
      <ErrorBoundary title="Test View">
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );
    rerender(
      <ErrorBoundary title="Test View">
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Test View failed to load')).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
  });

  it('resets and re-renders children once the error condition is cleared', () => {
    const { rerender } = render(
      <ErrorBoundary title="Test View">
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );
    rerender(
      <ErrorBoundary title="Test View">
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Clear the error condition first, then trigger the boundary reset.
    rerender(
      <ErrorBoundary title="Test View">
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );
    act(() => {
      screen.getByText('Try again').click();
    });

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
