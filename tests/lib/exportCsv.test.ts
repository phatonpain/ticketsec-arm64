// @vitest-environment jsdom
/**
 * exportCsv.test.ts (v2) — REAL target: src/lib/exportCsv.ts.
 *
 * Real export: exportTicketsToCsv(tickets, filename?) → void (side-effectful:
 * builds a Blob and clicks a synthetic anchor, lines 27-35). There is NO pure
 * ticketsToCsv() — the suite captures the Blob via a URL.createObjectURL stub.
 *
 * Real format (lines 14-25) — differs from the pass-1 contract:
 *   header:     ID,Subject,Category,Confidence,Status,Assigned To,Created At
 *               (no Severity column; not "Ticket ID"/"Time")
 *   confidence: (t.confidence * 100).toFixed(1)  → "96.0"  (no '%' suffix)
 *   createdAt:  t.createdAt.toISOString()
 *   escaping:   RFC 4180 — quote when , " \n \r present; inner quotes doubled
 *   empty list: EARLY RETURN — no file is downloaded at all (line 12)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { exportTicketsToCsv } from '../../src/lib/exportCsv';
import { CATEGORIES, makeTicket, snapshotTickets } from './fixtures';

const REAL_HEADER = 'ID,Subject,Category,Confidence,Status,Assigned To,Source,Created At';

let blobs: Blob[];
let clickSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  blobs = [];
  vi.stubGlobal('URL', Object.assign(URL, {
    createObjectURL: vi.fn((b: Blob) => {
      blobs.push(b);
      return 'blob:mock';
    }),
    revokeObjectURL: vi.fn(),
  }));
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});

afterEach(() => {
  clickSpy.mockRestore();
  vi.unstubAllGlobals();
});

async function csvOf(index = 0): Promise<string> {
  const blob = blobs[index];
  if (!blob) throw new Error('no CSV blob captured');
  return blob.text();
}

/** Strip the UTF-8 BOM the real exporter prepends for Excel. */
function stripBom(csv: string): string {
  return csv.replace(/^\uFEFF/, '');
}

/** Split on the real RFC-4180 CRLF record separator. */
function csvRows(csv: string): string[] {
  return stripBom(csv).split('\r\n');
}

describe('exportTicketsToCsv — structure (real format)', () => {
  it('empty list → NO download (early return, exportCsv.ts:12)', async () => {
    exportTicketsToCsv([]);
    expect(blobs).toHaveLength(0);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('header row is the real 7-column header; one line per ticket', async () => {
    exportTicketsToCsv(snapshotTickets());
    const lines = csvRows(await csvOf());
    expect(lines[0]).toBe(REAL_HEADER);
    expect(lines).toHaveLength(1 + 6);
  });

  it('serializes a plain ticket unquoted; confidence as fixed-1 number; ISO time', async () => {
    const createdAt = new Date('2026-07-17T13:20:00.000Z');
    exportTicketsToCsv([
      makeTicket({
        id: 'TKT-8471',
        subject: 'Suspicious email asking for bank credentials',
        category: 'Phishing',
        confidence: 0.96,
        status: 'Resolved',
        assignedTo: 'Auto',
        createdAt,
      }),
    ]);
    const lines = csvRows(await csvOf());
    expect(lines[1]).toBe(
      `TKT-8471,Suspicious email asking for bank credentials,Phishing,96.0,Resolved,Auto,live,${createdAt.toISOString()}`,
    );
  });

  it('confidence uses (c*100).toFixed(1) — one decimal, no % sign (pins real copy)', async () => {
    exportTicketsToCsv([
      makeTicket({ id: 'TKT-1', confidence: 0.955 }),
      makeTicket({ id: 'TKT-2', confidence: 0.5 }),
      makeTicket({ id: 'TKT-3', confidence: 1 }),
    ]);
    const lines = csvRows(await csvOf());
    expect(lines[1]).toContain(',95.5,');
    expect(lines[2]).toContain(',50.0,');
    expect(lines[3]).toContain(',100.0,');
  });
});

describe('exportTicketsToCsv — RFC 4180 escaping', () => {
  it('commas in a field are quoted', async () => {
    exportTicketsToCsv([makeTicket({ subject: 'Suspicious email, asking for credentials' })]);
    expect(await csvOf()).toContain('"Suspicious email, asking for credentials"');
  });

  it('double quotes are doubled and the field quoted', async () => {
    exportTicketsToCsv([makeTicket({ subject: 'Customer "export" without approval' })]);
    expect(await csvOf()).toContain('"Customer ""export"" without approval"');
  });

  it('newlines and carriage returns are quoted', async () => {
    exportTicketsToCsv([makeTicket({ subject: 'Line one\nLine two' })]);
    expect(await csvOf(0)).toContain('"Line one\nLine two"');
    exportTicketsToCsv([makeTicket({ subject: 'a\r\nb' })]);
    expect(await csvOf(1)).toContain('"a\r\nb"');
  });

  it('quotes + commas escape both rules at once', async () => {
    exportTicketsToCsv([makeTicket({ subject: 'He said, "stop"' })]);
    expect(await csvOf()).toContain('"He said, ""stop"""');
  });

  it('round-trips through a strict RFC 4180 parser (7 fields per row)', async () => {
    const parseField = (row: string): string[] => {
      const fields: string[] = [];
      let field = '';
      let inQuotes = false;
      for (let i = 0; i < row.length; i += 1) {
        const ch = row[i] ?? '';
        if (inQuotes) {
          if (ch === '"' && row[i + 1] === '"') {
            field += '"';
            i += 1;
          } else if (ch === '"') {
            inQuotes = false;
          } else {
            field += ch;
          }
        } else if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(field);
          field = '';
        } else {
          field += ch;
        }
      }
      fields.push(field);
      return fields;
    };
    exportTicketsToCsv([
      makeTicket({ subject: 'a, b' }),
      makeTicket({ subject: 'c "d" e' }),
      makeTicket({ subject: 'f\ng' }),
      makeTicket({ subject: 'plain' }),
    ]);
    const rows = csvRows(await csvOf()).map(parseField);
    expect(rows).toHaveLength(5);
    for (const r of rows) expect(r).toHaveLength(8);
    expect(rows[1]?.[1]).toBe('a, b');
    expect(rows[2]?.[1]).toBe('c "d" e');
    expect(rows[3]?.[1]).toBe('f\ng');
  });
});

describe('exportTicketsToCsv — unicode + exact categories', () => {
  it('unicode passes through unescaped', async () => {
    exportTicketsToCsv([makeTicket({ subject: 'São Paulo phishing — フィッシング' })]);
    expect(await csvOf()).toContain('São Paulo phishing — フィッシング');
  });

  it('serializes all six exact categories verbatim', async () => {
    exportTicketsToCsv(CATEGORIES.map((category) => makeTicket({ category })));
    const csv = await csvOf();
    const lines = csvRows(csv).slice(1);
    expect(lines).toHaveLength(6);
    CATEGORIES.forEach((category, i) => {
      expect((lines[i] ?? '').split(',')[2]).toBe(category);
    });
    expect(csv).toContain(',Unauthorized Access,');
    expect(csv).toContain(',Data Breach,');
    expect(csv).toContain(',False Positive,');
  });

  it('uses the requested filename and revokes the object URL', () => {
    exportTicketsToCsv(snapshotTickets(), 'my-export.csv');
    expect(blobs).toHaveLength(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });
});
