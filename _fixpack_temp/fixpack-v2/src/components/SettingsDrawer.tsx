/**
 * fixpack-v2 — applies: FIX-01-flow (settings re-probe), FIX-15, FIX-16,
 * FIX-19, FIX-20, FIX-23, FIX-31.
 * Original: src/components/SettingsDrawer.tsx (252 lines).
 *
 * Key changes vs original:
 *  - RE-PROBE FLOW [CONFIRMED defect]: "Test Connection" probed the SAVED
 *    settings.apiBase, not the draft the user just typed; and a saved URL
 *    was only exercised on the next scheduled probe (up to 60s away with
 *    backoff). Now: Test probes the DRAFT URL; on success it saves the URL
 *    AND immediately re-probes global state (checkHealth), so the header
 *    pill reflects the new endpoint within ~4s. Blur-saving a changed URL
 *    also triggers an immediate re-probe.
 *  - FIX-31: z-index 200 → var(--z-overlay, 1000).
 *  - FIX-20: inline outline:none removed from the URL input.
 *  - FIX-15/19: toggle knob '#fff' → --color-text-on-accent; radius tokens.
 *  - FIX-23: footer version string 'TicketSec Arm64 Guardian v0.0.1' →
 *    'TicketSec Arm64 · Security Operations v0.0.1'.
 */

import React, { useState } from 'react';
import { X, RotateCcw, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { probeApiBase, checkHealth } from '../hooks/useApi';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ open, onClose }) => {
  const { settings, updateApiBase, updateReducedMotion, restoreDefaults } = useSettings();
  const [draftUrl, setDraftUrl] = React.useState(settings.apiBase);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  React.useEffect(() => {
    if (open) {
      setDraftUrl(settings.apiBase);
      setTestResult(null);
    }
  }, [open, settings.apiBase]);

  if (!open) return null;

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraftUrl(e.target.value);
    setTestResult(null);
  };

  /** Save on blur; a CHANGED base URL re-probes immediately (was: next
   *  scheduled probe, up to a full backoff interval away). */
  const handleUrlBlur = () => {
    const next = draftUrl.trim();
    if (next && next !== settings.apiBase) {
      updateApiBase(next);
      void checkHealth();
    }
  };

  /** Test the DRAFT URL (was: the previously saved one). A successful test
   *  saves the URL and re-probes so the header pill updates at once. */
  const handleTest = async () => {
    const candidate = draftUrl.trim();
    if (!candidate) return;
    setTesting(true);
    setTestResult(null);
    const result = await probeApiBase(candidate);
    setTesting(false);
    if (result.ok) {
      const latency = result.endpoints.find(e => e.ok)?.latencyMs ?? '—';
      setTestResult({ ok: true, message: `Connected · ${latency}ms` });
      if (candidate !== settings.apiBase) {
        updateApiBase(candidate);
      }
      void checkHealth();
    } else {
      setTestResult({ ok: false, message: result.error ?? 'Connection failed' });
    }
  };

  const toggleReducedMotion = () => {
    updateReducedMotion(!settings.reducedMotion);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-overlay, 1000)' as unknown as number,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.50)',
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        style={{
          width: 360,
          height: '100%',
          background: 'var(--bg-sidebar)',
          borderLeft: '1px solid var(--border-default)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 id="settings-title" style={{ fontSize: 'var(--font-size-lg, 16px)', fontWeight: 600, color: 'var(--text-primary)' }}>
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              borderRadius: 'var(--radius-sm, 6px)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* API Endpoint */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label htmlFor="api-url" style={{ fontSize: 'var(--font-size-sm, 12px)', fontWeight: 600, color: 'var(--text-secondary)' }}>
            API Base URL
          </label>
          <input
            id="api-url"
            type="text"
            value={draftUrl}
            onChange={handleUrlChange}
            onBlur={handleUrlBlur}
            placeholder="http://3.23.60.61:8000"
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm, 6px)',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: 'var(--font-size-base, 13px)',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !draftUrl.trim()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm, 6px)',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-sm, 12px)',
                fontWeight: 500,
                cursor: testing || !draftUrl.trim() ? 'not-allowed' : 'pointer',
                opacity: testing || !draftUrl.trim() ? 0.6 : 1,
              }}
            >
              {testing && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              Test Connection
            </button>
            {testResult && (
              <span
                role="status"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 'var(--font-size-sm, 12px)',
                  color: testResult.ok ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                }}
              >
                {testResult.ok ? <Check size={14} /> : <AlertCircle size={14} />}
                {testResult.message}
              </span>
            )}
          </div>
          <p style={{ fontSize: 'var(--font-size-micro, 11px)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Overrides the default backend endpoint. Saving re-probes the API immediately.
          </p>
        </div>

        {/* Reduced Motion */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 12,
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-card)',
          }}
        >
          <div>
            <div style={{ fontSize: 'var(--font-size-base, 13px)', fontWeight: 500, color: 'var(--text-primary)' }}>Reduced motion</div>
            <div style={{ fontSize: 'var(--font-size-micro, 11px)', color: 'var(--text-muted)', marginTop: 2 }}>
              Disable animations and transitions.
            </div>
          </div>
          <button
            type="button"
            onClick={toggleReducedMotion}
            aria-pressed={settings.reducedMotion}
            style={{
              width: 40,
              height: 22,
              borderRadius: 11,
              border: 'none',
              background: settings.reducedMotion ? 'var(--accent-emerald)' : 'var(--text-muted)',
              position: 'relative',
              cursor: 'pointer',
              transition: 'background 150ms ease',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: settings.reducedMotion ? 20 : 2,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: 'var(--color-text-on-accent)',
                transition: 'left 150ms ease',
              }}
            />
          </button>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border-default)' }}>
          <button
            type="button"
            onClick={restoreDefaults}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm, 6px)',
              border: '1px solid var(--border-default)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 'var(--font-size-sm, 12px)',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={14} />
            Restore defaults
          </button>
          <span style={{ display: 'block', marginTop: 12, fontSize: 'var(--font-size-sm, 12px)', color: 'var(--text-muted)' }}>
            TicketSec Arm64 · Security Operations v0.0.1
          </span>
        </div>
      </div>
    </div>
  );
};
