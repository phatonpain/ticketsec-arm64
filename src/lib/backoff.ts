/**
 * NEW FILE (fixpack-v2) — applies: FIX-01.
 * Justification for adding: src/hooks/useApi.ts needs jittered exponential
 * backoff (5s → 60s) for offline re-probes; no backoff helper exists in
 * src/lib today. Pure function, zero dependencies.
 *
 * Exponential backoff with full jitter (AWS-style).
 * Contract (also used by tests):
 *   - createBackoff({ baseMs, maxMs, jitter?, random? }) → { next, reset, attempt }
 *   - next(): attempt n (0-based) → min(maxMs, baseMs * 2^n); with jitter
 *     enabled (default) delay = random() * capped ("full jitter").
 *   - random is INJECTABLE (seedable in tests); defaults to Math.random.
 *   - attempt(): number of next() calls since construction/reset.
 *   - reset(): attempt back to 0; next() returns the base delay again.
 *   - Never returns NaN/Infinity, even after 100+ attempts (cap guards overflow).
 */

export interface BackoffOptions {
  /** Delay for the first retry (attempt 0), before jitter. */
  baseMs: number;
  /** Hard cap for any computed delay, before jitter. */
  maxMs: number;
  /** Full jitter on/off. Default true. */
  jitter?: boolean;
  /** RNG returning [0, 1). Injected in tests; default Math.random. */
  random?: () => number;
}

export interface Backoff {
  /** Delay for the current attempt, then advance. Always finite, >= 0, <= maxMs. */
  next(): number;
  /** Back to attempt 0 (call after a success). */
  reset(): void;
  /** Attempts consumed since construction/reset. */
  attempt(): number;
}

/** Exponent ceiling: 2**30 dwarfs any sane maxMs, so the cap always wins. */
const MAX_EXPONENT = 30;

export function createBackoff(options: BackoffOptions): Backoff {
  const jitter = options.jitter ?? true;
  const random = options.random ?? Math.random;
  let attempts = 0;

  function cappedDelay(): number {
    const exponent = Math.min(attempts, MAX_EXPONENT);
    const raw = options.baseMs * Math.pow(2, exponent);
    // Math.min also swallows the Infinity case from huge baseMs values.
    return Math.min(options.maxMs, raw);
  }

  return {
    next(): number {
      const capped = cappedDelay();
      attempts += 1;
      if (!jitter) return capped;
      const delay = random() * capped;
      // Defensive: a hostile random() must never leak NaN/negative/Infinity.
      return Number.isFinite(delay) && delay > 0 ? delay : 0;
    },
    reset(): void {
      attempts = 0;
    },
    attempt(): number {
      return attempts;
    },
  };
}
