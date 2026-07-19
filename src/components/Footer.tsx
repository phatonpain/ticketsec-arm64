/**
 * fixpack-v2 — applies: FIX-15, FIX-23 (C-54/C-55), FIX-24.
 * Original: src/components/Footer.tsx (26 lines) — DEAD CODE in the shipped
 * app: App.tsx rendered its own inline footer with a same-tab API Docs link.
 * This component is now wired into App.tsx (single footer owner).
 *
 * Changes vs original:
 *  - FIX-24: API Docs keeps target="_blank" rel="noreferrer" AND gains an
 *    offline-aware tooltip (C-55: 'Interactive FastAPI schema — unavailable
 *    while the API is offline') so the link never reads as a dead end.
 *  - FIX-23: codename dropped — 'TicketSec Arm64 · AWS Graviton Deployment ·
 *    ONNX Runtime' (C-54).
 *  - FIX-15: links use --color-link (7.41:1 AA) instead of text-accent-indigo
 *    (4.47:1); Tailwind classes → token inline styles (consistent with the
 *    rest of the app; immune to the Tailwind/@theme reconciliation FIX-32).
 */

import React from 'react';
import { DEFAULT_API_BASE } from '../hooks/useSettings';

const linkStyle: React.CSSProperties = {
  color: 'var(--color-link)',
  fontWeight: 500,
  textDecoration: 'none',
};

export const Footer: React.FC = () => {
  return (
    <footer
      style={{
        height: 48,
        borderTop: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 var(--layout-page-px)',
        fontSize: 'var(--font-size-sm)',
        color: 'var(--text-muted)',
      }}
    >
      <span>TicketSec Arm64 · AWS Graviton Deployment · ONNX Runtime</span>
      <span style={{ margin: '0 8px' }}>·</span>
      <a
        href={`${DEFAULT_API_BASE}/docs`}
        target="_blank"
        rel="noreferrer"
        title="Interactive FastAPI schema — unavailable while the API is offline"
        style={linkStyle}
      >
        API Docs
      </a>
      <span style={{ margin: '0 8px' }}>·</span>
      <a
        href="https://github.com/phatonpain/ticketsec-arm64"
        target="_blank"
        rel="noreferrer"
        style={linkStyle}
      >
        GitHub
      </a>
    </footer>
  );
};
