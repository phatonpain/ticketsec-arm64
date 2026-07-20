import React from 'react';
import type { LucideIcon } from 'lucide-react';

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
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  nextStep,
  action,
  minHeight = 120,
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
