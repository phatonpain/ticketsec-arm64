/**
 * fixpack-v2 — applies: FIX-11, FIX-15, FIX-16, FIX-19, FIX-23
 * (C-16/C-17/C-18), FIX-24, FIX-29.
 * Original: src/App.tsx (395 lines).
 * NOTE: original lines 22, 245, 253, 276-277, 289-290, 379-380 were
 * truncated in the source PDF ("…"); reconstructions are marked inline.
 *
 * Key changes vs original:
 *  - FIX-24 [CONFIRMED]: App rendered its OWN inline footer (same-tab API
 *    Docs link, no target) while src/components/Footer.tsx — which already
 *    had target="_blank" — was dead code. App now renders <Footer />.
 *  - FIX-11: KPI icon chips drop the four pastel rgba tints for the neutral
 *    icon well (--color-icon-chip-bg + --text-secondary); sparkline colors
 *    come from chartTokens (the sanctioned hex mirror), not raw '#6366F1'.
 *  - FIX-23: '8.73MB' → '8.73 MB' (C-16); footprint detail/tooltip (C-17/18).
 *  - FIX-29: main marginLeft 260 → var(--layout-sidebar-w) (same
 *    token the Sidebar uses).
 *  - Event Log dedupe: status-transition logging (restored/lost) is now
 *    owned by the useApi single writer — this effect would double-log.
 *  - Reconstructed truncated badge ternaries: latency DOWN is positive,
 *    throughput UP is positive (flagged in PATCHES_V2.md).
 *  - M7-WS-A: dashboard composition extracted to <Dashboard />; App keeps
 *    only cross-cutting chrome (sidebar, header, view routing, footer).
 */

import React, { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { HelpModal } from './components/HelpModal';
import { SettingsDrawer } from './components/SettingsDrawer';
import { useCommandPalette, openCommandPalette } from './hooks/useCommandPalette';
const CommandPalette = React.lazy(() => import('./components/CommandPalette').then(m => ({ default: m.CommandPalette })));
import { Footer } from './components/Footer';
import { useEventLogActions } from './hooks/useEventLog';
import { useTickets, loadTicketSnapshot, type Ticket } from './hooks/useTickets';
import { useApi, type PredictionResult, type Classification } from './hooks/useApi';
import { useSettingsDrawer, closeSettingsDrawer } from './hooks/useSettingsDrawer';
import { focusTicketQuery } from './hooks/useTicketQuery';
import { useActiveView, type View } from './hooks/useActiveView';
import {
  DetectionsView,
  PredictionsView,
  ThreatAnalyticsView,
  ModelRegistryView,
  SystemHealthView,
} from './components/Views';

type EnrichedResult = Omit<PredictionResult, 'processing_time_ms'> & {
  category: string;
  processing_time_ms: string;
  /** Present only when the tiered endpoint (/predict/tiered) produced the row. */
  inference_tier?: 'onnx_int8' | 'local_llm_q4' | 'unavailable';
  llm_explanation?: string | null;
};

function mapClassificationToTicket(c: Classification): Ticket {
  return {
    id: c.id,
    subject: c.subject,
    category: c.category,
    confidence: c.confidence,
    status: c.status,
    assignedTo: c.assignedTo,
    createdAt: new Date(c.createdAt),
    source: 'live',
  };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

export const App: React.FC = () => {
  const { lastSync, getClassifications, checkHealth } = useApi();
  const { addInfo, addError } = useEventLogActions();
  const { seed, add } = useTickets();
  const settingsOpen = useSettingsDrawer();
  const { open: paletteOpen } = useCommandPalette();
  const { activeView, setView } = useActiveView();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const classifications = await getClassifications();
      if (!mounted) return;

      // Always load cached snapshot history as a baseline; live classifications
      // are prepended on top so Detections never looks empty when live history
      // is still accumulating (M6-D5). snapshotAttempted prevents duplicate loads.
      const snapshotLoaded = await loadTicketSnapshot();
      if (snapshotLoaded) {
        addInfo('Cached ticket snapshot loaded');
      }

      if (classifications.length > 0) {
        seed(classifications.map(mapClassificationToTicket));
      }

      if (classifications.length > 0 || snapshotLoaded) {
        addInfo('Cached performance and classification data loaded');
      }
    };
    load();
    return () => { mounted = false; };
  }, [getClassifications, seed, addInfo]);

  /* NOTE: status-transition logging (API restored / lost) is owned by the
   * useApi single writer (FIX-01). The previous local effect double-logged. */

  const handleClassify = useCallback((result: EnrichedResult, text: string) => {
    const ticket = add({
      subject: text,
      category: result.category,
      confidence: result.confidence,
      status: 'Resolved',
      assignedTo: 'Auto',
      // Tiered-provenance fields ride along only when the tiered endpoint
      // answered; plain /predict rows stay untouched.
      ...(result.inference_tier ? { inferenceTier: result.inference_tier } : {}),
      ...(result.llm_explanation ? { llmExplanation: result.llm_explanation } : {}),
    });
    const tierNote = result.inference_tier ? ` · tier ${result.inference_tier}` : '';
    addInfo(`Inference OK · ${ticket.id} · ${result.category} · ${result.processing_time_ms}ms${tierNote}`);
  }, [add, addInfo]);

  const handleClassifyError = useCallback((_text: string, errorMessage: string) => {
    addError(`Classification failed · ${errorMessage}`);
  }, [addError]);

  const handleClassifySubmit = useCallback((text: string) => {
    addInfo(`Classification submitted · ${truncateDisplay(text, 40)}`);
  }, [addInfo]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setHelpOpen(false);
        closeSettingsDrawer();
        return;
      }

      if (isTypingTarget(e.target)) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        openCommandPalette();
        return;
      }

      switch (e.key) {
        case '/':
          e.preventDefault();
          setView('detections');
          focusTicketQuery();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          void checkHealth();
          addInfo('Manual refresh triggered');
          break;
        case '?':
          e.preventDefault();
          setHelpOpen(true);
          break;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [checkHealth, addInfo, setView]);

  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, [activeView]);

  const viewConfig: Record<View, { title: string; subtitle: string }> = {
    dashboard: { title: 'Security Operations Center', subtitle: 'Real-time ML ticket classification on AWS Graviton ARM64' },
    detections: { title: 'Detections', subtitle: 'Search, sort and export classified tickets' },
    predictions: { title: 'Live Predictions', subtitle: 'Classify new tickets via the inference API' },
    'threat-analytics': { title: 'Threat Analytics', subtitle: 'Category distribution and accuracy trends' },
    'model-registry': { title: 'Model Registry', subtitle: 'Committed ML artifacts and evaluation results' },
    'system-health': { title: 'System Health', subtitle: 'API probes, backoff status and session telemetry' },
  };
  const { title: viewTitle, subtitle: viewSubtitle } = viewConfig[activeView];

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-body)', overflow: 'hidden' }}>
      <Sidebar />

      <main
        style={{
          flex: 1,
          marginLeft: 'var(--layout-sidebar-w)',
          height: '100vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1,
        }}
      >
        <Header />

        {/* Content */}
        <div style={{ flex: 1, padding: '20px var(--layout-page-px)', display: 'flex', flexDirection: 'column', gap: 'var(--density-card-gap)' }}>
          {/* Page Title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1
                ref={titleRef}
                tabIndex={-1}
                style={{
                  fontSize: 'var(--font-size-xl)',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: 'var(--tracking-title)',
                  marginBottom: 4,
                  outline: 'none',
                }}
              >
                {viewTitle}
              </h1>
              <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)' }}>
                {viewSubtitle}
              </p>
            </div>
            {lastSync && (
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                Last sync: {lastSync.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            )}
          </div>

          {activeView === 'dashboard' && <Dashboard />}

          {activeView === 'detections' && <DetectionsView />}
          {activeView === 'predictions' && (
            <PredictionsView
              onClassify={handleClassify}
              onError={handleClassifyError}
              onSubmit={handleClassifySubmit}
            />
          )}
          {activeView === 'threat-analytics' && <ThreatAnalyticsView />}
          {activeView === 'model-registry' && <ModelRegistryView />}
          {activeView === 'system-health' && <SystemHealthView />}

          {/* FIX-24: single footer owner (was an inline same-tab duplicate). */}
          <Footer />
        </div>
      </main>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <SettingsDrawer open={settingsOpen} onClose={closeSettingsDrawer} />
      <Suspense fallback={null}>
        {paletteOpen && <CommandPalette onOpenHelp={() => setHelpOpen(true)} />}
      </Suspense>
    </div>
  );
};

function truncateDisplay(str: string, max: number): string {
  if (str.length <= max) return str;
  return `${str.slice(0, max)}…`;
}
