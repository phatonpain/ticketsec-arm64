/**
 * fixpack-v2 — applies: FIX-04 (badge), FIX-05, FIX-06, FIX-15, FIX-16,
 * FIX-17, FIX-19, FIX-22, FIX-23 (C-34/C-35/C-37/C-40/C-42), FIX-25 (wiring
 * kept), FIX-26, FIX-27, FIX-28.
 * Original: src/components/ClassificationTable.tsx (377 lines).
 * NOTE: original lines 167-168, 298, 315-316, 325, 367 were truncated in the
 * source PDF ("…"); those regions are reconstructed semantically (root card
 * chrome, confidence cell, assignee/time cells, pagination/footer chrome) and
 * cross-checked against evidence/inline-styles.txt.
 *
 * Key changes vs original:
 *  - FIX-05: SEVERITY column 70→104px (fits "SEVERITY ▲" at 11px/600/0.5ls),
 *    th gets overflow guard (never bleeds into CONFIDENCE again), th height
 *    uses --density-table-head-h instead of misused --density-widget-head-h.
 *  - FIX-06: CATEGORY column 150→170px; badge max-width 100% + ellipsis +
 *    title — "Unauthorized Access" never guillotined.
 *  - FIX-22: dead <a href="#"> replaced with a non-interactive mono span
 *    (no fake affordance; a ticket detail view does not exist).
 *  - FIX-02 acceptance: severity cell renders dot + text label.
 *  - FIX-26: rows filtered by the shared time-range store (same pure
 *    function for live and cached rows).
 *  - FIX-28: paginate() owns slice/summary/button math; page clamps after
 *    filtering.
 *  - FIX-04/27: header badge = ProvenanceBadge (panel's own provenance);
 *    footer = SnapshotFooter (single owner).
 *  - FIX-15/16/19: badge geometry + status/category colors via tokens;
 *    no raw rgba literals; type floor 11px.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Download } from 'lucide-react';
import { useTickets, type Ticket } from '../hooks/useTickets';
import { useTicketQuery } from '../hooks/useTicketQuery';
import { useTimeRange } from '../hooks/useTimeRange';
import { useApi } from '../hooks/useApi';
import {
  CATEGORY_COLORS,
  CATEGORY_BG,
  CATEGORY_SEVERITY,
  SEVERITY_COLORS,
  SEVERITY_LABEL,
  STATUS_COLORS,
  truncate,
} from '../lib/utils';
import { filterByTimeRange } from '../lib/timeRange';
import { paginate, pageSummary } from '../lib/paginate';
import { formatRelativeTime } from '../lib/formatRelativeTime';
import { exportTicketsToCsv } from '../lib/exportCsv';
import { ProvenanceBadge, type DataSource } from './ProvenanceBadge';
import { SnapshotFooter } from './SnapshotFooter';

type SortKey = 'id' | 'category' | 'severity' | 'confidence' | 'status' | 'time';
type SortDir = 'asc' | 'desc';

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, info: 1 };

function sortTickets(tickets: readonly Ticket[], key: SortKey, dir: SortDir): Ticket[] {
  const sorted = [...tickets];
  sorted.sort((a, b) => {
    let comparison = 0;
    if (key === 'confidence') {
      comparison = a.confidence - b.confidence;
    } else if (key === 'id') {
      comparison = a.id.localeCompare(b.id);
    } else if (key === 'category') {
      comparison = a.category.localeCompare(b.category);
    } else if (key === 'severity') {
      const sevA = CATEGORY_SEVERITY[a.category] ?? 'info';
      const sevB = CATEGORY_SEVERITY[b.category] ?? 'info';
      comparison = (SEVERITY_RANK[sevA] ?? 0) - (SEVERITY_RANK[sevB] ?? 0);
    } else if (key === 'status') {
      comparison = a.status.localeCompare(b.status);
    } else if (key === 'time') {
      comparison = a.createdAt.getTime() - b.createdAt.getTime();
    }
    return dir === 'asc' ? comparison : -comparison;
  });
  return sorted;
}

function matchesQuery(ticket: Ticket, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    ticket.id.toLowerCase().includes(q) ||
    ticket.subject.toLowerCase().includes(q) ||
    ticket.category.toLowerCase().includes(q) ||
    ticket.status.toLowerCase().includes(q) ||
    ticket.assignedTo.toLowerCase().includes(q)
  );
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

const pageSize = 5;

export const ClassificationTable: React.FC = () => {
  const { status } = useApi();
  const { tickets } = useTickets();
  const { query, clear } = useTicketQuery();
  const { range } = useTimeRange();
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    setPage(1);
  }, [tickets.length, query, range]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  };

  /* One pipeline for live AND cached rows (FIX-26): query → time range → sort. */
  const filteredRows = useMemo(() => {
    return filterByTimeRange(tickets.filter(t => matchesQuery(t, query)), range);
  }, [tickets, query, range]);

  const sortedRows = useMemo(() => sortTickets(filteredRows, sortKey, sortDir), [filteredRows, sortKey, sortDir]);

  /* FIX-28: single owner for pagination math (slice, summary, disables). */
  const pageResult = useMemo(() => paginate(sortedRows, page, pageSize), [sortedRows, page]);

  useEffect(() => {
    if (pageResult.page !== page) setPage(pageResult.page);
  }, [pageResult.page, page]);

  const totalCount = pageResult.total;
  const hasRows = totalCount > 0;

  const thBaseStyle: React.CSSProperties = {
    padding: '6px 12px',
    fontSize: 'var(--font-size-micro, 11px)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 'var(--tracking-th, 0.5px)',
    color: 'var(--text-muted)',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    height: 'var(--density-table-head-h, 36px)',
    boxSizing: 'border-box',
    overflow: 'hidden', // FIX-05 guard: a header can never bleed into its neighbour
    textOverflow: 'ellipsis',
  };

  const tdStyle: React.CSSProperties = {
    padding: '0 12px',
    fontSize: 'var(--font-size-sm, 12px)',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 0,
    height: 'var(--density-row-h)',
    boxSizing: 'border-box',
  };

  const SortableHeader: React.FC<{ label: string; colKey: SortKey; width: number | string }> = ({ label, colKey, width }) => {
    const active = sortKey === colKey;
    const ariaSort = active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
    return (
      <th scope="col" aria-sort={ariaSort} style={{ ...thBaseStyle, width }}>
        <button
          type="button"
          onClick={() => handleSort(colKey)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: 0,
            font: 'inherit',
            color: 'inherit',
            textTransform: 'inherit',
            letterSpacing: 'inherit',
            maxWidth: '100%',
          }}
        >
          {label}
          <span style={{ fontSize: 'var(--font-size-micro, 11px)', color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {active ? (sortDir === 'asc' ? '▲' : '▼') : ''}
          </span>
        </button>
      </th>
    );
  };

  const live = status === 'live';
  const panelSource: DataSource = live ? 'live' : hasRows ? 'cache' : 'none';
  const subtitle = live ? 'Live API predictions' : 'Cached snapshot';

  const handleExport = () => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    exportTicketsToCsv(sortedRows, `ticketsec-classifications-${timestamp}.csv`);
  };

  return (
    <div
      id="classifications-table"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md, 8px)',
        overflow: 'hidden',
        transition: 'border-color 150ms ease',
      }}
    >
      <div
        style={{
          height: 'var(--density-widget-head-h)',
          padding: '0 var(--density-widget-pad-x, 20px)',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <div>
          <h2 style={{ fontSize: 'var(--font-size-md, 15px)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: 'var(--tracking-title, -0.2px)' }}>
            Recent Classifications
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm, 12px)', color: 'var(--text-muted)', marginTop: 1 }}>
            {subtitle}
            {query && ` · filtered by “${query}”`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {query && (
            <button
              type="button"
              onClick={clear}
              style={{
                fontSize: 'var(--font-size-micro, 11px)',
                color: 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 0',
              }}
            >
              Clear filter
            </button>
          )}
          {hasRows && (
            <button
              type="button"
              onClick={handleExport}
              title="Export filtered results as CSV"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                borderRadius: 'var(--radius-sm, 6px)',
                border: '1px solid var(--border-default)',
                background: 'var(--color-control-ghost-bg, transparent)',
                color: 'var(--text-secondary)',
                fontSize: 'var(--font-size-sm, 12px)',
                cursor: 'pointer',
              }}
            >
              <Download size={14} />
              Export CSV
            </button>
          )}
          <ProvenanceBadge source={panelSource} />
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 960 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
              <SortableHeader label="Ticket ID" colKey="id" width={96} />
              <th scope="col" aria-sort="none" style={{ ...thBaseStyle, width: '26%' }}>Subject</th>
              <SortableHeader label="Category" colKey="category" width={170} />
              <SortableHeader label="Severity" colKey="severity" width={104} />
              <SortableHeader label="Confidence" colKey="confidence" width={128} />
              <SortableHeader label="Status" colKey="status" width={104} />
              <th scope="col" aria-sort="none" style={{ ...thBaseStyle, width: 128 }}>Assigned To</th>
              <SortableHeader label="Time" colKey="time" width={88} />
            </tr>
          </thead>
          <tbody>
            {pageResult.items.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '32px 16px', textAlign: 'center', fontSize: 'var(--font-size-base, 13px)', color: 'var(--text-muted)' }}>
                  {query
                    ? 'No tickets match your query.'
                    : status === 'live'
                      ? 'No classifications yet. Submit a ticket to begin.'
                      : 'Unavailable — API offline · no cached classifications'}
                </td>
              </tr>
            ) : (
              pageResult.items.map(row => {
                const severity = CATEGORY_SEVERITY[row.category] ?? 'info';
                const categoryColor = CATEGORY_COLORS[row.category] ?? 'var(--text-muted)';
                const categoryBg = CATEGORY_BG[row.category] ?? 'var(--color-status-neutral-bg)';
                const severityColor = SEVERITY_COLORS[severity];
                return (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    style={{ height: 'var(--density-row-h)', borderBottom: '1px solid var(--tint-row, rgba(255,255,255,0.03))' }}
                  >
                    <td style={{ ...tdStyle, width: 96 }}>
                      {/* FIX-22: no detail view exists — render the ID as honest
                          non-interactive text instead of a dead href="#". */}
                      <span
                        style={{
                          fontFamily: 'var(--font-numeric)',
                          fontVariantNumeric: 'tabular-nums',
                          fontSize: 'var(--font-size-sm, 12px)',
                          color: 'var(--text-secondary)',
                        }}
                        title={row.id}
                      >
                        {row.id}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, width: '26%', fontSize: 'var(--font-size-base, 13px)', fontWeight: 500 }} title={row.subject}>
                      {truncate(row.subject, 42)}
                    </td>
                    <td style={{ ...tdStyle, width: 170 }}>
                      <span
                        title={row.category}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 'var(--badge-gap, 6px)',
                          borderRadius: 'var(--radius-badge, 4px)',
                          fontSize: 'var(--font-size-sm, 12px)',
                          fontWeight: 600,
                          letterSpacing: '0.2px',
                          backgroundColor: categoryBg,
                          color: categoryColor,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '100%',
                          padding: 'var(--badge-pad-y, 2px) var(--badge-pad-x, 8px)',
                          boxSizing: 'border-box',
                        }}
                      >
                        <span
                          style={{
                            width: 'var(--badge-dot-size, 6px)',
                            height: 'var(--badge-dot-size, 6px)',
                            borderRadius: '50%',
                            backgroundColor: categoryColor,
                            flexShrink: 0,
                          }}
                        />
                        {row.category}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, width: 104 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} title={`Severity: ${SEVERITY_LABEL[severity]}`}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: severityColor,
                            flexShrink: 0,
                          }}
                          aria-hidden="true"
                        />
                        <span style={{ fontSize: 'var(--font-size-sm, 12px)', color: 'var(--text-secondary)' }}>
                          {SEVERITY_LABEL[severity]}
                        </span>
                      </span>
                    </td>
                    <td style={{ ...tdStyle, width: 128 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-numeric)',
                            fontVariantNumeric: 'tabular-nums',
                            fontSize: 'var(--font-size-base, 13px)',
                            color: 'var(--text-primary)',
                            minWidth: 32,
                          }}
                        >
                          {(row.confidence * 100).toFixed(0)}%
                        </span>
                        <span
                          style={{
                            width: 48,
                            height: 2,
                            background: 'var(--tint-track, rgba(255,255,255,0.06))',
                            borderRadius: 2,
                            overflow: 'hidden',
                            display: 'inline-block',
                          }}
                        >
                          <span
                            style={{
                              display: 'block',
                              height: '100%',
                              borderRadius: 2,
                              background: 'var(--accent-emerald)',
                              width: `${row.confidence * 100}%`,
                            }}
                          />
                        </span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, width: 104 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: 'var(--badge-pad-y, 2px) var(--badge-pad-x, 8px)',
                          borderRadius: 'var(--radius-badge, 4px)',
                          fontSize: 'var(--badge-font-size, 11px)',
                          fontWeight: 'var(--badge-font-weight, 600)',
                          backgroundColor: STATUS_COLORS[row.status].bg,
                          color: STATUS_COLORS[row.status].text,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, width: 128 }} title={row.assignedTo}>
                      {row.assignedTo}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        width: 88,
                        fontFamily: 'var(--font-numeric)',
                        fontVariantNumeric: 'tabular-nums',
                        color: 'var(--text-muted)',
                      }}
                      title={formatFullTimestamp(row.createdAt)}
                    >
                      {formatRelativeTime(row.createdAt)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {hasRows && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px var(--density-widget-pad-x, 20px)',
            borderTop: '1px solid var(--border-default)',
          }}
        >
          <span style={{ fontSize: 'var(--font-size-sm, 12px)', color: 'var(--text-muted)' }}>
            {pageSummary(pageResult)}
            {query && ` (filtered from ${tickets.length})`}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              disabled={!pageResult.hasPrev}
              aria-disabled={!pageResult.hasPrev}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm, 6px)',
                border: '1px solid var(--border-default)',
                background: 'var(--color-control-ghost-bg, transparent)',
                color: !pageResult.hasPrev ? 'var(--text-muted)' : 'var(--text-primary)',
                fontSize: 'var(--font-size-sm, 12px)',
                cursor: !pageResult.hasPrev ? 'not-allowed' : 'pointer',
              }}
            >
              Previous
            </button>
            <span style={{ fontSize: 'var(--font-size-sm, 12px)', color: 'var(--text-secondary)' }}>
              Page {pageResult.page} of {pageResult.pageCount}
            </span>
            <button
              type="button"
              disabled={!pageResult.hasNext}
              aria-disabled={!pageResult.hasNext}
              onClick={() => setPage(p => p + 1)}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm, 6px)',
                border: '1px solid var(--border-default)',
                background: 'var(--color-control-ghost-bg, transparent)',
                color: !pageResult.hasNext ? 'var(--text-muted)' : 'var(--text-primary)',
                fontSize: 'var(--font-size-sm, 12px)',
                cursor: !pageResult.hasNext ? 'not-allowed' : 'pointer',
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
      <SnapshotFooter source={panelSource} />
    </div>
  );
};
