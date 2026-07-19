/**
 * M6-D1 — Real ML artifact registry.
 *
 * Reads the committed JSON artifacts under model/ at build time and renders
 * them with full provenance (generated_at + sha256 short) per section.
 * If an artifact is missing or PENDING, that section falls back to the honest
 * pending EmptyState pattern.
 *
 * D1 fix: all artifact status decisions flow through src/lib/artifacts.ts so
 * 'COMPLETE' and 'OK' are treated identically across every surface.
 */

import React, { useMemo } from 'react';
import { Box, FileText, Activity, Target, ShieldCheck, Beaker, BarChart3 } from 'lucide-react';
import { ECharts } from './ECharts';
import type { EChartsCoreOption } from '../lib/echarts';
import { EmptyState } from './EmptyState';
import { chartColors } from '../lib/chartTokens';
import { artifacts } from '../lib/artifacts';

const { eval: evalArtifact, confusion: confusionArtifact, latency: latencyArtifact, probes: probeArtifact, modelMeta, quantization } = artifacts;

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

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const panelHeadStyle: React.CSSProperties = {
  height: 'var(--density-widget-head-h)',
  padding: '0 var(--density-widget-pad-x)',
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
  padding: '6px var(--density-widget-pad-x) 8px',
  borderTop: '1px solid var(--border-default)',
};

const tableHeadStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 'var(--font-size-micro)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 'var(--tracking-th)',
  color: 'var(--text-muted)',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  height: 'var(--density-table-head-h)',
  boxSizing: 'border-box',
};

const tableCellStyle: React.CSSProperties = {
  padding: '0 12px',
  fontSize: 'var(--font-size-sm)',
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
        <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: 'var(--tracking-title)' }}>
          {title}
        </h2>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 1 }}>{subtitle}</p>
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
  if (!evalArtifact.ready) {
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

  const deltaText = quantization.delta != null
    ? `${quantization.delta >= 0 ? '+' : ''}${(quantization.delta * 100).toFixed(2)} pp`
    : '—';

  const items = [
    { label: 'Task', value: 'Multiclass ticket classification' },
    { label: 'Format', value: 'ONNX INT8' },
    { label: 'Artifact size', value: `${modelMeta.sizeMb ?? '—'} MB (${quantization.sizeText})` },
    { label: 'SHA-256', value: shortSha(modelMeta.sha256 ?? evalArtifact.sha256) },
    { label: 'Target', value: latencyArtifact.host ?? 'AWS Graviton t4g.micro' },
    { label: 'Dataset', value: `${evalArtifact.datasetSize?.toLocaleString('en-US') ?? '—'} samples` },
    { label: 'Train / test', value: `${evalArtifact.trainSize?.toLocaleString('en-US') ?? '—'} / ${evalArtifact.testSize?.toLocaleString('en-US') ?? '—'}` },
    { label: 'Quantization delta', value: `${deltaText} vs sklearn baseline` },
  ];

  return (
    <Panel
      icon={Box}
      title="Model Card"
      subtitle="Artifact metadata"
      footer={<ProvenanceFooter generatedAt={evalArtifact.generatedAt} sha256={modelMeta.sha256 ?? evalArtifact.sha256} />}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--density-card-gap)' }}>
        {items.map(item => (
          <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 'var(--font-size-micro)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', color: 'var(--text-muted)' }}>
              {item.label}
            </span>
            <span
              style={{
                fontSize: 'var(--font-size-base)',
                color: 'var(--text-primary)',
                fontFamily: item.label === 'SHA-256' || item.label === 'Artifact size' || item.label === 'Quantization delta' ? 'var(--font-numeric)' : 'var(--font-family-sans)',
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
  if (!evalArtifact.ready || !evalArtifact.perClassMetrics) {
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

  const categories = Object.keys(evalArtifact.perClassMetrics);

  return (
    <Panel
      icon={Target}
      title="Accuracy & Eval"
      subtitle={`Overall ${formatAccuracy(evalArtifact.overallAccuracy)} · synthetic dataset · GroupShuffleSplit · n=${evalArtifact.datasetSize ?? '—'}`}
      footer={<ProvenanceFooter generatedAt={evalArtifact.generatedAt} sha256={evalArtifact.sha256} />}
    >
      <div style={{ marginBottom: 12, display: 'flex', gap: 16 }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-micro)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Overall accuracy</span>
          <div style={{ fontSize: 'var(--font-size-kpi)', fontWeight: 700, fontFamily: 'var(--font-numeric)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
            {formatAccuracy(evalArtifact.overallAccuracy)}
          </div>
        </div>
        <div>
          <span style={{ fontSize: 'var(--font-size-micro)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Test set</span>
          <div style={{ fontSize: 'var(--font-size-kpi)', fontWeight: 700, fontFamily: 'var(--font-numeric)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
            {evalArtifact.testSize?.toLocaleString('en-US') ?? '—'}
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
              const m = evalArtifact.perClassMetrics![cat];
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
    const labels = confusionArtifact.labels ?? [];
    const matrix = confusionArtifact.matrix ?? [];
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
          color: [chartColors.cardBg, chartColors.indigoStrongHover, chartColors.onnx, chartColors.accentStrong],
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

  if (!confusionArtifact.ready || !confusionArtifact.matrix) {
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
      footer={<ProvenanceFooter generatedAt={confusionArtifact.generatedAt} sha256={confusionArtifact.sha256} />}
    >
      <ECharts option={option} style={{ width: '100%', height: '320px' }} />
    </Panel>
  );
};

const LatencySection: React.FC = () => {
  if (!latencyArtifact.ready || latencyArtifact.p50Ms == null) {
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
      subtitle={`${latencyArtifact.host ?? 'AWS Graviton t4g.micro'} · processing_time_ms excludes network RTT`}
      footer={<ProvenanceFooter generatedAt={latencyArtifact.generatedAt} extra={latencyArtifact.interpretation ?? ''} />}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--density-card-gap)' }}>
        <div style={{ backgroundColor: 'var(--bg-body)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: 12 }}>
          <span style={{ fontSize: 'var(--font-size-micro)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>p50</span>
          <div style={{ fontSize: 'var(--font-size-kpi)', fontWeight: 700, fontFamily: 'var(--font-numeric)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
            {formatLatencyMs(latencyArtifact.p50Ms)}
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-body)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: 12 }}>
          <span style={{ fontSize: 'var(--font-size-micro)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>p95</span>
          <div style={{ fontSize: 'var(--font-size-kpi)', fontWeight: 700, fontFamily: 'var(--font-numeric)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
            {formatLatencyMs(latencyArtifact.p95Ms)}
          </div>
        </div>
      </div>
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 12 }}>
        {latencyArtifact.interpretation ?? 'processing_time_ms is server-side ONNX inference time reported by /predict.'}
      </p>
      <p style={{ fontSize: 'var(--font-size-micro)', color: 'var(--text-muted)', marginTop: 8 }}>
        Measured on {latencyArtifact.host ?? 't4g.micro'} · n={latencyArtifact.sampleCount ?? '—'}
      </p>
    </Panel>
  );
};

const ProbeSuiteSection: React.FC = () => {
  if (!probeArtifact.ready || !probeArtifact.results) {
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

  const passed = (probeArtifact.probeCount ?? 0) - (probeArtifact.expectationMismatches ?? 0);

  return (
    <Panel
      icon={Beaker}
      title="Probe Suite"
      subtitle={`${probeArtifact.probesRun ?? passed}/${probeArtifact.probeCount ?? '—'} passed · expectation mismatches ${probeArtifact.expectationMismatches ?? '—'}`}
      footer={<ProvenanceFooter generatedAt={probeArtifact.generatedAt} sha256={probeArtifact.probeSuiteSha256} />}
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
            {probeArtifact.results.map(r => {
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
  if (!evalArtifact.ready || !evalArtifact.ablation) {
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
      subtitle={`Winner ${evalArtifact.winnerCandidateId ?? '—'} · deployed ${evalArtifact.deployedCandidateId ?? '—'}`}
      footer={<ProvenanceFooter generatedAt={evalArtifact.generatedAt} sha256={evalArtifact.sha256} extra="skl2onnx cannot export char_wb TfidfVectorizer" />}
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
            {evalArtifact.ablation.map(row => {
              const deployed = row.candidate_id === evalArtifact.deployedCandidateId;
              const winner = row.candidate_id === evalArtifact.winnerCandidateId;
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
                          fontSize: 'var(--badge-font-size)',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-badge)',
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
                          fontSize: 'var(--badge-font-size)',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-badge)',
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
      {evalArtifact.deployedNote && (
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 12 }}>
          {evalArtifact.deployedNote}
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
