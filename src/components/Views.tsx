import React, { Suspense } from 'react';
const ThreatBarChart = React.lazy(() => import('./ThreatBarChart').then(m => ({ default: m.ThreatBarChart })));
const PerformanceLineChart = React.lazy(() => import('./PerformanceLineChart').then(m => ({ default: m.PerformanceLineChart })));
const ModelRegistry = React.lazy(() => import('./ModelRegistry').then(m => ({ default: m.ModelRegistry })));
import { Search } from 'lucide-react';
import { ClassificationTable } from './ClassificationTable';
import { LivePrediction } from './LivePrediction';
import { SystemMonitor } from './SystemMonitor';
import { ChartSkeleton } from './ChartSkeleton';
const TimelineChart = React.lazy(() => import('./TimelineChart').then(m => ({ default: m.TimelineChart })));
import { CategoryCountBlocks } from './CategoryCountBlocks';
import { HealthStatRow } from './HealthStatRow';
import { ErrorBoundary } from './ErrorBoundary';
import { useTicketQuery } from '../hooks/useTicketQuery';
import { useTickets } from '../hooks/useTickets';
import type { PredictionResult } from '../hooks/useApi';

type EnrichedResult = Omit<PredictionResult, 'processing_time_ms'> & {
  category: string;
  processing_time_ms: string;
};

interface PredictionsViewProps {
  onClassify?: (result: EnrichedResult, text: string) => void;
  onError?: (text: string, error: string) => void;
  onSubmit?: (text: string) => void;
}

export const DetectionsView: React.FC = () => {
  const { query, setQuery, clear } = useTicketQuery();
  return (
    <ErrorBoundary title="Detections">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--density-card-gap)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <Search size={16} color="var(--text-muted)" aria-hidden />
        <input
          id="ticket-query-input"
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search tickets…"
          aria-label="Search tickets"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: 'var(--font-size-base)',
            outline: 'none',
          }}
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            style={{
              fontSize: 'var(--font-size-micro)',
              color: 'var(--text-muted)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}
      </div>
      <ClassificationTable />
    </div>
    </ErrorBoundary>
  );
};

export const PredictionsView: React.FC<PredictionsViewProps> = ({ onClassify, onError, onSubmit }) => (
  <ErrorBoundary title="Live Predictions">
    <div style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>
      <LivePrediction onClassify={onClassify} onError={onError} onSubmit={onSubmit} />
    </div>
  </ErrorBoundary>
);

export const ThreatAnalyticsView: React.FC = () => {
  const { tickets } = useTickets();
  return (
    <ErrorBoundary title="Threat Analytics">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--density-card-gap)' }}>
        <Suspense fallback={<ChartSkeleton height={260} />}>
          <TimelineChart tickets={tickets} />
        </Suspense>
        <CategoryCountBlocks tickets={tickets} />
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)', gap: 'var(--density-card-gap)' }}>
          <Suspense fallback={<ChartSkeleton height={320} />}>
            <ThreatBarChart />
          </Suspense>
          <Suspense fallback={<ChartSkeleton height={280} />}>
            <PerformanceLineChart />
          </Suspense>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export const ModelRegistryView: React.FC = () => (
  <ErrorBoundary title="Model Registry">
    <Suspense fallback={<ChartSkeleton height={480} />}>
      <ModelRegistry />
    </Suspense>
  </ErrorBoundary>
);

export const SystemHealthView: React.FC = () => (
  <ErrorBoundary title="System Health">
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--density-card-gap)' }}>
      <HealthStatRow />
      <SystemMonitor />
    </div>
  </ErrorBoundary>
);
