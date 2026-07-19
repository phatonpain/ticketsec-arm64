/**
 * fixpack-v2 — applies: FIX-13, FIX-15, FIX-16, FIX-19, FIX-20, FIX-23
 * (C-47/C-49/C-50/C-52).
 * Original: src/components/LivePrediction.tsx (266 lines).
 * NOTE: original lines 74, 76, 118-119, 153, 160-161, 191, 212-213, 245,
 * 253-254, 258-259 were truncated in the source PDF ("…"); panel chrome in
 * those regions is reconstructed semantically (the "Live Classification"
 * title is confirmed by evidence/text-content.txt).
 *
 * Key changes vs original (props interface {onClassify,onError,onSubmit} and
 * the App-level ticket/logging flow preserved exactly):
 *  - FIX-13 [CONFIRMED, S4]: the Classify button was a full-width saturated
 *    block (var(--accent-indigo) + '#fff') whose disabled state was opacity
 *    only, and it stayed ENABLED while the API was offline (submit then
 *    failed). Now: 32px right-aligned primary control
 *    (--color-accent-indigo-strong + --color-text-on-accent, 5.93:1 AA);
 *    disabled when offline / empty / loading, with the reason rendered next
 *    to it; double-submit guarded.
 *  - FIX-23: subtitle is state-aware — live: 'Real-time inference via ONNX
 *    Runtime INT8'; offline/cached: 'Classification is paused — API offline'.
 *    Hint: 'Ctrl + Enter to classify' (C-49). Samples labeled 'Try a
 *    sample' (C-50). Empty state no longer promises real-time results while
 *    the API is offline (C-52).
 *  - FIX-20: inline outline:none removed from the textarea.
 *  - FIX-15/16/19: '#fff' and raw rgba → tokens; type floor 11px (was 10px
 *    axis labels on the confidence bar).
 */

import React, { useState } from 'react';
import { Loader2, Zap, AlertTriangle, RefreshCw } from 'lucide-react';
import { useApi, type PredictionResult } from '../hooks/useApi';
import { CATEGORY_COLORS, CATEGORY_BG } from '../lib/utils';

type EnrichedResult = Omit<PredictionResult, 'processing_time_ms'> & {
  category: string;
  processing_time_ms: string;
};

interface LivePredictionProps {
  onClassify?: (result: EnrichedResult, text: string) => void;
  onError?: (text: string, error: string) => void;
  onSubmit?: (text: string) => void;
}

const EXAMPLES = [
  'suspicious email asking for bank credentials',
  'trojan horse detected in downloaded file',
  'multiple failed login attempts from unknown IP',
];

export const LivePrediction: React.FC<LivePredictionProps> = ({ onClassify, onError, onSubmit }) => {
  const [text, setText] = useState('');
  const [result, setResult] = useState<EnrichedResult | null>(null);
  const [processingTime, setProcessingTime] = useState<string | null>(null);
  const { predict, loading, error, status } = useApi();

  const live = status === 'live';
  const empty = !text.trim();

  const handleClassify = async (inputText?: string) => {
    if (loading) return; // double-submit guard (Ctrl+Enter spam)
    const ticket = inputText ?? text;
    if (!ticket.trim() || !live) return;
    onSubmit?.(ticket);
    setResult(null);
    setProcessingTime(null);
    const start = performance.now();
    const res = await predict(ticket);
    const elapsed = (performance.now() - start).toFixed(2);
    if (res) {
      const enriched = {
        ...res,
        category: res.predicted_category,
        processing_time_ms: elapsed,
      };
      setResult(enriched);
      setProcessingTime(`${elapsed}ms`);
      onClassify?.(enriched, ticket);
    } else {
      onError?.(ticket, error ?? 'API request failed');
    }
  };

  const confidencePercent = result ? result.confidence * 100 : 0;
  const categoryColor = result ? (CATEGORY_COLORS[result.predicted_category] ?? 'var(--text-muted)') : 'var(--text-muted)';

  /* FIX-13: the disabled control always says WHY. */
  const disabledReason = loading
    ? 'Classifying…'
    : !live
      ? 'API offline — classification unavailable'
      : empty
        ? 'Enter ticket text to enable classification'
        : null;

  return (
    <div
      id="live-prediction"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md, 8px)',
        overflow: 'hidden',
        transition: 'border-color 150ms ease',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 420,
        position: 'relative',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
    >
      <div
        style={{
          height: 'var(--density-widget-head-h)',
          padding: '0 var(--density-widget-pad-x, 20px)',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <div>
          <h2 style={{ fontSize: 'var(--font-size-md, 15px)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: 'var(--tracking-title, -0.2px)' }}>
            Live Classification
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm, 12px)', color: 'var(--text-muted)', marginTop: 1 }}>
            {live ? 'Real-time inference via ONNX Runtime INT8' : 'Classification is paused — API offline'}
          </p>
        </div>
      </div>
      <div style={{ padding: 'var(--density-card-pad) var(--density-widget-pad-x, 20px)', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleClassify(); } }}
          placeholder="Paste ticket subject or body here…"
          rows={4}
          aria-label="Ticket text"
          style={{
            width: '100%',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md, 8px)',
            padding: 12,
            fontSize: 'var(--font-size-base, 13px)',
            color: 'var(--text-primary)',
            fontFamily: 'Inter, sans-serif',
            resize: 'none',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ fontSize: 'var(--font-size-micro, 11px)', color: 'var(--text-muted)', marginTop: -4 }}>Ctrl + Enter to classify</div>

        <div>
          <div
            style={{
              fontSize: 'var(--font-size-micro, 11px)',
              fontWeight: 600,
              color: 'var(--text-muted)',
              letterSpacing: 'var(--tracking-caps, 0.6px)',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Try a sample
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {EXAMPLES.map(ex => (
              <button
                key={ex}
                type="button"
                onClick={() => { setText(ex); handleClassify(ex); }}
                style={{
                  fontSize: 'var(--font-size-micro, 11px)',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-body)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-badge, 4px)',
                  padding: '4px 8px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 'var(--font-size-micro, 11px)', color: 'var(--text-muted)' }}>
            {disabledReason ?? 'Ready'}
          </span>
          <button
            type="button"
            onClick={() => handleClassify()}
            disabled={loading || empty || !live}
            style={{
              height: 32,
              padding: '0 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: 'var(--color-accent-indigo-strong)',
              color: 'var(--color-text-on-accent)',
              border: 'none',
              borderRadius: 'var(--radius-sm, 6px)',
              fontSize: 'var(--font-size-base, 13px)',
              fontWeight: 600,
              cursor: loading || empty || !live ? 'not-allowed' : 'pointer',
              opacity: loading || empty || !live ? 0.5 : 1,
              flexShrink: 0,
            }}
          >
            {loading && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            {loading ? 'Classifying…' : <><Zap size={16} /> Classify Ticket</>}
          </button>
        </div>

        {!result && !loading && !error && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)', textAlign: 'center', padding: '0 24px' }}>
            <Zap size={24} style={{ opacity: 0.3 }} />
            <span style={{ fontSize: 'var(--font-size-sm, 12px)' }}>
              {live
                ? 'Submit a ticket to see the real-time prediction result.'
                : 'Classification is unavailable while the API is offline. The button re-enables automatically on reconnect.'}
            </span>
          </div>
        )}

        {error && !result && (
          <div
            role="alert"
            style={{
              background: 'var(--color-status-err-bg)',
              border: '1px solid var(--accent-rose)',
              borderRadius: 'var(--radius-md, 8px)',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-sm, 12px)', color: 'var(--accent-rose)', fontWeight: 600 }}>
              <AlertTriangle size={14} />
              Classification failed
            </div>
            <div style={{ fontSize: 'var(--font-size-sm, 12px)', color: 'var(--text-secondary)' }}>{error}</div>
            <button
              type="button"
              onClick={() => handleClassify()}
              disabled={loading || !live}
              style={{
                alignSelf: 'flex-start',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                borderRadius: 'var(--radius-sm, 6px)',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-body)',
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-sm, 12px)',
                cursor: loading || !live ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        {result && (
          <div style={{ background: 'var(--bg-body)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md, 8px)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--font-size-micro, 11px)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps, 0.6px)', fontWeight: 600 }}>
                Category
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--badge-gap, 6px)',
                  padding: 'var(--badge-pad-y, 2px) var(--badge-pad-x, 8px)',
                  borderRadius: 'var(--radius-badge, 4px)',
                  fontSize: 'var(--font-size-sm, 12px)',
                  fontWeight: 600,
                  background: CATEGORY_BG[result.predicted_category] || 'var(--color-status-neutral-bg)',
                  color: categoryColor,
                }}
              >
                <span style={{ width: 'var(--badge-dot-size, 6px)', height: 'var(--badge-dot-size, 6px)', borderRadius: '50%', background: categoryColor }} />
                {result.predicted_category.replace(/_/g, ' ')}
              </span>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 'var(--font-size-micro, 11px)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps, 0.6px)', fontWeight: 600 }}>
                  Confidence
                </span>
                <span style={{ fontSize: 'var(--font-size-lg, 18px)', fontFamily: 'var(--font-numeric)', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {confidencePercent.toFixed(1)}%
                </span>
              </div>
              <div style={{ position: 'relative', height: 6, background: 'var(--tint-track)', borderRadius: 3 }}>
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '100%',
                    width: `${confidencePercent}%`,
                    background: categoryColor,
                    borderRadius: 3,
                    transition: 'width 300ms ease',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: -3,
                    left: '70%',
                    width: 2,
                    height: 12,
                    background: 'var(--text-muted)',
                    borderRadius: 1,
                  }}
                  title="Decision threshold (70%)"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-micro, 11px)', color: 'var(--text-muted)', marginTop: 4 }}>
                <span>0%</span>
                <span>Threshold 70%</span>
                <span>100%</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--font-size-micro, 11px)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps, 0.6px)', fontWeight: 600 }}>
                Inference time
              </span>
              <span style={{ fontFamily: 'var(--font-numeric)', fontVariantNumeric: 'tabular-nums', fontSize: 'var(--font-size-base, 13px)', color: 'var(--text-primary)' }}>
                {processingTime ?? '—'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--font-size-micro, 11px)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps, 0.6px)', fontWeight: 600 }}>
                Model
              </span>
              <span style={{ fontSize: 'var(--font-size-sm, 12px)', color: 'var(--text-secondary)', fontFamily: 'var(--font-numeric)' }}>
                onnx-int8 · arm64
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
