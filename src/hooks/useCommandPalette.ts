import { useCallback, useSyncExternalStore } from 'react';

interface PaletteStore {
  open: boolean;
  listeners: Set<() => void>;
}

const store: PaletteStore = {
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

export function openCommandPalette(): void {
  if (store.open) return;
  store.open = true;
  emit();
}

export function closeCommandPalette(): void {
  if (!store.open) return;
  store.open = false;
  emit();
}

export function toggleCommandPalette(): void {
  store.open = !store.open;
  emit();
}

export function useCommandPalette() {
  const open = useSyncExternalStore(subscribe, getSnapshot);
  return {
    open,
    openCommandPalette: useCallback(() => openCommandPalette(), []),
    closeCommandPalette: useCallback(() => closeCommandPalette(), []),
    toggleCommandPalette: useCallback(() => toggleCommandPalette(), []),
  };
}
