/**
 * fixpack-v2 — applies: FIX-04, FIX-12, FIX-14 (F-14 donut center overlap),
 * FIX-19, FIX-23 (C-21/C-22/C-23/C-24), FIX-27.
 * Original: src/components/ModelHealthDonut.tsx (144 lines).
 * NOTE: original lines 122-123 and 137 were truncated in the source PDF
 * ("…"); card chrome in those regions is reconstructed semantically.
 *
 * Key changes vs original:
 *  - FIX-12: the real INT8 model slice (measured from artifact.onnx) now uses the accent
 *    cyan (chartColors.modelInt8 = #06B6D4); the ~699.62 MB headroom slice drops
 *    the loud violet (#8B5CF6) for the quiet neutral --chart-donut-track
 *    (#334155). Emphasis inversion corrected.
 *  - F-14/M6-D4: center labels anchored at the donut center (left 30% + centered
 *    text) — no collision with the right-side legend.
 *  - FIX-04/27: this panel renders STATIC, verifiable facts (measured
 *    artifact size + systemd MemoryMax) — it never consumed API or snapshot
 *    data, so the amber CACHED badge and "Snapshot: cached" caption were
 *    false provenance claims. Both removed; the budget caption remains.
 *  - FIX-23: unit spacing uses the real measured INT8 size / '700 MB'; legend 'Free headroom'.
 *  - useApi dependency dropped (no live inputs); typed tooltip formatter.
 */

import React, { useMemo } from 'react';
import { ECharts } from './ECharts';
import type { EChartsCoreOption } from '../lib/echarts';
import { chartColors } from '../lib/chartTokens';

// Verifiable sizes only. INT8 artifact size is measured from model/artifact.onnx.
// Memory budget is MemoryMax=700M in ops/ticketsec.service.
const MODEL_INT8_MB = 0.38;
const MEMORY_MAX_MB = 700;
const HEADROOM_MB = MEMORY_MAX_MB - MODEL_INT8_MB;
const TOTAL_MB = MODEL_INT8_MB + HEADROOM_MB;

const DATA = [
  { value: MODEL_INT8_MB, name: 'Model (INT8)', color: chartColors.modelInt8 },
  { value: HEADROOM_MB, name: 'Headroom', color: chartColors.donutTrack },
];

function formatPercent(value: number): string {
  return `${((value / TOTAL_MB) * 100).toFixed(1)}%`;
}

interface DonutTooltipParam {
  name: string;
  value: number | string;
}

export const ModelHealthDonut: React.FC = () => {
  const option: EChartsCoreOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: chartColors.tooltipBg,
      borderColor: chartColors.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: chartColors.textPrimary, fontFamily: 'JetBrains Mono', fontSize: 12 },
      formatter: (params: DonutTooltipParam) =>
        `${params.name}: ${Number(params.value).toFixed(2)} MB (${formatPercent(Number(params.value))})`,
    },
    legend: {
      orient: 'vertical',
      right: 16,
      top: 'middle',
      width: 170,
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 14,
      icon: 'circle',
      textStyle: {
        color: chartColors.textMuted,
        fontFamily: 'Inter',
        fontSize: 12,
        width: 154,
        overflow: 'break',
      },
      formatter: (name: string) => {
        const item = DATA.find(d => d.name === name);
        const value = item ? item.value : 0;
        return `${name}  ${value.toFixed(2)} MB (${formatPercent(value)})`;
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
        left: '30%',
        top: '50%',
        style: {
          text: `${MODEL_INT8_MB.toFixed(2)} MB`,
          textAlign: 'center',
          textVerticalAlign: 'middle',
          fill: chartColors.textPrimary,
          fontSize: 18,
          fontWeight: 600,
          fontFamily: 'JetBrains Mono',
        },
      },
    ],
  }), []);

  return (
    <div
      id="model-health"
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
            Model Footprint
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 1 }}>INT8 artifact vs t4g.micro memory budget</p>
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
          padding: '6px var(--density-widget-pad-x) 8px',
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
