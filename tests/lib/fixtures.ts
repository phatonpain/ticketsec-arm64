/**
 * fixtures.ts (v2) — deterministic fixtures matching the REAL model.
 *
 * Real Ticket (src/hooks/useTickets.ts:5-13):
 *   { id, subject, category: string, confidence: 0..1,
 *     status: 'Resolved' | 'Escalated' | 'Pending', assignedTo, createdAt: Date }
 * Differences from the pass-1 contract (source was unavailable then):
 *   - NO severity field — severity is DERIVED from category (src/lib/utils.ts CATEGORY_SEVERITY)
 *   - createdAt is a Date, not epoch ms
 *   - statuses are exactly Resolved/Escalated/Pending (no 'Open')
 *
 * The snapshot fixtures mirror public/cache/tickets-snapshot.json verbatim
 * (six tickets, TKT-8471…TKT-8466, one per exact category).
 */

import type { Ticket, TicketStatus } from '../../src/hooks/useTickets';

export const CATEGORIES = [
  'Phishing',
  'Malware',
  'Unauthorized Access',
  'Data Breach',
  'DDoS',
  'False Positive',
] as const;

export const STATUSES: readonly TicketStatus[] = ['Resolved', 'Escalated', 'Pending'];

let seq = 0;

/** Factory with sane defaults; every field overridable. */
export function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  seq += 1;
  return {
    id: `TKT-${9000 + seq}`,
    subject: `Synthetic ticket ${seq}`,
    category: 'Phishing',
    confidence: 0.5,
    status: 'Pending',
    assignedTo: 'Auto',
    createdAt: new Date('2026-07-17T13:20:00.000Z'),
    source: 'live',
    ...overrides,
  };
}

export interface SnapshotShape {
  id: string;
  subject: string;
  category: string;
  confidence: number;
  status: TicketStatus;
  assignedTo: string;
  minutesAgo: number;
}

/**
 * The REAL snapshot rows (public/cache/tickets-snapshot.json, verbatim).
 * This is the exact body the offline fetch handler serves.
 */
export const SNAPSHOT_JSON: readonly SnapshotShape[] = [
  { id: 'TKT-8471', subject: 'Suspicious email asking for bank credentials', category: 'Phishing', confidence: 0.96, status: 'Resolved', assignedTo: 'Auto', minutesAgo: 2 },
  { id: 'TKT-8470', subject: 'Trojan horse detected in downloaded file', category: 'Malware', confidence: 0.91, status: 'Resolved', assignedTo: 'Auto', minutesAgo: 5 },
  { id: 'TKT-8469', subject: 'Multiple failed login attempts from unknown IP', category: 'Unauthorized Access', confidence: 0.87, status: 'Escalated', assignedTo: 'Security Team', minutesAgo: 8 },
  { id: 'TKT-8468', subject: 'Customer database export without approval', category: 'Data Breach', confidence: 0.82, status: 'Pending', assignedTo: 'Security Team', minutesAgo: 14 },
  { id: 'TKT-8467', subject: 'DDoS attack pattern detected on edge router', category: 'DDoS', confidence: 0.79, status: 'Escalated', assignedTo: 'NOC', minutesAgo: 18 },
  { id: 'TKT-8466', subject: 'Routine vulnerability scan flagged as incident', category: 'False Positive', confidence: 0.71, status: 'Resolved', assignedTo: 'Auto', minutesAgo: 24 },
];

/** Snapshot as Ticket[] (createdAt = now - minutesAgo, like loadTicketSnapshot does). */
export function snapshotTickets(now: number = Date.now()): Ticket[] {
  return SNAPSHOT_JSON.map((s) => ({
    id: s.id,
    subject: s.subject,
    category: s.category,
    confidence: s.confidence,
    status: s.status,
    assignedTo: s.assignedTo,
    createdAt: new Date(now - s.minutesAgo * 60_000),
    source: 'cache',
  }));
}
