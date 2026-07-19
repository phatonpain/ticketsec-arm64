/**
 * M8-PHASE1 — Model Performance stat block.
 *
 * Accuracy comes from eval_results.json (committed artifact). Latency and
 * throughput come from useApi getPerformance. Sparklines show recent history
 * when live data exists; otherwise values read "—" with honest context.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Target, Zap, Activity } from 'lucide-react';
import { Sparkline } from './Sparkline';
import { chartColors } from '../lib/chartTokens';
import { extractLatencySeries, extractThroughputSeries } from '../lib/utils';
import { useApi } from '../hooks/useApi';
import evalResults from '../../model/eval_results.json';

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
  if (precision != null) detailParts.push(`Precision ${precision.toFixed(2)}`);
  if (f1 != null) detailParts.push(`F1 ${f1.toFixed(2)}`);
  return {
    value: `${(accuracy * 100).toFixed(0)}%`,
    detail: detailParts.join(' · ') || 'Held-out test accuracy',
    pending: false,
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

interface StatRowProps {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
  sparklineData: number[];
  sparklineColor: string;
  muted: boolean;
}

const StatRow: React.FC<StatRowProps> = ({ icon: Icon, label, value, detail, sparklineData, sparklineColor, muted }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--tint-row)' }}>
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 'var(--radius-sm, 6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-icon-chip-bg)',
        color: 'var(--text-secondary)',
        flexShrink: 0,
      }}
    >
      <Icon size={14} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 'var(--font-size-micro, 11px)', fontWeight: 600, letterSpacing: 'var(--tracking-caps, 0.6px)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
        <span
          style={{
            fontSize: 'var(--font-size-xl, 20px)',
            fontWeight: 600,
            fontFamily: 'var(--font-numeric)',
            fontVariantNumeric: 'tabular-nums',
            color: muted ? 'var(--text-muted)' : 'var(--text-primary)',
            letterSpacing: 'var(--tracking-kpi, -0.5px)',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </span>
        <span style={{ fontSize: 'var(--font-size-micro, 11px)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {detail}
        </span>
      </div>
    </div>
    <div style={{ width: 72, flexShrink: 0 }}>
      <Sparkline data={sparklineData} color={sparklineColor} height={28} strokeWidth={1.5} />
    </div>
  </div>
);

export const ModelPerformancePanel: React.FC = () => {
  const { status, getPerformance } = useApi();
  const cached = status !== 'live';

  const [latencyValue, setLatencyValue] = useState<string>('—');
  const [throughputValue, setThroughputValue] = useState<string>('—');
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);
  const [throughputHistory, setThroughputHistory] = useState<number[]>([]);
  const [accuracyHistory, setAccuracyHistory] = useState<number[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const performance = await getPerformance();
      if (!mounted) return;

      const hasLivePerformance = performance.length > 0;
      const latest = hasLivePerformance ? performance[performance.length - 1] : undefined;
      setLatencyValue(formatLatency(latest?.latency_ms));
      setThroughputValue(formatThroughput(latest?.throughput));
      setLatencyHistory(extractLatencySeries(hasLivePerformance ? performance : []));
      setThroughputHistory(extractThroughputSeries(hasLivePerformance ? performance : []));
      setAccuracyHistory(hasLivePerformance ? performance.map(p => p.int8) : []);
    };
    load();
    return () => { mounted = false; };
  }, [getPerformance, status]);

  const accuracy = useMemo(() => getAccuracyMetrics(), []);

  return (
    <div
      id="model-performance"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md, 8px)',
        overflow: 'hidden',
        transition: 'border-color 150ms ease',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          height: 'var(--density-widget-head-h)',
          padding: '0 var(--density-widget-pad-x, 20px)',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <div>
          <h2 style={{ fontSize: 'var(--font-size-md, 15px)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: 'var(--tracking-title, -0.2px)' }}>
            Model Performance
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm, 12px)', color: 'var(--text-muted)', marginTop: 1 }}>Accuracy, latency and throughput</p>
        </div>
      </div>
      <div style={{ padding: '0 var(--density-card-pad) var(--density-card-pad)', flex: 1 }}>
        <StatRow
          icon={Target}
          label="Accuracy"
          value={accuracy.value}
          detail={accuracy.detail}
          sparklineData={accuracyHistory}
          sparklineColor={chartColors.onnx}
          muted={accuracy.pending}
        />
        <StatRow
          icon={Zap}
          label="Latency"
          value={latencyValue}
          detail={cached ? 'Last known · cached snapshot' : 'Last inference probe'}
          sparklineData={latencyHistory}
          sparklineColor={chartColors.int8}
          muted={cached}
        />
        <StatRow
          icon={Activity}
          label="Throughput"
          value={throughputValue}
          detail={cached ? 'Last known · cached snapshot' : 'Requests / sec'}
          sparklineData={throughputHistory}
          sparklineColor={chartColors.int8}
          muted={cached}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '6px var(--density-widget-pad-x, 20px) 8px',
          borderTop: '1px solid var(--border-default)',
        }}
      >
        <span style={{ fontSize: 'var(--caption-size)', color: 'var(--caption-color)' }}>
          Accuracy from eval_results.json · latency/throughput from API metrics
        </span>
      </div>
    </div>
  );
};
