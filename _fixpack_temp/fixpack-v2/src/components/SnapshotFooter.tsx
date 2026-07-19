/**
 * NEW FILE (fixpack-v2) — applies: FIX-27, FIX-23 (canonical provenance copy).
 * Justification for adding: six panels hand-rendered their own
 * "Snapshot: cached" footer (two layout variants already drifting; the Event
 * Log even claimed snapshot provenance for live session events). ONE
 * component now owns provenance footers.
 *
 * Render rules (Honesty Contract):
 *   source 'cache' → "Cached snapshot from <timestamp>" — the timestamp is
 *                    REAL: lastSync (when the cached data was last fetched
 *                    from the live API) or, failing that, the actual snapshot
 *                    load time recorded by useTickets. Never fabricated.
 *   source 'live'  → nothing (provenance is the default)
 *   source 'none'  → nothing (offline-no-cache panels carry no snapshot claim)
 */

import React from 'react';
import { useApi } from '../hooks/useApi';
import { getSnapshotLoadedAt } from '../hooks/useTickets';
import type { DataSource } from './ProvenanceBadge';

interface SnapshotFooterProps {
  /** Provenance of the data THIS panel displays — footer renders only for 'cache'. */
  readonly source: DataSource;
}

function formatSnapshotTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export const SnapshotFooter: React.FC<SnapshotFooterProps> = ({ source }) => {
  const { lastSync } = useApi();
  if (source !== 'cache') return null;

  const timestamp = lastSync ?? getSnapshotLoadedAt();
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        padding: '6px var(--density-widget-pad-x, 16px) 8px',
        borderTop: '1px solid var(--border-default)',
      }}
    >
      <span style={{ fontSize: 'var(--caption-size)', color: 'var(--caption-color)' }}>
        {timestamp ? `Cached snapshot from ${formatSnapshotTime(timestamp)}` : 'Cached snapshot'}
      </span>
    </div>
  );
};
