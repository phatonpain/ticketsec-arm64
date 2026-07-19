/**
 * fixpack-v2 — applies: store-snapshot defect (sidebar search accepted
 * keystrokes but the table never re-filtered).
 * Original: src/hooks/useTicketQuery.ts (84 lines). Export surface preserved.
 *
 * ROOT CAUSE FIXED [CONFIRMED from source]: the original store object was
 * mutated in place (store.query = …) and getSnapshot() returned the SAME
 * reference, so useSyncExternalStore bailed out on Object.is and neither the
 * Sidebar input nor ClassificationTable re-rendered on query changes. State
 * is now replaced immutably.
 */

import { useCallback, useSyncExternalStore } from 'react';

interface TicketQueryState {
  query: string;
  expanded: boolean;
}

let state: TicketQueryState = {
  query: '',
  expanded: false,
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

function setState(patch: Partial<TicketQueryState>): void {
  state = { ...state, ...patch };
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): TicketQueryState {
  return state;
}

export function setTicketQuery(query: string): void {
  const trimmed = query.trimStart();
  if (trimmed === state.query) return;
  setState({ query: trimmed });
}

export function clearTicketQuery(): void {
  if (state.query === '' && !state.expanded) return;
  setState({ query: '' });
}

export function setTicketQueryExpanded(expanded: boolean): void {
  if (expanded === state.expanded) return;
  setState({ expanded });
}

export function focusTicketQuery(): void {
  setState({ expanded: true });
  window.setTimeout(() => {
    const input = document.getElementById('ticket-query-input');
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, 0);
}

export function useTicketQuery() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  const setQuery = useCallback((value: string) => setTicketQuery(value), []);
  const clear = useCallback(() => clearTicketQuery(), []);
  const setExpanded = useCallback((expanded: boolean) => setTicketQueryExpanded(expanded), []);
  const focus = useCallback(() => focusTicketQuery(), []);

  return {
    query: snapshot.query,
    expanded: snapshot.expanded,
    setQuery,
    clear,
    setExpanded,
    focus,
  };
}
