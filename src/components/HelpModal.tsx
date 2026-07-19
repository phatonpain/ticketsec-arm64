/**
 * fixpack-v2 — applies: FIX-16, FIX-31.
 * Original: src/components/HelpModal.tsx (104 lines).
 * NOTE: original line ~62 was truncated in the source PDF ("…justifyContent:
 * 'space-between', ga…"); reconstructed as gap: 12 (matches the parent stack).
 * Changes vs original: z-index 300 → var(--z-overlay, 1000); kbd font stack
 * literal → var(--font-numeric); radius token; shadow → --shadow-popover.
 */

import React from 'react';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  description: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['Ctrl', 'K'], description: 'Open the command palette' },
  { keys: ['/'], description: 'Focus the ticket query search box' },
  { keys: ['r'], description: 'Refresh API health and data' },
  { keys: ['?'], description: 'Open this keyboard shortcuts help' },
  { keys: ['Esc'], description: 'Close modals, drawers, and dropdowns' },
];

export const HelpModal: React.FC<HelpModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-overlay, 1000)' as unknown as number,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.60)',
        padding: 20,
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--bg-sidebar)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md, 12px)',
          padding: 24,
          boxShadow: 'var(--shadow-popover, 0 16px 48px rgba(0,0,0,0.40))',
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 id="help-title" style={{ fontSize: 'var(--font-size-lg, 16px)', fontWeight: 600, color: 'var(--text-primary)' }}>
            Keyboard Shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm, 12px)',
              padding: 4,
            }}
          >
            Esc
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {SHORTCUTS.map(shortcut => (
            <div key={shortcut.description} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 'var(--font-size-base, 13px)', color: 'var(--text-secondary)' }}>{shortcut.description}</span>
              <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {shortcut.keys.map(key => (
                  <kbd
                    key={key}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 28,
                      height: 24,
                      padding: '0 8px',
                      borderRadius: 4,
                      border: '1px solid var(--border-default)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--font-size-sm, 12px)',
                      fontFamily: 'var(--font-numeric)',
                    }}
                  >
                    {key}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>

        <p style={{ marginTop: 20, fontSize: 'var(--font-size-sm, 12px)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Shortcuts are active while no text input is focused. Press <kbd style={{ fontFamily: 'inherit' }}>Esc</kbd> to close.
        </p>
      </div>
    </div>
  );
};
