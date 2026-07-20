/**
 * M1 — real hash-based navigation.
 * M5 — sidebar collapse to a 56px icon rail (F-03).
 *
 * Nav items now map to real views (#/dashboard, #/detections, #/predictions,
 * #/threat-analytics, #/model-registry, #/system-health). The active item
 * exposes aria-current="page". Settings remains a drawer action (it does not
 * represent a page, so it gets no aria-current).
 *
 * Removed: Cases (folded into Detections), Ticket Query (duplicate of the
 * search bar inside Detections), API Metrics (duplicate of Threat Analytics).
 */

import React from 'react';
import {
  LayoutDashboard,
  ShieldAlert,
  Zap,
  BarChart3,
  Box,
  HeartPulse,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useActiveView, type View } from '../hooks/useActiveView';
import { openSettingsDrawer } from '../hooks/useSettingsDrawer';
import { useSettings } from '../hooks/useSettings';
import { useApi } from '../hooks/useApi';

interface NavItem {
  icon: React.ComponentType<{ size?: number; color?: string; 'aria-hidden'?: boolean }>;
  label: string;
  view?: View;
  action?: () => void;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    label: 'OVERVIEW',
    items: [{ icon: LayoutDashboard, label: 'Dashboard', view: 'dashboard' }],
  },
  {
    label: 'OPERATIONS',
    items: [
      { icon: ShieldAlert, label: 'Detections', view: 'detections' },
      { icon: Zap, label: 'Live Predictions', view: 'predictions' },
    ],
  },
  {
    label: 'INTELLIGENCE',
    items: [
      { icon: BarChart3, label: 'Threat Analytics', view: 'threat-analytics' },
      { icon: Box, label: 'Model Registry', view: 'model-registry' },
      { icon: HeartPulse, label: 'System Health', view: 'system-health' },
    ],
  },
  {
    label: 'SYSTEM',
    items: [{ icon: Settings, label: 'Settings', action: openSettingsDrawer }],
  },
];

export const Sidebar: React.FC = () => {
  const { activeView, setView } = useActiveView();
  const { settings, updateSidebarCollapsed } = useSettings();
  const { status } = useApi();
  const collapsed = settings.sidebarCollapsed;

  return (
    <aside
      style={{
        width: 'var(--layout-sidebar-w)',
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 'var(--z-header)' as unknown as number,
        transition: 'width 200ms ease',
        overflow: 'hidden',
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding: collapsed ? '20px 12px 16px' : '20px 24px 16px 20px',
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
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--font-size-base)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            flexShrink: 0,
          }}
        >
          T
        </div>
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--text-primary)' }}>TicketSec</div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 2 }}>Security Operations</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: collapsed ? '12px 8px 0' : '12px 12px 0',
        }}
        aria-label="Main navigation"
      >
        {SECTIONS.map(section => (
          <div key={section.label} style={{ marginBottom: 16 }}>
            {!collapsed && (
              <div
                style={{
                  fontSize: 'var(--font-size-micro)',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--tracking-caps)',
                  padding: '12px 12px 8px',
                }}
              >
                {section.label}
              </div>
            )}
            {section.items.map(item => {
              const Icon = item.icon;
              const isActive = item.view === activeView;
              const isPredictions = item.view === 'predictions';
              const isHealth = item.view === 'system-health';
              const healthColor =
                status === 'live' ? 'var(--accent-emerald)' : status === 'cached' ? 'var(--accent-amber)' : 'var(--accent-rose)';
              const iconColor = isActive ? 'var(--accent-indigo)' : isHealth ? healthColor : 'var(--text-muted)';
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => (item.action ? item.action() : setView(item.view!))}
                  aria-current={isActive ? 'page' : undefined}
                  title={item.label}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: 12,
                    padding: collapsed ? '10px 0' : '9px 14px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-base)',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    backgroundColor: isActive ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                    borderLeft: isActive ? '2px solid var(--accent-indigo)' : '2px solid transparent',
                    borderTop: 'none',
                    borderRight: 'none',
                    borderBottom: 'none',
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                    marginBottom: 2,
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-control-ghost-bg)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                    <Icon size={18} color={iconColor} aria-hidden />
                    {isPredictions && isActive && (
                      <span
                        style={{
                          position: 'absolute',
                          top: -1,
                          right: -1,
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: 'var(--accent-emerald)',
                          animation: 'pulse 1.2s ease-in-out infinite',
                        }}
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  {!collapsed && item.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div style={{ padding: 12, flexShrink: 0, borderTop: '1px solid var(--border-default)' }}>
        <button
          type="button"
          onClick={() => updateSidebarCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 8,
            padding: collapsed ? '8px 0' : '8px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && 'Collapse sidebar'}
        </button>
      </div>

      {/* User Card */}
      {!collapsed && (
        <div style={{ padding: 12, flexShrink: 0, borderTop: '1px solid var(--border-default)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: 8,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'var(--bg-input)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                fontSize: 'var(--font-size-micro)',
                fontWeight: 600,
              }}
            >
              SO
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 'var(--font-size-micro)', fontWeight: 600, color: 'var(--text-primary)' }}>SecOps Analyst</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
