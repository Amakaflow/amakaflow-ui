import { useState, useCallback } from 'react';
import type { WeekState, PlanPreviewState, PlanSummaryData, ProposedSession, SessionType, Intensity, ConflictWarning, DayState } from '../types';
import { getMockWeekState, getGeneratedWeekState, getMockPlanPreview, mockSchedulingConflicts } from '../mockData';

export type ViewLayer = 'planned' | 'actuals';

// ---------------------------------------------------------------------------
// Conflict detection (AMA-1521)
// ---------------------------------------------------------------------------

/** Detect scheduling conflicts in the generated week plan. */
function detectConflicts(days: DayState[]): ConflictWarning[] {
  const warnings: ConflictWarning[] = [];

  // Check for consecutive hard sessions
  for (let i = 0; i < days.length - 1; i++) {
    const today = days[i];
    const tomorrow = days[i + 1];

    const todayHasHard = today.sessions.some(s => s.intensity === 'hard');
    const tomorrowHasHard = tomorrow.sessions.some(s => s.intensity === 'hard');

    if (todayHasHard && tomorrowHasHard) {
      warnings.push({
        date: tomorrow.date,
        message: `Back-to-back hard sessions on ${today.dayLabel} and ${tomorrow.dayLabel} — consider adding recovery time.`,
        suggestion: `Move the ${tomorrow.dayLabel} session to allow 48h recovery.`,
      });
    }
  }

  // Check for days flagged with conflicts in the schedule
  for (const day of days) {
    if (day.hasConflict && day.sessions.length > 1) {
      warnings.push({
        date: day.date,
        message: `${day.dayLabel} has ${day.sessions.length} sessions that may conflict.`,
        suggestion: 'Consider spreading sessions across the week.',
      });
    }
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Orchestrator response → PlanPreviewState mapping (AMA-1436)
// ---------------------------------------------------------------------------

const SESSION_TYPE_MAP: Record<string, SessionType> = {
  run: 'run',
  strength: 'strength',
  hyrox: 'strength',
  yoga: 'yoga',
  class: 'class',
  cycling: 'run',
  swimming: 'run',
  mobility: 'yoga',
  recovery: 'rest',
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  run: 'Run',
  strength: 'Strength',
  hyrox: 'HYROX',
  yoga: 'Yoga',
  class: 'Class',
  cycling: 'Cycling',
  swimming: 'Swimming',
  mobility: 'Mobility',
  recovery: 'Recovery',
};

function formatSessionTitle(type: string, durationMin: number): string {
  const label = SESSION_TYPE_LABELS[type] ?? type;
  return `${label} — ${durationMin}min`;
}

function mapOrchestratorPlanToPreview(
  toolResults: Record<string, unknown>[],
): PlanPreviewState | null {
  const plannerResult = toolResults.find(
    (r: any) => r.tool === 'planner' && r.status === 'success',
  );
  if (!plannerResult) return null;

  const data = plannerResult.data as any;
  const sessions: any[] = data.sessions ?? data.proposed_sessions ?? [];
  const movedSessions: any[] = data.moved_sessions ?? [];

  if (sessions.length === 0 && movedSessions.length === 0) return null;

  const proposals: ProposedSession[] = [];

  // Map new sessions
  for (const s of sessions) {
    const sessionDate = new Date(s.date + 'T00:00:00');
    const dayIndex = (sessionDate.getDay() + 6) % 7; // Sun=0 → Mon=0

    proposals.push({
      id: crypto.randomUUID(),
      session: {
        id: crypto.randomUUID(),
        title: formatSessionTitle(s.type, s.duration_min),
        type: SESSION_TYPE_MAP[s.type] ?? 'strength',
        source: 'amakaflow',
        duration: s.duration_min,
        intensity: s.intensity as Intensity,
        status: 'planned',
        locked: false,
        rationale: s.rationale,
      },
      kind: 'new',
      rationale: s.rationale ?? '',
      toDayIndex: dayIndex,
    });
  }

  // Map moved sessions
  for (const m of movedSessions) {
    const toDate = new Date(m.to_date + 'T00:00:00');
    const fromDate = new Date(m.from_date + 'T00:00:00');
    const toDayIndex = (toDate.getDay() + 6) % 7;
    const fromDayIndex = (fromDate.getDay() + 6) % 7;

    proposals.push({
      id: m.id ?? crypto.randomUUID(),
      session: {
        id: m.id,
        title: 'Moved Session',
        type: 'strength',
        source: 'amakaflow',
        duration: 60,
        intensity: 'moderate',
        status: 'planned',
        locked: false,
        rationale: m.rationale,
      },
      kind: 'moved',
      rationale: m.rationale ?? '',
      fromDayIndex,
      toDayIndex,
    });
  }

  // Build summary
  const totalMinutes = sessions.reduce(
    (sum: number, s: any) => sum + (s.duration_min ?? 0),
    0,
  );
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const hardDays = sessions.filter((s: any) => s.intensity === 'hard').length;

  const summary: PlanSummaryData = {
    added: sessions.length,
    moved: movedSessions.length,
    removed: 0,
    totalWeeklyVolume: `${hours}h ${mins}min`,
    hardDaysUsed: hardDays,
    hardDaysCap: 3,
    warnings: data.violations ?? [],
  };

  return { active: true, proposals, summary };
}

const emptyPreview: PlanPreviewState = {
  active: false,
  proposals: [],
  summary: { added: 0, moved: 0, removed: 0, totalWeeklyVolume: '0h', hardDaysUsed: 0, hardDaysCap: 4, warnings: [] },
};

export function useWeekState() {
  const [weekState, setWeekState] = useState<WeekState>(getMockWeekState);
  const [viewLayer, setViewLayer] = useState<ViewLayer>('planned');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // --- Plan preview state (AMA-1128) ---
  const [planPreview, setPlanPreview] = useState<PlanPreviewState>(emptyPreview);

  const moveSession = useCallback(
    (sessionId: string, fromDayIndex: number, toDayIndex: number) => {
      setWeekState(prev => {
        const newDays = prev.days.map(d => ({
          ...d,
          sessions: [...d.sessions],
        }));

        const fromDay = newDays[fromDayIndex];
        const sessionIndex = fromDay.sessions.findIndex(s => s.id === sessionId);
        if (sessionIndex === -1) return prev;

        const [session] = fromDay.sessions.splice(sessionIndex, 1);
        newDays[toDayIndex].sessions.push(session);

        newDays.forEach(d => {
          d.hasConflict = d.sessions.length > 1 && d.sessions.some(s => s.hasConflict);
        });

        return { ...prev, days: newDays };
      });
    },
    [],
  );

  const toggleExpand = useCallback((sessionId: string) => {
    setExpandedSessionId(prev => (prev === sessionId ? null : sessionId));
  }, []);

  const toggleViewLayer = useCallback(() => {
    setViewLayer(prev => (prev === 'planned' ? 'actuals' : 'planned'));
  }, []);

  // Generate now shows the preview overlay instead of immediately applying
  const generateWeek = useCallback(async () => {
    setIsGenerating(true);
    try {
      const { sendMessage } = await import('../../../api/clients/orchestrator');
      const result = await sendMessage('Plan my week', 'web');
      if (result && result.tool_results?.length > 0) {
        const preview = mapOrchestratorPlanToPreview(result.tool_results);
        if (preview) {
          setPlanPreview(preview);
        } else {
          setPlanPreview(getMockPlanPreview());
        }
      } else {
        // Orchestrator returned advice/no tools — fall back to mock
        setPlanPreview(getMockPlanPreview());
      }
    } catch {
      // Orchestrator unavailable — fall back to mock preview
      setPlanPreview(getMockPlanPreview());
    }
    setIsGenerating(false);
  }, []);

  // --- Preview actions (AMA-1128) ---

  /** Apply the proposed plan: merge proposals into weekState */
  const applyPlan = useCallback(() => {
    setWeekState(prev => {
      const newDays = prev.days.map(d => ({
        ...d,
        sessions: [...d.sessions],
      }));

      for (const p of planPreview.proposals) {
        if (p.kind === 'new') {
          newDays[p.toDayIndex].sessions.push(p.session);
        } else if (p.kind === 'moved' && p.fromDayIndex !== undefined) {
          // Remove from old day
          const fromDay = newDays[p.fromDayIndex];
          fromDay.sessions = fromDay.sessions.filter(s => s.id !== p.session.id);
          // Add to new day
          newDays[p.toDayIndex].sessions.push(p.session);
        } else if (p.kind === 'removed') {
          // Remove session from its day
          newDays[p.toDayIndex].sessions = newDays[p.toDayIndex].sessions.filter(
            s => s.id !== p.session.id,
          );
        }
      }

      const allSessions = newDays.flatMap(d => d.sessions);
      return {
        ...prev,
        days: newDays,
        generated: true,
        conflicts: detectConflicts(newDays),
        completedCount: allSessions.filter(s => s.status === 'completed').length,
        totalPlanned: allSessions.filter(s => s.status !== 'missed').length,
      };
    });

    setPlanPreview(emptyPreview);
  }, [planPreview]);

  /** Cancel the preview without applying */
  const cancelPlan = useCallback(() => {
    setPlanPreview(emptyPreview);
  }, []);

  /** Placeholder: open an adjust UI (for now just logs) */
  const adjustPlan = useCallback(() => {
    // Future: open advanced editing modal
    console.log('[AMA-1128] Adjust plan clicked — advanced editing TBD');
  }, []);

  /** Edit duration of a proposed session */
  const updateProposalDuration = useCallback((id: string, newDuration: number) => {
    setPlanPreview(prev => ({
      ...prev,
      proposals: prev.proposals.map(p =>
        p.id === id
          ? { ...p, session: { ...p.session, duration: newDuration } }
          : p,
      ),
    }));
  }, []);

  /** Edit intensity of a proposed session */
  const updateProposalIntensity = useCallback((id: string, newIntensity: Intensity) => {
    setPlanPreview(prev => ({
      ...prev,
      proposals: prev.proposals.map(p =>
        p.id === id
          ? { ...p, session: { ...p.session, intensity: newIntensity } }
          : p,
      ),
    }));
  }, []);

  const dismissMissedSession = useCallback((sessionId: string) => {
    setWeekState(prev => ({
      ...prev,
      days: prev.days.map(d => ({
        ...d,
        sessions: d.sessions.filter(s => s.id !== sessionId),
      })),
    }));
  }, []);

  return {
    weekState,
    viewLayer,
    expandedSessionId,
    isGenerating,
    moveSession,
    toggleExpand,
    toggleViewLayer,
    setViewLayer,
    generateWeek,
    dismissMissedSession,
    // AMA-1128 plan preview
    planPreview,
    applyPlan,
    cancelPlan,
    adjustPlan,
    updateProposalDuration,
    updateProposalIntensity,
  };
}
