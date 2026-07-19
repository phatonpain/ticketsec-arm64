/**
 * fixpack-v2 — applies: FIX-27 support (honest snapshot provenance timestamp).
 * Original: src/hooks/useTickets.ts (113 lines). Export surface preserved.
 *
 * Changes vs original:
 *  - ADDED snapshotLoadedAt: the real wall-clock time the cached snapshot
 *    (public/cache/tickets-snapshot.json) was successfully loaded. The JSON
 *    carries no generatedAt field, so the load time is the only HONEST
 *    timestamp available for "Cached snapshot from <timestamp>" footers
 *    (never fabricated). Exposed via getSnapshotLoadedAt() for the shared
 *    SnapshotFooter; set before seedTickets() emits, so subscribers re-render
 *    with the flag already populated.
 *  - Everything else unchanged: immutable tickets array (safe for
 *    useSyncExternalStore), monotonic nextId counter.
 */

import { useSyncExternalStore, useCallback } from 'react';

export type TicketStatus = 'Resolved' | 'Escalated' | 'Pending';

export interface Ticket {
  id: string;
  subject: string;
  category: string;
  confidence: number;
  status: TicketStatus;
  assignedTo: string;
  createdAt: Date;
}

interface SnapshotTicket {
  id: string;
  subject: string;
  category: string;
  confidence: number;
  status: TicketStatus;
  assignedTo: string;
  minutesAgo: number;
}

interface TicketsStore {
  tickets: Ticket[];
  nextId: number;
  listeners: Set<() => void>;
}

const store: TicketsStore = {
  tickets: [],
  nextId: 8472,
  listeners: new Set(),
};

let snapshotLoadedAt: Date | null = null;

/** Real time the cached snapshot was loaded this session (null if never). */
export function getSnapshotLoadedAt(): Date | null {
  return snapshotLoadedAt;
}

function emit() {
  store.listeners.forEach(listener => listener());
}

function parseTicketId(id: string): number {
  const match = id.match(/TKT-(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function formatTicketId(num: number): string {
  return `TKT-${num}`;
}

export function seedTickets(tickets: Ticket[]) {
  store.tickets = [...tickets].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const maxId = tickets.reduce((max, t) => Math.max(max, parseTicketId(t.id)), 8466);
  store.nextId = maxId + 1;
  emit();
}

export function addTicket(ticket: Omit<Ticket, 'id' | 'createdAt'> & { id?: string; createdAt?: Date }) {
  const id = ticket.id ?? formatTicketId(store.nextId++);
  const createdAt = ticket.createdAt ?? new Date();
  const fullTicket: Ticket = { ...ticket, id, createdAt };
  store.tickets = [fullTicket, ...store.tickets];
  emit();
  return fullTicket;
}

export async function loadTicketSnapshot(): Promise<boolean> {
  try {
    const res = await fetch('/cache/tickets-snapshot.json');
    if (!res.ok) return false;
    const snapshots: SnapshotTicket[] = await res.json();

    const now = Date.now();
    const tickets: Ticket[] = snapshots.map(s => ({
      id: s.id,
      subject: s.subject,
      category: s.category,
      confidence: s.confidence,
      status: s.status,
      assignedTo: s.assignedTo,
      createdAt: new Date(now - s.minutesAgo * 60_000),
    }));
    // Set BEFORE emit so footers render with the timestamp already present.
    snapshotLoadedAt = new Date();
    seedTickets(tickets);
    return true;
  } catch {
    return false;
  }
}

function subscribe(listener: () => void) {
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

function getSnapshot(): Ticket[] {
  return store.tickets;
}

export function useTickets() {
  const tickets = useSyncExternalStore(subscribe, getSnapshot);

  const seed = useCallback((newTickets: Ticket[]) => {
    seedTickets(newTickets);
  }, []);

  const add = useCallback((ticket: Omit<Ticket, 'id' | 'createdAt'> & { id?: string; createdAt?: Date }) => {
    return addTicket(ticket);
  }, []);

  return { tickets, seed, add };
}
