import React, { useState } from 'react';
import { X, RotateCcw, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { probeApiBase } from '../hooks/useApi';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ open, onClose }) => {
  const { settings, updateApiBase, updateReducedMotion, updateDensity, restoreDefaults } = useSettings();
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

  const handleUrlBlur = () => {
    updateApiBase(draftUrl);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await probeApiBase(settings.apiBase);
    setTesting(false);
    if (result.ok) {
      const latency = result.endpoints.find(e => e.ok)?.latencyMs ?? '—';
      setTestResult({ ok: true, message: `Connected · ${latency}ms` });
    } else {
      setTestResult({ ok: false, message: result.error ?? 'Connection failed' });
    }
  };

  const toggleReducedMotion = () => {
    updateReducedMotion(!settings.reducedMotion);
  };

  const densityOptions = [
    { key: 'comfortable', label: 'Comfortable' },
    { key: 'compact', label: 'Compact' },
  ] as const;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
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
          <h2 id="settings-title" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
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
              borderRadius: 6,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* API Endpoint */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label htmlFor="api-url" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
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
              borderRadius: 6,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !settings.apiBase.trim()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--border-default)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: 12,
                fontWeight: 500,
                cursor: testing || !settings.apiBase.trim() ? 'not-allowed' : 'pointer',
                opacity: testing || !settings.apiBase.trim() ? 0.6 : 1,
              }}
            >
              {testing && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              Test Connection
            </button>
            {testResult && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  color: testResult.ok ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                }}
              >
                {testResult.ok ? <Check size={14} /> : <AlertCircle size={14} />}
                {testResult.message}
              </span>
            )}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Overrides the default backend endpoint. The dashboard will probe this URL on the next health check.
          </p>
        </div>

        {/* Density (F-02) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: 12,
            borderRadius: 8,
            border: '1px solid var(--border-default)',
            background: 'var(--bg-card)',
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Density</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Compact tightens spacing and font size for denser data views.
            </div>
          </div>
          <div role="group" aria-label="Density" style={{ display: 'flex', gap: 8 }}>
            {densityOptions.map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => updateDensity(opt.key)}
                aria-pressed={settings.density === opt.key}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border-default)',
                  background: settings.density === opt.key ? 'var(--color-accent-indigo-bg)' : 'transparent',
                  color: settings.density === opt.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Reduced Motion */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 12,
            borderRadius: 8,
            border: '1px solid var(--border-default)',
            background: 'var(--bg-card)',
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Reduced motion</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Disable animations and transitions.
            </div>
          </div>
          <button
            type="button"
            onClick={toggleReducedMotion}
            aria-label="Reduced motion"
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
                background: '#fff',
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
              borderRadius: 6,
              border: '1px solid var(--border-default)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={14} />
            Restore defaults
          </button>
          <span style={{ display: 'block', marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            TicketSec Arm64 Guardian v0.0.1
          </span>
        </div>
      </div>
    </div>
  );
};
