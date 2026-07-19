/**
 * fixpack-v2 — applies: FIX-04, FIX-10, FIX-12, FIX-19, FIX-23 (C-26/C-27),
 * FIX-27.
 * Original: src/components/PerformanceLineChart.tsx (187 lines).
 * NOTE: original lines 144-145 and 180 were truncated in the source PDF
 * ("…"); those regions (axis label config, card chrome) are reconstructed
 * semantically.
 *
 * Key changes vs original:
 *  - FIX-04 [CONFIRMED contradiction, S2]: the original showed the amber
 *    CACHED badge whenever data ever came from cache — including when the
 *    panel displayed "Awaiting live performance data" with zero points. The
 *    badge is now the shared ProvenanceBadge gated by THIS panel's
 *    provenance: cached points → CACHED; no points → no badge + honest
 *    empty state (C-26/C-27: "No performance data available").
 *  - FIX-27: footer = SnapshotFooter (real timestamp; gone when live/none).
 *  - FIX-19: raw rgba literals for grid/axis lines → chart chrome tokens
 *    (chartColors.grid / chartColors.axisLine; still hexToRgba-computed
 *    alpha fills from token hexes — canvas can't read CSS vars).
 *  - Data refresh: re-fetches when status flips to 'live' (panel heals in
 *    place after API recovery); mounted-guard retained.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ECharts } from './ECharts';
import type { EChartsCoreOption } from '../lib/echarts';
import { useApi, type PerformancePoint } from '../hooks/useApi';
import { chartColors } from '../lib/chartTokens';
import { ProvenanceBadge, type DataSource } from './ProvenanceBadge';
import { SnapshotFooter } from './SnapshotFooter';
import { EmptyState } from './EmptyState';
import { Activity } from 'lucide-react';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface SeriesStyle {
  line: { color: string; width: number; type?: 'solid' | 'dashed' };
  item: string;
}

interface LineTooltipParam {
  seriesName: string;
  value: number | string;
  marker?: string;
}

export const PerformanceLineChart: React.FC = () => {
  const { status, getPerformance } = useApi();
  const [data, setData] = useState<PerformancePoint[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    getPerformance().then(res => {
      if (!mounted) return;
      setData(res && res.length > 0 ? res : []);
      setLoaded(true);
    });
    return () => { mounted = false; };
    // Re-fetch on recovery (status → 'live') so the panel heals in place.
  }, [getPerformance, status]);

  const seriesStyles = useMemo<SeriesStyle[]>(() => [
    { line: { color: chartColors.baseline, width: 1.5, type: 'dashed' }, item: chartColors.baseline },
    { line: { color: chartColors.onnx, width: 2 }, item: chartColors.onnx },
    { line: { color: chartColors.int8, width: 2 }, item: chartColors.int8 },
  ], []);

  const option: EChartsCoreOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', label: { backgroundColor: chartColors.tooltipBg } },
      backgroundColor: chartColors.tooltipBg,
      borderColor: chartColors.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: chartColors.textPrimary, fontFamily: 'JetBrains Mono', fontSize: 12 },
      formatter: (params: LineTooltipParam | LineTooltipParam[]) => {
        const list = Array.isArray(params) ? params : [params];
        return list.map(p => `${p.marker ?? ''} ${p.seriesName}: ${p.value}%`).join('<br/>');
      },
    },
    legend: {
      top: 0,
      right: 0,
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 3,
      itemGap: 18,
      textStyle: { color: chartColors.textMuted, fontFamily: 'Inter', fontSize: 12 },
    },
    grid: { left: 12, right: 16, top: 40, bottom: 12, containLabel: true },
    xAxis: {
      type: 'category',
      data: data.map(d => d.time),
      boundaryGap: false,
      axisLine: { lineStyle: { color: chartColors.axisLine } },
      axisTick: { show: false },
      axisLabel: { color: chartColors.textMuted, fontFamily: 'Inter', fontSize: 11, margin: 12 },
    },
    yAxis: {
      type: 'value',
      min: 80,
      max: 100,
      name: 'Accuracy (%)',
      nameTextStyle: { color: chartColors.textMuted, fontFamily: 'Inter', fontSize: 11 },
      splitLine: { lineStyle: { color: chartColors.grid } },
      axisLabel: { color: chartColors.textMuted, fontFamily: 'JetBrains Mono', fontSize: 11 },
    },
    series: [
      {
        name: 'FP32 Baseline',
        type: 'line',
        data: data.map(d => d.baseline),
        smooth: true,
        symbol: 'none',
        lineStyle: seriesStyles[0].line,
        itemStyle: { color: seriesStyles[0].item },
      },
      {
        name: 'ONNX FP32',
        type: 'line',
        data: data.map(d => d.onnx),
        smooth: true,
        symbol: 'none',
        lineStyle: seriesStyles[1].line,
        itemStyle: { color: seriesStyles[1].item },
        areaStyle: { color: hexToRgba(chartColors.onnx, 0.06) },
      },
      {
        name: 'ONNX INT8',
        type: 'line',
        data: data.map(d => d.int8),
        smooth: true,
        symbol: 'none',
        lineStyle: seriesStyles[2].line,
        itemStyle: { color: seriesStyles[2].item },
        areaStyle: { color: hexToRgba(chartColors.int8, 0.06) },
      },
    ],
  }), [data, seriesStyles]);

  /* FIX-04: provenance belongs to THIS panel, not the global status alone. */
  const panelSource: DataSource =
    status === 'live' ? (data.length > 0 ? 'live' : 'none') : data.length > 0 ? 'cache' : 'none';

  return (
    <div
      id="performance-chart"
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
            Classification Performance
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm, 12px)', color: 'var(--text-muted)', marginTop: 1 }}>Accuracy — FP32 vs ONNX INT8</p>
        </div>
        <ProvenanceBadge source={panelSource} />
      </div>
      <div style={{ padding: '0 var(--density-card-pad) var(--density-card-pad)', flex: 1, position: 'relative' }}>
        {loaded && data.length === 0 ? (
          status === 'live' ? (
            <EmptyState
              icon={Activity}
              title="No accuracy history this session"
              description="Accuracy points accumulate as classifications run."
              nextStep="Run a classification to populate this chart."
              minHeight={180}
            />
          ) : (
            <EmptyState
              icon={Activity}
              title="No performance data available"
              description="Accuracy history is served by the inference API. The API is currently offline and the cache holds no performance points."
              nextStep="Offline eval results live in Model Registry →."
              minHeight={180}
            />
          )
        ) : (
          <ECharts option={option} style={{ width: '100%', height: '300px' }} />
        )}
      </div>
      <SnapshotFooter source={panelSource} />
    </div>
  );
};
