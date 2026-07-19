/**
 * fixpack-v2 — applies: FIX-11, FIX-15, FIX-16, FIX-19, FIX-23
 * (C-16/C-17/C-18), FIX-24, FIX-29.
 * Original: src/App.tsx (395 lines).
 * NOTE: original lines 22, 245, 253, 276-277, 289-290, 379-380 were
 * truncated in the source PDF ("…"); reconstructions are marked inline.
 *
 * Key changes vs original:
 *  - FIX-24 [CONFIRMED]: App rendered its OWN inline footer (same-tab API
 *    Docs link, no target) while src/components/Footer.tsx — which already
 *    had target="_blank" — was dead code. App now renders <Footer />.
 *  - FIX-11: KPI icon chips drop the four pastel rgba tints for the neutral
 *    icon well (--color-icon-chip-bg + --text-secondary); sparkline colors
 *    come from chartTokens (the sanctioned hex mirror), not raw '#6366F1'.
 *  - FIX-23: '8.73MB' → '8.73 MB' (C-16); footprint detail/tooltip (C-17/18).
 *  - FIX-29: main marginLeft 260 → var(--layout-sidebar-w, 240px) (same
 *    token the Sidebar uses).
 *  - Event Log dedupe: status-transition logging (restored/lost) is now
 *    owned by the useApi single writer — this effect would double-log.
 *  - Reconstructed truncated badge ternaries: latency DOWN is positive,
 *    throughput UP is positive (flagged in PATCHES_V2.md).
 */

import React, { Suspense, useEffect, useState, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { KpiCard } from './components/KpiCard';
import { ChartSkeleton } from './components/ChartSkeleton';
import { SystemMonitor } from './components/SystemMonitor';
import { ClassificationTable } from './components/ClassificationTable';
import { EventLog } from './components/EventLog';
import { LivePrediction } from './components/LivePrediction';
import { HelpModal } from './components/HelpModal';
import { SettingsDrawer } from './components/SettingsDrawer';
import { Footer } from './components/Footer';
import { Zap, Activity, Target, Box } from 'lucide-react';
import { useEventLog } from './hooks/useEventLog';
import { useTickets, loadTicketSnapshot } from './hooks/useTickets';
import { extractLatencySeries, extractThroughputSeries } from './lib/utils';
import { chartColors } from './lib/chartTokens';
import { useApi, type PredictionResult, type Classification, type PerformancePoint } from './hooks/useApi';
import evalResults from '../model/eval_results.json';
import { useSettingsDrawer, closeSettingsDrawer } from './hooks/useSettingsDrawer';
import { focusTicketQuery } from './hooks/useTicketQuery';

const ThreatBarChart = React.lazy(() => import('./components/ThreatBarChart').then(m => ({ default: m.ThreatBarChart })));
// Reconstructed (PDF-truncated): `.then(m => ({ default: m.PerformanceLineChart })))`
const PerformanceLineChart = React.lazy(() => import('./components/PerformanceLineChart').then(m => ({ default: m.PerformanceLineChart })));
const ModelHealthDonut = React.lazy(() => import('./components/ModelHealthDonut').then(m => ({ default: m.ModelHealthDonut })));

type EnrichedResult = Omit<PredictionResult, 'processing_time_ms'> & {
  category: string;
  processing_time_ms: string;
};

interface PerClassMetric {
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

interface EvalResults {
  status: 'OK' | 'PENDING' | string;
  overall_accuracy: number | null;
  per_class_metrics: Record<string, PerClassMetric> | null;
}

const typedEvalResults = evalResults as EvalResults;

function macroAverage(metrics: Record<string, PerClassMetric>, key: keyof PerClassMetric): number {
  const values = Object.values(metrics).map(m => m[key]);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function getAccuracyMetrics(): { value: string; detail: string; pending: boolean } {
  if (typedEvalResults.status !== 'OK' || typedEvalResults.overall_accuracy == null) {
    return { value: '—', detail: 'Awaiting eval — see MODEL_CARD.md', pending: true };
  }
  const accuracy = typedEvalResults.overall_accuracy;
  const perClass = typedEvalResults.per_class_metrics;
  const f1 = perClass ? macroAverage(perClass, 'f1') : null;
  const precision = perClass ? macroAverage(perClass, 'precision') : null;
  const detailParts: string[] = [];
  if (precision != null) detailParts.push(`Precision: ${precision.toFixed(2)}`);
  if (f1 != null) detailParts.push(`F1: ${f1.toFixed(2)}`);
  return {
    value: `${(accuracy * 100).toFixed(0)}%`,
    detail: detailParts.join(' · ') || 'Held-out test accuracy',
    pending: false,
  };
}

function mapClassificationToTicket(c: Classification) {
  return {
    id: c.id,
    subject: c.subject,
    category: c.category,
    confidence: c.confidence,
    status: c.status,
    assignedTo: c.assignedTo,
    createdAt: new Date(c.createdAt),
  };
}

function formatLatency(latency?: number): string {
  if (latency === undefined || latency === null) return '—';
  return latency < 1 ? `${latency.toFixed(2)}ms` : `${latency.toFixed(1)}ms`;
}

function formatThroughput(throughput?: number): string {
  if (throughput === undefined || throughput === null) return '—';
  return throughput.toLocaleString('en-US');
}

function extractLatestKpis(performance: PerformancePoint[]) {
  const latest = performance.length > 0 ? performance[performance.length - 1] : undefined;
  return {
    latency: formatLatency(latest?.latency_ms),
    throughput: formatThroughput(latest?.throughput),
  };
}

function formatDelta(current?: number, previous?: number): string | null {
  if (current === undefined || previous === undefined || previous === 0) return null;
  const delta = current - previous;
  const pct = (delta / previous) * 100;
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

export const App: React.FC = () => {
  const { status, lastSync, getPerformance, getClassifications, checkHealth } = useApi();
  const { addInfo, addError } = useEventLog(50);
  const { seed, add } = useTickets();
  const settingsOpen = useSettingsDrawer();

  const [latencyValue, setLatencyValue] = useState<string>('—');
  const [throughputValue, setThroughputValue] = useState<string>('—');
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);
  const [throughputHistory, setThroughputHistory] = useState<number[]>([]);
  const [latencyDelta, setLatencyDelta] = useState<string | null>(null);
  const [throughputDelta, setThroughputDelta] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [performance, classifications] = await Promise.all([
        getPerformance(),
        getClassifications(),
      ]);
      if (!mounted) return;

      const hasLivePerformance = performance.length > 0;
      const perfSource = hasLivePerformance ? performance : [];
      const kpis = extractLatestKpis(perfSource);
      const latencySeries = extractLatencySeries(perfSource);
      const throughputSeries = extractThroughputSeries(perfSource);

      setLatencyValue(kpis.latency);
      setThroughputValue(kpis.throughput);
      setLatencyHistory(latencySeries);
      setThroughputHistory(throughputSeries);

      const prevLatency = latencySeries.length > 1 ? latencySeries[latencySeries.length - 2] : undefined;
      const prevThroughput = throughputSeries.length > 1 ? throughputSeries[throughputSeries.length - 2] : undefined;
      const lastLatency = latencySeries[latencySeries.length - 1];
      const lastThroughput = throughputSeries[throughputSeries.length - 1];
      setLatencyDelta(hasLivePerformance ? formatDelta(lastLatency, prevLatency) : null);
      setThroughputDelta(hasLivePerformance ? formatDelta(lastThroughput, prevThroughput) : null);

      if (classifications.length > 0) {
        seed(classifications.map(mapClassificationToTicket));
      } else if (status !== 'live') {
        const loaded = await loadTicketSnapshot();
        if (loaded) {
          addInfo('Cached ticket snapshot loaded');
        }
      }

      if (hasLivePerformance || classifications.length > 0) {
        addInfo('Cached performance and classification data loaded');
      }
    };
    load();
    return () => { mounted = false; };
  }, [getPerformance, getClassifications, seed, addInfo, status]);

  /* NOTE: status-transition logging (API restored / lost) is owned by the
   * useApi single writer (FIX-01). The previous local effect double-logged. */

  const handleClassify = useCallback((result: EnrichedResult, text: string) => {
    const ticket = add({
      subject: text,
      category: result.category,
      confidence: result.confidence,
      status: 'Resolved',
      assignedTo: 'Auto',
    });
    addInfo(`Inference OK · ${ticket.id} · ${result.category} · ${result.processing_time_ms}ms`);
  }, [add, addInfo]);

  const handleClassifyError = useCallback((_text: string, errorMessage: string) => {
    addError(`Classification failed · ${errorMessage}`);
  }, [addError]);

  const handleClassifySubmit = useCallback((text: string) => {
    addInfo(`Classification submitted · ${truncateDisplay(text, 40)}`);
  }, [addInfo]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setHelpOpen(false);
        closeSettingsDrawer();
        return;
      }

      if (isTypingTarget(e.target)) return;

      switch (e.key) {
        case '/':
          e.preventDefault();
          focusTicketQuery();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          void checkHealth();
          addInfo('Manual refresh triggered');
          break;
        case '?':
          e.preventDefault();
          setHelpOpen(true);
          break;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [checkHealth, addInfo]);

  const cached = status !== 'live';
  const accuracy = getAccuracyMetrics();

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-body)', overflow: 'hidden' }}>
      <Sidebar />

      <main
        style={{
          flex: 1,
          marginLeft: 'var(--layout-sidebar-w, 240px)',
          height: '100vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1, // reconstructed (PDF-truncated)
        }}
      >
        <Header />

        {/* Content */}
        <div style={{ flex: 1, padding: '20px var(--layout-page-px, 24px)', display: 'flex', flexDirection: 'column', gap: 'var(--density-card-gap)' }}>
          {/* Page Title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1
                style={{
                  fontSize: 'var(--font-size-xl, 20px)',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: 'var(--tracking-title, -0.3px)',
                  marginBottom: 4, // reconstructed (PDF-truncated)
                }}
              >
                Security Operations Center
              </h1>
              <p style={{ fontSize: 'var(--font-size-base, 13px)', color: 'var(--text-secondary)' }}>
                Real-time ML ticket classification on AWS Graviton ARM64
              </p>
            </div>
            {lastSync && (
              <div style={{ fontSize: 'var(--font-size-sm, 12px)', color: 'var(--text-muted)' }}>
                Last sync: {lastSync.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            )}
          </div>

          {/* KPI Row — FIX-11: neutral icon wells; sparkline colors from chartTokens. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 'var(--density-card-gap)' }}>
            <KpiCard
              icon={Zap}
              iconColor="var(--text-secondary)"
              iconBg="var(--color-icon-chip-bg)"
              label="MODEL LATENCY"
              value={latencyValue}
              detail={cached ? 'Last known latency · cached snapshot' : 'Live metrics endpoint'}
              badge={
                cached
                  ? { type: 'cached' }
                  : latencyDelta
                    // reconstructed (PDF-truncated): latency DOWN is positive
                    ? { type: 'change', value: latencyDelta, changeType: latencyDelta.startsWith('-') ? 'positive' : 'negative' }
                    : undefined
              }
              tooltip={{
                title: 'Model Latency',
                note: 'Latency data comes from the live metrics endpoint when available. Sparkline shows recent history.',
              }}
              sparklineData={latencyHistory}
              sparklineColor={chartColors.onnx}
              muted={cached}
            />
            <KpiCard
              icon={Activity}
              iconColor="var(--text-secondary)"
              iconBg="var(--color-icon-chip-bg)"
              label="THROUGHPUT"
              value={throughputValue}
              detail={cached ? 'Last known throughput · cached snapshot' : 'Requests / sec'}
              badge={
                cached
                  ? { type: 'cached' }
                  : throughputDelta
                    // reconstructed (PDF-truncated): throughput UP is positive
                    ? { type: 'change', value: throughputDelta, changeType: throughputDelta.startsWith('+') ? 'positive' : 'negative' }
                    : undefined
              }
              tooltip={{
                title: 'Throughput',
                note: 'Throughput data comes from the live metrics endpoint when available. Sparkline shows recent history.',
              }}
              sparklineData={throughputHistory}
              sparklineColor={chartColors.int8}
              muted={cached}
            />
            <KpiCard
              icon={Target}
              iconColor="var(--text-secondary)"
              iconBg="var(--color-icon-chip-bg)"
              label="MODEL ACCURACY"
              value={accuracy.value}
              detail={accuracy.detail}
              badge={accuracy.pending ? { type: 'pending' } : { type: 'model-card' }}
              tooltip={
                accuracy.pending
                  ? { title: 'Model Accuracy', note: 'Awaiting eval — see MODEL_CARD.md' }
                  : { title: 'Model Accuracy', note: 'Held-out test set — see MODEL_CARD.md' }
              }
            />
            <KpiCard
              icon={Box}
              iconColor="var(--text-secondary)"
              iconBg="var(--color-icon-chip-bg)"
              label="MODEL FOOTPRINT"
              value="8.73 MB"
              detail="ONNX INT8 quantized"
              badge={{ type: 'model-card' }}
              tooltip={{ title: 'Model Footprint', note: 'INT8 artifact size — measured from model/artifact.onnx' }}
            />
          </div>

          {/* Charts Row 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)', gap: 'var(--density-card-gap)' }}>
            <Suspense fallback={<ChartSkeleton height={320} />}>
              <ThreatBarChart />
            </Suspense>
            <div id="model-health">
              <Suspense fallback={<ChartSkeleton height={280} />}>
                <ModelHealthDonut />
              </Suspense>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)', gap: 'var(--density-card-gap)' }}>
            <Suspense fallback={<ChartSkeleton height={280} />}>
              <PerformanceLineChart />
            </Suspense>
            <SystemMonitor />
          </div>

          {/* Table */}
          <ClassificationTable />

          {/* Bottom Row: Event Log + Live Prediction */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)', gap: 'var(--density-card-gap)' }}>
            <EventLog />
            <LivePrediction
              onClassify={handleClassify}
              onError={handleClassifyError}
              onSubmit={handleClassifySubmit}
            />
          </div>

          {/* FIX-24: single footer owner (was an inline same-tab duplicate). */}
          <Footer />
        </div>
      </main>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <SettingsDrawer open={settingsOpen} onClose={closeSettingsDrawer} />
    </div>
  );
};

function truncateDisplay(str: string, max: number): string {
  if (str.length <= max) return str;
  return `${str.slice(0, max)}…`;
}
