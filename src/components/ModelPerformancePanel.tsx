/**
 * M8-PHASE1 — Model Performance stat block.
 *
 * Accuracy comes from eval_results.json (committed artifact). Latency and
 * throughput come from useApi getPerformance when live; otherwise latency falls
 * back to the committed t4g.micro benchmark. Throughput stays honest: no source
 * means it reads '—' rather than inventing a number.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Target, Zap, Activity } from 'lucide-react';
import { Sparkline } from './Sparkline';
import { chartColors } from '../lib/chartTokens';
import { extractLatencySeries, extractThroughputSeries } from '../lib/utils';
import { useApi } from '../hooks/useApi';
import { artifacts } from '../lib/artifacts';

const { eval: evalArtifact, latency: latencyArtifact } = artifacts;

function getAccuracyMetrics(): { value: string; detail: string; pending: boolean } {
  if (!evalArtifact.ready || evalArtifact.overallAccuracy == null) {
    return { value: '—', detail: 'Awaiting eval — see MODEL_CARD.md', pending: true };
  }
  return {
    value: `${(evalArtifact.overallAccuracy * 100).toFixed(2)}%`,
    detail: 'from eval_results.json',
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
        borderRadius: 'var(--radius-sm)',
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
      <div style={{ fontSize: 'var(--font-size-micro)', fontWeight: 600, letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
        <span
          style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 600,
            fontFamily: 'var(--font-numeric)',
            fontVariantNumeric: 'tabular-nums',
            color: muted ? 'var(--text-muted)' : 'var(--text-primary)',
            letterSpacing: 'var(--tracking-kpi)',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </span>
        <span style={{ fontSize: 'var(--font-size-micro)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
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
  const [latencyDetail, setLatencyDetail] = useState<string>('—');
  const [throughputValue, setThroughputValue] = useState<string>('—');
  const [throughputDetail, setThroughputDetail] = useState<string>('—');
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

      if (hasLivePerformance && latest?.latency_ms != null) {
        setLatencyValue(formatLatency(latest.latency_ms));
        setLatencyDetail('Last inference probe');
      } else if (latencyArtifact.ready && latencyArtifact.p50Ms != null) {
        setLatencyValue(formatLatency(latencyArtifact.p50Ms));
        setLatencyDetail('Offline benchmark');
      } else {
        setLatencyValue('—');
        setLatencyDetail(cached ? 'No offline benchmark' : 'Awaiting probe');
      }

      const hasThroughput = latest?.throughput != null;
      setThroughputValue(formatThroughput(latest?.throughput));
      setThroughputDetail(
        hasLivePerformance && hasThroughput
          ? 'Requests / sec'
          : cached
            ? 'No data — metric not instrumented in cached snapshot'
            : 'No data — metric not instrumented in this source',
      );
      setLatencyHistory(extractLatencySeries(hasLivePerformance ? performance : []));
      setThroughputHistory(extractThroughputSeries(hasLivePerformance ? performance : []));
      setAccuracyHistory(hasLivePerformance ? performance.map(p => p.int8) : []);
    };
    load();
    return () => { mounted = false; };
  }, [getPerformance, status, cached]);

  const accuracy = useMemo(() => getAccuracyMetrics(), []);

  return (
    <div
      id="model-performance"
      className="panel-hover"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          height: 'var(--density-widget-head-h)',
          padding: '0 var(--density-widget-pad-x)',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <div>
          <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: 'var(--tracking-title)' }}>
            Model Performance
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 1 }}>Accuracy, latency and throughput</p>
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
          detail={latencyDetail}
          sparklineData={latencyHistory}
          sparklineColor={chartColors.int8}
          muted={cached && latencyDetail !== 'Offline benchmark'}
        />
        <StatRow
          icon={Activity}
          label="Throughput"
          value={throughputValue}
          detail={throughputDetail}
          sparklineData={throughputHistory}
          sparklineColor={chartColors.int8}
          muted={throughputValue === '—'}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '6px var(--density-widget-pad-x) 8px',
          borderTop: '1px solid var(--border-default)',
        }}
      >
        <span style={{ fontSize: 'var(--caption-size)', color: 'var(--caption-color)' }}>
          Accuracy from eval_results.json · latency/throughput from API metrics · offline fallback from latency_t4g_micro.json
        </span>
      </div>
    </div>
  );
};
