/**
 * fixpack-v2 — applies: FIX-04, FIX-12, FIX-14 (F-14 donut center overlap),
 * FIX-19, FIX-23 (C-21/C-22/C-23/C-24), FIX-27.
 * Original: src/components/ModelHealthDonut.tsx (144 lines).
 * NOTE: original lines 122-123 and 137 were truncated in the source PDF
 * ("…"); card chrome in those regions is reconstructed semantically.
 *
 * Key changes vs original:
 *  - FIX-12: the 8.73 MB model slice (the actual story) now uses the accent
 *    cyan (chartColors.modelInt8 = #06B6D4); the 691 MB headroom slice drops
 *    the loud violet (#8B5CF6) for the quiet neutral --chart-donut-track
 *    (#334155). Emphasis inversion corrected.
 *  - F-14: center labels anchored at the donut center (left 34% + centered
 *    text) — were anchored at 25%/26% and collided with slices/legend.
 *  - FIX-04/27: this panel renders STATIC, verifiable facts (measured
 *    artifact size + systemd MemoryMax) — it never consumed API or snapshot
 *    data, so the amber CACHED badge and "Snapshot: cached" caption were
 *    false provenance claims. Both removed; the budget caption remains.
 *  - FIX-23: unit spacing '8.73 MB' / '700 MB'; legend 'Free headroom'.
 *  - useApi dependency dropped (no live inputs); typed tooltip formatter.
 */

import React, { useMemo } from 'react';
import { ECharts } from './ECharts';
import type { EChartsCoreOption } from '../lib/echarts';
import { chartColors } from '../lib/chartTokens';

// Verifiable sizes only. INT8 artifact size is measured from model/artifact.onnx.
// Memory budget is MemoryMax=700M in ops/ticketsec.service.
const MODEL_INT8_MB = 8.73;
const MEMORY_MAX_MB = 700;
const DATA = [
  { value: MODEL_INT8_MB, name: 'Model (INT8)', color: chartColors.modelInt8 },
  { value: MEMORY_MAX_MB - MODEL_INT8_MB, name: 'Free headroom', color: chartColors.donutTrack },
];

interface DonutTooltipParam {
  name: string;
  value: number | string;
}

function calculatePercentages(values: number[]): string[] {
  const total = values.reduce((a, b) => a + b, 0);
  return values.map(v => total > 0 ? `${((v / total) * 100).toFixed(1)}%` : '0.0%');
}

export const ModelHealthDonut: React.FC = () => {
  const percentages = useMemo(() => calculatePercentages(DATA.map(d => d.value)), []);

  const option: EChartsCoreOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: chartColors.tooltipBg,
      borderColor: chartColors.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: chartColors.textPrimary, fontFamily: 'JetBrains Mono', fontSize: 12 },
      formatter: (params: DonutTooltipParam) => `${params.name}: ${Number(params.value).toFixed(2)} MB`,
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'middle',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 14,
      icon: 'circle',
      textStyle: {
        color: chartColors.textMuted,
        fontFamily: 'Inter',
        fontSize: 12,
        rich: {
          label: { width: 108, color: chartColors.textMuted, fontSize: 12, fontFamily: 'Inter' },
          value: { width: 64, align: 'right', color: chartColors.textPrimary, fontSize: 12, fontFamily: 'JetBrains Mono' },
          percent: { width: 44, align: 'right', color: chartColors.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' },
        },
      },
      formatter: (name: string) => {
        const idx = DATA.findIndex(d => d.name === name);
        const item = DATA[idx];
        return `{label|${name}} {value|${item.value.toFixed(2)} MB} {percent|${percentages[idx]}}`;
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['42%', '60%'],
        center: ['34%', '50%'],
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
        data: DATA.map(item => ({
          value: item.value,
          name: item.name,
          itemStyle: { color: item.color },
        })),
      },
    ],
    graphic: [
      {
        type: 'text',
        left: '34%',
        top: '46%',
        style: {
          text: '8.73 MB',
          textAlign: 'center',
          fill: chartColors.textPrimary,
          fontSize: 20,
          fontWeight: 600,
          fontFamily: 'JetBrains Mono',
        },
      },
      {
        type: 'text',
        left: '34%',
        top: '56%',
        style: {
          text: 'of 700 MB budget',
          textAlign: 'center',
          fill: chartColors.textMuted,
          fontSize: 11,
          fontFamily: 'Inter',
        },
      },
    ],
  }), [percentages]);

  return (
    <div
      id="model-health"
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
            Model Footprint
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm, 12px)', color: 'var(--text-muted)', marginTop: 1 }}>INT8 artifact vs t4g.micro memory budget</p>
        </div>
        {/* Static, verifiable facts — no provenance badge by design (FIX-04). */}
      </div>
      <div style={{ padding: '0 var(--density-card-pad) var(--density-card-pad)', flex: 1 }}>
        <ECharts option={option} style={{ width: '100%', height: '280px' }} />
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
          Budget: 700 MB (t4g.micro, 1 GB RAM)
        </span>
      </div>
    </div>
  );
};
