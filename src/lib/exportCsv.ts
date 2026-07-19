/**
 * fixpack-v2 — applies: FIX-25.
 * Original: src/lib/exportCsv.ts (41 lines).
 *
 * Changes vs original:
 *  - L3-9  escapeCsvCell: ADDED spreadsheet formula-injection guard — cells
 *          starting with = + - @ (or a leading quote variant) are prefixed
 *          with a single quote so Excel/Sheets never executes them.
 *  - L25   row join: '\n' → '\r\n' (strict RFC-4180 record separators).
 *  - L27   Blob: added UTF-8 BOM ('﻿') so Excel detects encoding and
 *          renders the '—'/'·' characters correctly.
 *  - API unchanged: exportTicketsToCsv(tickets, filename?) — existing call in
 *    ClassificationTable.tsx keeps working; exports ALL filtered+sorted rows.
 */

import type { Ticket } from '../hooks/useTickets';

const FORMULA_PREFIX = /^[=+\-@]/;

function escapeCsvCell(value: string | number): string {
  let str = String(value);
  // Formula-injection guard: a cell whose text starts with = + - @ is a
  // formula when opened in a spreadsheet. Neutralize with a leading quote.
  if (FORMULA_PREFIX.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportTicketsToCsv(tickets: readonly Ticket[], filename = 'ticketsec-classifications.csv'): void {
  if (tickets.length === 0) return;

  const headers = ['ID', 'Subject', 'Category', 'Confidence', 'Status', 'Assigned To', 'Source', 'Created At'];
  const rows = tickets.map(t => [
    t.id,
    t.subject,
    t.category,
    (t.confidence * 100).toFixed(1),
    t.status,
    t.assignedTo,
    t.source ?? 'live',
    t.createdAt.toISOString(),
  ]);

  const csv = [headers.map(escapeCsvCell).join(','), ...rows.map(row => row.map(escapeCsvCell).join(','))].join('\r\n');

  // '﻿' = U+FEFF BOM so Excel auto-detects UTF-8.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
