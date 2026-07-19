import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  title?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Per-view error boundary (AGENTS.md convention: one error boundary per view
 * root). Catches render-phase errors inside a view and renders an honest
 * fallback card instead of letting the whole app crash.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    const { children, title = 'This view' } = this.props;
    if (!this.state.hasError) return children;

    return (
      <div
        role="alert"
        aria-live="assertive"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--density-card-pad)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          minHeight: 260,
          textAlign: 'center',
        }}
      >
        <AlertTriangle size={32} color="var(--color-sev-critical)" aria-hidden />
        <div>
          <h2
            style={{
              fontSize: 'var(--font-size-md)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 4,
            }}
          >
            {title} failed to load
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
            Something went wrong while rendering this panel. The rest of the app is still usable.
          </p>
        </div>
        <button
          type="button"
          onClick={this.handleReset}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-button-secondary)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 500,
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}
