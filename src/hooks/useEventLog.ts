/**
 * fixpack-v2 — applies: FIX-08 (bell badge desync), plus the store-snapshot
 * defect that made the Event Log render stale data.
 * Original: src/hooks/useEventLog.ts (158 lines).
 *
 * ROOT CAUSE FIXED [CONFIRMED from source]: the original store was mutated in
 * place and getSnapshot() returned the SAME object reference every time, so
 * useSyncExternalStore's Object.is comparison bailed out and subscribed
 * components never re-rendered on new entries. Depending on which component
 * re-rendered last (local state), the bell could read 3 unread while the
 * Event Log panel still showed 2 entries (S1 vs S4).
 *
 * Changes vs original:
 *  - Store state is now replaced IMMUTABLY on every mutation (new object
 *    identity ⇒ every subscriber re-renders; bell count and log panel can
 *    never desync again).
 *  - Entry cap is a single module constant (MAX_ENTRIES) instead of
 *    "first hook caller wins" — previously useEventLog(50) in Header could
 *    trim the 100-entry Event Log view to 50.
 *  - ADDED imperative `logEvent(level, message)` export so non-React code
 *    (the useApi health probe) can write transitions (FIX-01). No import of
 *    useApi here — no cycle.
 *  - unreadCount stays derived from the store (logs newer than lastRead);
 *    badge hides at 0 in the Header.
 *  - Public hook API unchanged: useEventLog(maxEntries?) still returns
 *    { logs, unreadCount, addLog, addInfo, addWarn, addError, addDebug,
 *      markAllRead, bottomRef, renderLog }. `maxEntries` is accepted for
 *    compatibility but the store bound is MAX_ENTRIES for all writers.
 */

import { useCallback, useRef, useEffect, useSyncExternalStore } from 'react';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  count: number;
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  INFO: 'text-accent-emerald',
  WARN: 'text-accent-amber',
  ERROR: 'text-accent-rose',
  DEBUG: 'text-text-muted',
};

const LAST_READ_KEY = 'ticketsec-notifications-last-read';
/** Single bound for every writer (hook or imperative logEvent). */
const MAX_ENTRIES = 200;

function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 8);
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readLastRead(): number {
  try {
    const raw = localStorage.getItem(LAST_READ_KEY);
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!Number.isNaN(parsed)) return parsed;
    }
  } catch {
    // Storage may be unavailable.
  }
  return 0;
}

function writeLastRead(timestamp: number): void {
  try {
    localStorage.setItem(LAST_READ_KEY, String(timestamp));
  } catch {
    // Ignore storage errors.
  }
}

interface EventLogState {
  logs: LogEntry[];
  lastRead: number;
}

/* Store state is IMMUTABLE: every mutation produces a new object identity,
 * which is what useSyncExternalStore needs to notify subscribers. */
let state: EventLogState = {
  logs: [],
  lastRead: readLastRead(),
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Cached reference between mutations — required by useSyncExternalStore. */
function getSnapshot(): EventLogState {
  return state;
}

const INITIAL_LOGS: { level: LogLevel; message: string }[] = [
  { level: 'DEBUG', message: 'Health probe started' },
  { level: 'INFO', message: 'Dashboard initialized' },
];

function addLogEntry(level: LogLevel, message: string): void {
  const last = state.logs[0];
  if (last && last.level === level && last.message === message) {
    const updated: LogEntry = { ...last, count: last.count + 1 };
    state = { ...state, logs: [updated, ...state.logs.slice(1)].slice(0, MAX_ENTRIES) };
    emit();
    return;
  }
  const entry: LogEntry = {
    id: generateId(),
    timestamp: new Date(),
    level,
    message,
    count: 1,
  };
  state = { ...state, logs: [entry, ...state.logs].slice(0, MAX_ENTRIES) };
  emit();
}

/**
 * Imperative writer for non-React modules (e.g. the useApi health probe
 * logging FIX-01 transitions). Identical semantics to the hook's addLog.
 */
export function logEvent(level: LogLevel, message: string): void {
  addLogEntry(level, message);
}

function markAllRead(): void {
  const now = Date.now();
  state = { ...state, lastRead: now };
  writeLastRead(now);
  emit();
}

function getUnreadCount(): number {
  return state.logs.filter(entry => entry.timestamp.getTime() > state.lastRead).length;
}

/**
 * Writer-only hook for components that need to append log entries but must NOT
 * re-render when the log changes (e.g. the root <App>). Uses the same module-
 * level addLogEntry as useEventLog without subscribing to the store.
 */
export function useEventLogActions() {
  const addLog = useCallback((level: LogLevel, message: string) => {
    addLogEntry(level, message);
  }, []);

  const addInfo = useCallback((message: string) => addLog('INFO', message), [addLog]);
  const addWarn = useCallback((message: string) => addLog('WARN', message), [addLog]);
  const addError = useCallback((message: string) => addLog('ERROR', message), [addLog]);
  const addDebug = useCallback((message: string) => addLog('DEBUG', message), [addLog]);

  return { addLog, addInfo, addWarn, addError, addDebug };
}

export function useEventLog(maxEntries = MAX_ENTRIES) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Bound retained for call-site compatibility; the store itself is bounded
  // by MAX_ENTRIES so no caller can trim another caller's view.
  void maxEntries;

  const addLog = useCallback((level: LogLevel, message: string) => {
    addLogEntry(level, message);
  }, []);

  const addInfo = useCallback((message: string) => addLog('INFO', message), [addLog]);
  const addWarn = useCallback((message: string) => addLog('WARN', message), [addLog]);
  const addError = useCallback((message: string) => addLog('ERROR', message), [addLog]);
  const addDebug = useCallback((message: string) => addLog('DEBUG', message), [addLog]);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [snapshot.logs]);

  const renderLog = useCallback((entry: LogEntry) => {
    return {
      ...entry,
      formattedTime: formatTime(entry.timestamp),
      levelColor: LEVEL_COLORS[entry.level],
    };
  }, []);

  const unreadCount = getUnreadCount();

  return {
    logs: snapshot.logs,
    unreadCount,
    addLog,
    addInfo,
    addWarn,
    addError,
    addDebug,
    markAllRead,
    bottomRef,
    renderLog,
  };
}

/* Initialize the two mount-time entries exactly once when this module loads.
 * This avoids any StrictMode double-invocation or multi-consumer race that could
 * duplicate them on a fresh session. */
INITIAL_LOGS.forEach(l => addLogEntry(l.level, l.message));
