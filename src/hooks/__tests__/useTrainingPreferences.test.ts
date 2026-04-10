import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useTrainingPreferences,
  DEFAULT_PREFERENCES,
  VOLUME_PRESET_RANGES,
  GOAL_RACE_LABELS,
  DAY_LABELS,
  ALL_DAYS,
} from '../useTrainingPreferences';

describe('useTrainingPreferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default preferences when no stored data', () => {
    const { result } = renderHook(() => useTrainingPreferences());
    expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
    expect(result.current.isDirty).toBe(false);
  });

  it('loads stored preferences from localStorage', () => {
    const stored = { ...DEFAULT_PREFERENCES, weeklyVolumePreset: 'high' as const };
    localStorage.setItem('amakaflow-training-preferences', JSON.stringify(stored));

    const { result } = renderHook(() => useTrainingPreferences());
    expect(result.current.preferences.weeklyVolumePreset).toBe('high');
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('amakaflow-training-preferences', 'not-json');
    const { result } = renderHook(() => useTrainingPreferences());
    expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
  });

  it('updatePreference changes a single field and marks dirty', () => {
    const { result } = renderHook(() => useTrainingPreferences());

    act(() => {
      result.current.updatePreference('hardDaysPerWeek', 4);
    });

    expect(result.current.preferences.hardDaysPerWeek).toBe(4);
    expect(result.current.isDirty).toBe(true);
  });

  it('clears goalRaceDate when goalRace set to none', () => {
    localStorage.setItem('amakaflow-training-preferences', JSON.stringify({
      ...DEFAULT_PREFERENCES,
      goalRace: 'marathon',
      goalRaceDate: '2026-10-15',
    }));

    const { result } = renderHook(() => useTrainingPreferences());
    expect(result.current.preferences.goalRaceDate).toBe('2026-10-15');

    act(() => {
      result.current.updatePreference('goalRace', 'none');
    });

    expect(result.current.preferences.goalRace).toBe('none');
    expect(result.current.preferences.goalRaceDate).toBeNull();
  });

  it('toggleRunDay adds and removes days', () => {
    const { result } = renderHook(() => useTrainingPreferences());
    const initialDays = [...result.current.preferences.preferredRunDays];

    // Remove an existing day
    act(() => {
      result.current.toggleRunDay('tue');
    });
    expect(result.current.preferences.preferredRunDays).not.toContain('tue');

    // Add it back
    act(() => {
      result.current.toggleRunDay('tue');
    });
    expect(result.current.preferences.preferredRunDays).toContain('tue');
  });

  it('resetToDefaults restores defaults and clears dirty', () => {
    const { result } = renderHook(() => useTrainingPreferences());

    act(() => {
      result.current.updatePreference('hardDaysPerWeek', 4);
    });
    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.resetToDefaults();
    });

    expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
    expect(result.current.isDirty).toBe(false);
  });

  it('persists changes to localStorage', () => {
    const { result } = renderHook(() => useTrainingPreferences());

    act(() => {
      result.current.updatePreference('maxSessionLengthMinutes', 120);
    });

    const stored = JSON.parse(localStorage.getItem('amakaflow-training-preferences')!);
    expect(stored.maxSessionLengthMinutes).toBe(120);
  });
});

describe('constants', () => {
  it('VOLUME_PRESET_RANGES has all non-custom presets', () => {
    expect(VOLUME_PRESET_RANGES).toHaveProperty('low');
    expect(VOLUME_PRESET_RANGES).toHaveProperty('moderate');
    expect(VOLUME_PRESET_RANGES).toHaveProperty('high');
  });

  it('GOAL_RACE_LABELS has all races', () => {
    expect(Object.keys(GOAL_RACE_LABELS)).toHaveLength(6);
    expect(GOAL_RACE_LABELS.marathon).toBe('Marathon');
    expect(GOAL_RACE_LABELS.none).toBe('None');
  });

  it('ALL_DAYS has 7 days', () => {
    expect(ALL_DAYS).toHaveLength(7);
    expect(DAY_LABELS.mon).toBe('Mon');
  });
});
