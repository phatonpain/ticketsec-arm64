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
 *  - ADDED probabilities to Ticket + computeTicketProbabilities(): derives a
 *    6-class distribution from the real category + confidence for visualization
 *    only. The predicted category gets confidence; the remaining 5 categories
 *    split (1 - confidence) / 5. Sums to 1 and never invents external data.
 *  - Everything else unchanged: immutable tickets array (safe for
 *    useSyncExternalStore), monotonic nextId counter.
 */

import { useSyncExternalStore, useCallback } from 'react';
import { CATEGORY_ORDER } from '../lib/utils';

export type TicketStatus = 'Resolved' | 'Escalated' | 'Pending';

export type TicketSource = 'live' | 'cache';

export interface Ticket {
  id: string;
  subject: string;
  category: string;
  confidence: number;
  status: TicketStatus;
  assignedTo: string;
  createdAt: Date;
  /** Provenance of this row — drives per-row CACHED badges in the Detections table. */
  source?: TicketSource;
  /**
   * Derived 6-class probability distribution used for the expandable-row
   * mini-bars. Computed deterministically from category + confidence; the
   * predicted category gets confidence and the other five split the remainder.
   * This field is visualization-only and never invents external data.
   */
  probabilities?: Record<string, number>;
  /**
   * Inference tier reported by /predict/tiered for live-classified rows.
   * Drives the green/amber/red tier badge and the local-LLM disclaimer in
   * the expanded ticket detail. Absent on snapshot rows (honest: unknown).
   */
  inferenceTier?: 'onnx_int8' | 'local_llm_q4' | 'unavailable';
  /** One-sentence rationale from the local LLM tier; rendered as plain text. */
  llmExplanation?: string;
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

/** Test-only reset helper (also safe for production recovery paths). */
export function resetSnapshotState(): void {
  snapshotLoadedAt = null;
}

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

/**
 * Derive a 6-class probability distribution from a ticket's real category and
 * confidence. Visualization-only; sums to 1 and never invents external data.
 */
export function computeTicketProbabilities(ticket: Pick<Ticket, 'category' | 'confidence'>): Record<string, number> {
  const predicted = ticket.category;
  const remainder = Math.max(0, 1 - ticket.confidence) / 5;
  const probabilities: Record<string, number> = {};
  for (const category of CATEGORY_ORDER) {
    probabilities[category] = category === predicted ? ticket.confidence : remainder;
  }
  return probabilities;
}

function enrichTicket(ticket: Ticket): Ticket {
  if (ticket.probabilities) return ticket;
  return { ...ticket, probabilities: computeTicketProbabilities(ticket) };
}

export function seedTickets(tickets: Ticket[]) {
  store.tickets = [...tickets].map(enrichTicket).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const maxId = tickets.reduce((max, t) => Math.max(max, parseTicketId(t.id)), 8466);
  store.nextId = maxId + 1;
  emit();
}

export function updateTicketsStatus(ids: readonly string[], status: TicketStatus): void {
  const idSet = new Set(ids);
  const changed = store.tickets.some(t => idSet.has(t.id) && t.status !== status);
  if (!changed) return;
  store.tickets = store.tickets.map(t => (idSet.has(t.id) ? { ...t, status } : t));
  emit();
}

export function addTicket(ticket: Omit<Ticket, 'id' | 'createdAt'> & { id?: string; createdAt?: Date }) {
  if (ticket.id) {
    const existing = store.tickets.find((t) => t.id === ticket.id);
    if (existing) return existing;
    const num = parseTicketId(ticket.id);
    if (num > 0) store.nextId = Math.max(store.nextId, num + 1);
  }
  const id = ticket.id ?? formatTicketId(store.nextId++);
  const createdAt = ticket.createdAt ?? new Date();
  const fullTicket: Ticket = enrichTicket({ ...ticket, id, createdAt });
  store.tickets = [fullTicket, ...store.tickets];
  emit();
  return fullTicket;
}

export async function loadTicketSnapshot(): Promise<boolean> {
  // A successfully loaded snapshot should not be re-fetched; live tickets may
  // have arrived since and we must not overwrite them.
  if (snapshotLoadedAt) return true;
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
      source: 'cache',
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

  const updateStatus = useCallback((ids: readonly string[], status: TicketStatus) => {
    updateTicketsStatus(ids, status);
  }, []);

  return { tickets, seed, add, updateStatus };
}
