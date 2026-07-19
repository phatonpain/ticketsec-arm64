/**
 * fixpack-v2 — applies: FIX-09, FIX-11, FIX-15, FIX-16, FIX-19, FIX-30.
 * Original: src/components/KpiCard.tsx (271 lines).
 * NOTE: original lines 174 and 262 were truncated in the source PDF ("…");
 * both sat in regions rewritten here (card hover handlers, tooltip title).
 *
 * Key changes vs original:
 *  - FIX-09: tooltip trigger is now a small focusable info button (was: the
 *    whole card, unreachable by keyboard). Closes on mouse-leave, blur,
 *    Escape and outside pointerdown. Placed BELOW the trigger inside the
 *    card (was: bottom:calc(100%+8px) — rendered over the sticky header and
 *    page title, S1). aria-describedby is only applied while the tooltip is
 *    mounted (was: permanently dangling).
 *  - FIX-11: stat-block rhythm — 11px caps label (--font-size-micro +
 *    --tracking-caps), 28px value (--font-size-kpi) in the display-metric
 *    font (--font-metric, Inter + tabular-nums — FIX-30; mono stays for
 *    IDs/timestamps), 11px sub-label.
 *  - FIX-15/16/19: all four badge variants now share ONE geometry
 *    (--badge-*) and token color triples (--badge-cached-*, --badge-neutral-*,
 *    --color-status-*); no raw rgba; type floor 11px (was 10px).
 *  - sparklineColor default: raw '#06B6D4' → chartColors.int8 (chartTokens
 *    is the sanctioned hex mirror for SVG/canvas).
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Sparkline } from './Sparkline';
import { chartColors } from '../lib/chartTokens';

interface ChangeBadge {
  type: 'change';
  value: string;
  changeType: 'positive' | 'negative' | 'neutral';
}

interface CachedBadge {
  type: 'cached';
}

interface ModelCardBadge {
  type: 'model-card';
}

interface PendingBadge {
  type: 'pending';
}

type BadgeType = ChangeBadge | CachedBadge | ModelCardBadge | PendingBadge;

interface KpiCardProps {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  detail: string;
  badge?: BadgeType;
  tooltip?: { title?: string; trend?: string; threshold?: string; note?: string };
  sparklineData?: number[];
  sparklineColor?: string;
  muted?: boolean;
}

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

const badgeGeometry: React.CSSProperties = {
  fontSize: 'var(--badge-font-size)',
  fontWeight: 'var(--badge-font-weight)',
  letterSpacing: 'var(--badge-letter-spacing)',
  lineHeight: 'var(--badge-line-height)',
  textTransform: 'uppercase',
  padding: 'var(--badge-pad-y) var(--badge-pad-x)',
  borderRadius: 'var(--radius-badge)',
  whiteSpace: 'nowrap',
};

export const KpiCard: React.FC<KpiCardProps> = ({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  detail,
  badge,
  tooltip,
  sparklineData,
  sparklineColor = chartColors.int8,
  muted = false,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipId = useId();
  const triggerRef = useRef<HTMLDivElement>(null);
  const hasTooltip = Boolean(tooltip);

  /* FIX-09: Escape + outside pointerdown dismissal (mouse-leave and blur are
   * handled inline). The tooltip can never linger over the header again. */
  useEffect(() => {
    if (!showTooltip) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowTooltip(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (triggerRef.current && e.target instanceof Node && !triggerRef.current.contains(e.target)) {
        setShowTooltip(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [showTooltip]);

  const badgeEl = (() => {
    if (!badge) return null;
    if (badge.type === 'cached') {
      return (
        <span
          style={{
            ...badgeGeometry,
            color: 'var(--badge-cached-fg)',
            background: 'var(--badge-cached-bg)',
            border: '1px solid var(--badge-cached-border)',
          }}
        >
          Cached
        </span>
      );
    }
    if (badge.type === 'model-card') {
      return (
        <span
          style={{
            ...badgeGeometry,
            color: 'var(--badge-neutral-fg)',
            background: 'var(--badge-neutral-bg)',
            border: '1px solid var(--badge-neutral-border)',
          }}
        >
          Model Card
        </span>
      );
    }
    if (badge.type === 'pending') {
      return (
        <span
          style={{
            ...badgeGeometry,
            color: 'var(--badge-neutral-fg)',
            background: 'var(--badge-neutral-bg)',
            border: '1px solid var(--badge-neutral-border)',
          }}
        >
          Pending Validation
        </span>
      );
    }
    const tones =
      badge.changeType === 'positive'
        ? { color: 'var(--color-status-ok-text)', bg: 'var(--color-status-ok-bg)' }
        : badge.changeType === 'negative'
          ? { color: 'var(--color-status-err-text)', bg: 'var(--color-status-err-bg)' }
          : { color: 'var(--color-status-neutral-text)', bg: 'var(--color-status-neutral-bg)' };
    return (
      <span
        style={{
          ...badgeGeometry,
          textTransform: 'none',
          color: tones.color,
          background: tones.bg,
          border: '1px solid transparent',
          fontFamily: 'var(--font-numeric)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {badge.value}
      </span>
    );
  })();

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--density-card-pad)',
        height: 'var(--density-kpi-h)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        transition: 'border-color 150ms ease',
        boxSizing: 'border-box',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: 'var(--font-size-micro)',
            fontWeight: 600,
            letterSpacing: 'var(--tracking-caps)',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {hasTooltip && (
            <div
              ref={triggerRef}
              style={{ position: 'relative' }}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <button
                type="button"
                aria-label={`About ${label.toLowerCase()}`}
                aria-describedby={showTooltip ? `${tooltipId}-${slug(label)}` : undefined}
                onFocus={() => setShowTooltip(true)}
                onBlur={() => setShowTooltip(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 18,
                  height: 18,
                  padding: 0,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'help',
                }}
              >
                <Info size={13} />
              </button>
              {showTooltip && (
                <div
                  id={`${tooltipId}-${slug(label)}`}
                  role="tooltip"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: 240,
                    zIndex: 'var(--z-tooltip)' as unknown as number,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    padding: 10,
                    boxShadow: 'var(--shadow-popover)',
                    fontSize: 'var(--font-size-micro)',
                    lineHeight: 1.45,
                    color: 'var(--text-secondary)',
                    pointerEvents: 'none',
                    textTransform: 'none',
                    letterSpacing: 'normal',
                  }}
                >
                  {tooltip?.title && <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{tooltip.title}</div>}
                  {tooltip?.note && <div style={{ marginBottom: 2 }}>{tooltip.note}</div>}
                  {tooltip?.trend && <div style={{ marginBottom: 2 }}>{tooltip.trend}</div>}
                  {tooltip?.threshold && <div>{tooltip.threshold}</div>}
                </div>
              )}
            </div>
          )}
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: iconBg,
              color: iconColor,
              flexShrink: 0,
            }}
          >
            <Icon size={14} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
        <span
          style={{
            fontSize: 'clamp(var(--font-size-xl), 2.5vw, var(--font-size-kpi))',
            fontWeight: 600,
            fontFamily: 'var(--font-numeric)',
            fontVariantNumeric: 'tabular-nums',
            color: muted ? 'var(--text-muted)' : 'var(--text-primary)',
            letterSpacing: 'var(--tracking-kpi)',
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </span>
        {badgeEl}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        <span
          style={{
            fontSize: 'var(--font-size-micro)',
            color: 'var(--text-muted)',
            lineHeight: 1.4,
          }}
        >
          {detail}
        </span>
        {sparklineData && sparklineData.length > 0 && (
          <div style={{ width: 96, flexShrink: 0 }}>
            <Sparkline data={sparklineData} color={sparklineColor} height={32} strokeWidth={1.5} />
          </div>
        )}
      </div>
    </div>
  );
};
