import React from 'react';
import { CATEGORY_COLORS, CATEGORY_BG, SEVERITY_COLORS, SEVERITY_LABEL } from '../lib/utils';

type FilterGroup = 'severity' | 'status' | 'category';

export interface FilterCounts {
  severity: Record<string, number>;
  status: Record<string, number>;
  category: Record<string, number>;
}

export interface ActiveFilters {
  severity: Set<string>;
  status: Set<string>;
  category: Set<string>;
}

interface DetectionFiltersProps {
  counts: FilterCounts;
  active: ActiveFilters;
  onToggle: (group: FilterGroup, value: string) => void;
}

const SEVERITY_ORDER = ['Critical', 'High', 'Medium', 'Low'];
const STATUS_ORDER = ['Resolved', 'Escalated', 'Pending'] as const;

function chipBase(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--badge-gap)',
    padding: '4px 10px',
    borderRadius: 'var(--radius-pill)',
    border: '1px solid var(--border-default)',
    background: active ? 'var(--color-accent-indigo-bg)' : 'var(--color-control-ghost-bg)',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 120ms ease',
    whiteSpace: 'nowrap',
  };
}

const countStyle: React.CSSProperties = {
  fontFamily: 'var(--font-numeric)',
  fontVariantNumeric: 'tabular-nums',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--text-muted)',
  minWidth: 16,
  textAlign: 'center',
};

export const DetectionFilters: React.FC<DetectionFiltersProps> = ({ counts, active, onToggle }) => {
  const renderSeverityChip = (label: string) => {
    const key = SEVERITY_LABEL['info'] === label ? 'info' : Object.keys(SEVERITY_LABEL).find(k => SEVERITY_LABEL[k] === label) ?? 'info';
    const color = SEVERITY_COLORS[key];
    const isActive = active.severity.has(label);
    return (
      <button
        key={label}
        type="button"
        aria-pressed={isActive}
        onClick={() => onToggle('severity', label)}
        style={chipBase(isActive)}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
        {label}
        <span style={countStyle}>{counts.severity[label] ?? 0}</span>
      </button>
    );
  };

  const renderStatusChip = (status: string) => {
    const isActive = active.status.has(status);
    return (
      <button
        key={status}
        type="button"
        aria-pressed={isActive}
        onClick={() => onToggle('status', status)}
        style={chipBase(isActive)}
      >
        {status}
        <span style={countStyle}>{counts.status[status] ?? 0}</span>
      </button>
    );
  };

  const renderCategoryChip = (category: string) => {
    const color = CATEGORY_COLORS[category] ?? 'var(--text-muted)';
    const bg = CATEGORY_BG[category] ?? 'var(--color-control-ghost-bg)';
    const isActive = active.category.has(category);
    return (
      <button
        key={category}
        type="button"
        aria-pressed={isActive}
        onClick={() => onToggle('category', category)}
        style={{
          ...chipBase(isActive),
          background: isActive ? bg : 'var(--color-control-ghost-bg)',
          color: isActive ? color : 'var(--text-secondary)',
          borderColor: isActive ? color : 'var(--border-default)',
        }}
      >
        <span
          style={{
            width: 'var(--badge-dot-size)',
            height: 'var(--badge-dot-size)',
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
        {category}
        <span style={{ ...countStyle, color: isActive ? color : 'var(--text-muted)' }}>{counts.category[category] ?? 0}</span>
      </button>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '12px var(--density-widget-pad-x)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: 'var(--font-size-micro)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-caps)',
            color: 'var(--text-muted)',
          }}
        >
          Severity
        </span>
        {SEVERITY_ORDER.map(renderSeverityChip)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: 'var(--font-size-micro)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-caps)',
            color: 'var(--text-muted)',
          }}
        >
          Status
        </span>
        {STATUS_ORDER.map(renderStatusChip)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: 'var(--font-size-micro)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-caps)',
            color: 'var(--text-muted)',
          }}
        >
          Category
        </span>
        {Object.keys(counts.category)
          .sort()
          .map(renderCategoryChip)}
      </div>
    </div>
  );
};
