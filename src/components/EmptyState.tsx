import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  nextStep?: string;
  minHeight?: number;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  nextStep,
  minHeight = 240,
}) => (
  <div
    style={{
      minHeight,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      textAlign: 'center',
      padding: '24px',
      color: 'var(--text-muted)',
      border: '1px dashed var(--border-default)',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'var(--bg-body)',
    }}
  >
    <Icon size={28} style={{ opacity: 0.35 }} aria-hidden="true" />
    <span
      style={{
        fontWeight: 600,
        color: 'var(--text-secondary)',
        fontSize: 'var(--font-size-base)',
      }}
    >
      {title}
    </span>
    <span style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.5, maxWidth: 320 }}>
      {description}
    </span>
    {nextStep && (
      <span style={{ fontSize: 'var(--font-size-micro)', lineHeight: 1.5, maxWidth: 320 }}>
        {nextStep}
      </span>
    )}
  </div>
);
