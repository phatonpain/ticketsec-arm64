/**
 * fixpack-v2 — applies: FIX-10, FIX-16, FIX-19, FIX-21, FIX-27.
 * Original: src/components/EventLog.tsx (176 lines).
 * NOTE: original lines 54 and 171 were truncated in the source PDF ("…");
 * badge chrome and footer chrome are reconstructed semantically.
 *
 * Key changes vs original:
 *  - FIX-21: filter chips are now an accessible group (role="group" +
 *    aria-label) with aria-pressed on each toggle (screen readers could
 *    not tell which filter was active). The scrollable list is a real live
 *    log: role="log", aria-live="polite", aria-relevant="additions",
 *    aria-label="Event log" (was a plain div).
 *  - FIX-10: an "End of log · N entries" terminator row anchors short logs
 *    (with 2 entries the panel was a floor of dead space, S4).
 *  - FIX-27: the "Snapshot: cached" caption footer is REMOVED — Event Log
 *    entries are live session events; claiming snapshot provenance for them
 *    was a false claim (Honesty Contract).
 *  - FIX-16/19: level chip 9px → 11px floor; raw rgba borders → tint tokens.
 */

import React, { useState } from 'react';
import { useEventLog, type LogLevel } from '../hooks/useEventLog';

const LEVEL_STYLES: Record<LogLevel, { color: string; bg: string }> = {
  INFO: { color: 'var(--color-status-ok-text)', bg: 'var(--color-status-ok-bg)' },
  WARN: { color: 'var(--color-status-warn-text)', bg: 'var(--color-status-warn-bg)' },
  ERROR: { color: 'var(--color-status-err-text)', bg: 'var(--color-status-err-bg)' },
  DEBUG: { color: 'var(--color-status-neutral-text)', bg: 'var(--color-status-neutral-bg)' },
};

const FILTERS: Array<{ key: 'all' | LogLevel; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'INFO', label: 'Info' },
  { key: 'DEBUG', label: 'Debug' },
  { key: 'ERROR', label: 'Error' },
];

export const EventLog: React.FC = () => {
  const { logs, bottomRef, renderLog } = useEventLog(100);
  const [filter, setFilter] = useState<'all' | LogLevel>('all');

  const filteredLogs = filter === 'all' ? logs : logs.filter(log => log.level === filter);

  return (
    <div
      id="event-log"
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
            Event Log
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 1 }}>Real-time system events</p>
        </div>
        {/* FIX-21: filter state is exposed to assistive tech. */}
        <div role="group" aria-label="Filter events by level" style={{ display: 'flex', gap: 4 }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-micro)',
                fontWeight: 600,
                cursor: 'pointer',
                border: filter === f.key ? '1px solid var(--border-hover)' : '1px solid transparent',
                background: filter === f.key ? 'var(--color-control-ghost-bg)' : 'transparent',
                color: filter === f.key ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {/* FIX-21: semantic live log region (was a plain div). */}
      <div
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Event log"
        style={{
          maxHeight: 340,
          overflowY: 'auto',
          padding: '8px var(--density-widget-pad-x)',
          fontFamily: 'var(--font-numeric)',
          fontSize: 'var(--font-size-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {filteredLogs.length === 0 ? (
          <div
            style={{
              minHeight: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'var(--font-size-base)',
              color: 'var(--text-muted)',
            }}
          >
            No {filter === 'all' ? '' : filter.toLowerCase() + ' '}events yet
          </div>
        ) : (
          <>
            {filteredLogs.map(log => {
              const rendered = renderLog(log);
              const style = LEVEL_STYLES[log.level];
              return (
                <div
                  key={log.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', minHeight: 24 }}
                >
                  <span
                    style={{
                      fontSize: 'var(--font-size-micro)',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-numeric)',
                      fontVariantNumeric: 'tabular-nums',
                      flexShrink: 0,
                    }}
                  >
                    {rendered.formattedTime}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--font-size-micro)',
                      fontWeight: 700,
                      letterSpacing: 'var(--badge-letter-spacing)',
                      padding: 'var(--badge-pad-y) var(--badge-pad-x)',
                      borderRadius: 'var(--radius-badge)',
                      color: style.color,
                      background: style.bg,
                      flexShrink: 0,
                      minWidth: 44,
                      textAlign: 'center',
                    }}
                  >
                    {log.level}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={log.message}
                  >
                    {log.message}
                  </span>
                  {log.count > 1 && (
                    <span
                      aria-label={`${log.count} occurrences`}
                      style={{
                        fontSize: 'var(--font-size-micro)',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        background: 'var(--color-control-ghost-bg)',
                        borderRadius: 'var(--radius-badge)',
                        padding: '1px 5px',
                        flexShrink: 0,
                      }}
                    >
                      ×{log.count}
                    </span>
                  )}
                </div>
              );
            })}
            {/* FIX-10: terminator anchors short logs (was a floor of dead space). */}
            <div
              style={{
                textAlign: 'center',
                fontSize: 'var(--font-size-micro)',
                color: 'var(--text-muted)',
                padding: '8px 0 4px',
              }}
            >
              End of log · {filteredLogs.length} {filteredLogs.length === 1 ? 'entry' : 'entries'}
            </div>
          </>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
