import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type View =
  | 'dashboard'
  | 'detections'
  | 'predictions'
  | 'threat-analytics'
  | 'model-registry'
  | 'system-health';

const VALID_VIEWS: readonly View[] = [
  'dashboard',
  'detections',
  'predictions',
  'threat-analytics',
  'model-registry',
  'system-health',
];

const DEFAULT_VIEW: View = 'dashboard';

function hashToView(hash: string): View {
  const raw = hash.replace(/^#\/?/, '').trim() || DEFAULT_VIEW;
  const view = raw as View;
  return VALID_VIEWS.includes(view) ? view : DEFAULT_VIEW;
}

function viewToHash(view: View): string {
  return `#/${view}`;
}

interface ViewStoreState {
  activeView: View;
}

let state: ViewStoreState = {
  activeView: hashToView(typeof window !== 'undefined' ? window.location.hash : ''),
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

function getSnapshot(): ViewStoreState {
  return state;
}

function setView(view: View): void {
  if (view === state.activeView) return;
  const hash = viewToHash(view);
  if (typeof window !== 'undefined' && window.location.hash !== hash) {
    window.location.hash = hash;
  }
  state = { activeView: view };
  emit();
}

export function getActiveView(): View {
  return state.activeView;
}

export function useActiveView() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    const normalize = () => {
      const next = hashToView(window.location.hash);
      const normalized = viewToHash(next);
      if (normalized !== window.location.hash) {
        window.history.replaceState(null, '', normalized);
      }
      if (next !== state.activeView) {
        state = { activeView: next };
        emit();
      }
    };
    normalize();
    window.addEventListener('hashchange', normalize);
    window.addEventListener('popstate', normalize);
    return () => {
      window.removeEventListener('hashchange', normalize);
      window.removeEventListener('popstate', normalize);
    };
  }, []);

  const navigate = useCallback((view: View) => setView(view), []);

  return {
    activeView: snapshot.activeView,
    setView: navigate,
  };
}
