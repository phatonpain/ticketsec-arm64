/**
 * M8-PHASE1 — Severity Mix donut.
 *
 * Computed from real tickets via category → severity mapping. Right-side
 * legend; empty state follows the honesty contract.
 */

import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ECharts } from './ECharts';
import type { EChartsCoreOption } from '../lib/echarts';
import { chartColors, severityChartColors } from '../lib/chartTokens';
import { CATEGORY_SEVERITY, SEVERITY_LABEL } from '../lib/utils';
import { EmptyState } from './EmptyState';
import { ProvenanceBadge, type DataSource } from './ProvenanceBadge';
import { SnapshotFooter } from './SnapshotFooter';
import type { Ticket } from '../hooks/useTickets';

const SEVERITY_KEYS: Array<'critical' | 'high' | 'medium' | 'info'> = ['critical', 'high', 'medium', 'info'];

interface DonutTooltipParam {
  name: string;
  value: number | string;
  percent?: number;
}

interface SeverityMixDonutProps {
  tickets: readonly Ticket[];
  source: DataSource;
}

export const SeverityMixDonut: React.FC<SeverityMixDonutProps> = ({ tickets, source }) => {
  const data = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ticket of tickets) {
      const severity = CATEGORY_SEVERITY[ticket.category] ?? 'info';
      counts.set(severity, (counts.get(severity) ?? 0) + 1);
    }
    return SEVERITY_KEYS.map((severity, i) => ({
      name: SEVERITY_LABEL[severity],
      value: counts.get(severity) ?? 0,
      color: severityChartColors[i] ?? chartColors.baseline,
    })).filter(d => d.value > 0);
  }, [tickets]);

  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

  const option: EChartsCoreOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: chartColors.tooltipBg,
      borderColor: chartColors.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: chartColors.textPrimary, fontFamily: 'JetBrains Mono', fontSize: 12 },
      formatter: (params: DonutTooltipParam) =>
        `${params.name}: ${Number(params.value).toLocaleString('en-US')} (${params.percent ?? 0}%)`,
    },
    legend: {
      orient: 'vertical',
      right: 12,
      top: 'middle',
      width: 120,
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 12,
      icon: 'circle',
      textStyle: {
        color: chartColors.textMuted,
        fontFamily: 'Inter',
        fontSize: 12,
        width: 108,
        overflow: 'break',
      },
      formatter: (name: string) => {
        const item = data.find(d => d.name === name);
        const value = item ? item.value : 0;
        const pct = total > 0 ? ((value / total) * 100).toFixed(0) : '0';
        return `${name}  ${value} · ${pct}%`;
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '58%'],
        center: ['30%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: {
          label: { show: false },
          itemStyle: { shadowBlur: 0 },
        },
        labelLine: { show: false },
        itemStyle: {
          borderRadius: 4,
          borderColor: chartColors.cardBg,
          borderWidth: 2,
        },
        data: data.map(item => ({
          value: item.value,
          name: item.name,
          itemStyle: { color: item.color },
        })),
      },
    ],
    graphic: total > 0
      ? [
          {
            type: 'text',
            left: '30%',
            top: '50%',
            style: {
              text: String(total),
              textAlign: 'center',
              textVerticalAlign: 'middle',
              fill: chartColors.textPrimary,
              fontSize: 18,
              fontWeight: 600,
              fontFamily: 'JetBrains Mono',
            },
          },
        ]
      : [],
  }), [data, total]);

  return (
    <div
      id="severity-mix"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        transition: 'border-color 150ms ease',
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
            Severity Mix
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 1 }}>By inferred severity</p>
        </div>
        <ProvenanceBadge source={source} />
      </div>
      <div style={{ padding: '0 var(--density-card-pad) var(--density-card-pad)', flex: 1, position: 'relative' }}>
        {data.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="No severity data"
            description={source === 'none' ? 'The API is offline and no cached classifications are available.' : 'Classifications will populate this chart as they arrive.'}
            nextStep={source === 'none' ? 'Wait for the API to come back or refresh the cached snapshot.' : 'Open the Live Prediction panel and submit a ticket.'}
            minHeight={180}
          />
        ) : (
          <ECharts option={option} style={{ width: '100%', height: '240px' }} />
        )}
      </div>
      <SnapshotFooter source={source} />
    </div>
  );
};
