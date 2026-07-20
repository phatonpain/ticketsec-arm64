/**
 * Honest small-sample visualization for categorical counts.
 *
 * When a category/severity distribution has fewer than 10 total observations,
 * a donut distorts proportions and prints misleading percentages. Render a
 * simple horizontal bar chart with raw counts instead.
 */

import React from 'react';

interface SmallSampleBarsItem {
  name: string;
  value: number;
  color: string;
}

interface SmallSampleBarsProps {
  data: readonly SmallSampleBarsItem[];
  total: number;
}

export const SmallSampleBars: React.FC<SmallSampleBarsProps> = ({ data, total }) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div style={{ padding: '16px 0' }}>
      <div
        style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--text-muted)',
          marginBottom: 14,
        }}
      >
        Small sample — n={total}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.map(item => (
          <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 110,
                fontSize: 'var(--font-size-sm)',
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flexShrink: 0,
              }}
              title={item.name}
            >
              {item.name}
            </span>
            <div
              style={{
                flex: 1,
                height: 8,
                background: 'var(--chart-bar-track)',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${(item.value / maxValue) * 100}%`,
                  height: '100%',
                  background: item.color,
                  borderRadius: 4,
                }}
              />
            </div>
            <span
              style={{
                width: 28,
                fontSize: 'var(--font-size-sm)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-numeric)',
                fontVariantNumeric: 'tabular-nums',
                textAlign: 'right',
                flexShrink: 0,
              }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
