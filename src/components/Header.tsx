/**
 * fixpack-v2 — applies: FIX-01 (pill UI), FIX-08, FIX-09, FIX-15, FIX-16,
 * FIX-19, FIX-20, FIX-23 (C-04/C-05 pill copy), FIX-26, FIX-31.
 * Original: src/components/Header.tsx (442 lines).
 * NOTE: original lines 70, 74, 76-77, 207, 214-215, 218, 303, 312 were
 * truncated in the source PDF ("…"); those regions (statusConfig entries,
 * endpoint list rows, listbox option handlers) are reconstructed
 * semantically.
 *
 * Key changes vs original:
 *  - FIX-01: pill copy = canonical vocabulary: 'Connecting to inference API…'
 *    (transient) / 'LIVE' / 'CACHED' / 'API OFFLINE'. With the useApi rewrite
 *    the transient state now resolves in ≤4s; styling via the --pill-*
 *    and status token families (no raw rgba).
 *  - FIX-08: unread badge derives from the fixed useEventLog store (immutable
 *    snapshots — bell and Event Log can never desync again); hidden at 0.
 *  - FIX-09: status tooltip closes on Escape (dropdown + notification panel
 *    too); aria-describedby is only present while the tooltip is mounted
 *    (was a dangling reference).
 *  - FIX-20: inline outline:none removed from the pill (global
 *    :focus-visible style takes over).
 *  - FIX-26: time-range listbox writes the shared useTimeRange store (was
 *    local state that filtered nothing); label gains a muted '· cached data'
 *    suffix while the dashboard shows snapshot data.
 *  - FIX-15/16/19/31: bell badge tokens (--badge-count-*, AA-pass
 *    --color-badge-alert-bg), type floor respected, z-index tokens.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Bell, Settings, RefreshCw, ChevronDown, Search } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useEventLog } from '../hooks/useEventLog';
import { useTimeRange } from '../hooks/useTimeRange';
import { openSettingsDrawer } from '../hooks/useSettingsDrawer';
import { openCommandPalette } from '../hooks/useCommandPalette';
import { TIME_RANGES, TIME_RANGE_LABEL } from '../lib/timeRange';
import { VIEW_CONFIG } from '../lib/viewConfig';
import { formatRelativeTime } from '../lib/formatRelativeTime';
import { useActiveView } from '../hooks/useActiveView';

export const Header: React.FC = () => {
  const { activeView } = useActiveView();
  const { breadcrumb } = VIEW_CONFIG[activeView];
  const { status, checkHealth, checking, diagnostics, lastSync } = useApi();
  const { logs, unreadCount, markAllRead } = useEventLog();
  const { range, setRange } = useTimeRange();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [statusTooltipOpen, setStatusTooltipOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
      if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
        setStatusTooltipOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* FIX-09: Escape closes any open header flyout (was: notifications only). */
  useEffect(() => {
    if (!notifOpen && !dropdownOpen && !statusTooltipOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotifOpen(false);
        setDropdownOpen(false);
        setStatusTooltipOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [notifOpen, dropdownOpen, statusTooltipOpen]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await checkHealth();
    setIsRefreshing(false);
  };

  const handleToggleNotifications = () => {
    if (!notifOpen && unreadCount > 0) {
      markAllRead();
    }
    setNotifOpen(prev => !prev);
  };

  interface StatusConfig {
    label: string;
    color: string;
    bg: string;
    border: string;
    dot: string;
    spinning: boolean;
  }

  /* FIX-01/C-04/C-05: canonical pill vocabulary, token-driven styling. */
  const statusConfig: StatusConfig = checking
    ? {
        label: 'Connecting to inference API…',
        color: 'var(--text-muted)',
        bg: 'var(--pill-neutral-bg)',
        border: 'var(--pill-neutral-border)',
        dot: 'var(--text-muted)',
        spinning: true,
      }
    : status === 'live'
      ? {
          label: 'LIVE',
          color: 'var(--color-status-ok-text)',
          bg: 'var(--color-status-ok-bg)',
          border: 'var(--color-status-ok-text)',
          dot: 'var(--accent-emerald)',
          spinning: false,
        }
      : status === 'cached'
        ? {
            label: 'CACHED',
            color: 'var(--badge-cached-fg)',
            bg: 'var(--badge-cached-bg)',
            border: 'var(--badge-cached-border)',
            dot: 'var(--accent-amber)',
            spinning: false,
          }
        : {
            label: 'API OFFLINE',
            color: 'var(--color-status-err-text)',
            bg: 'var(--color-status-err-bg)',
            border: 'var(--color-status-err-text)',
            dot: 'var(--accent-rose)',
            spinning: false,
          };

  const iconButtonStyle: React.CSSProperties = {
    width: 34,
    height: 34,
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
  };

  const recentNotifications = logs.slice(0, 8);

  return (
    <header
      style={{
        height: 'var(--density-header-h)',
        padding: '0 var(--layout-page-px)',
        borderBottom: `1px solid ${scrolled ? 'var(--border-hover)' : 'var(--border-default)'}`,
        background: 'var(--bg-body)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-header)' as unknown as number,
        isolation: 'isolate',
        boxShadow: scrolled ? 'var(--shadow-popover)' : 'none',
        boxSizing: 'border-box',
      }}
    >
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-base)', color: 'var(--text-muted)' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Dashboard</span>
        <span style={{ fontSize: 'var(--font-size-micro)' }}>›</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{breadcrumb}</span>
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Status Pill */}
        <div
          ref={statusRef}
          style={{ position: 'relative' }}
          onMouseEnter={() => setStatusTooltipOpen(true)}
          onMouseLeave={() => setStatusTooltipOpen(false)}
          onFocus={() => setStatusTooltipOpen(true)}
          onBlur={() => setStatusTooltipOpen(false)}
        >
          <div
            tabIndex={0}
            role="button"
            aria-describedby={statusTooltipOpen ? 'status-tooltip' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 'var(--radius-pill)',
              border: `1px solid ${statusConfig.border}`,
              background: statusConfig.bg,
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              color: statusConfig.color,
              cursor: 'help',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: statusConfig.dot,
                display: 'inline-block',
                marginRight: 6,
                flexShrink: 0,
                animation: statusConfig.spinning ? 'pulse 1.2s ease-in-out infinite' : 'none',
              }}
            />
            {statusConfig.label}
          </div>
          {statusTooltipOpen && (
            <div
              id="status-tooltip"
              role="tooltip"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: 280,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: 12,
                zIndex: 'var(--z-tooltip)' as unknown as number,
                boxShadow: 'var(--shadow-popover)',
              }}
            >
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                Connection Diagnostics
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 'var(--font-size-micro)', color: 'var(--text-secondary)' }}>
                  Status: <span style={{ color: statusConfig.color, fontWeight: 500 }}>{statusConfig.label}</span>
                </div>
                {lastSync && (
                  <div style={{ fontSize: 'var(--font-size-micro)', color: 'var(--text-secondary)' }}>
                    Last sync: {formatRelativeTime(lastSync)}
                  </div>
                )}
                {diagnostics.lastProbe && (
                  <div style={{ fontSize: 'var(--font-size-micro)', color: 'var(--text-secondary)' }}>
                    Probed: {formatRelativeTime(diagnostics.lastProbe)}
                  </div>
                )}
                {diagnostics.lastError && (
                  <div style={{ fontSize: 'var(--font-size-micro)', color: 'var(--accent-rose)' }}>
                    Error: {diagnostics.lastError}
                  </div>
                )}
                <div style={{ marginTop: 4, borderTop: '1px solid var(--border-default)', paddingTop: 8 }}>
                  <div
                    style={{
                      fontSize: 'var(--font-size-micro)',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: 'var(--tracking-caps)',
                      marginBottom: 4,
                    }}
                  >
                    Endpoints
                  </div>
                  {diagnostics.endpoints.length === 0 ? (
                    <div style={{ fontSize: 'var(--font-size-micro)', color: 'var(--text-muted)' }}>No probes yet.</div>
                  ) : (
                    diagnostics.endpoints.map(endpoint => (
                      <div
                        key={endpoint.url}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
                      >
                        <span
                          style={{
                            color: 'var(--text-secondary)',
                            maxWidth: 160,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: 'var(--font-size-micro)',
                          }}
                          title={endpoint.url}
                        >
                          {endpoint.url}
                        </span>
                        <span
                          style={{
                            color: endpoint.ok ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                            fontWeight: 500,
                            flexShrink: 0,
                            fontSize: 'var(--font-size-micro)',
                            fontFamily: 'var(--font-numeric)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {endpoint.ok ? `${endpoint.latencyMs}ms` : (endpoint.error ?? 'Fail')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                <div style={{ fontSize: 'var(--font-size-micro)', color: 'var(--text-muted)', marginTop: 4 }}>
                  Auto-recovery probes with jittered backoff (5s–60s).
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Command palette trigger (F-01) */}
        <button
          type="button"
          onClick={openCommandPalette}
          aria-label="Open command palette"
          title="Open command palette (Ctrl+K)"
          style={{
            ...iconButtonStyle,
            width: 'auto',
            padding: '0 10px',
            gap: 6,
          }}
        >
          <Search size={16} />
          <kbd
            style={{
              fontFamily: 'var(--font-numeric)',
              fontSize: 'var(--font-size-micro)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-default)',
              borderRadius: 4,
              padding: '1px 4px',
            }}
          >
            Ctrl+K
          </kbd>
        </button>

        {/* Refresh */}
        <button
          type="button"
          onClick={handleRefresh}
          aria-label="Refresh data"
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
            size={16}
            style={{
              animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
            }}
          />
        </button>

        {/* Time Range Dropdown — FIX-26: writes the shared store; the table
            filters live AND cached rows through the same pure function. */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setDropdownOpen(prev => !prev)}
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--font-size-base)',
              cursor: 'pointer',
            }}
          >
            {TIME_RANGE_LABEL[range]}
            {status === 'cached' && <span style={{ color: 'var(--text-muted)' }}>· cached data</span>}
            <ChevronDown size={14} />
          </button>
          {dropdownOpen && (
            <div
              role="listbox"
              aria-label="Time range"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                minWidth: 180,
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

        {/* Notifications — FIX-08: count derives from the event-log store. */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={handleToggleNotifications}
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
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
            <Bell size={16} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 5,
                  right: 5,
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
          {notifOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: 340,
                maxHeight: 360,
                overflowY: 'auto',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 0',
                zIndex: 'var(--z-overlay)' as unknown as number,
                boxShadow: 'var(--shadow-popover)',
              }}
            >
              <div style={{ padding: '0 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)' }}>Notifications</span>
                <span style={{ fontSize: 'var(--font-size-micro)', color: 'var(--text-muted)' }}>{recentNotifications.length} events</span>
              </div>
              {recentNotifications.length === 0 ? (
                <div style={{ padding: '16px 14px', textAlign: 'center', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                  No notifications yet.
                </div>
              ) : (
                recentNotifications.map(entry => {
                  const levelColor = entry.level === 'INFO'
                    ? 'var(--accent-emerald)'
                    : entry.level === 'WARN'
                      ? 'var(--accent-amber)'
                      : entry.level === 'ERROR'
                        ? 'var(--accent-rose)'
                        : 'var(--text-muted)';
                  return (
                    <div
                      key={entry.id}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--tint-row)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: levelColor, flexShrink: 0 }} />
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>{entry.message}</span>
                      </div>
                      <span style={{ fontSize: 'var(--font-size-micro)', color: 'var(--text-muted)', paddingLeft: 14 }}>
                        {formatRelativeTime(entry.timestamp)} · {entry.level}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Settings */}
        <button
          type="button"
          onClick={openSettingsDrawer}
          aria-label="Settings"
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
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
};
