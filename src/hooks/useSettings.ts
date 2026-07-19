import { useCallback, useEffect, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'ticketsec-settings-v1';
export const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://3.23.60.61:8000';

export type Density = 'comfortable' | 'compact';

export interface Settings {
  apiBase: string;
  reducedMotion: boolean;
  density: Density;
  sidebarCollapsed: boolean;
}

interface SettingsStore {
  settings: Settings;
  listeners: Set<() => void>;
}

const store: SettingsStore = {
  settings: loadSettings(),
  listeners: new Set(),
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return {
        apiBase: normalizeApiBase(parsed.apiBase) ?? DEFAULT_API_BASE,
        reducedMotion: Boolean(parsed.reducedMotion),
        density: isDensity(parsed.density) ? parsed.density : 'comfortable',
        sidebarCollapsed: Boolean(parsed.sidebarCollapsed),
      };
    }
  } catch {
    // Ignore corrupted storage and fall back to defaults.
  }
  return {
    apiBase: DEFAULT_API_BASE,
    reducedMotion: false,
    density: 'comfortable',
    sidebarCollapsed: false,
  };
}

function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage may be unavailable in private mode or restricted contexts.
  }
}

function normalizeApiBase(url: string | undefined): string | undefined {
  if (!url) return undefined;
  let trimmed = url.trim();
  if (!trimmed) return undefined;
  trimmed = trimmed.replace(/\/+$/, '');
  // Allow users to type host:port; default to http:// for convenience.
  if (/^\d+\.\d+\.\d+\.\d+(:\d+)?$/.test(trimmed) || /^[\w.-]+(:\d+)?$/.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return trimmed;
}

function isDensity(value: string | undefined): value is Density {
  return value === 'comfortable' || value === 'compact';
}

function emit() {
  store.listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

function getSnapshot(): Settings {
  return store.settings;
}

function applyReducedMotion(reduced: boolean): void {
  if (reduced) {
    document.documentElement.setAttribute('data-reduced-motion', 'true');
  } else {
    document.documentElement.removeAttribute('data-reduced-motion');
  }
}

function applyDensity(density: Density): void {
  if (density === 'compact') {
    document.documentElement.setAttribute('data-density', 'compact');
  } else {
    document.documentElement.removeAttribute('data-density');
  }
}

function applySidebarCollapsed(collapsed: boolean): void {
  document.documentElement.style.setProperty('--layout-sidebar-w', collapsed ? '56px' : '240px');
  if (collapsed) {
    document.documentElement.setAttribute('data-sidebar-collapsed', 'true');
  } else {
    document.documentElement.removeAttribute('data-sidebar-collapsed');
  }
}

export function getApiBase(): string {
  return store.settings.apiBase;
}

export function setApiBase(url: string): void {
  const normalized = normalizeApiBase(url) ?? DEFAULT_API_BASE;
  if (normalized === store.settings.apiBase) return;
  store.settings = { ...store.settings, apiBase: normalized };
  saveSettings(store.settings);
  emit();
}

export function setReducedMotion(reduced: boolean): void {
  if (reduced === store.settings.reducedMotion) return;
  store.settings = { ...store.settings, reducedMotion: reduced };
  saveSettings(store.settings);
  applyReducedMotion(reduced);
  emit();
}

export function setDensity(density: Density): void {
  if (density === store.settings.density) return;
  store.settings = { ...store.settings, density };
  saveSettings(store.settings);
  applyDensity(density);
  emit();
}

export function setSidebarCollapsed(collapsed: boolean): void {
  if (collapsed === store.settings.sidebarCollapsed) return;
  store.settings = { ...store.settings, sidebarCollapsed: collapsed };
  saveSettings(store.settings);
  applySidebarCollapsed(collapsed);
  emit();
}

export function resetSettings(): void {
  store.settings = {
    apiBase: DEFAULT_API_BASE,
    reducedMotion: false,
    density: 'comfortable',
    sidebarCollapsed: false,
  };
  saveSettings(store.settings);
  applyReducedMotion(false);
  applyDensity('comfortable');
  applySidebarCollapsed(false);
  emit();
}

export function useSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    applyReducedMotion(settings.reducedMotion);
    applyDensity(settings.density);
    applySidebarCollapsed(settings.sidebarCollapsed);
  }, [settings.reducedMotion, settings.density, settings.sidebarCollapsed]);

  const updateApiBase = useCallback((url: string) => setApiBase(url), []);
  const updateReducedMotion = useCallback((reduced: boolean) => setReducedMotion(reduced), []);
  const updateDensity = useCallback((density: Density) => setDensity(density), []);
  const updateSidebarCollapsed = useCallback((collapsed: boolean) => setSidebarCollapsed(collapsed), []);
  const restoreDefaults = useCallback(() => resetSettings(), []);

  return {
    settings,
    updateApiBase,
    updateReducedMotion,
    updateDensity,
    updateSidebarCollapsed,
    restoreDefaults,
  };
}

// Apply persisted preferences as early as possible to avoid a flash of motion / density / layout.
applyReducedMotion(store.settings.reducedMotion);
applyDensity(store.settings.density);
applySidebarCollapsed(store.settings.sidebarCollapsed);
