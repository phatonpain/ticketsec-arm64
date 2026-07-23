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
import { useApi, type PredictionResult, type InferenceTier } from '../hooks/useApi';
import { CATEGORY_COLORS, CATEGORY_BG } from '../lib/utils';

type ClassifyPayload = Omit<PredictionResult, 'processing_time_ms'> & {
  category: string;
  processing_time_ms: string;
  /** Present only when the tiered endpoint (/predict/tiered) produced the row. */
  inference_tier?: InferenceTier;
  llm_explanation?: string | null;
  llm_model?: string | null;
};

/** Display-only variant: 'unavailable' tier carries a null predicted_category. */
type DisplayResult = Omit<ClassifyPayload, 'predicted_category'> & {
  predicted_category: string | null;
};

/** Tier badge palette — status tokens only, no hex literals. */
const TIER_BADGE: Record<InferenceTier, { label: string; fg: string; bg: string }> = {
  onnx_int8: { label: 'ONNX INT8', fg: 'var(--color-status-ok-text)', bg: 'var(--color-status-ok-bg)' },
  local_llm_q4: { label: 'LOCAL LLM Q4', fg: 'var(--color-status-warn-text)', bg: 'var(--color-status-warn-bg)' },
  unavailable: { label: 'UNAVAILABLE', fg: 'var(--color-status-err-text)', bg: 'var(--color-status-err-bg)' },
};

const LLM_DISCLAIMER = 'classificação por LLM local quantizado — precisão reduzida';

interface LivePredictionProps {
  onClassify?: (result: ClassifyPayload, text: string) => void;
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
  const [result, setResult] = useState<DisplayResult | null>(null);
  const [processingTime, setProcessingTime] = useState<string | null>(null);
  const [tiered, setTiered] = useState(false);
  const { predict, predictTiered, loading, error, status } = useApi();

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
    const res = tiered ? await predictTiered(ticket) : await predict(ticket);
    const elapsed = (performance.now() - start).toFixed(2);
    if (res) {
      const enriched: DisplayResult = {
        ...res,
        category: res.predicted_category ?? 'unavailable',
        processing_time_ms: elapsed,
      };
      setResult(enriched);
      setProcessingTime(`${elapsed}ms`);
      // Honest tier: an 'unavailable' tier is never dressed up as a result —
      // it renders the red UNAVAILABLE panel and logs the truth via onError.
      if ('inference_tier' in res && res.inference_tier === 'unavailable') {
        onError?.(ticket, 'Both inference tiers unavailable (ONNX below threshold/failed, local LLM offline)');
        return;
      }
      onClassify?.(enriched as ClassifyPayload, ticket);
    } else {
      onError?.(ticket, error ?? 'API request failed');
    }
  };

  const confidencePercent = result ? result.confidence * 100 : 0;
  const categoryKey = result?.predicted_category ?? null;
  const categoryColor = categoryKey ? (CATEGORY_COLORS[categoryKey] ?? 'var(--text-muted)') : 'var(--text-muted)';
  const unavailableTier = result?.inference_tier === 'unavailable';
  const tierBadge = result?.inference_tier ? TIER_BADGE[result.inference_tier] : null;

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
        borderRadius: 'var(--radius-md)',
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
          padding: '0 var(--density-widget-pad-x)',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <div>
          <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: 'var(--tracking-title)' }}>
            Live Classification
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 1 }}>
            {live
              ? tiered
                ? 'Tiered inference: ONNX INT8 first, local LLM fallback'
                : 'Real-time inference via ONNX Runtime INT8'
              : 'Classification is paused — API offline'}
          </p>
        </div>
      </div>
      <div style={{ padding: 'var(--density-card-pad) var(--density-widget-pad-x)', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
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
            borderRadius: 'var(--radius-md)',
            padding: 12,
            fontSize: 'var(--font-size-base)',
            color: 'var(--text-primary)',
            fontFamily: 'Inter, sans-serif',
            resize: 'none',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ fontSize: 'var(--font-size-micro)', color: 'var(--text-muted)', marginTop: -4 }}>Ctrl + Enter to classify</div>

        <div>
          <div
            style={{
              fontSize: 'var(--font-size-micro)',
              fontWeight: 600,
              color: 'var(--text-muted)',
              letterSpacing: 'var(--tracking-caps)',
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
                  fontSize: 'var(--font-size-micro)',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-body)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-badge)',
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
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 'var(--font-size-micro)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={tiered}
              onChange={e => setTiered(e.target.checked)}
              aria-label="Enable tiered fallback"
            />
            Tiered fallback (ONNX→local LLM)
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 'var(--font-size-micro)', color: 'var(--text-muted)' }}>
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
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-base)',
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
            <span style={{ fontSize: 'var(--font-size-sm)' }}>
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
              borderRadius: 'var(--radius-md)',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-sm)', color: 'var(--accent-rose)', fontWeight: 600 }}>
              <AlertTriangle size={14} />
              Classification failed
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{error}</div>
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
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-body)',
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-sm)',
                cursor: loading || !live ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        {result && unavailableTier && (
          <div
            role="alert"
            style={{
              background: 'var(--color-status-err-bg)',
              border: '1px solid var(--accent-rose)',
              borderRadius: 'var(--radius-md)',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-sm)', color: 'var(--color-status-err-text)', fontWeight: 600 }}>
              <AlertTriangle size={14} />
              Inference unavailable
              {tierBadge && (
                <span
                  style={{
                    marginLeft: 'auto',
                    padding: 'var(--badge-pad-y) var(--badge-pad-x)',
                    borderRadius: 'var(--radius-badge)',
                    fontSize: 'var(--badge-font-size)',
                    fontWeight: 'var(--badge-font-weight)',
                    background: tierBadge.bg,
                    color: tierBadge.fg,
                  }}
                >
                  {tierBadge.label}
                </span>
              )}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              No inference tier could classify this ticket — ONNX confidence was below threshold or failed, and the local LLM is offline. No category is shown rather than a guessed one.
            </div>
          </div>
        )}

        {result && !unavailableTier && categoryKey && (
          <div style={{ background: 'var(--bg-body)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--font-size-micro)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontWeight: 600 }}>
                Category
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--badge-gap)',
                  padding: 'var(--badge-pad-y) var(--badge-pad-x)',
                  borderRadius: 'var(--radius-badge)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 600,
                  background: CATEGORY_BG[categoryKey] || 'var(--color-status-neutral-bg)',
                  color: categoryColor,
                }}
              >
                <span style={{ width: 'var(--badge-dot-size)', height: 'var(--badge-dot-size)', borderRadius: '50%', background: categoryColor }} />
                {categoryKey.replace(/_/g, ' ')}
              </span>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 'var(--font-size-micro)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontWeight: 600 }}>
                  Confidence
                </span>
                <span style={{ fontSize: 'var(--font-size-lg)', fontFamily: 'var(--font-numeric)', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-primary)' }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-micro)', color: 'var(--text-muted)', marginTop: 4 }}>
                <span>0%</span>
                <span>Threshold 70%</span>
                <span>100%</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--font-size-micro)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontWeight: 600 }}>
                Inference time
              </span>
              <span style={{ fontFamily: 'var(--font-numeric)', fontVariantNumeric: 'tabular-nums', fontSize: 'var(--font-size-base)', color: 'var(--text-primary)' }}>
                {processingTime ?? '—'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--font-size-micro)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontWeight: 600 }}>
                Model
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {tierBadge && (
                  <span
                    style={{
                      padding: 'var(--badge-pad-y) var(--badge-pad-x)',
                      borderRadius: 'var(--radius-badge)',
                      fontSize: 'var(--badge-font-size)',
                      fontWeight: 'var(--badge-font-weight)',
                      background: tierBadge.bg,
                      color: tierBadge.fg,
                    }}
                  >
                    {tierBadge.label}
                  </span>
                )}
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', fontFamily: 'var(--font-numeric)' }}>
                  {result.inference_tier === 'local_llm_q4'
                    ? `${result.llm_model ?? 'local-llm'} · local q4`
                    : 'onnx-int8 · arm64'}
                </span>
              </span>
            </div>

            {result.inference_tier === 'local_llm_q4' && result.llm_explanation && (
              <div
                style={{
                  borderTop: '1px solid var(--tint-row)',
                  paddingTop: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 'var(--font-size-micro)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontWeight: 600 }}>
                  Local LLM explanation
                </span>
                {/* LLM output rendered as plain text data only — never HTML. */}
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {result.llm_explanation}
                </span>
                <span style={{ fontSize: 'var(--font-size-micro)', color: 'var(--color-status-warn-text)' }}>
                  {LLM_DISCLAIMER}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
