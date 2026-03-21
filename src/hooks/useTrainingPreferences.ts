import { useState, useEffect, useCallback } from 'react';

export type WeeklyVolumePreset = 'low' | 'moderate' | 'high' | 'custom';
export type WorkoutTime = 'morning' | 'lunchtime' | 'evening' | 'flexible';
export type GoalRace = 'marathon' | 'half-marathon' | 'hyrox' | '10k' | '5k' | 'none';
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type DeloadInterval = 3 | 4 | 5;

export interface TrainingPreferences {
  weeklyVolumePreset: WeeklyVolumePreset;
  weeklyVolumeCustomHours: number; // only used when preset is 'custom'
  hardDaysPerWeek: number; // 1-4
  maxSessionLengthMinutes: number; // 30-180
  preferredRunDays: DayOfWeek[];
  preferredWorkoutTime: WorkoutTime;
  goalRace: GoalRace;
  goalRaceDate: string | null; // ISO date string
  deloadInterval: DeloadInterval;
}

const STORAGE_KEY = 'amakaflow-training-preferences';

export const DEFAULT_PREFERENCES: TrainingPreferences = {
  weeklyVolumePreset: 'moderate',
  weeklyVolumeCustomHours: 5,
  hardDaysPerWeek: 2,
  maxSessionLengthMinutes: 90,
  preferredRunDays: ['tue', 'thu', 'sat'],
  preferredWorkoutTime: 'morning',
  goalRace: 'none',
  goalRaceDate: null,
  deloadInterval: 4,
};

export const VOLUME_PRESET_RANGES: Record<Exclude<WeeklyVolumePreset, 'custom'>, { min: number; max: number; label: string }> = {
  low: { min: 2, max: 3, label: 'Low (2-3h)' },
  moderate: { min: 4, max: 6, label: 'Moderate (4-6h)' },
  high: { min: 7, max: 10, label: 'High (7-10h)' },
};

export const GOAL_RACE_LABELS: Record<GoalRace, string> = {
  marathon: 'Marathon',
  'half-marathon': 'Half Marathon',
  hyrox: 'HYROX',
  '10k': '10K',
  '5k': '5K',
  none: 'None',
};

export const DAY_LABELS: Record<DayOfWeek, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

export const ALL_DAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function loadPreferences(): TrainingPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_PREFERENCES, ...parsed };
    }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_PREFERENCES;
}

function savePreferencesToStorage(prefs: TrainingPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage errors
  }
}

export function useTrainingPreferences() {
  const [preferences, setPreferencesState] = useState<TrainingPreferences>(loadPreferences);
  const [isDirty, setIsDirty] = useState(false);

  // Persist on change
  useEffect(() => {
    if (isDirty) {
      savePreferencesToStorage(preferences);
    }
  }, [preferences, isDirty]);

  const updatePreference = useCallback(<K extends keyof TrainingPreferences>(
    key: K,
    value: TrainingPreferences[K],
  ) => {
    setPreferencesState(prev => {
      const next = { ...prev, [key]: value };
      // Clear goal race date if goal race is set to none
      if (key === 'goalRace' && value === 'none') {
        next.goalRaceDate = null;
      }
      return next;
    });
    setIsDirty(true);
  }, []);

  const resetToDefaults = useCallback(() => {
    setPreferencesState(DEFAULT_PREFERENCES);
    savePreferencesToStorage(DEFAULT_PREFERENCES);
    setIsDirty(false);
  }, []);

  const toggleRunDay = useCallback((day: DayOfWeek) => {
    setPreferencesState(prev => {
      const days = prev.preferredRunDays.includes(day)
        ? prev.preferredRunDays.filter(d => d !== day)
        : [...prev.preferredRunDays, day];
      return { ...prev, preferredRunDays: days };
    });
    setIsDirty(true);
  }, []);

  return {
    preferences,
    isDirty,
    updatePreference,
    resetToDefaults,
    toggleRunDay,
  };
}
