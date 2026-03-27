import { useMemo } from 'react';
import { WORKOUT_SOURCES, type WorkoutSource } from '../lib/sources';
import { useConnectedCalendars } from './useCalendarApi';
import { isDemoMode } from '../lib/demo-mode';

export interface WorkoutSourceStatus extends WorkoutSource {
  isConnected: boolean;
  connectionId?: string;   // set for connected calendar instances
  workoutCount?: number;
}

// Demo connection state — realistic counts for the demo user
const DEMO_CONNECTED_IDS = new Set([
  'garmin', 'strava', 'apple', 'youtube', 'instagram', 'ai', 'manual',
]);
const DEMO_COUNTS: Record<string, number> = {
  garmin: 3,
  strava: 2,
  apple: 1,
  youtube: 1,
  instagram: 1,
  ai: 2,
  manual: 1,
};
const DEMO_CONNECTED_CALENDARS = [
  { registryId: 'runna', label: 'Runna – Subscribed', connectionId: 'demo-runna-1', workoutCount: 3 },
  { registryId: 'apple-calendar', label: 'Apple Calendar', connectionId: 'demo-apple-cal-1', workoutCount: 3 },
];

interface UseWorkoutSourcesProps {
  userId: string;
}

export interface UseWorkoutSourcesResult {
  sources: WorkoutSourceStatus[];
  /** True once all async data (connected calendars) has loaded. Consumers should
   *  defer one-time seeding until ready is true. */
  ready: boolean;
}

export function useWorkoutSources({ userId }: UseWorkoutSourcesProps): UseWorkoutSourcesResult {
  const { calendars: connectedCalendars } = useConnectedCalendars({ userId });

  return useMemo(() => {
    const baseSources = WORKOUT_SOURCES.filter(s => s.category !== 'calendar');

    if (isDemoMode) {
      const base: WorkoutSourceStatus[] = baseSources.map(s => ({
        ...s,
        isConnected: DEMO_CONNECTED_IDS.has(s.id),
        workoutCount: DEMO_COUNTS[s.id],
      }));

      const calendarEntries: WorkoutSourceStatus[] = DEMO_CONNECTED_CALENDARS.map(c => {
        const registryEntry = WORKOUT_SOURCES.find(s => s.id === c.registryId);
        if (!registryEntry) return null;
        return {
          ...registryEntry,
          label: c.label,
          isConnected: true,
          connectionId: c.connectionId,
          workoutCount: c.workoutCount,
        };
      }).filter((e): e is WorkoutSourceStatus => e !== null);

      return { sources: [...base, ...calendarEntries], ready: true };
    }

    // Real mode: base sources (non-calendar)
    const base: WorkoutSourceStatus[] = baseSources.map(s => ({
      ...s,
      isConnected: !s.requiresConnection,
    }));

    // Real mode: one entry per connected calendar instance
    const calendarEntries: WorkoutSourceStatus[] = (connectedCalendars || [])
      .filter(cal => cal.is_workout_calendar)
      .map(cal => {
        const calType = cal.type as string;
        const registryId =
          calType === 'runna' ? 'runna' :
          calType === 'apple' ? 'apple-calendar' :
          calType === 'google' ? 'google-calendar' :
          null;
        if (!registryId) return null;
        const registryEntry = WORKOUT_SOURCES.find(s => s.id === registryId);
        if (!registryEntry) return null;
        return {
          ...registryEntry,
          label: cal.name,
          isConnected: true,
          connectionId: cal.id,
        };
      }).filter((e): e is WorkoutSourceStatus => e !== null);

    return {
      sources: [...base, ...calendarEntries],
      // Ready once the API has responded (undefined = still loading)
      ready: connectedCalendars !== undefined,
    };
  }, [connectedCalendars]);
}
