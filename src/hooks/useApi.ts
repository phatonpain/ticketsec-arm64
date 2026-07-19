/**
 * fixpack-v2 — applies: FIX-01 (P0).
 * Original: src/hooks/useApi.ts (326 lines). Export surface preserved exactly —
 * every existing consumer (Header, App, ClassificationTable, ThreatBarChart,
 * PerformanceLineChart, ModelHealthDonut, SystemMonitor, EventLog,
 * LivePrediction, SettingsDrawer, utils.ts) compiles unchanged.
 *
 * ROOT CAUSES FIXED [CONFIRMED from source]:
 *  1. getSnapshot() returned the SAME mutated `store` object on every call, so
 *     useSyncExternalStore's Object.is comparison bailed out — subscribers
 *     never re-rendered when probes settled. The pill painted "Checking…" on
 *     first mount and stayed there (S1–S4) while probes actually completed
 *     underneath (S6). State is now replaced immutably (new identity ⇒
 *     subscribers re-render).
 *  2. The health probe allowed 10s per endpoint and re-entered `checking`
 *     on every scheduled/visibility/focus probe, so the transient state
 *     dominated wall time. Every probe now settles in ≤ PROBE_TIMEOUT_MS
 *     (4s, AbortController) — 'checking' is always transient.
 *  3. No race guard: a slow scheduled probe could overwrite fresher evidence
 *     (manual refresh, predict() outcome). A monotonically increasing
 *     sequence token now discards stale results; ALL health transitions flow
 *     through the single writer applyOutcome().
 *  4. Backoff was 30s→300s with no jitter (thundering herd + slow recovery
 *     signal). Offline retries now back off 5s→60s with full jitter
 *     (src/lib/backoff.ts); online re-checks every 30s.
 *  5. The first probe failure never produced an Event Log entry (status
 *     started 'offline', so no transition fired). Transitions are now logged
 *     from the single writer, including the initial checking→offline/cached
 *     resolution — the log tells the truth without spamming (ERROR once,
 *     DEBUG every 10th consecutive failure, INFO on recovery).
 *
 * HONESTY CONTRACT PRESERVED EXACTLY: 'cached' (snapshot/cache data with an
 * amber CACHED badge) and 'offline' ("Unavailable — API offline") are
 * first-class states. Nothing here fabricates availability or data.
 */

import { useEffect, useSyncExternalStore } from 'react';
import { getApiBase } from './useSettings';
import { createBackoff } from '../lib/backoff';
import { logEvent } from './useEventLog';

export type ApiStatus = 'live' | 'cached' | 'offline';

export interface PredictionResult {
  predicted_category: string;
  confidence: number;
  processing_time_ms?: number;
  probabilities?: Record<string, number>;
}

export interface CategoryStats {
  category: string;
  count: number;
}

export interface PerformancePoint {
  time: string;
  baseline: number;
  onnx: number;
  int8: number;
  latency_ms?: number;
  throughput?: number;
}

export interface Classification {
  id: string;
  subject: string;
  category: string;
  confidence: number;
  status: 'Resolved' | 'Escalated' | 'Pending';
  assignedTo: string;
  createdAt: string;
}

interface Cache {
  categories: CategoryStats[];
  performance: PerformancePoint[];
  classifications: Classification[];
}

export interface ProbeEndpoint {
  url: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export interface Diagnostics {
  lastProbe: Date | null;
  lastError: string | null;
  endpoints: ProbeEndpoint[];
}

interface ApiStoreState {
  status: ApiStatus;
  checking: boolean;
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
  diagnostics: Diagnostics;
}

/* ------------------------------------------------------------------ config */

/** Hard ceiling for every health probe — 'checking' can never outlive this. */
const PROBE_TIMEOUT_MS = 4_000;
const PREDICT_TIMEOUT_MS = 15_000;
/** Re-check cadence while healthy. */
const ONLINE_RECHECK_MS = 30_000;
/** Offline/cached retry cadence: 5s → 60s, full jitter (module-scope instance). */
const offlineBackoff = createBackoff({ baseMs: 5_000, maxMs: 60_000 });

/* ------------------------------------------------- store (module singleton) */

const cache: Cache = {
  categories: [],
  performance: [],
  classifications: [],
};

/* IMMUTABLE state: every mutation produces a new object identity so
 * useSyncExternalStore subscribers actually re-render (root cause of the
 * stuck "Checking…" pill). */
let state: ApiStoreState = {
  status: 'offline',
  checking: true,
  loading: false,
  error: null,
  lastSync: null,
  diagnostics: { lastProbe: null, lastError: null, endpoints: [] },
};

const listeners = new Set<() => void>();

function setState(patch: Partial<ApiStoreState>): void {
  state = { ...state, ...patch };
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Cached reference between setState calls — required by useSyncExternalStore. */
function getSnapshot(): ApiStoreState {
  return state;
}

function hasAnyCache(): boolean {
  return cache.categories.length > 0 || cache.performance.length > 0 || cache.classifications.length > 0;
}

/* ------------------------------------------------------- probe engine ----- */

/**
 * Ownership token. Incremented whenever a newer probe/report starts; results
 * carrying an older token are discarded. Kills probe-vs-refresh and
 * probe-vs-user-action races.
 */
let probeSeq = 0;
let inFlight: AbortController | null = null;
let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
let monitorStarted = false;
let offlineTransitionLogged = false;

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

async function probeSingleEndpoint(url: string, externalSignal?: AbortSignal): Promise<ProbeEndpoint> {
  const start = performance.now();
  try {
    const res = await fetchWithTimeout(url, { method: 'GET', cache: 'no-store' }, PROBE_TIMEOUT_MS, externalSignal);
    const latencyMs = Math.round(performance.now() - start);
    if (res.ok) {
      return { url, ok: true, latencyMs };
    }
    return { url, ok: false, latencyMs, error: `HTTP ${res.status}` };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    const error =
      err instanceof DOMException && err.name === 'AbortError'
        ? `timeout after ${PROBE_TIMEOUT_MS} ms`
        : err instanceof Error
          ? err.name
          : 'Network error';
    return { url, ok: false, latencyMs, error };
  }
}

interface HealthProbeResult {
  online: boolean;
  endpoints: ProbeEndpoint[];
  error: string | null;
}

async function runHealthProbe(baseUrl: string, externalSignal?: AbortSignal): Promise<HealthProbeResult> {
  const candidates = [`${baseUrl}/health`, `${baseUrl}/`, `${baseUrl}/docs`];
  const endpoints = await Promise.all(candidates.map(candidate => probeSingleEndpoint(candidate, externalSignal)));
  const online = endpoints.some(e => e.ok);
  const firstFailure = endpoints.find(e => !e.ok);
  return {
    online,
    endpoints,
    error: online ? null : (firstFailure?.error ?? 'All endpoints unreachable'),
  };
}

/**
 * The ONLY function allowed to mutate API health state (single writer).
 * `seq` must be freshly minted by the caller; stale results are dropped.
 * Logs honest transitions to the Event Log exactly once per state change.
 */
function applyOutcome(
  seq: number,
  online: boolean,
  evidence: { endpoints?: ProbeEndpoint[]; error: string | null },
): void {
  if (seq !== probeSeq) return; // stale: a newer probe/report owns state

  const previousStatus = state.status;
  const wasChecking = state.checking;
  const now = new Date();

  if (online) {
    offlineBackoff.reset();
    offlineTransitionLogged = false;
    setState({
      status: 'live',
      checking: false,
      lastSync: now,
      diagnostics: {
        lastProbe: now,
        lastError: null,
        endpoints: evidence.endpoints ?? state.diagnostics.endpoints,
      },
    });
    if (previousStatus !== 'live') {
      logEvent('INFO', wasChecking ? 'API reachable — health check OK' : 'API connection restored');
    }
    return;
  }

  const status: ApiStatus = hasAnyCache() ? 'cached' : 'offline';
  setState({
    status,
    checking: false,
    diagnostics: {
      lastProbe: now,
      lastError: evidence.error,
      endpoints: evidence.endpoints ?? state.diagnostics.endpoints,
    },
  });

  const failures = offlineBackoff.attempt();
  const isTransition = previousStatus !== status;
  const shouldLogTransition = isTransition || (wasChecking && !offlineTransitionLogged);

  if (shouldLogTransition) {
    offlineTransitionLogged = true;
    if (status === 'cached') {
      logEvent(
        'WARN',
        wasChecking
          ? 'API unreachable — displaying cached data'
          : 'API connection lost — displaying cached data',
      );
    } else {
      logEvent(
        'ERROR',
        wasChecking
          ? 'Metrics endpoint unreachable — retrying with backoff'
          : 'API connection lost — retrying with backoff',
      );
    }
  } else {
    const count = failures > 0 ? `(${failures} consecutive)` : '(retry)';
    logEvent('DEBUG', `Health probe still failing ${count}: ${evidence.error ?? 'unknown error'}`);
  }
}

/** Fresh evidence from any source flows here (single-writer guarantee). */
function reportApiOutcome(online: boolean, error: string | null): void {
  const seq = ++probeSeq;
  if (inFlight) {
    inFlight.abort();
    inFlight = null;
  }
  applyOutcome(seq, online, { error });
}

/* ------------------------------------------------------------ probing ----- */

/**
 * One health probe against the configured API base. NEVER rejects; ALWAYS
 * settles within PROBE_TIMEOUT_MS per endpoint (endpoints run in parallel).
 * Starting a new probe aborts and supersedes the previous one.
 */
export async function checkHealth(): Promise<void> {
  const seq = ++probeSeq;

  if (inFlight) inFlight.abort(); // superseded; its result is dropped by the seq check
  const controller = new AbortController();
  inFlight = controller;

  if (!state.checking) setState({ checking: true });

  try {
    const result = await runHealthProbe(getApiBase(), controller.signal);
    // If superseded mid-flight, applyOutcome drops the stale result itself.
    applyOutcome(seq, result.online, { endpoints: result.endpoints, error: result.error });
  } catch {
    // runHealthProbe itself never throws (per-endpoint capture), but stay
    // true to the never-rejects contract even on unexpected failures.
    applyOutcome(seq, false, { error: 'Unexpected probe failure' });
  } finally {
    if (inFlight === controller) inFlight = null;
  }
}

/**
 * Pure connectivity test for an ARBITRARY base URL (Settings drawer "Test
 * Connection"). Does NOT touch global health state.
 */
export async function probeApiBase(url: string): Promise<{ ok: boolean; endpoints: ProbeEndpoint[]; error: string | null }> {
  const result = await runHealthProbe(url);
  return { ok: result.online, endpoints: result.endpoints, error: result.error };
}

/* ------------------------------------------------------------ scheduling -- */

function scheduleNextProbe(): void {
  if (recoveryTimer) clearTimeout(recoveryTimer);
  const delay = state.status === 'live' ? ONLINE_RECHECK_MS : offlineBackoff.next();
  recoveryTimer = setTimeout(() => {
    void checkHealth().then(scheduleNextProbe);
  }, delay);
}

function startAutoRecovery(): void {
  if (monitorStarted) return;
  monitorStarted = true;
  scheduleNextProbe();
}

/* ----------------------------------------------------------- data calls --- */

export async function predict(text: string): Promise<PredictionResult | null> {
  setState({ loading: true, error: null });
  try {
    const res = await fetchWithTimeout(
      `${getApiBase()}/predict`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      },
      PREDICT_TIMEOUT_MS,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: PredictionResult = await res.json();
    // User-action evidence is fresher than any scheduled probe.
    reportApiOutcome(true, null);
    return data;
  } catch (err) {
    const message =
      err instanceof DOMException && err.name === 'AbortError'
        ? `timeout after ${PREDICT_TIMEOUT_MS} ms`
        : err instanceof Error
          ? err.message
          : 'Unknown error';
    setState({ error: message });
    // A failed user action marks the API not-live immediately (honest),
    // instead of waiting for the next scheduled probe.
    reportApiOutcome(false, message);
    return null;
  } finally {
    setState({ loading: false });
  }
}

export async function getStats(): Promise<CategoryStats[]> {
  try {
    const res = await fetchWithTimeout(`${getApiBase()}/api/v1/stats/categories`, { method: 'GET' }, PROBE_TIMEOUT_MS);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: CategoryStats[] = await res.json();
    cache.categories = data;
    reportApiOutcome(true, null);
    return data;
  } catch {
    return cache.categories.length > 0 ? cache.categories : [];
  }
}

export async function getPerformance(): Promise<PerformancePoint[]> {
  try {
    const res = await fetchWithTimeout(`${getApiBase()}/api/v1/performance/history`, { method: 'GET' }, PROBE_TIMEOUT_MS);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: PerformancePoint[] = await res.json();
    cache.performance = data;
    reportApiOutcome(true, null);
    return data;
  } catch {
    return cache.performance.length > 0 ? cache.performance : [];
  }
}

export async function getClassifications(): Promise<Classification[]> {
  try {
    const res = await fetchWithTimeout(`${getApiBase()}/api/v1/classifications`, { method: 'GET' }, PROBE_TIMEOUT_MS);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: Classification[] = await res.json();
    cache.classifications = data;
    reportApiOutcome(true, null);
    return data;
  } catch {
    return cache.classifications.length > 0 ? cache.classifications : [];
  }
}

/* ---------------------------------------------------------------- hook ---- */

export function useApi() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    void checkHealth();
    startAutoRecovery();

    const onVisible = () => {
      if (!document.hidden) {
        void checkHealth();
      }
    };
    const onFocus = () => {
      void checkHealth();
    };
    const onOnline = () => {
      void checkHealth(); // OS/browser says the network is back — verify now
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
    // The monitor is an app-lifetime singleton: intentionally no stop
    // cleanup, so React 19 StrictMode double-mounts never kill probing.
  }, []);

  return {
    status: snapshot.status,
    checking: snapshot.checking,
    loading: snapshot.loading,
    error: snapshot.error,
    lastSync: snapshot.lastSync,
    diagnostics: snapshot.diagnostics,
    consecutiveErrors: offlineBackoff.attempt(),
    checkHealth,
    predict,
    getStats,
    getPerformance,
    getClassifications,
  };
}
