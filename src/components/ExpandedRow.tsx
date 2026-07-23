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
  const llmTier = ticket.inferenceTier === 'local_llm_q4';

  const explanation = llmTier
    ? `Classified as ${ticket.category} by local quantized LLM · confidence ${ticket.confidence.toFixed(2)} · source ${ticket.source}`
    : ticket.source === 'live'
      ? `Classified as ${ticket.category} by ONNX Runtime INT8 model · confidence ${ticket.confidence.toFixed(2)} · source ${ticket.source}`
      : `Classified as ${ticket.category} by cached snapshot · confidence ${ticket.confidence.toFixed(2)} · source ${ticket.source}`;

  return (
    <div style={{ padding: '12px var(--density-widget-pad-x)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div
          style={{
            fontSize: 'var(--font-size-micro)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-caps)',
            color: 'var(--text-muted)',
            marginBottom: 4,
          }}
        >
          Subject
        </div>
        <div style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-primary)', lineHeight: 1.5, wordBreak: 'break-word' }}>
          {ticket.subject}
        </div>
      </div>

      <div>
        <div
          style={{
            fontSize: 'var(--font-size-micro)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-caps)',
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
                <span
                  style={{
                    width: 40,
                    fontFamily: 'var(--font-numeric)',
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 'var(--font-size-sm)',
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
                    background: 'var(--tint-track)',
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
              fontSize: 'var(--font-size-micro)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-caps)',
              color: 'var(--text-muted)',
              marginBottom: 4,
            }}
          >
            Provenance
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
            {sourceLabel} · {timestamp}
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 'var(--font-size-micro)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-caps)',
              color: 'var(--text-muted)',
              marginBottom: 4,
            }}
          >
            Assignment
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>{ticket.assignedTo}</div>
        </div>
        <div>
          <div
            style={{
              fontSize: 'var(--font-size-micro)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-caps)',
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
              padding: 'var(--badge-pad-y) var(--badge-pad-x)',
              borderRadius: 'var(--radius-badge)',
              fontSize: 'var(--badge-font-size)',
              fontWeight: 'var(--badge-font-weight)',
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
          fontSize: 'var(--font-size-sm)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-numeric)',
          borderTop: '1px solid var(--tint-row)',
          paddingTop: 10,
        }}
      >
        {explanation}
      </div>

      {llmTier && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            background: 'var(--color-status-warn-bg)',
            border: '1px solid var(--color-status-warn-text)',
            borderRadius: 'var(--radius-md)',
            padding: 10,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignSelf: 'flex-start',
              padding: 'var(--badge-pad-y) var(--badge-pad-x)',
              borderRadius: 'var(--radius-badge)',
              fontSize: 'var(--badge-font-size)',
              fontWeight: 'var(--badge-font-weight)',
              background: 'var(--color-status-warn-bg)',
              color: 'var(--color-status-warn-text)',
            }}
          >
            LOCAL LLM Q4
          </span>
          {ticket.llmExplanation && (
            /* LLM output rendered as plain text data only — never HTML. */
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', lineHeight: 1.5 }}>
              {ticket.llmExplanation}
            </span>
          )}
          <span style={{ fontSize: 'var(--font-size-micro)', color: 'var(--color-status-warn-text)' }}>
            classificação por LLM local quantizado — precisão reduzida
          </span>
        </div>
      )}
    </div>
  );
};
