/**
 * M8-PHASE1 — Threat Distribution donut.
 *
 * Computed from real tickets (useTickets). Right-side legend with dot +
 * category + count + %. Empty state is honest and compact.
 */

import React, { useMemo } from 'react';
import { BarChart2 } from 'lucide-react';
import { ECharts } from './ECharts';
import type { EChartsCoreOption } from '../lib/echarts';
import { chartColors, categoryChartColors } from '../lib/chartTokens';
import { EmptyState } from './EmptyState';
import { ProvenanceBadge, type DataSource } from './ProvenanceBadge';
import { SnapshotFooter } from './SnapshotFooter';
import type { Ticket } from '../hooks/useTickets';

const CATEGORIES = ['Phishing', 'Malware', 'Data Breach', 'Unauthorized Access', 'DDoS', 'False Positive'];

interface DonutTooltipParam {
  name: string;
  value: number | string;
  percent?: number;
}

interface ThreatDistributionDonutProps {
  tickets: readonly Ticket[];
  source: DataSource;
}

export const ThreatDistributionDonut: React.FC<ThreatDistributionDonutProps> = ({ tickets, source }) => {
  const data = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ticket of tickets) {
      counts.set(ticket.category, (counts.get(ticket.category) ?? 0) + 1);
    }
    return CATEGORIES.map((category, i) => ({
      name: category,
      value: counts.get(category) ?? 0,
      color: categoryChartColors[i] ?? chartColors.baseline,
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
      width: 150,
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 12,
      icon: 'circle',
      textStyle: {
        color: chartColors.textMuted,
        fontFamily: 'Inter',
        fontSize: 12,
        width: 138,
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
      id="threat-distribution"
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
            Threat Distribution
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 1 }}>Detections by category</p>
        </div>
        <ProvenanceBadge source={source} />
      </div>
      <div style={{ padding: '0 var(--density-card-pad) var(--density-card-pad)', flex: 1, position: 'relative' }}>
        {data.length === 0 ? (
          <EmptyState
            icon={BarChart2}
            title="No threat data"
            description={source === 'none' ? 'The API is offline and no cached classifications are available.' : 'Submit or load classifications to populate this chart.'}
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

