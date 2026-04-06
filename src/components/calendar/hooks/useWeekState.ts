import { useState, useCallback } from 'react';
import type { WeekState, PlanPreviewState, Intensity } from '../types';
import { getMockWeekState, getGeneratedWeekState, getMockPlanPreview } from '../mockData';

export type ViewLayer = 'planned' | 'actuals';

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
      // Try orchestrator first
      const { sendMessage } = await import('../../../api/clients/orchestrator');
      const result = await sendMessage('Plan my week', 'web');
      if (result && result.tool_results?.length > 0) {
        // Orchestrator returned real plan — use it
        // For now, still show mock preview since we need to map the response format
        // TODO: Map orchestrator plan response to PlanPreviewState
        setPlanPreview(getMockPlanPreview());
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
