import '@testing-library/jest-dom/vitest';
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useEventLog, useEventLogActions, logEvent } from '../../src/hooks/useEventLog';

describe('useEventLogActions', () => {
  it('provides stable addInfo/addError functions without subscribing to log changes', () => {
    const renderCount = { value: 0 };

    const { result } = renderHook(() => {
      renderCount.value += 1;
      return useEventLogActions();
    });

    const initialAddInfo = result.current.addInfo;

    act(() => {
      result.current.addInfo('writer-only test message');
    });

    // Hook must not re-render when the log store changes.
    expect(renderCount.value).toBe(1);
    // The action reference must stay stable.
    expect(result.current.addInfo).toBe(initialAddInfo);

    // Confirm the event was actually written (subscribers see it).
    const { result: subscriber } = renderHook(() => useEventLog());
    expect(subscriber.current.logs.some(l => l.message === 'writer-only test message')).toBe(true);
  });

  it('produces the same entries as the imperative logEvent helper', () => {
    const { result: actions } = renderHook(() => useEventLogActions());

    act(() => {
      actions.current.addWarn('warn from actions');
      logEvent('ERROR', 'error from helper');
    });

    const { result: subscriber } = renderHook(() => useEventLog());
    const messages = subscriber.current.logs.map(l => l.message);
    expect(messages).toContain('warn from actions');
    expect(messages).toContain('error from helper');
  });
});
