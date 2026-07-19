/**
 * fixpack-v2 — applies: FIX-04, FIX-15, FIX-16, FIX-19, FIX-23 (C-31/C-32),
 * FIX-27.
 * Original: src/components/SystemMonitor.tsx (140 lines).
 * NOTE: original lines 83 and 138 were truncated in the source PDF ("…");
 * badge chrome and card chrome are reconstructed semantically.
 *
 * Key changes vs original:
 *  - FIX-04 [CONFIRMED, S2]: the panel painted an amber CACHED badge while
 *    every tile said "Unavailable — API offline" — a direct contradiction.
 *    Per the binding matrix, this panel has NO cached data source, so it
 *    never shows a CACHED badge: live → no badge, offline → no badge (the
 *    honest body copy speaks for itself).
 *  - HONESTY: CPU/Memory tiles showed a fake 100%/0% utilization bar. The
 *    panel has no utilization telemetry — bars removed. vCPU/RAM are static
 *    deployment facts (t4g.micro configuration) and are labeled as such.
 *  - HONESTY: "API Latency" now displays the REAL last successful /health
 *    probe latency from useApi diagnostics when live (was: static '—' even
 *    when live). "Requests/min" has no telemetry endpoint — it says so
 *    instead of implying an outage.
 *  - FIX-27: "Snapshot: cached" caption removed (no snapshot provenance on
 *    this panel); the footer now states the real probe cadence.
 *  - FIX-15/16/19: no raw rgba; type floor 11px; token-driven chrome.
 */

import React from 'react';
import { Cpu, HardDrive, Zap, Activity } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { formatRelativeTime } from '../lib/formatRelativeTime';

interface Tile {
  label: string;
  icon: LucideIcon;
  value: string;
  sub: string;
}

export const SystemMonitor: React.FC = () => {
  const { status, diagnostics } = useApi();
  const live = status === 'live';

  /* Last successful /health probe latency — real measured data. */
  const healthProbe = diagnostics.endpoints.find(e => e.url.endsWith('/health') && e.ok);
  const latencyText = live && healthProbe ? `${healthProbe.latencyMs} ms` : '—';
  const latencySub = live ? (healthProbe ? 'Last /health probe' : 'Probing…') : 'Unavailable — API offline';

  const tiles: Tile[] = [
    // Static deployment facts — honest to show regardless of API state.
    { label: 'CPU', icon: Cpu, value: '2 vCPUs', sub: 't4g.micro — configuration' },
    { label: 'Memory', icon: HardDrive, value: '1 GB', sub: 't4g.micro — configuration' },
    // Live-only telemetry.
    { label: 'API Latency', icon: Zap, value: latencyText, sub: latencySub },
    // No requests/min telemetry endpoint exists — say so (was: implied outage).
    { label: 'Requests/min', icon: Activity, value: '—', sub: live ? 'No telemetry endpoint' : 'Unavailable — API offline' },
  ];

  return (
    <div
      id="system-monitor"
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
            System Monitor
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 1 }}>Infrastructure resources</p>
        </div>
        {/* FIX-04: no cached data source ⇒ no provenance badge on this panel. */}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
          padding: 'var(--density-card-pad) var(--density-widget-pad-x)',
        }}
      >
        {tiles.map(tile => (
          <div
            key={tile.label}
            style={{
              backgroundColor: 'var(--color-status-neutral-bg)',
              border: '1px solid var(--tint-track)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <tile.icon size={12} color="var(--text-secondary)" />
              <span
                style={{
                  fontSize: 'var(--font-size-micro)',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  letterSpacing: 'var(--tracking-caps)',
                  textTransform: 'uppercase',
                }}
              >
                {tile.label}
              </span>
            </div>
            <div
              style={{
                fontSize: 'var(--font-size-md)',
                fontWeight: 600,
                color: tile.value === '—' ? 'var(--text-secondary)' : 'var(--text-primary)',
                fontFamily: 'var(--font-numeric)',
                fontVariantNumeric: 'tabular-nums',
                marginBottom: 4,
              }}
            >
              {tile.value}
            </div>
            <div style={{ fontSize: 'var(--font-size-micro)', color: 'var(--text-secondary)' }}>{tile.sub}</div>
          </div>
        ))}
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
          {live && diagnostics.lastProbe
            ? `Health probe ${formatRelativeTime(diagnostics.lastProbe)} · every 30s`
            : 'Retrying with jittered backoff (5s–60s)'}
        </span>
      </div>
    </div>
  );
};
