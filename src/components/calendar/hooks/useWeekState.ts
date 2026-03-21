import { useState, useCallback } from 'react';
import type { WeekState } from '../types';
import { getMockWeekState, getGeneratedWeekState } from '../mockData';

export type ViewLayer = 'planned' | 'actuals';

export function useWeekState() {
  const [weekState, setWeekState] = useState<WeekState>(getMockWeekState);
  const [viewLayer, setViewLayer] = useState<ViewLayer>('planned');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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

  const generateWeek = useCallback(async () => {
    setIsGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 1200));
    setWeekState(getGeneratedWeekState());
    setIsGenerating(false);
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
  };
}
