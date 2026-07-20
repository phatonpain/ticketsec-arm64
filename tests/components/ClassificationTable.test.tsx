// @vitest-environment jsdom
/**
 * ClassificationTable.test.tsx (v2) — REAL home of sort/filter/pagination.
 *
 * Pass-1 assumed src/lib/sort.ts + src/lib/filter.ts + src/lib/fuzzy.ts.
 * Reality: sortTickets (lines 21-44), matchesQuery (46-56), and pagination
 * (96-101, pageSize=5) are component-local and NOT exported — so the suite
 * exercises them through the rendered table, seeded via the real
 * seedTickets(). Search text comes from the useTicketQuery store.
 *
 * What is GREEN here: sort/pagination (local useState), rows/offline badges
 * (immutable useTickets store), and search filter (immutable useTicketQuery
 * store — FIX-01 proven in hooks/storeIdentity.test.tsx).
 *
 * Selectors are the REAL ones: header buttons 'Ticket ID'/'Category'/
 * 'Severity'/'Confidence'/'Status'/'Time', 'Previous'/'Next',
 * 'Showing A–B of N', 'Export CSV', severity dot aria-labels.
 */

import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ClassificationTable } from '../../src/components/ClassificationTable';
import { setTicketQuery } from '../../src/hooks/useTicketQuery';
import { seedTickets, type Ticket } from '../../src/hooks/useTickets';
import { makeTicket, snapshotTickets } from '../lib/fixtures';
import {
  enableActEnvironment,
  installFetchMock,
  installJsdomStubs,
  networkError,
} from '../flows/testUtils';

enableActEnvironment();

beforeEach(() => {
  localStorage.clear();
  installJsdomStubs();
  installFetchMock(() => networkError()); // API offline (honest offline path)
  seedTickets(snapshotTickets());
  act(() => setTicketQuery(''));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function dataRows(): HTMLElement[] {
  // Ticket rows only: excludes the thead row AND the single-cell empty-state row.
  return screen
    .getAllByRole('row')
    .filter((r) => r.closest('thead') === null && within(r).queryAllByRole('cell').length > 1) as HTMLElement[];
}

function rowIds(): string[] {
  // M8-PHASE2: checkbox (0) · expand toggle (1) · Ticket ID (2) · Subject (3).
  // The severity rail cell is aria-hidden, so getAllByRole('cell') skips it.
  return dataRows().map((r) => within(r).getAllByRole('cell')[2]?.textContent ?? '');
}

function sortableColumnHeader(name: RegExp): HTMLElement {
  const found = screen
    .getAllByRole('columnheader', { name })
    .find((th) => within(th).queryByRole('button'));
  if (!found) throw new Error(`Sortable column header not found for ${name}`);
  return found;
}

function seedCustom(tickets: Ticket[]): void {
  act(() => seedTickets(tickets));
}

/** Seed 12 tickets with distinct, deterministic ids/subjects. */
function seedTwelve(): void {
  seedCustom(
    Array.from({ length: 12 }, (_, i) =>
      makeTicket({
        id: `TKT-${9000 + i}`,
        subject: `Ticket number ${i}`,
        createdAt: new Date(Date.now() - i * 60_000),
      }),
    ),
  );
}

describe('offline honesty (initial status is offline — no store update needed)', () => {
  it('renders cached snapshot rows with the honest offline badge + subtitle', async () => {
    render(<ClassificationTable />);
    expect(await screen.findByText('TKT-8471')).toBeInTheDocument();
    // Subtitle + SnapshotFooter both carry the canonical "Cached snapshot" copy.
    expect(screen.getAllByText('Cached snapshot')).toHaveLength(2);
    // All 6 snapshot rows are visible (page size 20) plus the panel provenance badge.
    expect(screen.getAllByText('Cached')).toHaveLength(7);
  });

  it('empty store → honest empty state, NO rows fabricated, NO export button', () => {
    seedCustom([]);
    render(<ClassificationTable />);
    expect(screen.getByText('Unavailable — API offline · no cached classifications')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export csv/i })).not.toBeInTheDocument();
    expect(dataRows()).toHaveLength(0);
  });

  it('footer reads "Cached snapshot" (never claims live)', () => {
    render(<ClassificationTable />);
    expect(screen.getAllByText(/Cached snapshot/i).length).toBeGreaterThanOrEqual(1);
  });
});

describe('rendering details', () => {
  it('rows are 40px-token height (density contract)', async () => {
    render(<ClassificationTable />);
    await screen.findByText('TKT-8471');
    expect(dataRows()[0]?.style.height).toBe('var(--density-table-row-h)');
  });

  it('severity dots carry accessible labels derived from category', async () => {
    const user = userEvent.setup();
    render(<ClassificationTable />);
    await screen.findByText('TKT-8471');
    // Page 1 (5 rows): 3× Critical (Phishing/Malware/Data Breach), High, Medium.
    expect(screen.getAllByTitle('Severity: Critical')).toHaveLength(3);
    expect(screen.getByTitle('Severity: High')).toBeInTheDocument();
    expect(screen.getByTitle('Severity: Medium')).toBeInTheDocument();
    // Page 2: False Positive → Low.
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByTitle('Severity: Low')).toBeInTheDocument();
  });

  it('confidence renders as integer percent (evidence: "96%")', async () => {
    render(<ClassificationTable />);
    await screen.findByText('TKT-8471');
    expect(screen.getByText('96%')).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();
  });

  it('all six exact categories render verbatim, incl. False Positive', async () => {
    const user = userEvent.setup();
    render(<ClassificationTable />);
    await screen.findByText('TKT-8471');
    for (const cat of ['Phishing', 'Malware', 'Unauthorized Access', 'Data Breach', 'DDoS']) {
      // Categories now appear in both row badges and chip filters.
      expect(screen.getAllByText(cat).length).toBeGreaterThanOrEqual(1);
    }
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getAllByText('False Positive').length).toBeGreaterThanOrEqual(1);
  });
});

describe('sorting (local state — works)', () => {
  it('default: Time desc (newest first), aria-sort on the Time column', async () => {
    render(<ClassificationTable />);
    await screen.findByText('TKT-8471');
    expect(rowIds()).toEqual(['TKT-8471', 'TKT-8470', 'TKT-8469', 'TKT-8468', 'TKT-8467', 'TKT-8466']);
    const timeTh = screen.getByRole('columnheader', { name: /time/i });
    expect(timeTh).toHaveAttribute('aria-sort', 'descending');
  });

  it('Category: new key starts desc; second click flips to asc', async () => {
    render(<ClassificationTable />);
    await screen.findByText('TKT-8471');

    act(() => {
      screen.getByRole('button', { name: /^category/i }).click();
    });
    await waitFor(() => expect(sortableColumnHeader(/^category/i)).toHaveAttribute('aria-sort', 'descending'));
    await waitFor(() => expect(rowIds()[0]).toBe('TKT-8469')); // 'Unauthorized Access' last alphabetically → first in desc

    act(() => {
      screen.getByRole('button', { name: /^category/i }).click();
    });
    await waitFor(() => expect(sortableColumnHeader(/^category/i)).toHaveAttribute('aria-sort', 'ascending'));
    await waitFor(() => expect(rowIds()[0]).toBe('TKT-8468')); // 'Data Breach' first alphabetically
  });

  it('Severity desc: Critical categories first by rank (not alphabetically)', async () => {
    render(<ClassificationTable />);
    await screen.findByText('TKT-8471');

    act(() => {
      screen.getByRole('button', { name: /^severity/i }).click();
    });
    await waitFor(() =>
      expect(sortableColumnHeader(/^severity/i)).toHaveAttribute('aria-sort', 'descending'),
    );
    // critical: Phishing/Malware/Data Breach (stable, keeps time order) → high → medium → info
    await waitFor(() =>
      expect(rowIds()).toEqual(['TKT-8471', 'TKT-8470', 'TKT-8468', 'TKT-8469', 'TKT-8467', 'TKT-8466']),
    );
  });

  it('Confidence asc: lowest confidence first (numeric, not lexicographic)', async () => {
    render(<ClassificationTable />);
    await screen.findByText('TKT-8471');

    act(() => {
      screen.getByRole('button', { name: /^confidence/i }).click();
    }); // desc
    await waitFor(() =>
      expect(sortableColumnHeader(/^confidence/i)).toHaveAttribute('aria-sort', 'descending'),
    );
    await waitFor(() => expect(rowIds()[0]).toBe('TKT-8471')); // 0.96
    act(() => {
      screen.getByRole('button', { name: /^confidence/i }).click();
    }); // asc
    await waitFor(() =>
      expect(sortableColumnHeader(/^confidence/i)).toHaveAttribute('aria-sort', 'ascending'),
    );
    await waitFor(() => expect(rowIds()[0]).toBe('TKT-8466')); // 0.71
  });

  it(
    'EXPOSED-05: Ticket ID sort is numeric-aware — "TKT-9999" sorts before "TKT-10000" ascending',
    async () => {
      seedCustom([
        makeTicket({ id: 'TKT-9999', subject: 'four digits', createdAt: new Date(Date.now() - 60_000) }),
        makeTicket({ id: 'TKT-10000', subject: 'five digits', createdAt: new Date() }),
      ]);
      render(<ClassificationTable />);
      await screen.findByText('TKT-9999');

      act(() => {
        screen.getByRole('button', { name: /^ticket id/i }).click();
      }); // desc: TKT-10000 first
      await waitFor(() =>
        expect(sortableColumnHeader(/^ticket id/i)).toHaveAttribute('aria-sort', 'descending'),
      );
      await waitFor(() => expect(rowIds()[0]).toBe('TKT-10000'));
      act(() => {
        screen.getByRole('button', { name: /^ticket id/i }).click();
      }); // asc
      await waitFor(() =>
        expect(sortableColumnHeader(/^ticket id/i)).toHaveAttribute('aria-sort', 'ascending'),
      );
      // Numeric ascending puts TKT-9999 first.
      await waitFor(() => expect(rowIds()[0]).toBe('TKT-9999'));
    },
  );
});

describe('pagination (local state — works)', () => {
  it('page 1: all 12 rows on one page (page size 20), Previous/Next disabled', async () => {
    seedTwelve();
    render(<ClassificationTable />);
    await screen.findByText('TKT-9000');
    expect(screen.getByText(/showing 1–12 of 12/i)).toBeInTheDocument();
    expect(screen.getByText(/^page 1 of 1 · 20 per page$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /previous/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: /^next$/i })).toBeDisabled();
    expect(dataRows()).toHaveLength(12);
  });
});

describe('search filter (FIX-01: immutable query store)', () => {
  it(
    'FIX-01: query from the useTicketQuery store narrows the table (substring, case-insensitive)',
    async () => {
      render(<ClassificationTable />);
      await screen.findByText('TKT-8471');
      act(() => setTicketQuery('trojan'));
      expect(rowIds()).toEqual(['TKT-8470']);
      expect(screen.getByText(/showing 1–1 of 1/i)).toBeInTheDocument();
      expect(screen.getByText(/\(filtered from 6\)/i)).toBeInTheDocument();
    },
  );

  it(
    'FIX-01: "Clear filter" button appears while a query is active and resets it',
    async () => {
      const user = userEvent.setup();
      render(<ClassificationTable />);
      await screen.findByText('TKT-8471');
      act(() => setTicketQuery('trojan'));
      const clear = await screen.findByRole('button', { name: /clear filter/i });
      await user.click(clear);
      expect(rowIds()).toHaveLength(6);
    },
  );

  it(
    'FIX-01: no-match query shows the honest empty state (no fabricated rows)',
    async () => {
      render(<ClassificationTable />);
      await screen.findByText('TKT-8471');
      act(() => setTicketQuery('zzz-no-match'));
      expect(screen.getByText('No tickets match your query.')).toBeInTheDocument();
      expect(dataRows()).toHaveLength(0);
    },
  );
});

describe('CSV export wiring (FIX-25: the wiring EXISTS in the real code)', () => {
  it('Export CSV produces a blob from the currently sorted rows', async () => {
    const blobs: Blob[] = [];
    vi.stubGlobal('URL', Object.assign(URL, {
      createObjectURL: vi.fn((b: Blob) => {
        blobs.push(b);
        return 'blob:mock';
      }),
      revokeObjectURL: vi.fn(),
    }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const user = userEvent.setup();
    render(<ClassificationTable />);
    await screen.findByText('TKT-8471');
    await user.click(screen.getByRole('button', { name: /export csv/i }));

    expect(blobs).toHaveLength(1);
    const csv = await blobs[0]!.text();
    expect(csv.split('\r\n')[0]).toBe('ID,Subject,Category,Confidence,Status,Assigned To,Source,Created At');
    expect(csv).toContain('TKT-8471');
    expect(csv).toContain('False Positive');
  });
});
