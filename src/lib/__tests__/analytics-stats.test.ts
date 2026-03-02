import { describe, it, expect } from 'vitest';
import {
  estimateWorkoutDuration,
  formatHours,
  computeWeeklyHours,
  computeMonthlyHours,
  computeStreak,
  computeTrainingSplit,
  computeAverageWorkoutDuration,
  computeWeeklyDelta,
  computeWeeklyChartData,
} from '../analytics-stats';
import type { WorkoutHistoryItem } from '../workout-history';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function makeItem(opts: {
  daysAgo?: number;
  workout_type?: string;
  exercises?: Array<{ sets?: number; duration_sec?: number }>;
} = {}): WorkoutHistoryItem {
  const date = new Date();
  date.setDate(date.getDate() - (opts.daysAgo ?? 0));
  return {
    id: Math.random().toString(),
    workout: {
      title: 'Test',
      source: 'test',
      blocks: [{
        label: 'Main',
        exercises: (opts.exercises ?? [{ sets: 3 }, { sets: 3 }]).map((e, i) => ({
          id: `ex-${i}`,
          name: `Exercise ${i}`,
          sets: e.sets,
          duration_sec: e.duration_sec,
        })),
        supersets: [],
      }],
      workout_type: opts.workout_type ?? 'strength',
    } as any,
    sources: [],
    device: 'garmin',
    createdAt: date.toISOString(),
    updatedAt: date.toISOString(),
  };
}

describe('estimateWorkoutDuration', () => {
  it('returns 0 for workout with no blocks', () => {
    const item = makeItem();
    item.workout.blocks = [];
    expect(estimateWorkoutDuration(item)).toBe(0);
  });

  it('estimates 3 min per set for strength exercises', () => {
    // 2 exercises × 3 sets × 3 min = 18 min
    const item = makeItem({ exercises: [{ sets: 3 }, { sets: 3 }] });
    expect(estimateWorkoutDuration(item)).toBe(18);
  });

  it('uses duration_sec for timed exercises', () => {
    // 1 exercise with 600s = 10 min
    const item = makeItem({ exercises: [{ duration_sec: 600 }] });
    expect(estimateWorkoutDuration(item)).toBe(10);
  });

  it('defaults to 3 sets when sets is undefined', () => {
    // 1 exercise, sets undefined → 3 sets × 3 min = 9 min
    const item = makeItem({ exercises: [{}] });
    expect(estimateWorkoutDuration(item)).toBe(9);
  });
});

describe('formatHours', () => {
  it('formats whole hours', () => expect(formatHours(2)).toBe('2h'));
  it('formats minutes only when < 1 hour', () => expect(formatHours(0.5)).toBe('30m'));
  it('formats hours and minutes', () => expect(formatHours(1.5)).toBe('1h 30m'));
  it('formats 0 as 0m', () => expect(formatHours(0)).toBe('0m'));
});

describe('computeWeeklyHours', () => {
  it('returns 0 for empty history', () => {
    expect(computeWeeklyHours([])).toBe(0);
  });

  it('sums hours from workouts in the last 7 days', () => {
    // 2 workouts × 18 min each = 36 min = 0.6 hours
    const history = [makeItem({ daysAgo: 0 }), makeItem({ daysAgo: 3 })];
    expect(computeWeeklyHours(history)).toBeCloseTo(0.6);
  });

  it('excludes workouts older than 7 days', () => {
    const history = [makeItem({ daysAgo: 0 }), makeItem({ daysAgo: 8 })];
    expect(computeWeeklyHours(history)).toBeCloseTo(0.3);
  });
});

describe('computeMonthlyHours', () => {
  it('returns 0 for empty history', () => {
    expect(computeMonthlyHours([])).toBe(0);
  });

  it('sums hours for current calendar month only', () => {
    const thisMonth = makeItem({ daysAgo: 0 });
    const lastMonth = makeItem({ daysAgo: 35 });
    expect(computeMonthlyHours([thisMonth])).toBeCloseTo(0.3); // 2 exercises × 3 sets × 3 min = 18 min = 0.3h
    expect(computeMonthlyHours([lastMonth])).toBe(0);
  });
});

describe('computeStreak', () => {
  it('returns 0 for empty history', () => {
    expect(computeStreak([])).toBe(0);
  });

  it('returns 1 for a single workout today', () => {
    expect(computeStreak([makeItem({ daysAgo: 0 })])).toBe(1);
  });

  it('counts consecutive days', () => {
    const history = [
      makeItem({ daysAgo: 0 }),
      makeItem({ daysAgo: 1 }),
      makeItem({ daysAgo: 2 }),
    ];
    expect(computeStreak(history)).toBe(3);
  });

  it('stops at a gap', () => {
    const history = [
      makeItem({ daysAgo: 0 }),
      makeItem({ daysAgo: 1 }),
      makeItem({ daysAgo: 3 }),
    ];
    expect(computeStreak(history)).toBe(2);
  });

  it('counts yesterday as streak when today has no workout', () => {
    const history = [makeItem({ daysAgo: 1 })];
    expect(computeStreak(history)).toBe(1);
  });
});

describe('computeTrainingSplit', () => {
  it('returns zero for empty history', () => {
    const result = computeTrainingSplit([]);
    expect(result.strengthMinutes).toBe(0);
    expect(result.cardioMinutes).toBe(0);
  });

  it('categorises strength workouts correctly', () => {
    const history = [makeItem({ daysAgo: 0, workout_type: 'strength' })];
    const { strengthMinutes, cardioMinutes } = computeTrainingSplit(history);
    expect(strengthMinutes).toBeGreaterThan(0);
    expect(cardioMinutes).toBe(0);
  });

  it('categorises all cardio workout types correctly', () => {
    const cardioTypes = ['cardio', 'hiit', 'running', 'cycling', 'yoga'];
    for (const type of cardioTypes) {
      const history = [makeItem({ daysAgo: 0, workout_type: type })];
      const { cardioMinutes, strengthMinutes } = computeTrainingSplit(history);
      expect(cardioMinutes).toBeGreaterThan(0);
      expect(strengthMinutes).toBe(0);
    }
  });

  it('excludes workouts older than the specified weeks', () => {
    const old = makeItem({ daysAgo: 30, workout_type: 'cardio' });
    const result = computeTrainingSplit([old], 4);
    expect(result.cardioMinutes).toBe(0);
  });
});

describe('computeAverageWorkoutDuration', () => {
  it('returns 0 for empty history', () => {
    expect(computeAverageWorkoutDuration([])).toBe(0);
  });

  it('averages duration across sessions', () => {
    const history = [makeItem(), makeItem()];
    expect(computeAverageWorkoutDuration(history)).toBe(18);
  });
});

describe('computeWeeklyDelta', () => {
  it('returns 0 for empty history', () => {
    expect(computeWeeklyDelta([])).toBe(0);
  });

  it('returns positive when this week has more hours than last', () => {
    const thisWeek = [makeItem({ daysAgo: 0 }), makeItem({ daysAgo: 1 })];
    const lastWeek = [makeItem({ daysAgo: 8 })];
    expect(computeWeeklyDelta([...thisWeek, ...lastWeek])).toBeGreaterThan(0);
  });
});

describe('computeWeeklyChartData', () => {
  it('returns 7 data points', () => {
    expect(computeWeeklyChartData([])).toHaveLength(7);
  });

  it('counts sessions per day', () => {
    const history = [makeItem({ daysAgo: 0 }), makeItem({ daysAgo: 0 })];
    const data = computeWeeklyChartData(history);
    const today = data[6];
    expect(today.sessions).toBe(2);
  });

  it('sets type to cardio when all workouts that day are cardio', () => {
    const history = [makeItem({ daysAgo: 0, workout_type: 'running' })];
    const data = computeWeeklyChartData(history);
    expect(data[6].type).toBe('cardio');
  });

  it('sets type to mixed when both types exist on same day', () => {
    const history = [
      makeItem({ daysAgo: 0, workout_type: 'strength' }),
      makeItem({ daysAgo: 0, workout_type: 'running' }),
    ];
    const data = computeWeeklyChartData(history);
    expect(data[6].type).toBe('mixed');
  });
});
