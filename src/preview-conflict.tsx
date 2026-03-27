/**
 * Standalone preview entry point for AMA-1118 conflict detection UI.
 * Served at /conflict-preview.html during dev.
 *
 * Shows:
 * 1. ConflictIndicator variations (warning, critical, multi-count)
 * 2. ConflictDetailPanel with expandable cards and fix buttons
 * 3. Full TrainingWeekView with conflicts overlaid
 */
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import './index.css';
import { ConflictIndicator } from './components/calendar/ConflictIndicator';
import { ConflictDetailPanel } from './components/calendar/ConflictDetailPanel';
import { TrainingWeekView } from './components/calendar/TrainingWeekView';
import { mockSchedulingConflicts } from './components/calendar/mockData';
import type { SchedulingConflict, SuggestedFix } from './components/calendar/types';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-foreground border-b border-border pb-2">{title}</h2>
      {children}
    </div>
  );
}

function ConflictPreview() {
  const [conflicts, setConflicts] = useState<SchedulingConflict[]>(mockSchedulingConflicts);

  const warningOnly: SchedulingConflict[] = [
    {
      type: 'same_muscle_group',
      severity: 'warning',
      message: 'Two hard strength sessions within 48h',
      affectedSessionIds: ['s1'],
      affectedDates: ['2026-03-17'],
      suggestedFixes: [],
    },
  ];

  const criticalOnly: SchedulingConflict[] = [
    {
      type: 'pre_fatigue',
      severity: 'critical',
      message: 'Hard session before A-priority event',
      affectedSessionIds: ['s1'],
      affectedDates: ['2026-03-18'],
      suggestedFixes: [],
    },
  ];

  const multi: SchedulingConflict[] = [
    ...warningOnly,
    ...criticalOnly,
    {
      type: 'overload',
      severity: 'warning',
      message: 'Weekly volume exceeds target',
      affectedSessionIds: [],
      affectedDates: [],
      suggestedFixes: [],
    },
  ];

  const handleApplyFix = (conflict: SchedulingConflict, _fix: SuggestedFix) => {
    setConflicts(prev => prev.filter(c => c !== conflict));
  };

  return (
    <div className="dark bg-background text-foreground min-h-screen">
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AMA-1118: Conflict Detection UI</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conflict-aware workout scheduling: protect high-priority sessions from pre-fatigue
          </p>
        </div>

        {/* Indicators */}
        <Section title="1. ConflictIndicator Variants">
          <div className="flex items-center gap-8 bg-card rounded-lg p-4 border border-border">
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-muted-foreground">No conflicts</span>
              <ConflictIndicator conflicts={[]} />
              <span className="text-xs text-muted-foreground italic">(nothing renders)</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-muted-foreground">Warning (1)</span>
              <ConflictIndicator conflicts={warningOnly} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-muted-foreground">Critical (1)</span>
              <ConflictIndicator conflicts={criticalOnly} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-muted-foreground">Mixed (3)</span>
              <ConflictIndicator conflicts={multi} />
            </div>
          </div>
        </Section>

        {/* Detail Panel */}
        <Section title="2. ConflictDetailPanel (click to expand)">
          <div className="bg-card rounded-lg p-4 border border-border">
            <ConflictDetailPanel
              conflicts={conflicts}
              onApplyFix={handleApplyFix}
            />
          </div>
        </Section>

        {/* Full Week View */}
        <Section title="3. TrainingWeekView with Conflicts">
          <p className="text-xs text-muted-foreground">
            Click "Generate my week" to see conflicts appear on the calendar.
            Conflict indicators show on day columns with affected sessions.
          </p>
          <div className="bg-card rounded-xl border border-border min-h-[500px]">
            <TrainingWeekView />
          </div>
        </Section>
      </div>
    </div>
  );
}

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(<ConflictPreview />);
}
