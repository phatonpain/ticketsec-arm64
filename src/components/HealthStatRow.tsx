import React, { useMemo } from 'react';
import { Activity, Zap, Clock, AlertTriangle, BarChart2 } from 'lucide-react';
import { KpiCard } from './KpiCard';
import { useApi } from '../hooks/useApi';
import { useProbeHistory } from '../hooks/useProbeHistory';
import { chartColors } from '../lib/chartTokens';
import { formatRelativeTime } from '../lib/formatRelativeTime';

const SESSION_START = Date.now();

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}

export const HealthStatRow: React.FC = () => {
  const { status, checking, diagnostics, consecutiveErrors } = useApi();
  const latencyHistory = useProbeHistory();

  const healthProbe = diagnostics.endpoints.find(e => e.url.endsWith('/health') && e.ok);
  const lastLatency = healthProbe ? `${healthProbe.latencyMs} ms` : '—';
  const latencySub = checking
    ? 'Probing…'
    : healthProbe && diagnostics.lastProbe
      ? `${formatRelativeTime(diagnostics.lastProbe)} · /health`
      : 'No successful probe';

  const statusConfig = useMemo(() => {
    if (checking) {
      return {
        value: 'CHECKING…',
        detail: 'Inference API health probe in progress',
        iconColor: 'var(--text-muted)',
        iconBg: 'var(--tint-indigo-10)',
      };
    }
    if (status === 'live') {
      return {
        value: 'LIVE',
        detail: 'Healthy · last probe OK',
        iconColor: 'var(--color-status-ok-text)',
        iconBg: 'var(--color-status-ok-bg)',
      };
    }
    if (status === 'cached') {
      return {
        value: 'CACHED',
        detail: 'API unreachable · displaying cached data',
        iconColor: 'var(--badge-cached-fg)',
        iconBg: 'var(--badge-cached-bg)',
      };
    }
    return {
      value: 'OFFLINE',
      detail: diagnostics.lastError ?? 'API unreachable',
      iconColor: 'var(--color-status-err-text)',
      iconBg: 'var(--color-status-err-bg)',
    };
  }, [checking, status, diagnostics.lastError]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 'var(--density-card-gap)',
      }}
    >
      <KpiCard
        icon={Activity}
        iconBg={statusConfig.iconBg}
        iconColor={statusConfig.iconColor}
        label="Probe Status"
        value={statusConfig.value}
        detail={statusConfig.detail}
      />
      <KpiCard
        icon={Zap}
        iconBg="var(--tint-cyan-10)"
        iconColor="var(--accent-cyan)"
        label="Latency"
        value={lastLatency}
        detail={latencySub}
        sparklineData={latencyHistory}
        sparklineColor={chartColors.int8}
        muted={latencyHistory.length === 0}
      />
      <KpiCard
        icon={Clock}
        iconBg="var(--tint-indigo-10)"
        iconColor="var(--accent-indigo)"
        label="Session Uptime"
        value={formatDuration(Date.now() - SESSION_START)}
        detail="Since dashboard loaded"
      />
      <KpiCard
        icon={AlertTriangle}
        iconBg="var(--tint-violet-10)"
        iconColor="var(--accent-rose)"
        label="Error Count"
        value={consecutiveErrors > 0 ? String(consecutiveErrors) : '—'}
        detail={diagnostics.lastError ?? 'No recent errors'}
        muted={consecutiveErrors === 0}
      />
      <KpiCard
        icon={BarChart2}
        iconBg="var(--tint-emerald-10)"
        iconColor="var(--accent-emerald)"
        label="Requests / min"
        value="—"
        detail="No telemetry endpoint"
        muted
      />
    </div>
  );
};
