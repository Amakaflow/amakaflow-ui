/**
 * Standalone preview entry point for FatigueAdvisor.
 * Served at /fatigue-advisor-preview.html during dev.
 *
 * AMA-1114: Renders fatigue advisor in various states for Playwright screenshots.
 *
 * Modes (via ?mode= query param):
 * - empty: Empty state with body map selector
 * - response: Pre-populated response for quad fatigue after HYROX
 * - loading: Loading skeleton state
 * - bodymap: Body map with a muscle group selected
 */
import { createRoot } from 'react-dom/client';
import { useState, useEffect } from 'react';
import './index.css';
import { FatigueAdvisorPage } from './components/FatigueAdvisor/FatigueAdvisorPage';
import { FatigueResponse } from './components/FatigueAdvisor/FatigueResponse';
import { BodyMapSelector } from './components/FatigueAdvisor/BodyMapSelector';
import type { FatigueAdvice } from './components/FatigueAdvisor/hooks/useFatigueAdvisor';

// =============================================================================
// Demo data
// =============================================================================

const DEMO_ADVICE: FatigueAdvice = {
  likely_cause:
    'Eccentric overload on the quadriceps during HYROX wall balls, sled push, and lunges. The repetitive eccentric contractions cause micro-tears in the muscle fibers, leading to delayed onset muscle soreness (DOMS).',
  immediate_recovery: [
    'Quad stretch 2x30s each leg -- hold gentle, no bouncing',
    'Foam roll quads and IT band 90s each side',
    'Ice bath or cold water immersion 10-15 min',
    'Elevate legs for 10 min to reduce swelling',
  ],
  programming_suggestions: [
    'Add tempo squats (3s eccentric) to build eccentric strength',
    'Include Nordic hamstring curls to balance quad dominance',
    'Progress to Bulgarian split squats for single-leg stability',
  ],
  related_exercises: [
    'Bulgarian split squat',
    'Step-up with knee drive',
    'Wall sit',
    'Leg extension (light)',
    'Cyclist squat',
  ],
  rest_recommendation:
    '48-72h before next heavy lower body session. Light walking or cycling is fine for active recovery.',
};

// =============================================================================
// Preview modes
// =============================================================================

function EmptyStatePreview() {
  return (
    <div data-testid="preview-empty" className="flex flex-col h-screen bg-background">
      <FatigueAdvisorPage showBodyMap={true} demoMode={true} />
    </div>
  );
}

function ResponsePreview() {
  return (
    <div data-testid="preview-response" className="flex flex-col h-screen bg-background">
      <FatigueAdvisorPage
        initialAdvice={DEMO_ADVICE}
        initialQuestion="My quadriceps are fatigued after HYROX -- what do I need to do to improve?"
        showBodyMap={false}
        demoMode={true}
      />
    </div>
  );
}

function LoadingPreview() {
  return (
    <div data-testid="preview-loading" className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-border/40 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-sm font-bold">
          F
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Fatigue Advisor</h2>
          <p className="text-xs text-muted-foreground">Ask about muscle fatigue, get targeted advice</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4 max-w-lg mx-auto">
          {/* Question display */}
          <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 p-3">
            <p className="text-xs text-muted-foreground mb-1">Your question:</p>
            <p className="text-sm text-foreground">My quadriceps are fatigued after HYROX</p>
          </div>
          {/* Loading skeleton */}
          <div data-testid="fatigue-loading" className="flex flex-col gap-3 animate-pulse">
            <div className="rounded-xl border border-border/40 bg-card p-4">
              <div className="h-4 w-24 rounded bg-muted/50 mb-2" />
              <div className="h-3 w-full rounded bg-muted/30 mb-1" />
              <div className="h-3 w-3/4 rounded bg-muted/30" />
            </div>
            <div className="rounded-xl border border-border/40 bg-card p-4">
              <div className="h-4 w-32 rounded bg-muted/50 mb-2" />
              <div className="space-y-1.5">
                <div className="h-3 w-full rounded bg-muted/30" />
                <div className="h-3 w-5/6 rounded bg-muted/30" />
                <div className="h-3 w-4/5 rounded bg-muted/30" />
              </div>
            </div>
            <div className="rounded-xl border border-border/40 bg-card p-4">
              <div className="h-4 w-40 rounded bg-muted/50 mb-2" />
              <div className="space-y-1.5">
                <div className="h-3 w-full rounded bg-muted/30" />
                <div className="h-3 w-4/5 rounded bg-muted/30" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BodyMapPreview() {
  return (
    <div data-testid="preview-bodymap" className="flex flex-col h-screen bg-background">
      <FatigueAdvisorPage showBodyMap={true} demoMode={true} />
    </div>
  );
}

function ResponseOnlyPreview() {
  return (
    <div data-testid="preview-response-only" className="flex flex-col h-screen bg-background overflow-y-auto p-4">
      <FatigueResponse advice={DEMO_ADVICE} />
    </div>
  );
}

// =============================================================================
// Main
// =============================================================================

function FatigueAdvisorPreview() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode') || 'response';

  switch (mode) {
    case 'empty':
      return <EmptyStatePreview />;
    case 'loading':
      return <LoadingPreview />;
    case 'bodymap':
      return <BodyMapPreview />;
    case 'response-only':
      return <ResponseOnlyPreview />;
    case 'response':
    default:
      return <ResponsePreview />;
  }
}

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(
    <div className="dark bg-background text-foreground">
      <FatigueAdvisorPreview />
    </div>,
  );
}
