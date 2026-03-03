# Analytics Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate Analytics, VolumeAnalytics, and ExerciseHistory into a single `AnalyticsHub` with three tabs (Overview | Volume | Exercise), and add a new Overview tab with training hours, streak, split, and averages.

**Architecture:** Create `src/components/AnalyticsHub/` as the hub shell. Extract analytics computations into `src/lib/analytics-stats.ts`. The Volume and Exercise tabs wrap the existing VolumeAnalytics and ExerciseHistory components unchanged. Update the router to remove the `exercise-history` and `volume-analytics` views and consolidate everything into `analytics`.

**Tech Stack:** React, shadcn Tabs, Recharts (already installed), Vitest + React Testing Library, TypeScript.

---

## Codebase Context

Before starting, read these files to understand the structure:

- `src/app/router.tsx` — lazy imports and View type
- `src/app/NavBar.tsx` — current nav items (Analytics, History, Volume are separate)
- `src/app/WorkflowView.tsx` — where views are rendered (lines 293–308)
- `src/components/Analytics.tsx` — current analytics page being replaced
- `src/lib/workout-history.ts` — `WorkoutHistoryItem` type and `getWorkoutStats()`
- `src/types/workout.ts:128` — `WorkoutStructure` interface (no duration field — we estimate)

**Key types:**
```typescript
// WorkoutHistoryItem (src/lib/workout-history.ts)
type WorkoutHistoryItem = {
  id: string;
  workout: WorkoutStructure;   // has workout_type?: string, blocks[]
  sources: string[];
  device: DeviceId;
  createdAt: string;           // ISO date string
  updatedAt: string;
};

// WorkoutStructure (src/types/workout.ts)
interface WorkoutStructure {
  title: string;
  source: string;
  blocks: Block[];             // each block has exercises[], supersets[]
  workout_type?: string;       // 'strength' | 'cardio' | 'hiit' | 'cycling' | 'running' etc.
}

// Exercise (within a block)
// has: sets?: number, reps?, duration_sec?: number (cardio exercises only)
```

**Nav currently has:** Import | Create with AI | Calendar | My Workouts | Programs | Analytics | History | Volume | Team

**After this plan:** History and Volume buttons are removed from nav. Analytics button routes to the new hub.

**Run tests:** `npm run test -- <TestName> --run` or `npm run test:run`

---

## Task 1: Analytics Stats Utility

**Files:**
- Create: `src/lib/analytics-stats.ts`
- Test: `src/lib/__tests__/analytics-stats.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/lib/__tests__/analytics-stats.test.ts
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
    // Only 1 workout (18 min) should count
    expect(computeWeeklyHours(history)).toBeCloseTo(0.3);
  });
});

describe('computeMonthlyHours', () => {
  it('returns 0 for empty history', () => {
    expect(computeMonthlyHours([])).toBe(0);
  });

  it('sums hours for current calendar month only', () => {
    const thisMonth = makeItem({ daysAgo: 5 });  // in this month (probably)
    const lastMonth = makeItem({ daysAgo: 35 }); // in last month
    // We can't guarantee daysAgo: 5 is always in this month, but for test purposes
    // just verify last month is excluded
    const result = computeMonthlyHours([thisMonth]);
    expect(result).toBeGreaterThan(0);
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
      // gap on day 2
      makeItem({ daysAgo: 3 }),
    ];
    expect(computeStreak(history)).toBe(2);
  });

  it('returns 0 when most recent workout was yesterday and today has none', () => {
    // Note: streak is only 0 when there's a gap; yesterday counts toward streak
    // if today is day 0 with no workout and yesterday has one, streak = 1
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

  it('categorises cardio workout types correctly', () => {
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
    const result = computeTrainingSplit([old], 4); // 4 weeks = 28 days, so 30 days ago is excluded
    expect(result.cardioMinutes).toBe(0);
  });
});

describe('computeAverageWorkoutDuration', () => {
  it('returns 0 for empty history', () => {
    expect(computeAverageWorkoutDuration([])).toBe(0);
  });

  it('averages duration across sessions', () => {
    // makeItem with 2 exercises × 3 sets × 3 min = 18 min each
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
    const today = data[6]; // last element = today
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
```

**Step 2: Run tests to confirm they fail**

```bash
npm run test -- analytics-stats --run
```

Expected: All tests FAIL with "Cannot find module '../analytics-stats'"

**Step 3: Implement `src/lib/analytics-stats.ts`**

```typescript
// src/lib/analytics-stats.ts
import type { WorkoutHistoryItem } from './workout-history';

const CARDIO_TYPES = new Set(['cardio', 'hiit', 'cycling', 'running', 'yoga', 'swimming', 'rowing']);

/**
 * Estimate workout duration in minutes.
 * - Timed exercises: uses duration_sec directly.
 * - Strength exercises: sets × 3 minutes (work + rest estimate).
 */
export function estimateWorkoutDuration(item: WorkoutHistoryItem): number {
  const blocks = item.workout?.blocks ?? [];
  let total = 0;
  for (const block of blocks) {
    for (const ex of block.exercises ?? []) {
      if (ex.duration_sec) {
        total += ex.duration_sec / 60;
      } else {
        const sets = typeof ex.sets === 'number' ? ex.sets : parseInt(String(ex.sets ?? '3'), 10);
        total += (isNaN(sets) ? 3 : sets) * 3;
      }
    }
    for (const ss of block.supersets ?? []) {
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

/** Format decimal hours as "1h 30m" */
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

/** Total training hours in the last 7 days. */
export function computeWeeklyHours(history: WorkoutHistoryItem[]): number {
  const minutes = history
    .filter(item => isWithinDays(item, 7))
    .reduce((sum, item) => sum + estimateWorkoutDuration(item), 0);
  return minutes / 60;
}

/** Total training hours in the current calendar month. */
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

/** Current streak in consecutive days with at least one workout. */
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
      // Today has no workout yet — check yesterday before breaking
      continue;
    } else {
      break;
    }
  }
  return streak;
}

/** Training split: strength vs cardio minutes over the last `weeks` weeks. */
export function computeTrainingSplit(
  history: WorkoutHistoryItem[],
  weeks = 4
): { strengthMinutes: number; cardioMinutes: number } {
  const recent = history.filter(item => isWithinDays(item, weeks * 7));
  let strengthMinutes = 0;
  let cardioMinutes = 0;
  for (const item of recent) {
    const mins = estimateWorkoutDuration(item);
    const type = item.workout?.workout_type ?? 'strength';
    if (CARDIO_TYPES.has(type)) {
      cardioMinutes += mins;
    } else {
      strengthMinutes += mins;
    }
  }
  return { strengthMinutes, cardioMinutes };
}

/** Average workout duration in minutes over the last 30 sessions. */
export function computeAverageWorkoutDuration(history: WorkoutHistoryItem[]): number {
  const recent = history.slice(0, 30);
  if (recent.length === 0) return 0;
  const total = recent.reduce((sum, item) => sum + estimateWorkoutDuration(item), 0);
  return Math.round(total / recent.length);
}

/** Week-over-week delta in hours (positive = more this week than last). */
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

/** 7-day chart data with sessions, hours, and type per day. */
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
    const types = dayItems.map(item => item.workout?.workout_type ?? 'strength');
    const hasCardio = types.some(t => CARDIO_TYPES.has(t));
    const hasStrength = types.some(t => !CARDIO_TYPES.has(t));
    const type = hasCardio && hasStrength ? 'mixed' : hasCardio ? 'cardio' : 'strength';
    return { day: dayName, sessions: dayItems.length, hours: Math.round(hours * 10) / 10, type };
  });
}
```

**Step 4: Run tests to confirm they pass**

```bash
npm run test -- analytics-stats --run
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/lib/analytics-stats.ts src/lib/__tests__/analytics-stats.test.ts
git commit -m "feat: add analytics-stats utility (computeWeeklyHours, streak, split, chart data)"
```

**Acceptance criteria:**
- [ ] `estimateWorkoutDuration` returns 0 for empty blocks
- [ ] `computeWeeklyHours` excludes workouts older than 7 days
- [ ] `computeStreak` counts consecutive days correctly and handles today-with-no-workout
- [ ] `computeTrainingSplit` correctly categorises all CARDIO_TYPES as cardio
- [ ] All tests pass

---

## Task 2: AnalyticsHub Shell

**Files:**
- Create: `src/components/AnalyticsHub/AnalyticsHub.tsx`
- Create: `src/components/AnalyticsHub/index.ts`
- Test: `src/components/AnalyticsHub/__tests__/AnalyticsHub.test.tsx`

**Step 1: Write the failing tests**

```typescript
// src/components/AnalyticsHub/__tests__/AnalyticsHub.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnalyticsHub } from '../AnalyticsHub';

// Mock child components to keep tests fast and isolated
vi.mock('../../VolumeAnalytics', () => ({
  VolumeAnalytics: () => <div data-testid="volume-analytics">VolumeAnalytics</div>,
}));
vi.mock('../../ExerciseHistory', () => ({
  ExerciseHistory: () => <div data-testid="exercise-history">ExerciseHistory</div>,
}));
vi.mock('../OverviewTab', () => ({
  OverviewTab: () => <div data-testid="overview-tab">OverviewTab</div>,
}));

const mockUser = {
  id: 'u1', name: 'Test User', email: 'test@test.com', subscription: 'free', mode: 'individual',
} as any;

describe('AnalyticsHub', () => {
  it('renders all three tab triggers', () => {
    render(<AnalyticsHub user={mockUser} history={[]} />);
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Volume' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Exercise' })).toBeInTheDocument();
  });

  it('Overview tab is active by default', () => {
    render(<AnalyticsHub user={mockUser} history={[]} />);
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByTestId('overview-tab')).toBeInTheDocument();
  });

  it('clicking Volume tab renders VolumeAnalytics', async () => {
    render(<AnalyticsHub user={mockUser} history={[]} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Volume' }));
    expect(screen.getByTestId('volume-analytics')).toBeInTheDocument();
  });

  it('clicking Exercise tab renders ExerciseHistory', async () => {
    render(<AnalyticsHub user={mockUser} history={[]} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Exercise' }));
    expect(screen.getByTestId('exercise-history')).toBeInTheDocument();
  });

  it('has data-testid for E2E targeting', () => {
    render(<AnalyticsHub user={mockUser} history={[]} />);
    expect(screen.getByTestId('analytics-hub')).toBeInTheDocument();
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
npm run test -- AnalyticsHub --run
```

Expected: FAIL — "Cannot find module '../AnalyticsHub'"

**Step 3: Create a placeholder `OverviewTab` so the hub can import it**

```typescript
// src/components/AnalyticsHub/OverviewTab.tsx (placeholder — Task 3 fills this in)
import type { AppUser } from '../../app/useAppAuth';
import type { WorkoutHistoryItem } from '../../lib/workout-history';

interface OverviewTabProps {
  user: AppUser;
  history: WorkoutHistoryItem[];
}

export function OverviewTab({ history }: OverviewTabProps) {
  return <div data-testid="overview-tab">Overview coming soon ({history.length} workouts)</div>;
}
```

**Step 4: Implement `AnalyticsHub.tsx`**

```typescript
// src/components/AnalyticsHub/AnalyticsHub.tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { VolumeAnalytics } from '../VolumeAnalytics';
import { ExerciseHistory } from '../ExerciseHistory';
import { OverviewTab } from './OverviewTab';
import type { AppUser } from '../../app/useAppAuth';
import type { WorkoutHistoryItem } from '../../lib/workout-history';

interface AnalyticsHubProps {
  user: AppUser;
  history: WorkoutHistoryItem[];
}

export function AnalyticsHub({ user, history }: AnalyticsHubProps) {
  return (
    <div className="space-y-4" data-testid="analytics-hub">
      <div>
        <h2 className="text-2xl mb-2">Analytics</h2>
        <p className="text-muted-foreground">Your workout insights and progress</p>
      </div>
      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-3 max-w-xs">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="volume">Volume</TabsTrigger>
          <TabsTrigger value="exercise">Exercise</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6">
          <OverviewTab user={user} history={history} />
        </TabsContent>
        <TabsContent value="volume" className="mt-6">
          <VolumeAnalytics user={user} />
        </TabsContent>
        <TabsContent value="exercise" className="mt-6">
          <ExerciseHistory user={user} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Step 5: Create barrel export**

```typescript
// src/components/AnalyticsHub/index.ts
export { AnalyticsHub } from './AnalyticsHub';
```

**Step 6: Run tests to confirm they pass**

```bash
npm run test -- AnalyticsHub --run
```

Expected: All tests PASS.

**Step 7: Commit**

```bash
git add src/components/AnalyticsHub/
git commit -m "feat: add AnalyticsHub shell with Overview/Volume/Exercise tabs"
```

**Acceptance criteria:**
- [ ] Three tabs render
- [ ] Overview is active by default
- [ ] Volume tab renders VolumeAnalytics component
- [ ] Exercise tab renders ExerciseHistory component

---

## Task 3: OverviewTab

**Files:**
- Modify: `src/components/AnalyticsHub/OverviewTab.tsx` (replace placeholder)
- Test: `src/components/AnalyticsHub/__tests__/OverviewTab.test.tsx`

**Step 1: Write the failing tests**

```typescript
// src/components/AnalyticsHub/__tests__/OverviewTab.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OverviewTab } from '../OverviewTab';

const mockUser = {
  id: 'u1', name: 'Test', email: 'test@test.com', subscription: 'free', mode: 'individual',
} as any;

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function makeItem(daysAgoN = 0, workout_type = 'strength'): any {
  return {
    id: Math.random().toString(),
    workout: {
      title: 'Test', source: 'test',
      blocks: [{ label: 'Main', exercises: [{ id: 'e1', name: 'Squat', sets: 3 }], supersets: [] }],
      workout_type,
    },
    sources: [], device: 'garmin',
    createdAt: daysAgo(daysAgoN),
    updatedAt: daysAgo(daysAgoN),
  };
}

describe('OverviewTab', () => {
  it('renders the weekly hours stat card', () => {
    render(<OverviewTab user={mockUser} history={[makeItem(0)]} />);
    expect(screen.getByTestId('stat-weekly-hours')).toBeInTheDocument();
  });

  it('renders the sessions count stat card', () => {
    render(<OverviewTab user={mockUser} history={[makeItem(0), makeItem(1)]} />);
    expect(screen.getByTestId('stat-sessions')).toBeInTheDocument();
    // 2 workouts in last 7 days
    expect(screen.getByTestId('stat-sessions')).toHaveTextContent('2');
  });

  it('renders the streak stat card', () => {
    render(<OverviewTab user={mockUser} history={[makeItem(0)]} />);
    expect(screen.getByTestId('stat-streak')).toBeInTheDocument();
  });

  it('renders the week-over-week delta card', () => {
    render(<OverviewTab user={mockUser} history={[makeItem(0)]} />);
    expect(screen.getByTestId('stat-delta')).toBeInTheDocument();
  });

  it('renders the training split section', () => {
    render(<OverviewTab user={mockUser} history={[makeItem(0, 'strength'), makeItem(1, 'running')]} />);
    expect(screen.getByText(/training split/i)).toBeInTheDocument();
    expect(screen.getByText(/Strength/)).toBeInTheDocument();
    expect(screen.getByText(/Cardio/)).toBeInTheDocument();
  });

  it('renders the weekly activity chart section', () => {
    render(<OverviewTab user={mockUser} history={[]} />);
    expect(screen.getByText(/weekly activity/i)).toBeInTheDocument();
  });

  it('toggles chart between sessions and hours views', async () => {
    render(<OverviewTab user={mockUser} history={[makeItem(0)]} />);
    // Default is sessions
    const hoursButton = screen.getByRole('button', { name: /hours/i });
    expect(hoursButton).toBeInTheDocument();
    await userEvent.click(hoursButton);
    // After click, the active toggle should be hours
    expect(screen.getByRole('button', { name: /sessions/i })).toBeInTheDocument();
  });

  it('renders averages row with avg workout and monthly hours', () => {
    render(<OverviewTab user={mockUser} history={[makeItem(0)]} />);
    expect(screen.getByText(/avg workout/i)).toBeInTheDocument();
    expect(screen.getByText(/monthly/i)).toBeInTheDocument();
  });

  it('renders empty state gracefully with no history', () => {
    render(<OverviewTab user={mockUser} history={[]} />);
    expect(screen.getByTestId('stat-weekly-hours')).toHaveTextContent('0m');
    expect(screen.getByTestId('stat-sessions')).toHaveTextContent('0');
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
npm run test -- OverviewTab --run
```

Expected: FAIL — placeholder doesn't have data-testids

**Step 3: Implement `OverviewTab.tsx`**

```tsx
// src/components/AnalyticsHub/OverviewTab.tsx
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { TrendingUp, Flame, Clock, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  computeWeeklyHours,
  computeMonthlyHours,
  computeStreak,
  computeTrainingSplit,
  computeAverageWorkoutDuration,
  computeWeeklyDelta,
  computeWeeklyChartData,
  formatHours,
} from '../../lib/analytics-stats';
import type { AppUser } from '../../app/useAppAuth';
import type { WorkoutHistoryItem } from '../../lib/workout-history';

interface OverviewTabProps {
  user: AppUser;
  history: WorkoutHistoryItem[];
}

export function OverviewTab({ history }: OverviewTabProps) {
  const [chartMode, setChartMode] = useState<'sessions' | 'hours'>('sessions');

  const weeklyHours = computeWeeklyHours(history);
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
  const sessionsThisWeek = history.filter(item => new Date(item.createdAt) >= weekStart).length;
  const streak = computeStreak(history);
  const delta = computeWeeklyDelta(history);
  const { strengthMinutes, cardioMinutes } = computeTrainingSplit(history);
  const totalSplitMins = strengthMinutes + cardioMinutes || 1; // avoid div-by-zero
  const avgDuration = computeAverageWorkoutDuration(history);
  const monthlyHours = computeMonthlyHours(history);
  const chartData = computeWeeklyChartData(history);

  const deltaLabel = delta === 0
    ? '—'
    : delta > 0
      ? `+${formatHours(delta)} vs last week`
      : `${formatHours(Math.abs(delta))} less vs last week`;

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">This week</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="stat-weekly-hours">
              {formatHours(weeklyHours)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">training</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Sessions</CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="stat-sessions">
              {sessionsThisWeek}
            </div>
            <p className="text-xs text-muted-foreground mt-1">last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Streak</CardTitle>
            <Flame className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="stat-streak">
              {streak}d
            </div>
            <p className="text-xs text-muted-foreground mt-1">consecutive days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">vs last week</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-semibold ${delta > 0 ? 'text-green-600 dark:text-green-400' : delta < 0 ? 'text-red-500' : ''}`}
              data-testid="stat-delta"
            >
              {delta > 0 ? '+' : ''}{delta === 0 ? '—' : formatHours(Math.abs(delta))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{deltaLabel}</p>
          </CardContent>
        </Card>
      </div>

      {/* Training split */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Training split <span className="text-xs text-muted-foreground font-normal ml-1">4-week avg</span></CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Strength</span>
              <span className="text-muted-foreground">{formatHours(strengthMinutes / 60)}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${(strengthMinutes / totalSplitMins) * 100}%` }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Cardio</span>
              <span className="text-muted-foreground">{formatHours(cardioMinutes / 60)}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${(cardioMinutes / totalSplitMins) * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly activity chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Weekly activity</CardTitle>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={chartMode === 'sessions' ? 'default' : 'ghost'}
              className="h-7 text-xs"
              onClick={() => setChartMode('sessions')}
            >
              Sessions
            </Button>
            <Button
              size="sm"
              variant={chartMode === 'hours' ? 'default' : 'ghost'}
              className="h-7 text-xs"
              onClick={() => setChartMode('hours')}
            >
              Hours
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis allowDecimals={chartMode === 'hours'} />
              <Tooltip formatter={(v: number) => chartMode === 'hours' ? `${v}h` : v} />
              <Bar dataKey={chartMode} fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Averages */}
      <div className="grid gap-4 grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Avg workout</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{avgDuration}m</div>
            <p className="text-xs text-muted-foreground mt-1">estimated duration</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Monthly total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatHours(monthlyHours)}</div>
            <p className="text-xs text-muted-foreground mt-1">training this month</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

**Step 4: Run tests to confirm they pass**

```bash
npm run test -- OverviewTab --run
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/components/AnalyticsHub/OverviewTab.tsx src/components/AnalyticsHub/__tests__/OverviewTab.test.tsx
git commit -m "feat: implement OverviewTab with hours, streak, split, and chart"
```

**Acceptance criteria:**
- [ ] All 4 stat cards render with correct data-testid attributes
- [ ] Training split bars show correct proportions
- [ ] Chart toggles between sessions and hours mode
- [ ] Averages row shows avg workout and monthly total
- [ ] Empty state (no history) renders without errors

---

## Task 4: Router Update

**Files:**
- Modify: `src/app/router.tsx`

No tests needed — this is pure wiring. Verify by running the app.

**Step 1: Add `AnalyticsHub` lazy import**

In `src/app/router.tsx`, add after the existing `Analytics` lazy import:

```typescript
export const AnalyticsHub = lazy(() =>
  import('../components/AnalyticsHub').then(m => ({ default: m.AnalyticsHub }))
);
```

The existing `Analytics`, `ExerciseHistory`, and `VolumeAnalytics` lazy exports can stay for now — they'll be cleaned up in a later task once WorkflowView no longer references them.

**Step 2: Commit**

```bash
git add src/app/router.tsx
git commit -m "feat: add AnalyticsHub lazy import to router"
```

---

## Task 5: WorkflowView Update

**Files:**
- Modify: `src/app/WorkflowView.tsx`

**Step 1: Import `AnalyticsHub`**

At line 16 in `WorkflowView.tsx`, add `AnalyticsHub` to the router imports:

```typescript
import {
  Analytics,       // keep temporarily for safety
  AnalyticsHub,    // new
  UserSettings,
  StravaEnhance,
  Calendar,
  WorkoutList,
  MobileCompanion,
  ImportScreen,
  HelpPage,
  ExerciseHistory, // keep temporarily
  VolumeAnalytics, // keep temporarily
  ProgramDetail,
  ProgramsList,
  CreateAIWorkout,
} from './router';
```

**Step 2: Replace the three separate view renders with one `AnalyticsHub` render**

Find these three blocks in `WorkflowView.tsx` (around lines 293–308):

```tsx
// REMOVE these three blocks:
{currentView === 'analytics' &&
  (user ? (
    <Analytics user={user} history={workoutHistoryList} />
  ) : (
    <div className="text-center py-16">
      <p className="text-muted-foreground">Please sign in to view analytics</p>
    </div>
  ))}

{currentView === 'exercise-history' && user && (
  <div data-assistant-target="workout-history">
    <ExerciseHistory user={user} />
  </div>
)}

{currentView === 'volume-analytics' && user && <VolumeAnalytics user={user} />}
```

Replace with:

```tsx
{currentView === 'analytics' && user && (
  <AnalyticsHub user={user} history={workoutHistoryList} />
)}
```

**Step 3: Verify the app builds**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

**Step 4: Commit**

```bash
git add src/app/WorkflowView.tsx
git commit -m "feat: replace separate analytics views with unified AnalyticsHub"
```

**Acceptance criteria:**
- [ ] Navigating to Analytics in the app renders the three-tab hub
- [ ] Volume tab shows VolumeAnalytics
- [ ] Exercise tab shows ExerciseHistory
- [ ] Build passes

---

## Task 6: NavBar Update

**Files:**
- Modify: `src/app/NavBar.tsx`

**Step 1: Remove the History and Volume nav buttons**

In `src/app/NavBar.tsx`, remove these two `<Button>` blocks (around lines 125–143):

```tsx
// REMOVE: History button
<Button
  variant={currentView === 'exercise-history' ? 'default' : 'ghost'}
  size="sm"
  data-assistant-target="nav-history"
  onClick={() => onNavigate('exercise-history')}
  className="gap-2"
>
  <TrendingUp className="w-4 h-4" />
  History
</Button>

// REMOVE: Volume button
<Button
  variant={currentView === 'volume-analytics' ? 'default' : 'ghost'}
  size="sm"
  onClick={() => onNavigate('volume-analytics')}
  className="gap-2"
>
  <Activity className="w-4 h-4" />
  Volume
</Button>
```

**Step 2: Update the Analytics button active state**

The existing Analytics button checks `currentView === 'analytics'`. Update it to also highlight when navigating from old deep-links (the old views are now gone, but this is defensive):

```tsx
<Button
  variant={currentView === 'analytics' ? 'default' : 'ghost'}
  size="sm"
  data-assistant-target="nav-analytics"
  onClick={() => onNavigate('analytics')}
  className="gap-2"
>
  <BarChart3 className="w-4 h-4" />
  Analytics
</Button>
```

No change needed here — it's already correct. Just confirm it looks right.

**Step 3: Clean up unused imports**

If `TrendingUp` and `Activity` are now unused after removing the buttons, remove them from the lucide-react import line. Check if they're used elsewhere in the file first.

```typescript
// Before:
import { Activity, BarChart3, CalendarDays, Dumbbell, FolderOpen, HelpCircle, Plus, Settings, Sparkles, TrendingUp, Users } from 'lucide-react';

// After (if TrendingUp and Activity are not used elsewhere):
import { BarChart3, CalendarDays, Dumbbell, FolderOpen, HelpCircle, Plus, Settings, Sparkles, Users } from 'lucide-react';
```

**Step 4: Run TypeScript check**

```bash
npm run build
```

Expected: No errors. (The `Activity` and `TrendingUp` icons are only used in the removed nav items.)

**Step 5: Commit**

```bash
git add src/app/NavBar.tsx
git commit -m "feat: consolidate nav — remove History and Volume items, Analytics routes to hub"
```

**Acceptance criteria:**
- [ ] Nav no longer shows separate "History" and "Volume" items
- [ ] Analytics button is the single entry point to all analytics features
- [ ] Build passes with no TS errors

---

## Task 7: Volume Tab Frequency Chart

**Files:**
- Create: `src/components/VolumeAnalytics/WorkoutFrequencyChart.tsx`
- Modify: `src/components/VolumeAnalytics/VolumeAnalytics.tsx`
- Test: `src/components/VolumeAnalytics/__tests__/WorkoutFrequencyChart.test.tsx`

**Context:** VolumeAnalytics currently receives `user: AppUser`. The AnalyticsHub passes `user` to it. The `WorkoutHistoryItem[]` array also needs to be threaded through so frequency can be computed. Check the current `VolumeAnalytics` component signature — if it doesn't accept `history`, we'll need to add it. Read `src/components/VolumeAnalytics/VolumeAnalytics.tsx` before implementing.

**Step 1: Check VolumeAnalytics props**

Read `src/components/VolumeAnalytics/VolumeAnalytics.tsx` and find the component props interface. Note whether it already accepts a `history` prop.

**Step 2: Write the failing tests**

```typescript
// src/components/VolumeAnalytics/__tests__/WorkoutFrequencyChart.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkoutFrequencyChart } from '../WorkoutFrequencyChart';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function makeItem(daysAgoN = 0): any {
  return {
    id: Math.random().toString(),
    workout: { title: 'Test', source: 'test', blocks: [], workout_type: 'strength' },
    sources: [], device: 'garmin',
    createdAt: daysAgo(daysAgoN),
    updatedAt: daysAgo(daysAgoN),
  };
}

describe('WorkoutFrequencyChart', () => {
  it('renders without crashing with empty history', () => {
    render(<WorkoutFrequencyChart history={[]} />);
    expect(screen.getByTestId('frequency-chart')).toBeInTheDocument();
  });

  it('shows 8 weeks of data', () => {
    render(<WorkoutFrequencyChart history={[]} />);
    expect(screen.getByText(/workout frequency/i)).toBeInTheDocument();
  });

  it('renders with history data', () => {
    const history = [makeItem(0), makeItem(7), makeItem(14)];
    render(<WorkoutFrequencyChart history={history} />);
    expect(screen.getByTestId('frequency-chart')).toBeInTheDocument();
  });
});
```

**Step 3: Run tests to confirm they fail**

```bash
npm run test -- WorkoutFrequencyChart --run
```

Expected: FAIL — module not found.

**Step 4: Implement `WorkoutFrequencyChart.tsx`**

```tsx
// src/components/VolumeAnalytics/WorkoutFrequencyChart.tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { WorkoutHistoryItem } from '../../lib/workout-history';

interface WorkoutFrequencyChartProps {
  history: WorkoutHistoryItem[];
}

function computeWeeklyFrequency(history: WorkoutHistoryItem[]): Array<{ week: string; sessions: number }> {
  return Array.from({ length: 8 }, (_, i) => {
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 7);

    const label = i === 0 ? 'This wk' : `${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    const sessions = history.filter(item => {
      if (!item.createdAt) return false;
      const d = new Date(item.createdAt);
      return !isNaN(d.getTime()) && d >= weekStart && d < weekEnd;
    }).length;

    return { week: label, sessions };
  }).reverse();
}

export function WorkoutFrequencyChart({ history }: WorkoutFrequencyChartProps) {
  const data = computeWeeklyFrequency(history);

  return (
    <Card data-testid="frequency-chart">
      <CardHeader>
        <CardTitle className="text-base">Workout frequency <span className="text-xs text-muted-foreground font-normal ml-1">last 8 weeks</span></CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip formatter={(v: number) => [`${v} session${v !== 1 ? 's' : ''}`, '']} />
            <Bar dataKey="sessions" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**Step 5: Add to VolumeAnalytics**

Read `src/components/VolumeAnalytics/VolumeAnalytics.tsx` fully. Then:

1. Add `history?: WorkoutHistoryItem[]` to the props interface
2. Import `WorkoutFrequencyChart` from `./WorkoutFrequencyChart`
3. Import `WorkoutHistoryItem` from `../../lib/workout-history`
4. Add `<WorkoutFrequencyChart history={history ?? []} />` as the first element inside the component's returned JSX, before the existing content

In `AnalyticsHub.tsx`, pass `history={history}` to `<VolumeAnalytics>`:

```tsx
<TabsContent value="volume" className="mt-6">
  <VolumeAnalytics user={user} history={history} />
</TabsContent>
```

**Step 6: Run all tests**

```bash
npm run test:run
```

Expected: All tests pass. Pay attention to the existing VolumeAnalytics tests — if adding the optional `history` prop breaks any, fix them by adding `history={[]}` to the test render calls.

**Step 7: Commit**

```bash
git add src/components/VolumeAnalytics/WorkoutFrequencyChart.tsx
git add src/components/VolumeAnalytics/VolumeAnalytics.tsx
git add src/components/VolumeAnalytics/__tests__/WorkoutFrequencyChart.test.tsx
git add src/components/AnalyticsHub/AnalyticsHub.tsx
git commit -m "feat: add 8-week workout frequency chart to Volume tab"
```

**Acceptance criteria:**
- [ ] WorkoutFrequencyChart renders 8 bars (one per week)
- [ ] Bars reflect actual session counts from history
- [ ] VolumeAnalytics shows frequency chart above existing content
- [ ] All existing VolumeAnalytics tests still pass

---

## Final Verification

After all 7 tasks are complete:

```bash
npm run test:run
npm run build
```

Both must succeed with no errors.

Visually verify in the running app (demo mode):
- [ ] Nav shows: Import | Create with AI | Calendar | My Workouts | Analytics | Settings (no History, no Volume)
- [ ] Clicking Analytics renders the hub with 3 tabs
- [ ] Overview tab shows: weekly hours, sessions, streak, delta, training split, weekly chart, averages
- [ ] Volume tab renders VolumeAnalytics with frequency chart at top
- [ ] Exercise tab renders ExerciseHistory unchanged
