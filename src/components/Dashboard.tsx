/**
 * M8-PHASE1 — Dashboard composition (Splunk ES Incident Review pattern).
 *
 * - Dashboard-specific status/filter rail under the page title.
 * - Analytics row: Threat Distribution, Severity Mix, Model Footprint,
 *   Model Performance.
 * - Hero classifications table with bulk selection + resolve.
 * - Event Log and Live Prediction removed for Phase 1.
 */

import React, { Suspense, useMemo, useState } from 'react';
import { Bell, RefreshCw, Settings, ChevronDown } from 'lucide-react';
import { ClassificationTable } from './ClassificationTable';
import { ChartSkeleton } from './ChartSkeleton';
const ThreatDistributionDonut = React.lazy(() => import('./ThreatDistributionDonut').then(m => ({ default: m.ThreatDistributionDonut })));
const SeverityMixDonut = React.lazy(() => import('./SeverityMixDonut').then(m => ({ default: m.SeverityMixDonut })));
import { ModelPerformancePanel } from './ModelPerformancePanel';
import { useApi } from '../hooks/useApi';
import { useTickets } from '../hooks/useTickets';
import { useTimeRange } from '../hooks/useTimeRange';
import { useEventLog } from '../hooks/useEventLog';
import { openSettingsDrawer } from '../hooks/useSettingsDrawer';
import { TIME_RANGES, TIME_RANGE_LABEL } from '../lib/timeRange';
import { formatRelativeTime } from '../lib/formatRelativeTime';

const ModelHealthDonut = React.lazy(() => import('./ModelHealthDonut').then(m => ({ default: m.ModelHealthDonut })));

export const Dashboard: React.FC = () => {
  const { status, checking, diagnostics, lastSync, checkHealth } = useApi();
  const { tickets } = useTickets();
  const { range, setRange } = useTimeRange();
  const { unreadCount, markAllRead } = useEventLog();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await checkHealth();
    setIsRefreshing(false);
  };

  const healthProbe = diagnostics.endpoints.find(e => e.url.endsWith('/health') && e.ok);
  const probeLatency = healthProbe ? `${healthProbe.latencyMs} ms` : checking ? '…' : '—';

  const statusConfig = useMemo(() => {
    if (checking) {
      return {
        label: 'Connecting…',
        color: 'var(--text-muted)',
        bg: 'var(--pill-neutral-bg)',
        border: 'var(--pill-neutral-border)',
        dot: 'var(--text-muted)',
        spinning: true,
      };
    }
    if (status === 'live') {
      return {
        label: 'LIVE',
        color: 'var(--color-status-ok-text)',
        bg: 'var(--color-status-ok-bg)',
        border: 'var(--color-status-ok-text)',
        dot: 'var(--accent-emerald)',
        spinning: false,
      };
    }
    if (status === 'cached') {
      return {
        label: 'CACHED',
        color: 'var(--badge-cached-fg)',
        bg: 'var(--badge-cached-bg)',
        border: 'var(--badge-cached-border)',
        dot: 'var(--accent-amber)',
        spinning: false,
      };
    }
    return {
      label: 'API OFFLINE',
      color: 'var(--color-status-err-text)',
      bg: 'var(--color-status-err-bg)',
      border: 'var(--color-status-err-text)',
      dot: 'var(--accent-rose)',
      spinning: false,
    };
  }, [checking, status]);

  const analyticsSource: 'live' | 'cache' | 'none' =
    tickets.length === 0
      ? 'none'
      : status === 'live'
        ? 'live'
        : 'cache';

  const iconButtonStyle: React.CSSProperties = {
    width: 30,
    height: 30,
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-default)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    position: 'relative',
    padding: 0,
  };

  return (
    <>
      {/* Status / filter rail */}
      <div
        style={{
          height: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '0 var(--layout-page-px)',
          margin: '0 calc(-1 * var(--layout-page-px))',
          borderBottom: '1px solid var(--border-default)',
          boxSizing: 'border-box',
        }}
      >
        {/* Status pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 'var(--radius-pill)',
            border: `1px solid ${statusConfig.border}`,
            background: statusConfig.bg,
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            color: statusConfig.color,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: statusConfig.dot,
              display: 'inline-block',
              flexShrink: 0,
              animation: statusConfig.spinning ? 'pulse 1.2s ease-in-out infinite' : 'none',
            }}
          />
          {statusConfig.label}
        </div>

        {/* Probe latency */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
          <span>Probe</span>
          <span
            style={{
              fontFamily: 'var(--font-numeric)',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--text-secondary)',
            }}
          >
            {probeLatency}
          </span>
        </div>

        {/* Time range */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setDropdownOpen(prev => !prev)}
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer',
              height: 28,
            }}
          >
            {TIME_RANGE_LABEL[range]}
            <ChevronDown size={14} />
          </button>
          {dropdownOpen && (
            <div
              role="listbox"
              aria-label="Time range"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                minWidth: 160,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 0',
                zIndex: 'var(--z-overlay)' as unknown as number,
                boxShadow: 'var(--shadow-popover)',
              }}
            >
              {TIME_RANGES.map(option => (
                <div
                  key={option}
                  role="option"
                  aria-selected={option === range}
                  tabIndex={0}
                  onClick={() => { setRange(option); setDropdownOpen(false); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setRange(option);
                      setDropdownOpen(false);
                    }
                  }}
                  style={{
                    padding: '8px 14px',
                    fontSize: 'var(--font-size-base)',
                    color: option === range ? 'var(--text-primary)' : 'var(--text-secondary)',
                    background: option === range ? 'var(--color-accent-indigo-bg)' : 'transparent',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-control-ghost-bg)'; }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = option === range ? 'var(--color-accent-indigo-bg)' : 'transparent';
                  }}
                >
                  {TIME_RANGE_LABEL[option]}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Refresh + last sync */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <button
            type="button"
            onClick={handleRefresh}
            aria-label="Refresh data"
            title="Refresh data"
            style={iconButtonStyle}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--color-control-ghost-bg)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
            }}
          >
            <RefreshCw
              size={14}
              style={{
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
              }}
            />
          </button>
          <span style={{ fontSize: 'var(--font-size-micro)', color: 'var(--text-muted)' }}>
            {lastSync ? `Synced ${formatRelativeTime(lastSync)}` : checking ? 'Checking…' : 'Not synced'}
          </span>
        </div>

        {/* Notifications */}
        <button
          type="button"
          onClick={() => {
            if (unreadCount > 0) markAllRead();
          }}
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          title="Notifications"
          style={iconButtonStyle}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--color-control-ghost-bg)';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
          }}
        >
          <Bell size={14} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                minWidth: 'var(--badge-count-size)',
                height: 'var(--badge-count-size)',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--color-badge-alert-bg)',
                color: 'var(--color-text-on-accent)',
                fontSize: 'var(--badge-count-font-size)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                boxSizing: 'border-box',
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        {/* Settings */}
        <button
          type="button"
          onClick={openSettingsDrawer}
          aria-label="Settings"
          title="Settings"
          style={iconButtonStyle}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--color-control-ghost-bg)';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
          }}
        >
          <Settings size={14} />
        </button>
      </div>

      {/* Analytics row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 'var(--density-card-gap)' }}>
        <Suspense fallback={<ChartSkeleton height={240} />}>
          <ThreatDistributionDonut tickets={tickets} source={analyticsSource} />
        </Suspense>
        <Suspense fallback={<ChartSkeleton height={240} />}>
          <SeverityMixDonut tickets={tickets} source={analyticsSource} />
        </Suspense>
        <Suspense fallback={<ChartSkeleton height={280} />}>
          <ModelHealthDonut />
        </Suspense>
        <ModelPerformancePanel />
      </div>

      {/* Hero table */}
      <ClassificationTable />
    </>
  );
};
