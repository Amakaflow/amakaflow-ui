import type { WorkoutHistoryItem } from './workout-history';

const CARDIO_TYPES = new Set(['cardio', 'hiit', 'cycling', 'running', 'yoga', 'swimming', 'rowing']);

export function estimateWorkoutDuration(item: WorkoutHistoryItem): number {
  const blocks = item.workout?.blocks ?? [];
  let total = 0;
  for (const block of blocks) {
    for (const ex of (block as any).exercises ?? []) {
      if (ex.duration_sec) {
        total += ex.duration_sec / 60;
      } else {
        const sets = typeof ex.sets === 'number' ? ex.sets : parseInt(String(ex.sets ?? '3'), 10);
        total += (isNaN(sets) ? 3 : sets) * 3;
      }
    }
    for (const ss of (block as any).supersets ?? []) {
      for (const ex of ss.exercises ?? []) {
        if (ex.duration_sec) {
          total += ex.duration_sec / 60;
        } else {
          const sets = typeof ex.sets === 'number' ? ex.sets : parseInt(String(ex.sets ?? '3'), 10);
          total += (isNaN(sets) ? 3 : sets) * 3;
        }
      }
    }
  }
  return total;
}

export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0 && m === 0) return '0m';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function isWithinDays(item: WorkoutHistoryItem, days: number): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const d = new Date(item.createdAt);
  return !isNaN(d.getTime()) && d >= cutoff;
}

export function computeWeeklyHours(history: WorkoutHistoryItem[]): number {
  const minutes = history
    .filter(item => isWithinDays(item, 7))
    .reduce((sum, item) => sum + estimateWorkoutDuration(item), 0);
  return minutes / 60;
}

export function computeMonthlyHours(history: WorkoutHistoryItem[]): number {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const minutes = history
    .filter(item => {
      const d = new Date(item.createdAt);
      return !isNaN(d.getTime()) && d >= startOfMonth;
    })
    .reduce((sum, item) => sum + estimateWorkoutDuration(item), 0);
  return minutes / 60;
}

export function computeStreak(history: WorkoutHistoryItem[]): number {
  if (history.length === 0) return 0;
  const workoutDays = new Set(
    history
      .filter(item => !isNaN(new Date(item.createdAt).getTime()))
      .map(item => {
        const d = new Date(item.createdAt);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      })
  );
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const check = new Date(today);
    check.setDate(today.getDate() - i);
    const key = `${check.getFullYear()}-${check.getMonth()}-${check.getDate()}`;
    if (workoutDays.has(key)) {
      streak++;
    } else if (i === 0) {
      continue; // today has no workout yet, check yesterday
    } else {
      break;
    }
  }
  return streak;
}

export function computeTrainingSplit(
  history: WorkoutHistoryItem[],
  weeks = 4
): { strengthMinutes: number; cardioMinutes: number } {
  const recent = history.filter(item => isWithinDays(item, weeks * 7));
  let strengthMinutes = 0;
  let cardioMinutes = 0;
  for (const item of recent) {
    const mins = estimateWorkoutDuration(item);
    const type = (item.workout as any)?.workout_type ?? 'strength';
    if (CARDIO_TYPES.has(type)) {
      cardioMinutes += mins;
    } else {
      strengthMinutes += mins;
    }
  }
  return { strengthMinutes, cardioMinutes };
}

export function computeAverageWorkoutDuration(history: WorkoutHistoryItem[]): number {
  const recent = history.slice(0, 30);
  if (recent.length === 0) return 0;
  const total = recent.reduce((sum, item) => sum + estimateWorkoutDuration(item), 0);
  return Math.round(total / recent.length);
}

export function computeWeeklyDelta(history: WorkoutHistoryItem[]): number {
  const now = new Date();
  const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
  const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(now.getDate() - 14);
  const thisWeekMins = history
    .filter(item => isWithinDays(item, 7))
    .reduce((s, i) => s + estimateWorkoutDuration(i), 0);
  const lastWeekMins = history
    .filter(item => {
      const d = new Date(item.createdAt);
      return !isNaN(d.getTime()) && d >= twoWeeksAgo && d < weekAgo;
    })
    .reduce((s, i) => s + estimateWorkoutDuration(i), 0);
  return (thisWeekMins - lastWeekMins) / 60;
}

export function computeWeeklyChartData(history: WorkoutHistoryItem[]): Array<{
  day: string;
  sessions: number;
  hours: number;
  type: 'strength' | 'cardio' | 'mixed';
}> {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayItems = history.filter(item => {
      if (!item.createdAt) return false;
      const d = new Date(item.createdAt);
      return !isNaN(d.getTime()) && d.toDateString() === date.toDateString();
    });
    const hours = dayItems.reduce((s, item) => s + estimateWorkoutDuration(item), 0) / 60;
    const types = dayItems.map(item => (item.workout as any)?.workout_type ?? 'strength');
    const hasCardio = types.some(t => CARDIO_TYPES.has(t));
    const hasStrength = types.some(t => !CARDIO_TYPES.has(t));
    const type = hasCardio && hasStrength ? 'mixed' : hasCardio ? 'cardio' : 'strength';
    return { day: dayName, sessions: dayItems.length, hours: Math.round(hours * 10) / 10, type };
  });
}
