/**
 * M8-PHASE2 — Detections table (CrowdStrike Falcon pattern, structure only).
 *
 * - Severity / Status / Category chip filter rail with real counts.
 * - Expandable rows: click a row to reveal full subject, 6-class probability
 *   mini-bars, provenance, assignment/status, and an honest ML explanation.
 * - Search/sort/pagination/CSV and per-row CACHED provenance retained.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Download, CheckSquare, Square, ChevronDown, ChevronRight } from 'lucide-react';
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
import { DetectionFilters, type FilterCounts, type ActiveFilters } from './DetectionFilters';
import { ExpandedRow } from './ExpandedRow';

type SortKey = 'id' | 'category' | 'severity' | 'confidence' | 'status' | 'time';
type SortDir = 'asc' | 'desc';

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, info: 1 };
const STATUS_ORDER: Record<string, number> = { Resolved: 0, Escalated: 1, Pending: 2 };

function parseTicketNumber(id: string): number | null {
  const match = id.match(/^TKT-(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

function compareTicketId(a: string, b: string): number {
  const numA = parseTicketNumber(a);
  const numB = parseTicketNumber(b);
  if (numA !== null && numB !== null) return numA - numB;
  return a.localeCompare(b);
}

function sortTickets(tickets: readonly Ticket[], key: SortKey, dir: SortDir): Ticket[] {
  const sorted = [...tickets];
  sorted.sort((a, b) => {
    let comparison = 0;
    if (key === 'confidence') {
      comparison = a.confidence - b.confidence;
    } else if (key === 'id') {
      comparison = compareTicketId(a.id, b.id);
    } else if (key === 'category') {
      comparison = a.category.localeCompare(b.category);
    } else if (key === 'severity') {
      const sevA = CATEGORY_SEVERITY[a.category] ?? 'info';
      const sevB = CATEGORY_SEVERITY[b.category] ?? 'info';
      comparison = (SEVERITY_RANK[sevA] ?? 0) - (SEVERITY_RANK[sevB] ?? 0);
    } else if (key === 'status') {
      comparison = (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0);
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

function getSeverityLabel(category: string): string {
  return SEVERITY_LABEL[CATEGORY_SEVERITY[category] ?? 'info'];
}

const pageSize = 20;

export const ClassificationTable: React.FC = () => {
  const { status } = useApi();
  const { tickets, updateStatus } = useTickets();
  const { query, clear } = useTicketQuery();
  const { range } = useTimeRange();
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<ActiveFilters>({
    severity: new Set(),
    status: new Set(),
    category: new Set(),
  });

  useEffect(() => {
    setPage(1);
  }, [tickets.length, query, range, filters]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  };

  const toggleFilter = (group: keyof ActiveFilters, value: string) => {
    setFilters(prev => {
      const next = new Set(prev[group]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...prev, [group]: next };
    });
  };

  /* One pipeline for live AND cached rows: query → time range. */
  const filteredRows = useMemo(() => {
    return filterByTimeRange(tickets.filter(t => matchesQuery(t, query)), range);
  }, [tickets, query, range]);

  /* Real counts from the query/time-range filtered set, before chip filters. */
  const counts = useMemo<FilterCounts>(() => {
    const severity: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    for (const ticket of filteredRows) {
      const sev = getSeverityLabel(ticket.category);
      severity[sev] = (severity[sev] ?? 0) + 1;
      statusCounts[ticket.status] = (statusCounts[ticket.status] ?? 0) + 1;
      categoryCounts[ticket.category] = (categoryCounts[ticket.category] ?? 0) + 1;
    }
    return { severity, status: statusCounts, category: categoryCounts };
  }, [filteredRows]);

  /* Apply chip filters (OR within a group, AND across groups). */
  const chipFilteredRows = useMemo(() => {
    return filteredRows.filter(ticket => {
      if (filters.severity.size > 0 && !filters.severity.has(getSeverityLabel(ticket.category))) return false;
      if (filters.status.size > 0 && !filters.status.has(ticket.status)) return false;
      if (filters.category.size > 0 && !filters.category.has(ticket.category)) return false;
      return true;
    });
  }, [filteredRows, filters]);

  const sortedRows = useMemo(() => sortTickets(chipFilteredRows, sortKey, sortDir), [chipFilteredRows, sortKey, sortDir]);

  /* FIX-28: single owner for pagination math (slice, summary, disables). */
  const pageResult = useMemo(() => paginate(sortedRows, page, pageSize), [sortedRows, page]);

  useEffect(() => {
    if (pageResult.page !== page) setPage(pageResult.page);
  }, [pageResult.page, page]);

  useEffect(() => {
    // Collapse an expanded row if it is no longer visible after filtering/sorting/paging.
    if (expandedId && !pageResult.items.some(r => r.id === expandedId)) {
      setExpandedId(null);
    }
  }, [pageResult.items, expandedId]);

  const totalCount = pageResult.total;
  const hasRows = totalCount > 0;

  /* Bulk selection: header checkbox toggles all currently visible rows. */
  const visibleIds = pageResult.items.map(r => r.id);
  const selectedVisibleCount = visibleIds.filter(id => selectedIds.has(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;

  const toggleRow = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  };

  const handleBulkResolve = () => {
    if (selectedIds.size === 0) return;
    updateStatus(Array.from(selectedIds), 'Resolved');
    setSelectedIds(new Set());
  };

  const toggleExpanded = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const thBaseStyle: React.CSSProperties = {
    padding: '6px 12px',
    fontSize: 'var(--font-size-micro)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 'var(--tracking-th)',
    color: 'var(--text-muted)',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    height: 'var(--density-table-head-h)',
    boxSizing: 'border-box',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const tdStyle: React.CSSProperties = {
    padding: '0 12px',
    fontSize: 'var(--font-size-sm)',
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
          <span style={{ fontSize: 'var(--font-size-micro)', color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {active ? (sortDir === 'asc' ? '▲' : '▼') : ''}
          </span>
        </button>
      </th>
    );
  };

  const hasLiveRow = sortedRows.some(r => r.source === 'live');
  const hasCacheRow = sortedRows.some(r => r.source === 'cache');
  const panelSource: DataSource = hasLiveRow ? 'live' : hasCacheRow ? 'cache' : 'none';
  const subtitle = hasLiveRow
    ? (hasCacheRow ? 'Live API predictions · cached history included' : 'Live API predictions')
    : hasCacheRow
      ? 'Cached snapshot'
      : (status === 'live' ? 'Live API predictions' : 'Cached snapshot');

  const handleExport = () => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    exportTicketsToCsv(sortedRows, `ticketsec-classifications-${timestamp}.csv`);
  };

  const emptyReason = () => {
    if (query) return 'No tickets match your query.';
    if (filters.severity.size > 0 || filters.status.size > 0 || filters.category.size > 0) {
      return 'No tickets match the selected filters.';
    }
    if (status === 'live') {
      return hasCacheRow
        ? 'No live classifications this session yet · cached history below.'
        : 'No classifications yet. Submit a ticket to begin.';
    }
    return 'Unavailable — API offline · no cached classifications';
  };

  return (
    <div
      id="classifications-table"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        transition: 'border-color 150ms ease',
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
            {totalCount} Classifications
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 1 }}>
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
                fontSize: 'var(--font-size-micro)',
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
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleBulkResolve}
              title={`Resolve ${selectedIds.size} selected classification${selectedIds.size === 1 ? '' : 's'}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-status-ok-text)',
                background: 'var(--color-status-ok-bg)',
                color: 'var(--color-status-ok-text)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Resolve selected ({selectedIds.size})
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
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                background: 'var(--color-control-ghost-bg)',
                color: 'var(--text-secondary)',
                fontSize: 'var(--font-size-sm)',
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

      <DetectionFilters counts={counts} active={filters} onToggle={toggleFilter} />

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 1120 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
              <th scope="col" style={{ ...thBaseStyle, width: 40, padding: '6px 8px' }}>
                <button
                  type="button"
                  onClick={toggleAllVisible}
                  aria-label={allVisibleSelected ? 'Deselect all visible rows' : 'Select all visible rows'}
                  title={allVisibleSelected ? 'Deselect all visible rows' : 'Select all visible rows'}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {allVisibleSelected ? <CheckSquare size={14} /> : someVisibleSelected ? <CheckSquare size={14} style={{ opacity: 0.6 }} /> : <Square size={14} />}
                </button>
              </th>
              <th scope="col" aria-sort="none" style={{ ...thBaseStyle, width: 3, padding: 0 }}>
                <span style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>Severity</span>
              </th>
              <th scope="col" aria-sort="none" style={{ ...thBaseStyle, width: 28, padding: '6px 4px' }}>
                <span style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>Actions</span>
              </th>
              <SortableHeader label="Ticket ID" colKey="id" width={92} />
              <th scope="col" aria-sort="none" style={{ ...thBaseStyle, width: 'auto', minWidth: 220 }}>Subject</th>
              <SortableHeader label="Category" colKey="category" width={160} />
              <SortableHeader label="Severity" colKey="severity" width={96} />
              <SortableHeader label="Confidence" colKey="confidence" width={120} />
              <SortableHeader label="Status" colKey="status" width={96} />
              <th scope="col" aria-sort="none" style={{ ...thBaseStyle, width: 120 }}>Assigned To</th>
              <th scope="col" aria-sort="none" style={{ ...thBaseStyle, width: 72 }}>Source</th>
              <SortableHeader label="Time" colKey="time" width={84} />
            </tr>
          </thead>
          <tbody>
            {pageResult.items.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ padding: '32px 16px', textAlign: 'center', fontSize: 'var(--font-size-base)', color: 'var(--text-muted)' }}>
                  {emptyReason()}
                </td>
              </tr>
            ) : (
              pageResult.items.map(row => {
                const severity = CATEGORY_SEVERITY[row.category] ?? 'info';
                const categoryColor = CATEGORY_COLORS[row.category] ?? 'var(--text-muted)';
                const categoryBg = CATEGORY_BG[row.category] ?? 'var(--color-status-neutral-bg)';
                const severityColor = SEVERITY_COLORS[severity];
                const expanded = expandedId === row.id;
                return (
                  <React.Fragment key={row.id}>
                    <tr
                      style={{ height: 'var(--density-row-h)', borderBottom: '1px solid var(--tint-row)' }}
                    >
                      <td style={{ ...tdStyle, width: 40, padding: '0 8px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => toggleRow(row.id)}
                          aria-label={selectedIds.has(row.id) ? `Deselect ${row.id}` : `Select ${row.id}`}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: selectedIds.has(row.id) ? 'var(--color-accent-indigo)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {selectedIds.has(row.id) ? <CheckSquare size={14} /> : <Square size={14} />}
                        </button>
                      </td>
                      <td style={{ ...tdStyle, width: 3, padding: 0, backgroundColor: severityColor }} aria-hidden="true" />
                      <td style={{ ...tdStyle, width: 28, padding: '0 4px' }}>
                        <button
                          type="button"
                          onClick={() => toggleExpanded(row.id)}
                          aria-expanded={expanded}
                          aria-controls={`expanded-row-${row.id}`}
                          aria-label={expanded ? 'Collapse row details' : 'Expand row details'}
                          title={expanded ? 'Collapse row' : 'Expand row'}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>
                      <td style={{ ...tdStyle, width: 92 }}>
                        <button
                          type="button"
                          onClick={() => toggleExpanded(row.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            fontFamily: 'var(--font-numeric)',
                            fontVariantNumeric: 'tabular-nums',
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--text-secondary)',
                            textAlign: 'left',
                          }}
                          title={row.id}
                        >
                          {row.id}
                        </button>
                      </td>
                      <td
                        onClick={() => toggleExpanded(row.id)}
                        style={{ ...tdStyle, width: 'auto', minWidth: 220, maxWidth: 'none', fontSize: 'var(--font-size-base)', fontWeight: 500, cursor: 'pointer' }}
                        title={row.subject}
                      >
                        {truncate(row.subject, 36)}
                      </td>
                      <td style={{ ...tdStyle, width: 160 }}>
                        <span
                          title={row.category}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 'var(--badge-gap)',
                            borderRadius: 'var(--radius-badge)',
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 600,
                            letterSpacing: '0.2px',
                            backgroundColor: categoryBg,
                            color: categoryColor,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '100%',
                            padding: 'var(--badge-pad-y) var(--badge-pad-x)',
                            boxSizing: 'border-box',
                          }}
                        >
                          <span
                            style={{
                              width: 'var(--badge-dot-size)',
                              height: 'var(--badge-dot-size)',
                              borderRadius: '50%',
                              backgroundColor: categoryColor,
                              flexShrink: 0,
                            }}
                          />
                          {row.category}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, width: 96 }}>
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
                          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                            {SEVERITY_LABEL[severity]}
                          </span>
                        </span>
                      </td>
                      <td style={{ ...tdStyle, width: 120 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-numeric)',
                              fontVariantNumeric: 'tabular-nums',
                              fontSize: 'var(--font-size-base)',
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
                              background: 'var(--tint-track)',
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
                      <td style={{ ...tdStyle, width: 96 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: 'var(--badge-pad-y) var(--badge-pad-x)',
                            borderRadius: 'var(--radius-badge)',
                            fontSize: 'var(--badge-font-size)',
                            fontWeight: 'var(--badge-font-weight)',
                            backgroundColor: STATUS_COLORS[row.status].bg,
                            color: STATUS_COLORS[row.status].text,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, width: 120 }} title={row.assignedTo}>
                        {row.assignedTo}
                      </td>
                      <td style={{ ...tdStyle, width: 72 }}>
                        {row.source === 'cache' && (
                          <span
                            style={{
                              fontSize: 'var(--badge-font-size)',
                              fontWeight: 'var(--badge-font-weight)',
                              letterSpacing: 'var(--badge-letter-spacing)',
                              textTransform: 'uppercase',
                              padding: 'var(--badge-pad-y) var(--badge-pad-x)',
                              borderRadius: 'var(--radius-badge)',
                              color: 'var(--badge-cached-fg)',
                              background: 'var(--badge-cached-bg)',
                              border: '1px solid var(--badge-cached-border)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Cached
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          width: 84,
                          fontFamily: 'var(--font-numeric)',
                          fontVariantNumeric: 'tabular-nums',
                          color: 'var(--text-muted)',
                        }}
                        title={formatFullTimestamp(row.createdAt)}
                      >
                        {formatRelativeTime(row.createdAt)}
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td
                          colSpan={12}
                          style={{
                            padding: 0,
                            borderBottom: '1px solid var(--border-default)',
                            background: 'var(--bg-body)',
                          }}
                        >
                          <div
                            id={`expanded-row-${row.id}`}
                            style={{
                              maxHeight: 400,
                              overflow: 'hidden',
                              transition: 'max-height 120ms ease',
                            }}
                          >
                            <ExpandedRow ticket={row} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
            padding: '10px var(--density-widget-pad-x)',
            borderTop: '1px solid var(--border-default)',
          }}
        >
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
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
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                background: 'var(--color-control-ghost-bg)',
                color: !pageResult.hasPrev ? 'var(--text-muted)' : 'var(--text-primary)',
                fontSize: 'var(--font-size-sm)',
                cursor: !pageResult.hasPrev ? 'not-allowed' : 'pointer',
              }}
            >
              Previous
            </button>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              Page {pageResult.page} of {pageResult.pageCount} · {pageSize} per page
            </span>
            <button
              type="button"
              disabled={!pageResult.hasNext}
              aria-disabled={!pageResult.hasNext}
              onClick={() => setPage(p => p + 1)}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                background: 'var(--color-control-ghost-bg)',
                color: !pageResult.hasNext ? 'var(--text-muted)' : 'var(--text-primary)',
                fontSize: 'var(--font-size-sm)',
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
