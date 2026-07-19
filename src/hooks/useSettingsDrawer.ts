import { useSyncExternalStore } from 'react';

interface SettingsDrawerStore {
  open: boolean;
  listeners: Set<() => void>;
}

const store: SettingsDrawerStore = {
  open: false,
  listeners: new Set(),
};

function emit() {
  store.listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

function getSnapshot(): boolean {
  return store.open;
}

export function openSettingsDrawer(): void {
  if (store.open) return;
  store.open = true;
  emit();
}

export function closeSettingsDrawer(): void {
  if (!store.open) return;
  store.open = false;
  emit();
}

export function useSettingsDrawer(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
