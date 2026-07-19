/**
 * NEW FILE (fixpack-v2) — applies: FIX-26.
 * Justification for adding: the time-range selection must be shared between
 * the Header (listbox) and ClassificationTable (row filter). The project
 * pattern is one singleton store per concern (useTicketQuery, useSettings,
 * useSettingsDrawer); time range had no home — Header kept it in local state
 * and the control filtered nothing. Follows the same immutable-snapshot
 * pattern as the fixed stores. Zero dependencies.
 */

import { useCallback, useSyncExternalStore } from 'react';
import { DEFAULT_TIME_RANGE, TIME_RANGES, type TimeRange } from '../lib/timeRange';

interface TimeRangeState {
  range: TimeRange;
}

let state: TimeRangeState = {
  range: DEFAULT_TIME_RANGE,
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

function getSnapshot(): TimeRangeState {
  return state;
}

export function setTimeRange(range: TimeRange): void {
  if (!TIME_RANGES.includes(range) || range === state.range) return;
  state = { ...state, range };
  emit();
}

export function useTimeRange() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  const setRange = useCallback((range: TimeRange) => setTimeRange(range), []);

  return {
    range: snapshot.range,
    setRange,
  };
}
