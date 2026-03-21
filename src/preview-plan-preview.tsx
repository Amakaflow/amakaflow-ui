/**
 * Standalone preview entry point for AMA-1128 Plan Preview Overlay.
 * Served at /plan-preview.html during dev.
 *
 * Renders the TrainingWeekView which includes the Generate button
 * and, once clicked, shows the plan preview overlay.
 */
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import './index.css';
import { PlanPreviewOverlay } from './components/calendar/PlanPreviewOverlay';
import { PlanSummary } from './components/calendar/PlanSummary';
import { ProposedSessionCard } from './components/calendar/ProposedSessionCard';
import { TrainingWeekView } from './components/calendar/TrainingWeekView';
import { getMockPlanPreview, mockPlanSummary, mockProposedSessions } from './components/calendar/mockData';
import type { PlanPreviewState, Intensity } from './components/calendar/types';

/** Isolated component demos + full integration */
function PlanPreviewDemo() {
  const [mode, setMode] = useState<'full' | 'overlay-only' | 'summary-only' | 'cards-only'>('full');
  const [preview, setPreview] = useState<PlanPreviewState>(getMockPlanPreview());

  const handleDurationChange = (id: string, dur: number) => {
    setPreview(prev => ({
      ...prev,
      proposals: prev.proposals.map(p =>
        p.id === id ? { ...p, session: { ...p.session, duration: dur } } : p,
      ),
    }));
  };

  const handleIntensityChange = (id: string, intensity: Intensity) => {
    setPreview(prev => ({
      ...prev,
      proposals: prev.proposals.map(p =>
        p.id === id ? { ...p, session: { ...p.session, intensity } } : p,
      ),
    }));
  };

  return (
    <div className="dark bg-background text-foreground min-h-screen">
      {/* Mode tabs */}
      <div className="flex gap-2 p-3 border-b border-border" data-testid="demo-tabs">
        {(['full', 'overlay-only', 'summary-only', 'cards-only'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === m ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent'
            }`}
            data-testid={`tab-${m}`}
          >
            {m.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Full integration: TrainingWeekView with Generate button */}
      {mode === 'full' && (
        <div data-testid="demo-full" className="h-[calc(100vh-52px)]">
          <TrainingWeekView />
        </div>
      )}

      {/* Overlay only in a container */}
      {mode === 'overlay-only' && (
        <div data-testid="demo-overlay" className="relative h-[calc(100vh-52px)] m-4">
          <PlanPreviewOverlay
            preview={preview}
            onApply={() => alert('Applied!')}
            onCancel={() => alert('Cancelled!')}
            onAdjust={() => alert('Adjust!')}
            onDurationChange={handleDurationChange}
            onIntensityChange={handleIntensityChange}
          />
        </div>
      )}

      {/* Summary panel only */}
      {mode === 'summary-only' && (
        <div data-testid="demo-summary" className="max-w-md mx-auto p-6">
          <PlanSummary summary={mockPlanSummary} />
        </div>
      )}

      {/* Individual cards */}
      {mode === 'cards-only' && (
        <div data-testid="demo-cards" className="max-w-sm mx-auto p-6 space-y-4">
          {mockProposedSessions.map(p => (
            <ProposedSessionCard
              key={p.id}
              proposal={p}
              onDurationChange={handleDurationChange}
              onIntensityChange={handleIntensityChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(<PlanPreviewDemo />);
}
