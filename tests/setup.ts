import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import { resetSettings } from '../src/hooks/useSettings';

// Make @testing-library/wait-for cooperate with vitest fake timers.
configure({ advanceTimers: (delay) => vi.advanceTimersByTime(delay) });

/**
 * In-memory localStorage polyfill for tests.
 *
 * Node's experimental localStorage requires `--localstorage-file` and shares
 * state across parallel workers when they use the same file. We instead
 * provide a per-worker/process store that is reset before every test, giving
 * each test file deterministic, isolated persistence.
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  getItem(name: string): string | null {
    return this.store.get(String(name)) ?? null;
  }

  setItem(name: string, value: string): void {
    this.store.set(String(name), String(value));
  }

  removeItem(name: string): void {
    this.store.delete(String(name));
  }

  clear(): void {
    this.store.clear();
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as typeof globalThis & { localStorage: Storage }).localStorage = new MemoryStorage();
}

beforeEach(() => {
  localStorage.clear();
  resetSettings();
});
