import React from 'react';
import { CATEGORY_ORDER, CATEGORY_COLORS, STATUS_COLORS } from '../lib/utils';
import type { Ticket } from '../hooks/useTickets';

interface ExpandedRowProps {
  ticket: Ticket;
}

function formatFullTimestamp(date: Date): string {
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  });
}

export const ExpandedRow: React.FC<ExpandedRowProps> = ({ ticket }) => {
  const probabilities = ticket.probabilities ?? {};
  const statusColors = STATUS_COLORS[ticket.status];
  const sourceLabel = ticket.source === 'live' ? 'LIVE session' : 'CACHED snapshot';
  const timestamp = formatFullTimestamp(ticket.createdAt);

  const explanation = ticket.source === 'live'
    ? `Classified as ${ticket.category} by ONNX Runtime INT8 model · confidence ${ticket.confidence.toFixed(2)} · source ${ticket.source}`
    : `Classified as ${ticket.category} by cached snapshot · confidence ${ticket.confidence.toFixed(2)} · source ${ticket.source}`;

  return (
    <div style={{ padding: '12px var(--density-widget-pad-x, 20px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div
          style={{
            fontSize: 'var(--font-size-micro, 11px)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-caps, 0.6px)',
            color: 'var(--text-muted)',
            marginBottom: 4,
          }}
        >
          Subject
        </div>
        <div style={{ fontSize: 'var(--font-size-base, 13px)', color: 'var(--text-primary)', lineHeight: 1.5, wordBreak: 'break-word' }}>
          {ticket.subject}
        </div>
      </div>

      <div>
        <div
          style={{
            fontSize: 'var(--font-size-micro, 11px)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-caps, 0.6px)',
            color: 'var(--text-muted)',
            marginBottom: 6,
          }}
        >
          Class probabilities
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {CATEGORY_ORDER.map(category => {
            const value = probabilities[category] ?? 0;
            const color = CATEGORY_COLORS[category] ?? 'var(--text-muted)';
            return (
              <div key={category} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    width: 110,
                    fontSize: 'var(--font-size-sm, 12px)',
                    color: 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={category}
                >
                  {category}
                </span>
                <span
                  style={{
                    width: 40,
                    fontFamily: 'var(--font-numeric)',
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 'var(--font-size-sm, 12px)',
                    color: 'var(--text-primary)',
                    textAlign: 'right',
                  }}
                >
                  {(value * 100).toFixed(0)}%
                </span>
                <span
                  style={{
                    flex: 1,
                    height: 4,
                    background: 'var(--tint-track, rgba(255,255,255,0.06))',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      height: '100%',
                      borderRadius: 2,
                      background: color,
                      width: `${value * 100}%`,
                      transition: 'width 120ms ease',
                    }}
                  />
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div>
          <div
            style={{
              fontSize: 'var(--font-size-micro, 11px)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-caps, 0.6px)',
              color: 'var(--text-muted)',
              marginBottom: 4,
            }}
          >
            Provenance
          </div>
          <div style={{ fontSize: 'var(--font-size-sm, 12px)', color: 'var(--text-primary)' }}>
            {sourceLabel} · {timestamp}
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 'var(--font-size-micro, 11px)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-caps, 0.6px)',
              color: 'var(--text-muted)',
              marginBottom: 4,
            }}
          >
            Assignment
          </div>
          <div style={{ fontSize: 'var(--font-size-sm, 12px)', color: 'var(--text-primary)' }}>{ticket.assignedTo}</div>
        </div>
        <div>
          <div
            style={{
              fontSize: 'var(--font-size-micro, 11px)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-caps, 0.6px)',
              color: 'var(--text-muted)',
              marginBottom: 4,
            }}
          >
            Status
          </div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: 'var(--badge-pad-y, 2px) var(--badge-pad-x, 8px)',
              borderRadius: 'var(--radius-badge, 4px)',
              fontSize: 'var(--badge-font-size, 11px)',
              fontWeight: 'var(--badge-font-weight, 600)',
              backgroundColor: statusColors.bg,
              color: statusColors.text,
              whiteSpace: 'nowrap',
            }}
          >
            {ticket.status}
          </span>
        </div>
      </div>

      <div
        style={{
          fontSize: 'var(--font-size-sm, 12px)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-numeric)',
          borderTop: '1px solid var(--tint-row, rgba(255,255,255,0.03))',
          paddingTop: 10,
        }}
      >
        {explanation}
      </div>
    </div>
  );
};
