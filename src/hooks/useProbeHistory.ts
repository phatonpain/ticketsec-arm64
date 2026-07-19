import { useEffect, useRef, useState } from 'react';
import { useApi } from './useApi';

const MAX_HISTORY = 20;

/**
 * Track the last MAX_HISTORY successful /health probe latencies from useApi
 * diagnostics. Returns an array suitable for a sparkline (ms values).
 */
export function useProbeHistory(): number[] {
  const { diagnostics } = useApi();
  const [history, setHistory] = useState<number[]>([]);
  const lastProbeRef = useRef<number | null>(null);

  useEffect(() => {
    const probe = diagnostics.lastProbe;
    if (!probe) return;
    const ts = probe.getTime();
    if (lastProbeRef.current === ts) return;
    lastProbeRef.current = ts;

    const health = diagnostics.endpoints.find(e => e.url.endsWith('/health') && e.ok);
    if (!health) return;

    setHistory(prev => {
      const next = [...prev, health.latencyMs];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
  }, [diagnostics]);

  return history;
}
