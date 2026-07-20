import React, { useMemo } from 'react';
import { CATEGORY_ORDER, CATEGORY_COLORS } from '../lib/utils';
import type { Ticket } from '../hooks/useTickets';

interface CategoryCountBlocksProps {
  tickets: readonly Ticket[];
}

export const CategoryCountBlocks: React.FC<CategoryCountBlocksProps> = ({ tickets }) => {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const ticket of tickets) {
      map.set(ticket.category, (map.get(ticket.category) ?? 0) + 1);
    }
    return CATEGORY_ORDER.map(category => ({
      category,
      count: map.get(category) ?? 0,
      color: CATEGORY_COLORS[category] ?? 'var(--text-muted)',
    })).filter(({ count }) => count > 0);
  }, [tickets]);

  if (counts.length === 0) return null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 'var(--density-card-gap)',
      }}
    >
      {counts.map(({ category, count, color }) => (
        <div
          key={category}
          className="panel-hover"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--density-card-pad)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 3,
                height: 16,
                borderRadius: 2,
                background: color,
                flexShrink: 0,
              }}
              aria-hidden="true"
            />
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={category}
            >
              {category}
            </span>
          </div>
          <div
            style={{
              fontSize: 'var(--font-size-kpi)',
              fontWeight: 600,
              fontFamily: 'var(--font-numeric)',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--text-primary)',
              letterSpacing: 'var(--tracking-kpi)',
              lineHeight: 1,
            }}
          >
            {count.toLocaleString('en-US')}
          </div>
        </div>
      ))}
    </div>
  );
};
