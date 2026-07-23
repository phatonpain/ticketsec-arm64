import React from 'react';
import type { LucideIcon } from 'lucide-react';
import emptyStateArt from '../assets/empty-state.webp';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  nextStep?: string;
  action?: EmptyStateAction;
  minHeight?: number;
  /* FASE 4: decorative square art (opacity 40%, max-height 120px) — opt-in,
   * only for genuine empty states with room; never over data. */
  art?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  nextStep,
  action,
  minHeight = 120,
  art = false,
}) => (
  <div
    style={{
      minHeight,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      textAlign: 'center',
      padding: '16px',
      color: 'var(--text-muted)',
      border: '1px dashed var(--border-default)',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'var(--bg-body)',
    }}
  >
    {art && (
      <img
        src={emptyStateArt}
        alt=""
        aria-hidden="true"
        onError={e => { e.currentTarget.style.display = 'none'; }}
        style={{
          width: 'min(120px, 40%)',
          aspectRatio: '1',
          objectFit: 'cover',
          borderRadius: 'var(--radius-md)',
          opacity: 0.4,
          maxHeight: 120,
          pointerEvents: 'none',
        }}
      />
    )}
    <Icon size={20} style={{ opacity: 0.4 }} aria-hidden="true" />
    <span
      style={{
        fontWeight: 600,
        color: 'var(--text-secondary)',
        fontSize: 'var(--font-size-sm)',
      }}
    >
      {title}
    </span>
    <span style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.4, maxWidth: 360 }}>
      {description}
    </span>
    {nextStep && !action && (
      <span style={{ fontSize: 'var(--font-size-micro)', lineHeight: 1.4, maxWidth: 360 }}>
        {nextStep}
      </span>
    )}
    {action && (
      <button
        type="button"
        onClick={action.onClick}
        style={{
          fontSize: 'var(--font-size-micro)',
          fontWeight: 600,
          color: 'var(--color-link)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        {action.label}
      </button>
    )}
  </div>
);
