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
 * What is GREEN here: everything driven by local useState (sort, pagination)
 * and by the immutable useTickets store (rows, honest offline badges).
 * What is it.fails: everything driven by the useTicketQuery store — its
 * getSnapshot returns the mutated singleton, so subscribers never re-render
 * (FIX-01 mechanism, proven in hooks/storeIdentity.test.tsx).
 *
 * Selectors are the REAL ones: header buttons 'Ticket ID'/'Category'/
 * 'Severity'/'Confidence'/'Status'/'Time', 'Previous'/'Next',
 * 'Showing A–B of N', 'Export CSV', severity dot aria-labels.
 */

import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
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
  return dataRows().map((r) => within(r).getAllByRole('cell')[0]?.textContent ?? '');
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
    expect(screen.getByText('Cached predictions — API offline')).toBeInTheDocument();
    expect(screen.getByText('API Offline — Displaying cached data')).toBeInTheDocument();
  });

  it('empty store → honest empty state, NO rows fabricated, NO export button', () => {
    seedCustom([]);
    render(<ClassificationTable />);
    expect(screen.getByText('No classifications yet. Submit a ticket to begin.')).toBeInTheDocument();
    expect(screen.getByText('API Offline — no cached data available')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export csv/i })).not.toBeInTheDocument();
    expect(dataRows()).toHaveLength(0);
  });

  it('footer reads "Snapshot: cached" (never claims live)', () => {
    render(<ClassificationTable />);
    expect(screen.getByText('Snapshot: cached')).toBeInTheDocument();
  });
});

describe('rendering details', () => {
  it('rows are 40px-token height (density contract)', async () => {
    render(<ClassificationTable />);
    await screen.findByText('TKT-8471');
    expect(dataRows()[0]?.style.height).toBe('var(--density-row-h)');
  });

  it('severity dots carry accessible labels derived from category', async () => {
    const user = userEvent.setup();
    render(<ClassificationTable />);
    await screen.findByText('TKT-8471');
    // Page 1 (5 rows): 3× Critical (Phishing/Malware/Data Breach), High, Medium.
    expect(screen.getAllByLabelText('Severity: Critical')).toHaveLength(3);
    expect(screen.getByLabelText('Severity: High')).toBeInTheDocument();
    expect(screen.getByLabelText('Severity: Medium')).toBeInTheDocument();
    // Page 2: False Positive → Info.
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByLabelText('Severity: Info')).toBeInTheDocument();
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
      expect(screen.getByText(cat)).toBeInTheDocument();
    }
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByText('False Positive')).toBeInTheDocument();
  });
});

describe('sorting (local state — works)', () => {
  it('default: Time desc (newest first), aria-sort on the Time column', async () => {
    render(<ClassificationTable />);
    await screen.findByText('TKT-8471');
    expect(rowIds()).toEqual(['TKT-8471', 'TKT-8470', 'TKT-8469', 'TKT-8468', 'TKT-8467']);
    const timeTh = screen.getByRole('columnheader', { name: /time/i });
    expect(timeTh).toHaveAttribute('aria-sort', 'descending');
  });

  it('Category: new key starts desc; second click flips to asc', async () => {
    const user = userEvent.setup();
    render(<ClassificationTable />);
    await screen.findByText('TKT-8471');

    await user.click(screen.getByRole('button', { name: /^category/i }));
    expect(rowIds()[0]).toBe('TKT-8469'); // 'Unauthorized Access' last alphabetically → first in desc

    await user.click(screen.getByRole('button', { name: /^category/i }));
    expect(rowIds()[0]).toBe('TKT-8468'); // 'Data Breach' first alphabetically
    expect(screen.getByRole('columnheader', { name: /^category/i })).toHaveAttribute('aria-sort', 'ascending');
  });

  it('Severity desc: Critical categories first by rank (not alphabetically)', async () => {
    const user = userEvent.setup();
    render(<ClassificationTable />);
    await screen.findByText('TKT-8471');

    await user.click(screen.getByRole('button', { name: /^severity/i }));
    // critical: Phishing/Malware/Data Breach (stable, keeps time order) → high → medium → info
    expect(rowIds()).toEqual(['TKT-8471', 'TKT-8470', 'TKT-8468', 'TKT-8469', 'TKT-8467', 'TKT-8466'].slice(0, 5));
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(rowIds()).toEqual(['TKT-8466']); // False Positive (info) last
  });

  it('Confidence asc: lowest confidence first (numeric, not lexicographic)', async () => {
    const user = userEvent.setup();
    render(<ClassificationTable />);
    await screen.findByText('TKT-8471');

    await user.click(screen.getByRole('button', { name: /^confidence/i })); // desc
    expect(rowIds()[0]).toBe('TKT-8471'); // 0.96
    await user.click(screen.getByRole('button', { name: /^confidence/i })); // asc
    expect(rowIds()[0]).toBe('TKT-8466'); // 0.71
  });

  it.fails(
    'EXPOSED-05: Ticket ID sort is lexicographic — "TKT-10000" sorts before "TKT-9999" ascending (ClassificationTable.tsx:28)',
    async () => {
      const user = userEvent.setup();
      seedCustom([
        makeTicket({ id: 'TKT-9999', subject: 'four digits', createdAt: new Date(Date.now() - 60_000) }),
        makeTicket({ id: 'TKT-10000', subject: 'five digits', createdAt: new Date() }),
      ]);
      render(<ClassificationTable />);
      await screen.findByText('TKT-9999');

      await user.click(screen.getByRole('button', { name: /^ticket id/i })); // desc: TKT-9999 first (both ways agree)
      expect(rowIds()[0]).toBe('TKT-9999');
      await user.click(screen.getByRole('button', { name: /^ticket id/i })); // asc
      // Numeric ascending must put TKT-9999 first; localeCompare puts TKT-10000 first.
      expect(rowIds()[0]).toBe('TKT-9999');
    },
  );
});

describe('pagination (local state — works)', () => {
  it('page 1: "Showing 1–5 of 12", Previous disabled, page size 5', async () => {
    seedTwelve();
    render(<ClassificationTable />);
    await screen.findByText('TKT-9000');
    expect(screen.getByText(/showing 1–5 of 12/i)).toBeInTheDocument();
    expect(screen.getByText(/^page 1$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /previous/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: /^next$/i })).toBeEnabled();
    expect(dataRows()).toHaveLength(5);
  });

  it('walks to the last page and back (FIX-28 verified: bounds are correct)', async () => {
    const user = userEvent.setup();
    seedTwelve();
    render(<ClassificationTable />);
    await screen.findByText('TKT-9000');

    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByText(/showing 6–10 of 12/i)).toBeInTheDocument();
    expect(screen.getByText(/^page 2$/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByText(/showing 11–12 of 12/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^next$/i })).toBeDisabled();
    expect(dataRows()).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: /previous/i }));
    expect(screen.getByText(/showing 6–10 of 12/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /previous/i }));
    expect(screen.getByText(/showing 1–5 of 12/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
  });
});

describe('search filter (BROKEN by the store-identity bail-out — it.fails until FIX-01)', () => {
  it.fails(
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

  it.fails(
    'FIX-01: "Clear filter" button appears while a query is active and resets it',
    async () => {
      const user = userEvent.setup();
      render(<ClassificationTable />);
      await screen.findByText('TKT-8471');
      act(() => setTicketQuery('trojan'));
      const clear = await screen.findByRole('button', { name: /clear filter/i });
      await user.click(clear);
      expect(rowIds()).toHaveLength(5);
    },
  );

  it.fails(
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
    expect(csv.split('\n')[0]).toBe('ID,Subject,Category,Confidence,Status,Assigned To,Created At');
    expect(csv).toContain('TKT-8471');
    expect(csv).toContain('False Positive');
  });
});
