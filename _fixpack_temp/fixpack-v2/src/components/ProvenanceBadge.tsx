/**
 * NEW FILE (fixpack-v2) — applies: FIX-04 (P0 honesty-adjacent), FIX-15.
 * Justification for adding: four divergent CACHED-badge implementations
 * existed (ThreatBarChart/ModelHealthDonut/PerformanceLineChart as Tailwind
 * classes, SystemMonitor inline with border, ClassificationTable/KpiCard
 * inline variants). ONE component now owns the provenance badge, gated by the
 * panel's OWN data provenance — never by the global API status alone.
 *
 * Binding state → badge matrix (FIX_PACK FIX-04):
 *   live            → no badge (provenance is the default)
 *   cache           → amber CACHED badge (panel really shows snapshot data)
 *   none (offline, no cached rows) → NO badge ("Unavailable — API offline"
 *                     body copy speaks for itself)
 *   checking        → transient, no badge
 */

import React from 'react';

/** Provenance of the data a panel is ACTUALLY displaying. */
export type DataSource = 'live' | 'cache' | 'none';

interface ProvenanceBadgeProps {
  readonly source: DataSource;
}

export const ProvenanceBadge: React.FC<ProvenanceBadgeProps> = ({ source }) => {
  if (source !== 'cache') return null;
  return (
    <span
      style={{
        fontSize: 'var(--badge-font-size, 11px)',
        fontWeight: 'var(--badge-font-weight, 600)',
        letterSpacing: 'var(--badge-letter-spacing, 0.4px)',
        lineHeight: 'var(--badge-line-height, 16px)',
        textTransform: 'uppercase',
        padding: 'var(--badge-pad-y, 2px) var(--badge-pad-x, 8px)',
        borderRadius: 'var(--radius-badge, 4px)',
        color: 'var(--badge-cached-fg)',
        background: 'var(--badge-cached-bg)',
        border: '1px solid var(--badge-cached-border)',
        whiteSpace: 'nowrap',
      }}
    >
      Cached
    </span>
  );
};
