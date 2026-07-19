import React, { useMemo } from 'react';
import { ECharts } from './ECharts';
import type { EChartsCoreOption } from '../lib/echarts';
import { chartColors } from '../lib/chartTokens';
import type { Ticket } from '../hooks/useTickets';

interface TimelineTooltipParam {
  name: string;
  value: number | string;
}

interface TimelineChartProps {
  tickets: readonly Ticket[];
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const TimelineChart: React.FC<TimelineChartProps> = ({ tickets }) => {
  const { categories, values } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ticket of tickets) {
      const iso = ticket.createdAt.toISOString().slice(0, 10);
      counts.set(iso, (counts.get(iso) ?? 0) + 1);
    }
    const sorted = Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
    return {
      categories: sorted.map(([iso]) => formatDateLabel(iso)),
      values: sorted.map(([, count]) => count),
    };
  }, [tickets]);

  const option: EChartsCoreOption = useMemo(() => {
    const maxValue = Math.max(...values, 1);
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', label: { backgroundColor: chartColors.tooltipBg } },
        backgroundColor: chartColors.tooltipBg,
        borderColor: chartColors.tooltipBorder,
        borderWidth: 1,
        textStyle: { color: chartColors.textPrimary, fontFamily: 'JetBrains Mono', fontSize: 12 },
        formatter: (params: TimelineTooltipParam | TimelineTooltipParam[]) => {
          const p = Array.isArray(params) ? params[0] : params;
          return `${p.name}: ${Number(p.value).toLocaleString('en-US')}`;
        },
      },
      grid: { left: 12, right: 16, top: 24, bottom: 24, containLabel: true },
      xAxis: {
        type: 'category',
        data: categories,
        boundaryGap: false,
        axisLine: { lineStyle: { color: chartColors.axisLine } },
        axisTick: { show: false },
        axisLabel: { color: chartColors.textMuted, fontFamily: 'Inter', fontSize: 11, margin: 12 },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: maxValue,
        splitLine: { lineStyle: { color: chartColors.grid } },
        axisLabel: { color: chartColors.textMuted, fontFamily: 'JetBrains Mono', fontSize: 11 },
      },
      series: [
        {
          type: 'line',
          data: values,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: chartColors.onnx, width: 2 },
          itemStyle: { color: chartColors.onnx },
          areaStyle: { color: chartColors.onnx, opacity: 0.06 },
        },
      ],
    };
  }, [categories, values]);

  return (
    <div
      id="threat-timeline"
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
            Detections Over Time
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm, 12px)', color: 'var(--text-muted)', marginTop: 1 }}>Classifications by day</p>
        </div>
      </div>
      <div style={{ padding: '0 var(--density-card-pad) var(--density-card-pad)', flex: 1, position: 'relative' }}>
        <ECharts option={option} style={{ width: '100%', height: '260px' }} />
      </div>
    </div>
  );
};
