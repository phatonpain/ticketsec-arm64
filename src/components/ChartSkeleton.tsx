/**
 * fixpack-v2 — applies: FIX-19.
 * Original: src/components/ChartSkeleton.tsx (59 lines).
 * Change vs original: raw rgba() placeholder fills → tint tokens
 * (--tint-track / --tint-row). This is a transient Suspense fallback for the
 * lazy chart chunks — loading chrome only, never a fake-data skeleton.
 */

import React from 'react';

interface ChartSkeletonProps {
  height?: number;
}

export const ChartSkeleton: React.FC<ChartSkeletonProps> = ({ height = 320 }) => (
  <div
    style={{
      width: '100%',
      height,
      background: 'var(--bg-card)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-default)',
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      boxSizing: 'border-box',
    }}
    aria-hidden="true"
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div
          className="animate-shimmer"
          style={{
            width: 180,
            height: 14,
            borderRadius: 4,
          }}
        />
        <div
          className="animate-shimmer"
          style={{
            width: 120,
            height: 10,
            borderRadius: 4,
            marginTop: 8,
          }}
        />
      </div>
      <div
        className="animate-shimmer"
        style={{
          width: 56,
          height: 18,
          borderRadius: 4,
        }}
      />
    </div>
    <div
      className="animate-shimmer"
      style={{
        flex: 1,
        borderRadius: 'var(--radius-sm)',
      }}
    />
  </div>
);
