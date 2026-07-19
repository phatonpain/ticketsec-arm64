/**
 * M6-D1 — Real ML artifact registry.
 *
 * Reads the committed JSON artifacts under model/ at build time and renders
 * them with full provenance (generated_at + sha256 short) per section.
 * If an artifact is missing or PENDING, that section falls back to the honest
 * pending EmptyState pattern.
 */

import React, { useMemo } from 'react';
import { Box, FileText, Activity, Target, ShieldCheck, Beaker, BarChart3 } from 'lucide-react';
import { ECharts } from './ECharts';
import type { EChartsCoreOption } from '../lib/echarts';
import { EmptyState } from './EmptyState';
import { chartColors } from '../lib/chartTokens';
import evalResults from '../../model/eval_results.json';
import confusionMatrix from '../../model/confusion_matrix.json';
import latency from '../../model/latency_t4g_micro.json';
import probes from '../../model/probe_results.json';
import quantizationMd from '../../model/quantization.md?raw';

interface EvalArtifact {
  status: string;
  generated_at?: string;
  artifact_sha256?: string;
  dataset_size?: number;
  train_size?: number;
  test_size?: number;
  overall_accuracy?: number;
  methodology?: {
    split?: string;
    categories?: string[];
  };
  per_class_metrics?: Record<string, { precision: number; recall: number; f1: number; support: number }>;
  ablation?: Array<{
    candidate_id: string;
    overall_accuracy: number;
    min_f1: number;
    all_f1_above_floor: boolean;
  }>;
  winner_candidate_id?: string;
  deployed_candidate_id?: string;
  deployed_note?: string;
}

interface ConfusionArtifact {
  status: string;
  generated_at?: string;
  artifact_sha256?: string;
  labels?: string[];
  matrix?: number[][];
}

interface LatencyArtifact {
  status: string;
  generated_at?: string;
  host?: string;
  p50_ms?: number;
  p95_ms?: number;
  measurement_protocol?: {
    interpretation?: string;
  };
}

interface ProbeResult {
  id: string;
  expected_vs_actual?: {
    expected: string | null;
    actual: string | null;
    matched: boolean;
  };
}

interface ProbeArtifact {
  status: string;
  generated_at?: string;
  probe_suite_sha256?: string;
  probe_count?: number;
  probes_run?: number;
  expectation_mismatches?: number;
  results?: ProbeResult[];
}

const typedEval = evalResults as EvalArtifact;
const typedConfusion = confusionMatrix as ConfusionArtifact;
const typedLatency = latency as LatencyArtifact;
const typedProbes = probes as ProbeArtifact;

const MODEL_INT8_BYTES = 401_770;

function shortSha(sha?: string): string {
  return sha ? sha.slice(0, 12) : '—';
}

function formatAccuracy(acc?: number): string {
  return acc != null ? `${(acc * 100).toFixed(2)}%` : '—';
}

function formatMetric(n?: number): string {
  return n != null ? n.toFixed(4) : '—';
}

function formatLatencyMs(ms?: number): string {
  return ms != null ? `${ms.toFixed(2)}ms` : '—';
}

function formatGeneratedAt(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function extractArtifactSize(md: string): string {
  const match = md.match(/INT8 ONNX.*?(\d[\d,]*\s*bytes)/);
  return match ? match[1].replace(/,/g, ',') : `${MODEL_INT8_BYTES.toLocaleString('en-US')} bytes`;
}

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md, 8px)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const panelHeadStyle: React.CSSProperties = {
  height: 'var(--density-widget-head-h)',
  padding: '0 var(--density-widget-pad-x, 20px)',
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: '1px solid var(--border-default)',
};

const panelBodyStyle: React.CSSProperties = {
  padding: 'var(--density-card-pad)',
  flex: 1,
};

const panelFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  padding: '6px var(--density-widget-pad-x, 16px) 8px',
  borderTop: '1px solid var(--border-default)',
};

const tableHeadStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 'var(--font-size-micro, 11px)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 'var(--tracking-th, 0.5px)',
  color: 'var(--text-muted)',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  height: 'var(--density-table-head-h, 36px)',
  boxSizing: 'border-box',
};

const tableCellStyle: React.CSSProperties = {
  padding: '0 12px',
  fontSize: 'var(--font-size-sm, 12px)',
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  height: 'var(--density-row-h)',
  boxSizing: 'border-box',
};

const monoCellStyle: React.CSSProperties = {
  ...tableCellStyle,
  fontFamily: 'var(--font-numeric)',
  fontVariantNumeric: 'tabular-nums',
};

interface PanelProps {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const Panel: React.FC<PanelProps> = ({ icon: Icon, title, subtitle, children, footer }) => (
  <div style={cardStyle}>
    <div style={panelHeadStyle}>
      <div>
        <h2 style={{ fontSize: 'var(--font-size-md, 15px)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: 'var(--tracking-title, -0.2px)' }}>
          {title}
        </h2>
        <p style={{ fontSize: 'var(--font-size-sm, 12px)', color: 'var(--text-muted)', marginTop: 1 }}>{subtitle}</p>
      </div>
      <Icon size={18} color="var(--text-muted)" aria-hidden />
    </div>
    <div style={panelBodyStyle}>{children}</div>
    {footer && <div style={panelFooterStyle}>{footer}</div>}
  </div>
);

const ProvenanceFooter: React.FC<{ generatedAt?: string; sha256?: string; extra?: string }> = ({
  generatedAt,
  sha256,
  extra,
}) => (
  <span style={{ fontSize: 'var(--caption-size)', color: 'var(--caption-color)' }}>
    Generated {formatGeneratedAt(generatedAt)}
    {sha256 && ` · SHA-256 ${shortSha(sha256)}`}
    {extra && ` · ${extra}`}
  </span>
);

const ModelCardSection: React.FC = () => {
  if (typedEval.status !== 'OK') {
    return (
      <Panel icon={Box} title="Model Card" subtitle="Artifact metadata">
        <EmptyState
          icon={FileText}
          title="Model card pending"
          description="Eval results are generated offline by the ML pipeline."
          nextStep="Run python model/eval.py and commit model/eval_results.json."
          minHeight={180}
        />
      </Panel>
    );
  }

  const items = [
    { label: 'Task', value: 'Multiclass ticket classification' },
    { label: 'Format', value: 'ONNX INT8' },
    { label: 'Artifact size', value: `0.38 MB (${extractArtifactSize(quantizationMd)})` },
    { label: 'SHA-256', value: shortSha(typedEval.artifact_sha256) },
    { label: 'Target', value: typedLatency.host ?? 'AWS Graviton t4g.micro' },
    { label: 'Dataset', value: `${typedEval.dataset_size?.toLocaleString('en-US') ?? '—'} samples` },
    { label: 'Train / test', value: `${typedEval.train_size?.toLocaleString('en-US') ?? '—'} / ${typedEval.test_size?.toLocaleString('en-US') ?? '—'}` },
    { label: 'Split', value: typedEval.methodology?.split ?? '—' },
  ];

  return (
    <Panel
      icon={Box}
      title="Model Card"
      subtitle="Artifact metadata"
      footer={<ProvenanceFooter generatedAt={typedEval.generated_at} sha256={typedEval.artifact_sha256} />}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--density-card-gap)' }}>
        {items.map(item => (
          <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 'var(--font-size-micro, 11px)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps, 0.6px)', color: 'var(--text-muted)' }}>
              {item.label}
            </span>
            <span
              style={{
                fontSize: 'var(--font-size-base, 13px)',
                color: 'var(--text-primary)',
                fontFamily: item.label === 'SHA-256' || item.label === 'Artifact size' ? 'var(--font-numeric)' : 'var(--font-family-sans)',
                fontVariantNumeric: 'tabular-nums',
              }}
              title={item.value}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
};

const AccuracySection: React.FC = () => {
  if (typedEval.status !== 'OK' || !typedEval.per_class_metrics) {
    return (
      <Panel icon={Target} title="Accuracy & Eval" subtitle="Per-class precision / recall / F1">
        <EmptyState
          icon={FileText}
          title="Eval results pending"
          description="Accuracy and per-class metrics are generated offline."
          nextStep="Run python model/eval.py and commit model/eval_results.json."
          minHeight={180}
        />
      </Panel>
    );
  }

  const categories = Object.keys(typedEval.per_class_metrics);

  return (
    <Panel
      icon={Target}
      title="Accuracy & Eval"
      subtitle={`Overall ${formatAccuracy(typedEval.overall_accuracy)} · synthetic dataset · GroupShuffleSplit · n=${typedEval.dataset_size ?? '—'}`}
      footer={<ProvenanceFooter generatedAt={typedEval.generated_at} sha256={typedEval.artifact_sha256} />}
    >
      <div style={{ marginBottom: 12, display: 'flex', gap: 16 }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-micro, 11px)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Overall accuracy</span>
          <div style={{ fontSize: 'var(--font-size-kpi, 28px)', fontWeight: 700, fontFamily: 'var(--font-numeric)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
            {formatAccuracy(typedEval.overall_accuracy)}
          </div>
        </div>
        <div>
          <span style={{ fontSize: 'var(--font-size-micro, 11px)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Test set</span>
          <div style={{ fontSize: 'var(--font-size-kpi, 28px)', fontWeight: 700, fontFamily: 'var(--font-numeric)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
            {typedEval.test_size?.toLocaleString('en-US') ?? '—'}
          </div>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }} tabIndex={0}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
              <th style={tableHeadStyle}>Category</th>
              <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Support</th>
              <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Precision</th>
              <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Recall</th>
              <th style={{ ...tableHeadStyle, textAlign: 'right' }}>F1</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => {
              const m = typedEval.per_class_metrics![cat];
              return (
                <tr key={cat} style={{ borderBottom: '1px solid var(--tint-row)' }}>
                  <td style={tableCellStyle}>{cat}</td>
                  <td style={{ ...monoCellStyle, textAlign: 'right' }}>{m.support}</td>
                  <td style={{ ...monoCellStyle, textAlign: 'right' }}>{formatMetric(m.precision)}</td>
                  <td style={{ ...monoCellStyle, textAlign: 'right' }}>{formatMetric(m.recall)}</td>
                  <td style={{ ...monoCellStyle, textAlign: 'right' }}>{formatMetric(m.f1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
};

const ConfusionMatrixSection: React.FC = () => {
  const option = useMemo<EChartsCoreOption>(() => {
    const labels = typedConfusion.labels ?? [];
    const matrix = typedConfusion.matrix ?? [];
    const data: [number, number, number][] = [];
    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        data.push([x, y, value]);
      });
    });
    const maxVal = Math.max(...data.map(d => d[2]), 1);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        position: 'top',
        backgroundColor: chartColors.tooltipBg,
        borderColor: chartColors.tooltipBorder,
        borderWidth: 1,
        textStyle: { color: chartColors.textPrimary, fontFamily: 'JetBrains Mono', fontSize: 12 },
        formatter: (p: { name: string; value: [number, number, number] }) => {
          const [x, y, v] = p.value;
          return `${labels[y]} → ${labels[x]}: ${v}`;
        },
      },
      grid: { left: 80, right: 16, top: 16, bottom: 32 },
      xAxis: {
        type: 'category',
        data: labels,
        position: 'bottom',
        axisLine: { lineStyle: { color: chartColors.axisLine } },
        axisTick: { show: false },
        axisLabel: { color: chartColors.textMuted, fontFamily: 'Inter', fontSize: 10, rotate: 30, interval: 0 },
      },
      yAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: chartColors.axisLine } },
        axisTick: { show: false },
        axisLabel: { color: chartColors.textMuted, fontFamily: 'Inter', fontSize: 10, interval: 0 },
      },
      visualMap: {
        min: 0,
        max: maxVal,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        show: false,
        inRange: {
          color: [chartColors.cardBg, '#4338CA', '#6366F1', '#818CF8'],
        },
      },
      series: [
        {
          type: 'heatmap',
          data,
          label: {
            show: true,
            color: chartColors.textPrimary,
            fontFamily: 'JetBrains Mono',
            fontSize: 11,
            formatter: (p: { value: [number, number, number] }) => String(p.value[2]),
          },
          itemStyle: {
            borderColor: chartColors.cardBg,
            borderWidth: 1,
            borderRadius: 2,
          },
          emphasis: {
            itemStyle: { shadowBlur: 0 },
          },
        },
      ],
    };
  }, []);

  if (typedConfusion.status !== 'OK' || !typedConfusion.matrix) {
    return (
      <Panel icon={BarChart3} title="Confusion Matrix" subtitle="6×6 held-out test predictions">
        <EmptyState
          icon={FileText}
          title="Confusion matrix pending"
          description="Confusion matrix data is generated offline."
          nextStep="Run python model/eval.py and commit model/confusion_matrix.json."
          minHeight={180}
        />
      </Panel>
    );
  }

  return (
    <Panel
      icon={BarChart3}
      title="Confusion Matrix"
      subtitle="6×6 held-out test predictions"
      footer={<ProvenanceFooter generatedAt={typedConfusion.generated_at} sha256={typedConfusion.artifact_sha256} />}
    >
      <ECharts option={option} style={{ width: '100%', height: '320px' }} />
    </Panel>
  );
};

const LatencySection: React.FC = () => {
  if (typedLatency.status !== 'OK' || typedLatency.p50_ms == null) {
    return (
      <Panel icon={Activity} title="Latency on Graviton" subtitle="t4g.micro inference benchmarks">
        <EmptyState
          icon={FileText}
          title="Latency benchmarks pending"
          description="Latency data is generated offline against the deployed endpoint."
          nextStep="Run python model/measure_latency.py and commit model/latency_t4g_micro.json."
          minHeight={180}
        />
      </Panel>
    );
  }

  return (
    <Panel
      icon={Activity}
      title="Latency on Graviton"
      subtitle={`${typedLatency.host ?? 'AWS Graviton t4g.micro'} · processing_time_ms excludes network RTT`}
      footer={<ProvenanceFooter generatedAt={typedLatency.generated_at} extra={typedLatency.measurement_protocol?.interpretation ?? ''} />}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--density-card-gap)' }}>
        <div style={{ backgroundColor: 'var(--bg-body)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm, 6px)', padding: 12 }}>
          <span style={{ fontSize: 'var(--font-size-micro, 11px)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>p50</span>
          <div style={{ fontSize: 'var(--font-size-kpi, 28px)', fontWeight: 700, fontFamily: 'var(--font-numeric)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
            {formatLatencyMs(typedLatency.p50_ms)}
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-body)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm, 6px)', padding: 12 }}>
          <span style={{ fontSize: 'var(--font-size-micro, 11px)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>p95</span>
          <div style={{ fontSize: 'var(--font-size-kpi, 28px)', fontWeight: 700, fontFamily: 'var(--font-numeric)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
            {formatLatencyMs(typedLatency.p95_ms)}
          </div>
        </div>
      </div>
      <p style={{ fontSize: 'var(--font-size-sm, 12px)', color: 'var(--text-muted)', marginTop: 12 }}>
        {typedLatency.measurement_protocol?.interpretation ?? 'processing_time_ms is server-side ONNX inference time reported by /predict.'}
      </p>
    </Panel>
  );
};

const ProbeSuiteSection: React.FC = () => {
  if (typedProbes.status !== 'OK' || !typedProbes.results) {
    return (
      <Panel icon={Beaker} title="Probe Suite" subtitle="OOD / empty / unicode probes">
        <EmptyState
          icon={FileText}
          title="Probe suite pending"
          description="Probe suite results are generated offline."
          nextStep="Run python model/run_probe_suite.py and commit model/probe_results.json."
          minHeight={180}
        />
      </Panel>
    );
  }

  const passed = (typedProbes.probe_count ?? 0) - (typedProbes.expectation_mismatches ?? 0);

  return (
    <Panel
      icon={Beaker}
      title="Probe Suite"
      subtitle={`${typedProbes.probes_run ?? passed}/${typedProbes.probe_count ?? '—'} passed · expectation mismatches ${typedProbes.expectation_mismatches ?? '—'}`}
      footer={<ProvenanceFooter generatedAt={typedProbes.generated_at} sha256={typedProbes.probe_suite_sha256} />}
    >
      <div style={{ overflowX: 'auto' }} tabIndex={0}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
              <th style={tableHeadStyle}>Probe</th>
              <th style={tableHeadStyle}>Expected</th>
              <th style={tableHeadStyle}>Actual</th>
              <th style={{ ...tableHeadStyle, textAlign: 'center' }}>Pass</th>
            </tr>
          </thead>
          <tbody>
            {typedProbes.results.map(r => {
              const matched = r.expected_vs_actual?.matched ?? false;
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--tint-row)' }}>
                  <td style={{ ...tableCellStyle, fontFamily: 'var(--font-numeric)' }}>{r.id}</td>
                  <td style={tableCellStyle}>{r.expected_vs_actual?.expected ?? '—'}</td>
                  <td style={tableCellStyle}>{r.expected_vs_actual?.actual ?? '—'}</td>
                  <td style={{ ...tableCellStyle, textAlign: 'center', color: matched ? 'var(--color-status-ok-text)' : 'var(--color-status-err-text)' }}>
                    {matched ? '✓' : '✗'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
};

const AblationSection: React.FC = () => {
  if (typedEval.status !== 'OK' || !typedEval.ablation) {
    return (
      <Panel icon={ShieldCheck} title="Ablation" subtitle="Candidate selection">
        <EmptyState
          icon={FileText}
          title="Ablation table pending"
          description="Candidate results are generated offline."
          nextStep="Run python model/train.py and commit model/eval_results.json."
          minHeight={180}
        />
      </Panel>
    );
  }

  return (
    <Panel
      icon={ShieldCheck}
      title="Ablation"
      subtitle={`Winner ${typedEval.winner_candidate_id ?? '—'} · deployed ${typedEval.deployed_candidate_id ?? '—'}`}
      footer={<ProvenanceFooter generatedAt={typedEval.generated_at} sha256={typedEval.artifact_sha256} extra="skl2onnx cannot export char_wb TfidfVectorizer" />}
    >
      <div style={{ overflowX: 'auto' }} tabIndex={0}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
              <th style={tableHeadStyle}>Candidate</th>
              <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Accuracy</th>
              <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Min F1</th>
              <th style={{ ...tableHeadStyle, textAlign: 'center' }}>Floor</th>
              <th style={tableHeadStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {typedEval.ablation.map(row => {
              const deployed = row.candidate_id === typedEval.deployed_candidate_id;
              const winner = row.candidate_id === typedEval.winner_candidate_id;
              return (
                <tr key={row.candidate_id} style={{ borderBottom: '1px solid var(--tint-row)' }}>
                  <td style={{ ...tableCellStyle, fontFamily: 'var(--font-numeric)' }}>{row.candidate_id}</td>
                  <td style={{ ...monoCellStyle, textAlign: 'right' }}>{formatAccuracy(row.overall_accuracy)}</td>
                  <td style={{ ...monoCellStyle, textAlign: 'right' }}>{formatMetric(row.min_f1)}</td>
                  <td style={{ ...tableCellStyle, textAlign: 'center' }}>{row.all_f1_above_floor ? 'Yes' : 'No'}</td>
                  <td style={tableCellStyle}>
                    {deployed && (
                      <span
                        style={{
                          fontSize: 'var(--badge-font-size, 11px)',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-badge, 4px)',
                          color: 'var(--color-text-on-accent)',
                          backgroundColor: 'var(--color-accent-indigo-strong)',
                        }}
                      >
                        Deployed
                      </span>
                    )}
                    {winner && !deployed && (
                      <span
                        style={{
                          fontSize: 'var(--badge-font-size, 11px)',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-badge, 4px)',
                          color: 'var(--color-text-inverse)',
                          backgroundColor: 'var(--color-accent-cyan)',
                        }}
                      >
                        Accuracy winner
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {typedEval.deployed_note && (
        <p style={{ fontSize: 'var(--font-size-sm, 12px)', color: 'var(--text-muted)', marginTop: 12 }}>
          {typedEval.deployed_note}
        </p>
      )}
    </Panel>
  );
};

export const ModelRegistry: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--density-card-gap)' }}>
    <ModelCardSection />
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--density-card-gap)' }}>
      <AccuracySection />
      <LatencySection />
    </div>
    <ConfusionMatrixSection />
    <ProbeSuiteSection />
    <AblationSection />
  </div>
);
