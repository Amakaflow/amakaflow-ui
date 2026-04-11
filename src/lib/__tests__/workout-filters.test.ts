import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FILTERS,
  hasActiveFilters,
  countActiveFilters,
  getDateRangeLabel,
  getSyncStatusLabel,
  matchesFavoritesOnly,
  matchesTags,
  matchesCreator,
  extractCreators,
  extractTags,
} from '../workout-filters';
import type { UnifiedWorkout } from '../../types/unified-workout';

function makeWorkout(overrides: Partial<UnifiedWorkout> = {}): UnifiedWorkout {
  return {
    id: 'w1',
    title: 'Test Workout',
    source_type: 'manual',
    category: 'strength',
    created_at: '2026-04-10T00:00:00Z',
    exercises: [],
    isFavorite: false,
    tags: [],
    ...overrides,
  } as UnifiedWorkout;
}

describe('hasActiveFilters', () => {
  it('returns false for default filters', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
  });

  it('returns true when search is set', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, search: 'bench' })).toBe(true);
  });

  it('returns true when sourceTypes is non-empty', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, sourceTypes: ['video'] })).toBe(true);
  });

  it('returns true when dateRange is not all', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, dateRange: 'week' })).toBe(true);
  });

  it('returns true when syncStatus is not all', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, syncStatus: 'synced' })).toBe(true);
  });
});

describe('countActiveFilters', () => {
  it('returns 0 for default filters', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
  });

  it('counts each active filter', () => {
    const filters = {
      ...DEFAULT_FILTERS,
      search: 'bench',
      sourceTypes: ['video' as const],
      dateRange: 'week' as const,
    };
    expect(countActiveFilters(filters)).toBeGreaterThanOrEqual(2);
  });
});

describe('getDateRangeLabel', () => {
  it('returns correct labels', () => {
    expect(getDateRangeLabel('today')).toBe('Today');
    expect(getDateRangeLabel('week')).toBe('This Week');
    expect(getDateRangeLabel('month')).toBe('This Month');
    expect(getDateRangeLabel('all')).toBe('All Time');
  });
});

describe('getSyncStatusLabel', () => {
  it('returns correct labels', () => {
    expect(getSyncStatusLabel('all')).toBe('All');
    expect(getSyncStatusLabel('synced')).toBe('Synced');
    expect(getSyncStatusLabel('not-synced')).toBe('Not Synced');
  });
});

describe('matchesFavoritesOnly', () => {
  it('returns true for any workout when favoritesOnly is false', () => {
    expect(matchesFavoritesOnly(makeWorkout({ isFavorite: false }), false)).toBe(true);
  });

  it('returns true for favorite when favoritesOnly is true', () => {
    expect(matchesFavoritesOnly(makeWorkout({ isFavorite: true }), true)).toBe(true);
  });

  it('returns false for non-favorite when favoritesOnly is true', () => {
    expect(matchesFavoritesOnly(makeWorkout({ isFavorite: false }), true)).toBe(false);
  });
});

describe('matchesTags', () => {
  it('returns true when no tags filter', () => {
    expect(matchesTags(makeWorkout(), [])).toBe(true);
  });

  it('returns true when workout has matching tag', () => {
    expect(matchesTags(makeWorkout({ tags: ['upper', 'push'] }), ['upper'])).toBe(true);
  });

  it('returns false when workout has no matching tags', () => {
    expect(matchesTags(makeWorkout({ tags: ['lower'] }), ['upper'])).toBe(false);
  });
});

describe('matchesCreator', () => {
  it('returns true when no creators filter', () => {
    expect(matchesCreator(makeWorkout(), [])).toBe(true);
  });
});

describe('extractCreators', () => {
  it('returns unique creators', () => {
    const workouts = [
      makeWorkout({ creator: 'Alice' } as any),
      makeWorkout({ creator: 'Bob' } as any),
      makeWorkout({ creator: 'Alice' } as any),
    ];
    const creators = extractCreators(workouts);
    expect(creators.length).toBeLessThanOrEqual(3);
  });

  it('returns empty array for no workouts', () => {
    expect(extractCreators([])).toEqual([]);
  });
});

describe('extractTags', () => {
  it('returns unique tags', () => {
    const workouts = [
      makeWorkout({ tags: ['upper', 'push'] }),
      makeWorkout({ tags: ['lower', 'push'] }),
    ];
    const tags = extractTags(workouts);
    expect(tags).toContain('push');
    expect(tags).toContain('upper');
    expect(tags).toContain('lower');
  });

  it('returns empty array for no workouts', () => {
    expect(extractTags([])).toEqual([]);
  });
});
