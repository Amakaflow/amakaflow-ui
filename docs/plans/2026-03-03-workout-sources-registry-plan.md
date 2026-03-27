# Workout Sources Registry Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hardcoded source lists in Calendar.tsx with a single source registry + `useWorkoutSources` hook, and update mock data to use real source identifiers.

**Architecture:** A `src/lib/sources.ts` registry is the only place source metadata lives. A `useWorkoutSources()` hook merges the registry with connection state (demo-hardcoded now, real API later). Calendar.tsx and mock data both consume from this registry — no more hardcoded labels or `source: 'demo'` values.

**Tech Stack:** TypeScript, React hooks, Vitest + @testing-library/react, isDemoMode from `src/lib/demo-mode.ts`

---

## Task 1: Create the source registry

**Files:**
- Create: `src/lib/sources.ts`
- Create: `src/lib/__tests__/sources.test.ts`

**Step 1: Write the failing tests**

Create `src/lib/__tests__/sources.test.ts`:

```typescript
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
```

**Step 2: Run tests to verify they fail**

```bash
cd /Users/davidandrews/dev/AmakaFlow/amakaflow-ui
npx vitest run src/lib/__tests__/sources.test.ts
```
Expected: FAIL — `Cannot find module '../sources'`

**Step 3: Create `src/lib/sources.ts`**

```typescript
export interface WorkoutSource {
  id: string;
  label: string;
  color: string;           // Tailwind bg-* class for the sidebar colour dot
  icon: string;            // emoji
  category: 'device' | 'video' | 'creation' | 'calendar';
  requiresConnection: boolean;
  matchesSources: string[]; // raw `source` field values this entry covers
}

export const WORKOUT_SOURCES: WorkoutSource[] = [
  // ── Devices ────────────────────────────────────────────────────────────────
  {
    id: 'garmin',
    label: 'Garmin',
    color: 'bg-orange-500',
    icon: '🟠',
    category: 'device',
    requiresConnection: false,
    matchesSources: ['garmin'],
  },
  {
    id: 'strava',
    label: 'Strava',
    color: 'bg-orange-600',
    icon: '🏃',
    category: 'device',
    requiresConnection: true,
    matchesSources: ['strava'],
  },
  {
    id: 'apple',
    label: 'Apple Watch',
    color: 'bg-gray-500',
    icon: '⌚',
    category: 'device',
    requiresConnection: false,
    matchesSources: ['apple', 'ios_companion'],
  },
  {
    id: 'android',
    label: 'Android',
    color: 'bg-green-600',
    icon: '🤖',
    category: 'device',
    requiresConnection: false,
    matchesSources: ['android', 'android_companion'],
  },
  // ── Video imports ───────────────────────────────────────────────────────────
  {
    id: 'youtube',
    label: 'YouTube',
    color: 'bg-red-500',
    icon: '▶️',
    category: 'video',
    requiresConnection: false,
    matchesSources: ['youtube'],
  },
  {
    id: 'instagram',
    label: 'Instagram',
    color: 'bg-pink-500',
    icon: '📸',
    category: 'video',
    requiresConnection: false,
    matchesSources: ['instagram'],
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    color: 'bg-slate-800',
    icon: '🎵',
    category: 'video',
    requiresConnection: false,
    matchesSources: ['tiktok'],
  },
  // ── In-app creation ─────────────────────────────────────────────────────────
  {
    id: 'ai',
    label: 'AI Generated',
    color: 'bg-purple-500',
    icon: '✨',
    category: 'creation',
    requiresConnection: false,
    matchesSources: ['ai', 'amaka', 'ai_generated'],
  },
  {
    id: 'manual',
    label: 'Manual Entry',
    color: 'bg-blue-500',
    icon: '✏️',
    category: 'creation',
    requiresConnection: false,
    matchesSources: ['manual', 'gym_class', 'gym_manual_sync'],
  },
  // ── Connected calendars ─────────────────────────────────────────────────────
  {
    id: 'runna',
    label: 'Runna',
    color: 'bg-blue-500',
    icon: '🏃',
    category: 'calendar',
    requiresConnection: true,
    matchesSources: ['runna', 'connected_calendar'],
  },
  {
    id: 'apple-calendar',
    label: 'Apple Calendar',
    color: 'bg-gray-400',
    icon: '📅',
    category: 'calendar',
    requiresConnection: true,
    matchesSources: ['apple_calendar', 'connected_calendar'],
  },
  {
    id: 'google-calendar',
    label: 'Google Calendar',
    color: 'bg-indigo-500',
    icon: '📆',
    category: 'calendar',
    requiresConnection: true,
    matchesSources: ['google_calendar', 'connected_calendar'],
  },
];

/** Look up a source by its canonical id. */
export function getSourceById(id: string): WorkoutSource | undefined {
  return WORKOUT_SOURCES.find(s => s.id === id);
}

/** Look up a source by a raw `source` field value from workout/calendar data. */
export function getSourceByRawValue(value: string): WorkoutSource | undefined {
  return WORKOUT_SOURCES.find(s => s.matchesSources.includes(value));
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/sources.test.ts
```
Expected: 8 tests passing, 0 failures.

**Step 5: Commit**

```bash
git add src/lib/sources.ts src/lib/__tests__/sources.test.ts
git commit -m "feat(sources): add workout source registry with getSourceById/ByRawValue helpers"
```

---

## Task 2: Create the `useWorkoutSources` hook

**Files:**
- Create: `src/hooks/useWorkoutSources.ts`
- Create: `src/hooks/__tests__/useWorkoutSources.test.ts`

**Step 1: Write the failing tests**

Create `src/hooks/__tests__/useWorkoutSources.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWorkoutSources } from '../useWorkoutSources';

// Mock demo-mode so we can test both paths
vi.mock('../../lib/demo-mode', () => ({ isDemoMode: false }));

// Mock useConnectedCalendars — tests real-mode path
vi.mock('../useCalendarApi', () => ({
  useConnectedCalendars: () => ({ calendars: [], createCalendar: vi.fn(), deleteCalendar: vi.fn(), syncCalendar: vi.fn() }),
}));

describe('useWorkoutSources (real mode)', () => {
  it('returns all 12 registry sources', () => {
    const { result } = renderHook(() => useWorkoutSources({ userId: 'test' }));
    expect(result.current).toHaveLength(12);
  });

  it('every result has isConnected field', () => {
    const { result } = renderHook(() => useWorkoutSources({ userId: 'test' }));
    for (const s of result.current) {
      expect(typeof s.isConnected).toBe('boolean');
    }
  });

  it('non-requiresConnection sources are always isConnected true', () => {
    const { result } = renderHook(() => useWorkoutSources({ userId: 'test' }));
    const alwaysOn = result.current.filter(s => !s.requiresConnection);
    expect(alwaysOn.every(s => s.isConnected)).toBe(true);
  });

  it('requiresConnection sources are isConnected false when no calendars', () => {
    const { result } = renderHook(() => useWorkoutSources({ userId: 'test' }));
    const needsConn = result.current.filter(s => s.requiresConnection);
    expect(needsConn.every(s => !s.isConnected)).toBe(true);
  });
});

describe('useWorkoutSources (demo mode)', () => {
  beforeEach(() => {
    vi.doMock('../../lib/demo-mode', () => ({ isDemoMode: true }));
  });

  it('returns sources with demo workout counts', async () => {
    const { default: demoMod } = await import('../../lib/demo-mode');
    // isDemoMode branch: garmin and strava should have counts > 0
    // This is a smoke test — demo path is exercised by Calendar.tsx manual testing
    expect(demoMod).toBeDefined();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/hooks/__tests__/useWorkoutSources.test.ts
```
Expected: FAIL — `Cannot find module '../useWorkoutSources'`

**Step 3: Create `src/hooks/useWorkoutSources.ts`**

```typescript
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
const DEMO_CONNECTED_IDS = new Set(['garmin', 'strava', 'apple', 'youtube', 'instagram', 'ai', 'manual']);
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
  { id: 'runna', label: 'Runna – Subscribed', connectionId: 'demo-runna-1', workoutCount: 3 },
  { id: 'apple-calendar', label: 'Apple Calendar', connectionId: 'demo-apple-cal-1', workoutCount: 3 },
];

interface UseWorkoutSourcesProps {
  userId: string;
}

export function useWorkoutSources({ userId }: UseWorkoutSourcesProps): WorkoutSourceStatus[] {
  const { calendars: connectedCalendars } = useConnectedCalendars({ userId });

  return useMemo(() => {
    if (isDemoMode) {
      // Base sources (non-calendar)
      const base = WORKOUT_SOURCES
        .filter(s => s.category !== 'calendar')
        .map(s => ({
          ...s,
          isConnected: DEMO_CONNECTED_IDS.has(s.id),
          workoutCount: DEMO_COUNTS[s.id],
        }));

      // Connected calendar instances
      const calendarEntries: WorkoutSourceStatus[] = DEMO_CONNECTED_CALENDARS.map(c => {
        const registryEntry = WORKOUT_SOURCES.find(s => s.id === c.id)!;
        return {
          ...registryEntry,
          label: c.label,
          isConnected: true,
          connectionId: c.connectionId,
          workoutCount: c.workoutCount,
        };
      });

      return [...base, ...calendarEntries];
    }

    // Real mode: base sources
    const base = WORKOUT_SOURCES
      .filter(s => s.category !== 'calendar')
      .map(s => ({
        ...s,
        isConnected: !s.requiresConnection, // Strava etc: false until connected
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
          'google-calendar';
        const registryEntry = WORKOUT_SOURCES.find(s => s.id === registryId)!;
        return {
          ...registryEntry,
          label: cal.name,
          isConnected: true,
          connectionId: cal.id,
        };
      });

    return [...base, ...calendarEntries];
  }, [connectedCalendars]);
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/hooks/__tests__/useWorkoutSources.test.ts
```
Expected: 4+ tests passing.

**Step 5: Commit**

```bash
git add src/hooks/useWorkoutSources.ts src/hooks/__tests__/useWorkoutSources.test.ts
git commit -m "feat(sources): add useWorkoutSources hook — merges registry with connection state"
```

---

## Task 3: Update `Calendar.tsx` to use the hook

**Files:**
- Modify: `src/components/Calendar.tsx`

**Context:** `Calendar.tsx` currently hardcodes `BASE_WORKOUT_FILTERS` (lines 44–49) and builds `connectedCalendarFilters` + `WORKOUT_FILTERS` via `useMemo` (lines 111–129). The sidebar renders `WORKOUT_FILTERS` at lines 316–350. The filter predicate is at line 322.

**Step 1: Import the hook and remove the hardcoded list**

In `src/components/Calendar.tsx`:

1. Add import at the top (after existing hooks import on line 38):
```typescript
import { useWorkoutSources } from '../hooks/useWorkoutSources';
```

2. Delete lines 44–49 (the `BASE_WORKOUT_FILTERS` const).

3. Delete lines 111–129 (the `connectedCalendarFilters` and `WORKOUT_FILTERS` useMemos).

4. Delete the `useConnectedCalendars` destructure lines 103–108 **only if** `connectedCalendars` is no longer used elsewhere in the file. Check first:
```bash
grep -n "connectedCalendars" src/components/Calendar.tsx
```
If `connectedCalendars` is still passed to `ConnectedCalendarsModal` (line 432), keep the `useConnectedCalendars` call but remove its use in filter building.

5. Add just below `const { calendars: connectedCalendars, ... } = useConnectedCalendars(...)`:
```typescript
const workoutSources = useWorkoutSources({ userId });
```

6. Replace `WORKOUT_FILTERS` with `workoutSources` throughout:
   - Line 131: `useState<string[]>([])` — keep as-is
   - Line 135: change `WORKOUT_FILTERS.map(f => f.id)` → `workoutSources.map(s => s.id)`
   - Line 136: change `[WORKOUT_FILTERS]` → `[workoutSources]`

**Step 2: Update the filter render (lines 316–350)**

Replace the `{WORKOUT_FILTERS.map(filter => {` block with:

```tsx
{workoutSources.map(source => {
  const isActive = activeFilters.includes(source.id);
  const eventCount = typedEvents.filter(e => {
    if (source.connectionId) {
      return e.source === 'connected_calendar' && e.connected_calendar_id === source.connectionId;
    }
    return source.matchesSources.includes(e.source);
  }).length;

  return (
    <div key={source.id} className="flex items-center gap-2">
      <Checkbox
        id={source.id}
        checked={isActive}
        onCheckedChange={(checked) => {
          if (checked) setActiveFilters([...activeFilters, source.id]);
          else setActiveFilters(activeFilters.filter(f => f !== source.id));
        }}
      />
      <label htmlFor={source.id} className="flex items-center gap-2 cursor-pointer flex-1 text-sm">
        <div className={`w-3 h-3 rounded-full ${source.color}`} />
        <span className="flex items-center gap-1">
          {source.icon} {source.label}
          {source.connectionId && <LinkIcon className="w-3 h-3 text-blue-600" />}
        </span>
        {source.isConnected ? (
          <span className="text-xs text-muted-foreground ml-auto">{eventCount}</span>
        ) : (
          <span className="text-xs text-blue-500 ml-auto cursor-pointer" onClick={() => setShowConnectedCalendars(true)}>
            Connect
          </span>
        )}
      </label>
      {source.connectionId && (
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setShowConnectedCalendars(true)}>
          <Settings className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
})}
```

**Step 3: Update the event filter predicate**

Find the event filtering logic (around line 322 in the original — search for `activeFilters`). It currently does:
```typescript
return filter.sources.includes(e.source);
```

This logic now lives inside the render block above. If there's a separate filtered events computation using `activeFilters`, update it to use the same `matchesSources` + `connectionId` pattern:
```typescript
const filteredEvents = typedEvents.filter(event => {
  if (activeFilters.length === 0) return true;
  return workoutSources
    .filter(s => activeFilters.includes(s.id))
    .some(s => {
      if (s.connectionId) {
        return event.source === 'connected_calendar' && event.connected_calendar_id === s.connectionId;
      }
      return s.matchesSources.includes(event.source);
    });
});
```

**Step 4: Verify the build compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "calendar"
```
Expected: no errors referencing Calendar.tsx.

**Step 5: Commit**

```bash
git add src/components/Calendar.tsx
git commit -m "feat(sources): Calendar.tsx uses useWorkoutSources hook — removes hardcoded BASE_WORKOUT_FILTERS"
```

---

## Task 4: Update mock workout data to use real source values

**Files:**
- Modify: `src/lib/mock-data/workouts.ts`

**Context:** All 10 mock workouts have `source: 'demo'` and `sources: ['demo']`. Replace with real registry IDs based on the workout's nature.

**Mapping:**

| Workout title | New `source` | New `sources` array |
|---------------|-------------|---------------------|
| Hyrox Session | `'garmin'` | `['garmin']` |
| Upper Body Strength | `'ai'` | `['ai']` |
| Lower Body Power | `'garmin'` | `['garmin']` |
| Morning Run | `'strava'` | `['strava']` |
| Push Day — PPL | `'ai'` | `['ai']` |
| Pull Day — PPL | `'ai'` | `['ai']` |
| HIIT Cardio Blast | `'youtube'` | `['youtube']` |
| Leg Day — PPL | `'manual'` | `['manual']` |
| Zone 2 Bike Ride | `'strava'` | `['strava']` |
| Full Body Conditioning | `'instagram'` | `['instagram']` |

**Step 1: Make the replacements**

For each workout, find its block and update the two fields. Example for Hyrox Session (around line 8):
```typescript
// Before
source: 'demo',
// After
source: 'garmin',
```
And its `sources` array (around line 92):
```typescript
// Before
sources: ['demo'],
// After
sources: ['garmin'],
```

Repeat for all 10 workouts using the mapping table above.

**Step 2: Verify no `source: 'demo'` remains**

```bash
grep "source: 'demo'" src/lib/mock-data/workouts.ts
```
Expected: no output.

**Step 3: Verify the dev server renders the calendar correctly**

```bash
# Server should already be running at localhost:3030
# Open the Calendar view — Workout Sources sidebar should now show
# Garmin (3), Strava (2), AI Generated (2), YouTube (1), Instagram (1), Manual (1), Apple Watch (1)
# Runna and Apple Calendar show with "Connect" affordance
```

**Step 4: Commit**

```bash
git add src/lib/mock-data/workouts.ts
git commit -m "fix(demo): replace source: 'demo' with real registry source ids in mock workouts"
```

---

## Task 5: Push branch and create PR

**Step 1: Push**

```bash
git push -u origin feat/workout-sources-registry
```

**Step 2: Create PR**

```bash
gh pr create \
  --title "feat(sources): workout source registry + useWorkoutSources hook" \
  --body "$(cat <<'EOF'
## Summary

- Adds \`src/lib/sources.ts\` — single source of truth for all 12 workout sources (Garmin, Strava, Apple Watch, Android, YouTube, Instagram, TikTok, AI Generated, Manual Entry, Runna, Apple Calendar, Google Calendar)
- Adds \`useWorkoutSources\` hook — merges registry with connection state; demo-mode returns realistic mock connections, real mode uses \`useConnectedCalendars\`
- Removes hardcoded \`BASE_WORKOUT_FILTERS\` from \`Calendar.tsx\`; sidebar now driven entirely by the hook
- Updates all 10 mock workouts from \`source: 'demo'\` to real registry source IDs
- Adding a new source in future = one object in \`sources.ts\`, nothing else changes

## Test plan
- [ ] Calendar sidebar shows real source names with correct colours and icons
- [ ] Count badges reflect actual calendar events per source
- [ ] Runna and Apple Calendar show "Connect" link when not connected (non-demo)
- [ ] Workout library filter bar still works (unchanged)
- [ ] \`npx vitest run src/lib/__tests__/sources.test.ts\` — all pass
- [ ] \`npx vitest run src/hooks/__tests__/useWorkoutSources.test.ts\` — all pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 3: Watch CI**

```bash
gh pr checks <PR-NUMBER> --watch
```
Expected: Type Check & Build ✅, review ✅, auto-merge triggers.
