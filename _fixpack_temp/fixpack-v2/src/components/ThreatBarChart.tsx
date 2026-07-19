/**
 * fixpack-v2 — applies: FIX-03, FIX-04, FIX-07 (via lib/echarts.ts),
 * FIX-12, FIX-19, FIX-23, FIX-27 + P0 HONESTY (fabricated fallback removed).
 * Original: src/components/ThreatBarChart.tsx (152 lines).
 * NOTE: original lines 130-131 and 145 were truncated in the source PDF
 * ("…"); card chrome in those regions is reconstructed semantically.
 *
 * Key changes vs original:
 *  - P0 HONESTY [CONFIRMED from source]: the original hardcoded a FALLBACK
 *    dataset (Phishing 1847, Malware 1245, …) and displayed it whenever the
 *    API/cache had nothing — fabricated data painted as real, under a CACHED
 *    badge, in direct violation of the Honesty Contract. REMOVED. The chart
 *    now shows live data, cache data, or an honest empty state.
 *  - FIX-04: badge = ProvenanceBadge gated by THIS panel's provenance
 *    (live rows → none; cached rows → CACHED; nothing → none + empty state).
 *  - FIX-12: bars pick up the muted 600-level categorical set through
 *    categoryChartColors (chartTokens mirror); bar track/split lines use
 *    chart chrome tokens instead of raw rgba literals (FIX-19).
 *  - FIX-27: footer = SnapshotFooter (single owner, real timestamp).
 *  - Data refresh: re-fetches when the API comes back (status → 'live'),
 *    so the panel heals without a reload. No fabricated intermediate states.
 *  - `any` tooltip/label formatters → typed params (TS strict).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ECharts } from './ECharts';
import type { EChartsCoreOption } from '../lib/echarts';
import { useApi, type CategoryStats } from '../hooks/useApi';
import { categoryChartColors, chartColors } from '../lib/chartTokens';
import { ProvenanceBadge, type DataSource } from './ProvenanceBadge';
import { SnapshotFooter } from './SnapshotFooter';

/**
 * Map a category name to a stable categorical color (600-level, muted).
 * The order matches the categorical palette so chart, table, and donut
 * stay coherent: 1 Phishing, 2 Malware, 3 Data Breach,
 * 4 Unauthorized Access, 5 DDoS, 6 False Positive.
 */
function categoryToChartColor(category: string): string {
  const map: Record<string, string> = {
    Phishing: categoryChartColors[0],
    Malware: categoryChartColors[1],
    'Data Breach': categoryChartColors[2],
    'Unauthorized Access': categoryChartColors[3],
    DDoS: categoryChartColors[4],
    'False Positive': categoryChartColors[5],
  };
  return map[category] ?? chartColors.baseline;
}

interface BarTooltipParam {
  name: string;
  value: number | string;
}

export const ThreatBarChart: React.FC = () => {
  const { status, getStats } = useApi();
  const [data, setData] = useState<CategoryStats[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    getStats().then(res => {
      if (!mounted) return;
      setData(res && res.length > 0 ? res : []);
      setLoaded(true);
    });
    return () => { mounted = false; };
    // Re-fetch on recovery (status → 'live') so the panel heals in place.
  }, [getStats, status]);

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => a.count - b.count);
  }, [data]);

  const option: EChartsCoreOption = useMemo(() => {
    const categories = sortedData.map(d => d.category);
    const values = sortedData.map(d => d.count);
    const maxValue = Math.max(...values, 1);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: chartColors.tooltipBg,
        borderColor: chartColors.tooltipBorder,
        borderWidth: 1,
        textStyle: { color: chartColors.textPrimary, fontFamily: 'JetBrains Mono', fontSize: 12 },
        formatter: (params: BarTooltipParam | BarTooltipParam[]) => {
          const p = Array.isArray(params) ? params[0] : params;
          return `${p.name}: ${Number(p.value).toLocaleString('en-US')}`;
        },
      },
      grid: { left: 12, right: 80, top: 12, bottom: 12, containLabel: true },
      xAxis: {
        type: 'value',
        max: maxValue,
        splitLine: {
          show: true,
          lineStyle: { color: chartColors.grid, type: 'solid' },
          interval: maxValue / 4,
        },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
      },
      yAxis: {
        type: 'category',
        data: categories,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: chartColors.textMuted,
          fontFamily: 'Inter',
          fontSize: 12,
          margin: 12,
        },
      },
      series: [
        {
          type: 'bar',
          data: values.map((value, i) => ({
            value,
            itemStyle: { color: categoryToChartColor(categories[i]) },
          })),
          barWidth: 18,
          showBackground: true,
          backgroundStyle: { color: chartColors.barTrack, borderRadius: [0, 4, 4, 0] },
          itemStyle: { borderRadius: [0, 4, 4, 0] },
          label: {
            show: true,
            position: 'right',
            color: chartColors.textPrimary,
            fontFamily: 'JetBrains Mono',
            fontSize: 12,
            formatter: (p: { value: number | string }) => Number(p.value).toLocaleString('en-US'),
          },
          animationDuration: 600,
        },
      ],
    };
  }, [sortedData]);

  /* FIX-04: provenance belongs to THIS panel, not the global status alone. */
  const panelSource: DataSource =
    status === 'live' ? (sortedData.length > 0 ? 'live' : 'none') : sortedData.length > 0 ? 'cache' : 'none';

  return (
    <div
      id="threat-chart"
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
            Threat Category Distribution
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm, 12px)', color: 'var(--text-muted)', marginTop: 1 }}>Detections by category</p>
        </div>
        <ProvenanceBadge source={panelSource} />
      </div>
      <div style={{ padding: '0 var(--density-card-pad) var(--density-card-pad)', flex: 1, position: 'relative' }}>
        {loaded && sortedData.length === 0 ? (
          <div
            style={{
              height: 320,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              textAlign: 'center',
              padding: '0 24px',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: 'var(--font-size-base, 13px)' }}>
              No category data available
            </span>
            <span style={{ fontSize: 'var(--font-size-micro, 11px)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Detections are computed by the inference API. The API is currently offline and the cache holds no
              category counts. This chart populates automatically when the API reconnects — no action needed.
            </span>
          </div>
        ) : (
          <ECharts option={option} style={{ width: '100%', height: '320px' }} />
        )}
      </div>
      <SnapshotFooter source={panelSource} />
    </div>
  );
};
