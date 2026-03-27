/**
 * Standalone preview for AMA-1153: AI Reasoning Panel.
 *
 * Shows the ReasoningPanel component with 3 different sessions
 * to demonstrate varied source types, confidence levels, and categories.
 */
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import './index.css';
import { ReasoningPanel, type ReasoningData } from './components/calendar/ReasoningPanel';
import {
  easyRunReasoning,
  hardStrengthReasoning,
  tempoRunReasoning,
} from './components/calendar/mockReasoningData';

const sessions: { label: string; data: ReasoningData; sessionType: string }[] = [
  { label: 'Easy Recovery Run', data: easyRunReasoning, sessionType: 'Easy / Recovery' },
  { label: 'Hard Strength Session', data: hardStrengthReasoning, sessionType: 'Hard / Strength' },
  { label: 'Tempo Run', data: tempoRunReasoning, sessionType: 'Moderate / Run' },
];

function ReasoningPreview() {
  const [activeIdx, setActiveIdx] = useState(0);

  return (
    <div className="dark bg-background text-foreground min-h-screen p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            AI Reasoning Layer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AMA-1153: "Why this workout?" with cited sources (Perplexity-style)
          </p>
        </div>

        {/* Session selector */}
        <div className="flex gap-2" data-testid="session-selector">
          {sessions.map((s, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              data-testid={`select-session-${i}`}
              className={`
                rounded-lg px-4 py-2 text-sm font-medium transition-colors
                ${activeIdx === i
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'}
              `}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Session context */}
        <div className="rounded-lg border border-border bg-card/50 p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Session Type
          </div>
          <div className="text-lg font-semibold text-foreground">
            {sessions[activeIdx].label}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {sessions[activeIdx].sessionType}
          </div>
        </div>

        {/* Reasoning panel — expanded by default for preview */}
        <ReasoningPanel
          key={activeIdx}
          reasoning={sessions[activeIdx].data}
          defaultExpanded={true}
        />

        {/* All three stacked (for screenshot) */}
        <div className="mt-8 space-y-4" data-testid="all-panels">
          <h2 className="text-lg font-semibold text-foreground/80">
            All Sessions (stacked)
          </h2>
          {sessions.map((s, i) => (
            <div key={i} className="space-y-1">
              <div className="text-xs text-muted-foreground font-medium">{s.label}</div>
              <ReasoningPanel reasoning={s.data} defaultExpanded={i === 0} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(<ReasoningPreview />);
}
