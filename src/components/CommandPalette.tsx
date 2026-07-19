/**
 * F-01 — Command palette (Ctrl+K / Cmd+K).
 *
 * Enterprise-style centered modal with fuzzy search, keyboard navigation,
 * grouped actions (Navigation, Actions, Filters), and focus trapping.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard,
  ShieldAlert,
  Zap,
  BarChart3,
  Box,
  HeartPulse,
  RefreshCw,
  Plug,
  Download,
  Settings,
  HelpCircle,
  Search,
  Terminal,
  type LucideIcon,
} from 'lucide-react';
import { useActiveView, type View } from '../hooks/useActiveView';
import { useApi } from '../hooks/useApi';
import { useTickets } from '../hooks/useTickets';
import { openSettingsDrawer } from '../hooks/useSettingsDrawer';
import { closeCommandPalette } from '../hooks/useCommandPalette';
import { focusTicketQuery, setTicketQuery } from '../hooks/useTicketQuery';
import { exportTicketsToCsv } from '../lib/exportCsv';
import type { Ticket } from '../hooks/useTickets';

interface PaletteAction {
  id: string;
  label: string;
  group: 'Navigation' | 'Actions' | 'Filters';
  icon: LucideIcon;
  keywords: string;
  run: () => void;
}

const VIEWS: { view: View; label: string; icon: LucideIcon }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'detections', label: 'Detections', icon: ShieldAlert },
  { view: 'predictions', label: 'Live Predictions', icon: Zap },
  { view: 'threat-analytics', label: 'Threat Analytics', icon: BarChart3 },
  { view: 'model-registry', label: 'Model Registry', icon: Box },
  { view: 'system-health', label: 'System Health', icon: HeartPulse },
];

function buildActions(
  setView: (view: View) => void,
  checkHealth: () => void,
  tickets: Ticket[],
  onOpenHelp: () => void,
): PaletteAction[] {
  const nav: PaletteAction[] = VIEWS.map(v => ({
    id: `nav-${v.view}`,
    label: v.label,
    group: 'Navigation',
    icon: v.icon,
    keywords: `${v.label} go open view`,
    run: () => setView(v.view),
  }));

  const filters: PaletteAction[] = [
    {
      id: 'filter-search',
      label: 'Jump to ticket query',
      group: 'Filters',
      icon: Search,
      keywords: 'filter search query tickets find',
      run: () => {
        setView('detections');
        focusTicketQuery();
      },
    },
    {
      id: 'filter-phishing',
      label: 'Filter tickets: Phishing',
      group: 'Filters',
      icon: ShieldAlert,
      keywords: 'phishing filter category critical',
      run: () => {
        setView('detections');
        setTicketQuery('Phishing');
        focusTicketQuery();
      },
    },
    {
      id: 'filter-malware',
      label: 'Filter tickets: Malware',
      group: 'Filters',
      icon: ShieldAlert,
      keywords: 'malware filter category critical',
      run: () => {
        setView('detections');
        setTicketQuery('Malware');
        focusTicketQuery();
      },
    },
    {
      id: 'filter-false-positive',
      label: 'Filter tickets: False Positive',
      group: 'Filters',
      icon: ShieldAlert,
      keywords: 'false positive filter category info',
      run: () => {
        setView('detections');
        setTicketQuery('False Positive');
        focusTicketQuery();
      },
    },
  ];

  const actions: PaletteAction[] = [
    {
      id: 'action-refresh',
      label: 'Refresh data',
      group: 'Actions',
      icon: RefreshCw,
      keywords: 'refresh health probe api sync reload',
      run: checkHealth,
    },
    {
      id: 'action-test',
      label: 'Test connection',
      group: 'Actions',
      icon: Plug,
      keywords: 'test connection probe api endpoint ping',
      run: checkHealth,
    },
    {
      id: 'action-export',
      label: 'Export CSV',
      group: 'Actions',
      icon: Download,
      keywords: 'export csv download tickets classifications',
      run: () => exportTicketsToCsv(tickets),
    },
    {
      id: 'action-settings',
      label: 'Open Settings',
      group: 'Actions',
      icon: Settings,
      keywords: 'settings api url endpoint reduced motion density',
      run: openSettingsDrawer,
    },
    {
      id: 'action-help',
      label: 'Open shortcuts help',
      group: 'Actions',
      icon: HelpCircle,
      keywords: 'help shortcuts keyboard ?',
      run: onOpenHelp,
    },
  ];

  return [...nav, ...actions, ...filters];
}

function score(query: string, action: PaletteAction): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const hay = `${action.label} ${action.keywords}`.toLowerCase();
  if (hay === q) return 100;
  if (action.label.toLowerCase().startsWith(q)) return 80;
  if (hay.startsWith(q)) return 60;
  if (hay.includes(` ${q}`)) return 50;
  if (hay.includes(q)) return 30;
  return 0;
}

export interface CommandPaletteProps {
  onOpenHelp: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ onOpenHelp }) => {
  const { setView } = useActiveView();
  const { checkHealth } = useApi();
  const { tickets } = useTickets();

  const actions = useMemo(
    () => buildActions(setView, checkHealth, tickets, onOpenHelp),
    [setView, checkHealth, tickets, onOpenHelp],
  );

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return actions;
    const scored = actions
      .map(a => ({ action: a, s: score(q, a) }))
      .filter(item => item.s > 0)
      .sort((a, b) => b.s - a.s || a.action.label.localeCompare(b.action.label));
    return scored.map(item => item.action);
  }, [actions, query]);

  useEffect(() => {
    inputRef.current?.focus();
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered]);

  useEffect(() => {
    const el = document.getElementById(`palette-item-${selectedId}`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  const execute = (action: PaletteAction) => {
    action.run();
    closeCommandPalette();
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeCommandPalette();
      setQuery('');
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const ids = filtered.map(a => a.id);
      if (ids.length === 0) return;
      const idx = selectedId ? ids.indexOf(selectedId) : -1;
      const nextIdx = e.key === 'ArrowDown'
        ? (idx + 1) % ids.length
        : (idx - 1 + ids.length) % ids.length;
      setSelectedId(ids[nextIdx]);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filtered.find(a => a.id === selectedId);
      if (selected) execute(selected);
      return;
    }

    // Simple focus trap for Tab inside the palette.
    if (e.key === 'Tab') {
      const focusable = paletteRef.current?.querySelectorAll<HTMLElement>(
        'input, button, [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const grouped = useMemo(() => {
    const groups: Record<string, PaletteAction[]> = {};
    for (const action of filtered) {
      groups[action.group] = groups[action.group] ?? [];
      groups[action.group].push(action);
    }
    return groups;
  }, [filtered]);

  const groupOrder = ['Navigation', 'Actions', 'Filters'];

  return (
    <div
      ref={paletteRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-overlay, 1000)' as unknown as number,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        background: 'var(--color-overlay-backdrop)',
        paddingTop: '12vh',
      }}
      onClick={() => {
        closeCommandPalette();
        setQuery('');
      }}
      role="presentation"
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '70vh',
          background: 'var(--bg-sidebar)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg, 10px)',
          boxShadow: 'var(--shadow-popover, 0 16px 48px rgba(0,0,0,0.40))',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-default)',
          }}
        >
          <Terminal size={18} color="var(--text-muted)" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands…"
            aria-label="Command palette search"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: 'var(--font-size-base, 13px)',
              outline: 'none',
            }}
          />
          <kbd
            style={{
              padding: '2px 6px',
              borderRadius: 4,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-card)',
              color: 'var(--text-muted)',
              fontSize: 'var(--font-size-micro, 11px)',
              fontFamily: 'var(--font-numeric)',
            }}
          >
            Esc
          </kbd>
        </div>

        <div
          ref={listRef}
          style={{ overflowY: 'auto', padding: '8px 0', flex: 1 }}
          role="listbox"
          aria-label="Command results"
        >
          {filtered.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 'var(--font-size-sm, 12px)',
              }}
            >
              No commands match “{query}”
            </div>
          ) : (
            groupOrder.map(group => {
              const items = grouped[group];
              if (!items || items.length === 0) return null;
              return (
                <div key={group} role="group" aria-label={group}>
                  <div
                    style={{
                      padding: '6px 16px',
                      fontSize: 'var(--font-size-micro, 11px)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: 'var(--tracking-caps, 0.6px)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {group}
                  </div>
                  {items.map(action => {
                    const Icon = action.icon;
                    const selected = selectedId === action.id;
                    return (
                      <button
                        key={action.id}
                        id={`palette-item-${action.id}`}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => execute(action)}
                        onMouseEnter={() => setSelectedId(action.id)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 16px',
                          background: selected ? 'var(--color-accent-indigo-bg)' : 'transparent',
                          border: 'none',
                          color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: 'var(--font-size-base, 13px)',
                          fontFamily: 'inherit',
                        }}
                      >
                        <Icon size={16} aria-hidden />
                        <span style={{ flex: 1 }}>{action.label}</span>
                        {selected && (
                          <kbd
                            style={{
                              padding: '2px 6px',
                              borderRadius: 4,
                              border: '1px solid var(--border-default)',
                              background: 'var(--bg-card)',
                              color: 'var(--text-muted)',
                              fontSize: 'var(--font-size-micro, 11px)',
                              fontFamily: 'var(--font-numeric)',
                            }}
                          >
                            ↵
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 12,
            padding: '8px 16px',
            borderTop: '1px solid var(--border-default)',
            fontSize: 'var(--font-size-micro, 11px)',
            color: 'var(--text-muted)',
          }}
        >
          <span>↑↓ to navigate</span>
          <span>↵ to run</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
};
