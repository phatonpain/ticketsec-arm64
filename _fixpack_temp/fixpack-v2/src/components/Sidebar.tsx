/**
 * fixpack-v2 — applies: FIX-19, FIX-20, FIX-23 (C-01/C-02), FIX-29, FIX-31.
 * Original: src/components/Sidebar.tsx (270 lines).
 * NOTE: original line 2 was truncated in the source PDF ("…from 'lucid...");
 * reconstructed as 'lucide-react' — every imported icon is used in the file,
 * so the list is fully determined by the call sites.
 *
 * Key changes vs original:
 *  - FIX-29: width 260px → var(--layout-sidebar-w, 240px) (App's content
 *    margin uses the same token); group labels 10px → 11px floor
 *    (--font-size-micro, --tracking-caps); user card radius 10 → --radius-md.
 *  - FIX-23: brand subtitle 'Arm64 Guardian' → 'Security Operations' (C-01);
 *    search placeholder ASCII dots → ellipsis 'Search tickets…' (C-02).
 *  - FIX-20: inline outline:none removed from the search input (global
 *    :focus-visible token style takes over).
 *  - FIX-19: active/hover rgba literals → --color-accent-indigo-bg /
 *    --color-control-ghost-bg tokens.
 *  - FIX-31: z-index 100 → var(--z-header, 100).
 */

import React from 'react';
import { LayoutDashboard, FolderOpen, ShieldAlert, BarChart3, Search, Zap, Box, HeartPulse, Activity, Settings, X } from 'lucide-react';
import { useTicketQuery, focusTicketQuery } from '../hooks/useTicketQuery';
import { openSettingsDrawer } from '../hooks/useSettingsDrawer';

interface NavItem {
  icon: React.ComponentType<{ size?: number; color?: string; 'aria-hidden'?: boolean }>;
  label: string;
  active?: boolean;
  action: () => void;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

export const Sidebar: React.FC = () => {
  const { query, setQuery, clear } = useTicketQuery();

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const sections: NavSection[] = [
    {
      label: 'OVERVIEW',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', active: true, action: scrollToTop },
        { icon: FolderOpen, label: 'Cases', action: () => scrollTo('classifications-table') },
        { icon: ShieldAlert, label: 'Detections', action: () => scrollTo('threat-chart') },
        { icon: BarChart3, label: 'Threat Analytics', action: () => scrollTo('performance-chart') },
      ],
    },
    {
      label: 'OPERATIONS',
      items: [
        {
          icon: Search,
          label: 'Ticket Query',
          action: focusTicketQuery,
        },
        { icon: Zap, label: 'Live Predictions', action: () => scrollTo('live-prediction') },
        { icon: Box, label: 'Model Registry', action: () => scrollTo('model-health') },
      ],
    },
    {
      label: 'SYSTEM',
      items: [
        { icon: HeartPulse, label: 'System Health', action: () => scrollTo('system-monitor') },
        { icon: Activity, label: 'API Metrics', action: () => scrollTo('performance-chart') },
        { icon: Settings, label: 'Settings', action: openSettingsDrawer },
      ],
    },
  ];

  return (
    <aside
      style={{
        width: 'var(--layout-sidebar-w, 240px)',
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 'var(--z-header, 100)' as unknown as number,
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding: '20px 24px 16px 20px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-md, 8px)',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--font-size-base, 13px)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            flexShrink: 0,
          }}
        >
          T
        </div>
        <div>
          <div style={{ fontSize: 'var(--font-size-md, 15px)', fontWeight: 600, color: 'var(--text-primary)' }}>TicketSec</div>
          <div style={{ fontSize: 'var(--font-size-sm, 12px)', color: 'var(--text-muted)', marginTop: 2 }}>Security Operations</div>
        </div>
      </div>

      {/* Navigation — scrollable */}
      <nav
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '12px 12px 0',
        }}
      >
        {sections.map(section => (
          <div key={section.label} style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 'var(--font-size-micro, 11px)',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--tracking-caps, 0.6px)',
                padding: '12px 12px 8px',
              }}
            >
              {section.label}
            </div>
            {section.items.map(item => {
              const Icon = item.icon;
              return (
                <React.Fragment key={item.label}>
                  <button
                    type="button"
                    onClick={item.action}
                    aria-current={item.active ? 'page' : undefined}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '9px 14px',
                      borderRadius: 'var(--radius-md, 8px)',
                      fontSize: 'var(--font-size-base, 13px)',
                      fontWeight: item.active ? 600 : 500,
                      color: item.active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      background: item.active ? 'var(--color-accent-indigo-bg)' : 'transparent',
                      borderLeft: item.active ? '3px solid var(--accent-indigo)' : '3px solid transparent',
                      borderTop: 'none',
                      borderRight: 'none',
                      borderBottom: 'none',
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                      marginBottom: 2,
                      textAlign: 'left',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => {
                      if (!item.active) (e.currentTarget as HTMLElement).style.background = 'var(--color-control-ghost-bg)';
                    }}
                    onMouseLeave={(e) => {
                      if (!item.active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                      <Icon size={18} color={item.active ? 'var(--accent-indigo)' : 'var(--text-muted)'} aria-hidden />
                    </span>
                    {item.label}
                  </button>
                  {item.label === 'Ticket Query' && (
                    <div style={{ padding: '0 14px 8px 44px' }}>
                      <input
                        id="ticket-query-input"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search tickets…"
                        aria-label="Search tickets"
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm, 6px)',
                          border: '1px solid var(--border-default)',
                          background: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          fontSize: 'var(--font-size-sm, 12px)',
                          boxSizing: 'border-box',
                        }}
                      />
                      {query && (
                        <button
                          type="button"
                          onClick={clear}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 6,
                            padding: 0,
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            fontSize: 'var(--font-size-micro, 11px)',
                            cursor: 'pointer',
                          }}
                        >
                          <X size={12} />
                          Clear filter
                        </button>
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Card — pinned at bottom */}
      <div style={{ padding: 12, flexShrink: 0, borderTop: '1px solid var(--border-default)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 12,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md, 8px)',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'var(--font-size-sm, 12px)',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            FI
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-base, 13px)', fontWeight: 500, color: 'var(--text-primary)' }}>Felipe Inacio</div>
            <div style={{ fontSize: 'var(--font-size-sm, 12px)', color: 'var(--text-muted)' }}>Security Analyst</div>
          </div>
        </div>
      </div>
    </aside>
  );
};
