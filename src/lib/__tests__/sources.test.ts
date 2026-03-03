import { describe, it, expect } from 'vitest';
import {
  WORKOUT_SOURCES,
  getSourceById,
  getSourceByRawValue,
  type WorkoutSource,
} from '../sources';

describe('WORKOUT_SOURCES registry', () => {
  it('contains exactly 12 sources', () => {
    expect(WORKOUT_SOURCES).toHaveLength(12);
  });

  it('every source has required fields', () => {
    for (const s of WORKOUT_SOURCES) {
      expect(s.id).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.color).toMatch(/^bg-/);
      expect(s.icon).toBeTruthy();
      expect(['device', 'video', 'creation', 'calendar']).toContain(s.category);
      expect(typeof s.requiresConnection).toBe('boolean');
      expect(Array.isArray(s.matchesSources)).toBe(true);
    }
  });

  it('all ids are unique', () => {
    const ids = WORKOUT_SOURCES.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('getSourceById', () => {
  it('returns the source for a known id', () => {
    const src = getSourceById('garmin');
    expect(src?.label).toBe('Garmin');
  });

  it('returns undefined for an unknown id', () => {
    expect(getSourceById('nonexistent')).toBeUndefined();
  });
});

describe('getSourceByRawValue', () => {
  it('finds garmin by raw source value', () => {
    expect(getSourceByRawValue('garmin')?.id).toBe('garmin');
  });

  it('finds ai source by legacy amaka value', () => {
    expect(getSourceByRawValue('amaka')?.id).toBe('ai');
  });

  it('finds manual by gym_class value', () => {
    expect(getSourceByRawValue('gym_class')?.id).toBe('manual');
  });

  it('returns undefined for unknown raw value', () => {
    expect(getSourceByRawValue('demo')).toBeUndefined();
  });
});
