/**
 * M8-PHASE1 — Dashboard composition (Splunk ES Incident Review pattern).
 *
 * Analytics row: Threat Distribution, Severity Mix, Model Footprint,
 * Model Performance. Hero classifications table with bulk selection + resolve.
 * Status/filter chrome lives in the global Header so it is not duplicated here.
 */

import React, { Suspense } from 'react';
import { ClassificationTable } from './ClassificationTable';
import { ChartSkeleton } from './ChartSkeleton';
const ThreatDistributionDonut = React.lazy(() => import('./ThreatDistributionDonut').then(m => ({ default: m.ThreatDistributionDonut })));
const SeverityMixDonut = React.lazy(() => import('./SeverityMixDonut').then(m => ({ default: m.SeverityMixDonut })));
import { ModelPerformancePanel } from './ModelPerformancePanel';
import { useApi } from '../hooks/useApi';
import { useTickets } from '../hooks/useTickets';
import { ErrorBoundary } from './ErrorBoundary';

const ModelHealthDonut = React.lazy(() => import('./ModelHealthDonut').then(m => ({ default: m.ModelHealthDonut })));

export const Dashboard: React.FC = () => {
  const { status } = useApi();
  const { tickets } = useTickets();

  const analyticsSource: 'live' | 'cache' | 'none' =
    tickets.length === 0
      ? 'none'
      : status === 'live'
        ? 'live'
        : 'cache';

  return (
    <ErrorBoundary title="Dashboard">
      {/* Analytics row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 'var(--density-card-gap)' }}>
        <Suspense fallback={<ChartSkeleton height={240} />}>
          <ThreatDistributionDonut tickets={tickets} source={analyticsSource} />
        </Suspense>
        <Suspense fallback={<ChartSkeleton height={240} />}>
          <SeverityMixDonut tickets={tickets} source={analyticsSource} />
        </Suspense>
        <Suspense fallback={<ChartSkeleton height={280} />}>
          <ModelHealthDonut />
        </Suspense>
        <ModelPerformancePanel />
      </div>

      {/* Hero table */}
      <ClassificationTable />
    </ErrorBoundary>
  );
};
