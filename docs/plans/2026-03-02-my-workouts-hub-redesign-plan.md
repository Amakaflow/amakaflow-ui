# My Workouts Hub Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganise the My Workouts section into a clean 3-tab hub (Library | Programs | History), collapse the nav from 9 to 6 items, replace filter dropdowns with a tag strip, and add "Add to Calendar" everywhere workouts appear.

**Architecture:** Each task is a self-contained PR from a feature branch into `develop`. No task rewrites existing components — they are reorganised and connected. The tab shell wraps existing WorkoutList, ProgramsList, and ActivityHistory components. Tags are auto-generated in the save path and stored via the existing tag API.

**Tech Stack:** React 18, TypeScript, Vitest + React Testing Library, Tailwind, shadcn/ui (Tabs, Badge, Button, ScrollArea). All test commands run from `amakaflow-ui/`.

**Branch strategy:** Every task = its own branch off `develop`. Never commit directly to `develop`.
```
git checkout develop && git pull origin develop
git checkout -b feat/ama-NNN-short-description
```

---

## Task 1: Nav bar — collapse from 9 to 6 items

**Linear ticket:** AMA-TBD
**Branch:** `feat/ama-NNN-nav-collapse`
**Files:**
- Modify: `src/app/NavBar.tsx`
- Modify: `src/app/router.tsx` (remove unused View types)

**What to do:**
Remove these nav buttons: Programs, History (Exercise History), Volume, Team. Keep: Import, Create with AI, Calendar, My Workouts, Analytics, Settings.
Move Team into Settings page (it already renders inside UserSettings — just remove the nav entry).
Remove `'programs'`, `'exercise-history'`, `'volume-analytics'`, `'team'` from the `View` union type only after confirming nothing in `WorkflowView.tsx` breaks — those views will still render but only be reachable from within My Workouts tabs.

**Step 1: Write the failing test**

Create `src/app/__tests__/NavBar.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NavBar } from '../NavBar';

const defaultProps = {
  user: { id: 'u1', name: 'Test User', subscription: 'free' },
  currentView: 'home' as const,
  stravaConnected: false,
  hasClerk: false,
  onNavigate: vi.fn(),
};

describe('NavBar', () => {
  it('renders exactly the 6 primary nav items', () => {
    render(<NavBar {...defaultProps} />);
    expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create with ai/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /calendar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /my workouts/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analytics/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
  });

  it('does NOT render Programs, History, Volume, or Team as top-level nav items', () => {
    render(<NavBar {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /^programs$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^history$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^volume$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^team$/i })).not.toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**
```
npm run test -- NavBar.test --run
```
Expected: FAIL — Programs/History/Volume/Team buttons found in DOM.

**Step 3: Remove the 4 nav buttons from `NavBar.tsx`**
Delete the `<Button>` blocks for Programs, History (TrendingUp), Volume (Activity icon), and Team. Keep Strava Enhance conditional (it's useful). Do not remove their corresponding view handlers from `WorkflowView` — just remove the nav entry.

**Step 4: Run test to verify it passes**
```
npm run test -- NavBar.test --run
```
Expected: PASS — 2 tests passing.

**Step 5: Run existing tests to confirm no regression**
```
npm run test:run
```
Expected: All existing tests pass.

**Step 6: Commit**
```
git add src/app/NavBar.tsx src/app/__tests__/NavBar.test.tsx
git commit -m "feat(nav): collapse nav from 9 to 6 primary items"
```

**Acceptance criteria:**
- [ ] Nav renders exactly 6 items (Import, Create with AI, Calendar, My Workouts, Analytics, Settings)
- [ ] Programs / History / Volume / Team buttons are gone from the top nav
- [ ] All existing tests pass

---

## Task 2: My Workouts — 3-tab shell (Library | Programs | History)

**Linear ticket:** AMA-TBD
**Branch:** `feat/ama-NNN-workouts-tabs`
**Files:**
- Modify: `src/components/Workouts/WorkoutList.tsx` (add Tabs wrapper)
- The existing workout list content becomes the Library tab body
- `ProgramsSection` component moves into the Programs tab
- `ActivityHistory` component moves into the History tab

**What to do:**
Wrap the WorkoutList render output in a shadcn `<Tabs>` with three `<TabsContent>` panels. The Library tab contains everything currently rendered (the workout cards, search, filters, etc.). The Programs tab renders `<ProgramsSection>`. The History tab renders `<ActivityHistory>`.

Remove: the `showActivityHistory` state toggle and its button from the header — that pattern is gone. Remove: the `<ProgramsSection>` embedded mid-page above the workout cards.

**Step 1: Write the failing test**

Create `src/components/Workouts/__tests__/WorkoutList.tabs.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { WorkoutList } from '../WorkoutList';

vi.mock('../../../lib/unified-workouts', () => ({
  fetchAllWorkouts: vi.fn().mockResolvedValue({ workouts: [], errors: [] }),
}));
vi.mock('../../../lib/workout-api', () => ({
  getUserTags: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../lib/completions-api', () => ({
  fetchWorkoutCompletions: vi.fn().mockResolvedValue({ completions: [], total: 0 }),
}));
// Add any other mocks that WorkoutList needs — copy from useWorkoutList.test.ts

const defaultProps = {
  profileId: 'user-1',
  onEditWorkout: vi.fn(),
  onLoadWorkout: vi.fn(),
  onDeleteWorkout: vi.fn(),
};

describe('WorkoutList tabs', () => {
  it('renders Library, Programs, and History tabs', async () => {
    render(<WorkoutList {...defaultProps} />);
    expect(await screen.findByRole('tab', { name: /library/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /programs/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /history/i })).toBeInTheDocument();
  });

  it('Library tab is selected by default', async () => {
    render(<WorkoutList {...defaultProps} />);
    const libraryTab = await screen.findByRole('tab', { name: /library/i });
    expect(libraryTab).toHaveAttribute('aria-selected', 'true');
  });

  it('clicking History tab shows history content', async () => {
    render(<WorkoutList {...defaultProps} />);
    await screen.findByRole('tab', { name: /history/i });
    await userEvent.click(screen.getByRole('tab', { name: /history/i }));
    // ActivityHistory renders a heading or identifiable element
    expect(screen.getByTestId('activity-history')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**
```
npm run test -- WorkoutList.tabs.test --run
```
Expected: FAIL — no tab roles found.

**Step 3: Add Tabs to WorkoutList**

At the top of the return in `WorkoutList.tsx`, after the Delete modal and Header, wrap in:
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';

// In the return, replace the existing content with:
<div className="space-y-4">
  {/* Delete modal stays here — outside tabs */}

  <div className="flex items-center justify-between">
    <h2 className="text-2xl">My Workouts</h2>
  </div>

  <Tabs defaultValue="library">
    <TabsList className="grid w-full grid-cols-3">
      <TabsTrigger value="library">Library</TabsTrigger>
      <TabsTrigger value="programs">Programs</TabsTrigger>
      <TabsTrigger value="history">History</TabsTrigger>
    </TabsList>

    <TabsContent value="library">
      {/* Everything that was previously rendered: search, filters, cards */}
    </TabsContent>

    <TabsContent value="programs">
      <ProgramsSection onViewProgram={onViewProgram} />
    </TabsContent>

    <TabsContent value="history">
      <ActivityHistory
        data-testid="activity-history"
        profileId={profileId}
        completions={completions}
        loading={completionsLoading}
        total={completionsTotal}
        onLoadMore={loadMoreCompletions}
        onSelectCompletion={setSelectedCompletionId}
      />
    </TabsContent>
  </Tabs>
</div>
```

Remove `showActivityHistory` state and its toggle button. Remove the `<ProgramsSection>` that was embedded mid-page.

**Step 4: Ensure ActivityHistory has data-testid**
Add `data-testid="activity-history"` to the root element of `src/components/ActivityHistory.tsx`.

**Step 5: Run tests**
```
npm run test -- WorkoutList.tabs.test --run
npm run test:run
```
Expected: All tests pass.

**Step 6: Commit**
```
git add src/components/Workouts/WorkoutList.tsx src/components/ActivityHistory.tsx src/components/Workouts/__tests__/WorkoutList.tabs.test.tsx
git commit -m "feat(workouts): add Library/Programs/History tab shell"
```

**Acceptance criteria:**
- [ ] Three tabs render: Library, Programs, History
- [ ] Library tab is default
- [ ] Programs tab shows programs (ProgramsSection)
- [ ] History tab shows activity history (ActivityHistory)
- [ ] The `showActivityHistory` toggle button is gone
- [ ] ProgramsSection is no longer embedded mid-page in Library

---

## Task 3: Library tab — replace filter dropdowns with tag strip

**Linear ticket:** AMA-TBD
**Branch:** `feat/ama-NNN-library-tag-strip`
**Files:**
- Modify: `src/components/Workouts/WorkoutList.tsx`
- Modify: `src/components/Workouts/hooks/useWorkoutList.ts`

**What to do:**
Remove the source, platform, category, and sync filter dropdowns from the Library tab header. Replace with a horizontal scrollable tag strip. Tags come from `availableTags` (already fetched via `loadTags`). Clicking a tag sets `tagFilter` (state already exists). Keep search input and sort dropdown.

**Step 1: Write the failing test**

Create `src/components/Workouts/__tests__/WorkoutList.tagstrip.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { WorkoutList } from '../WorkoutList';
import * as workoutApi from '../../../lib/workout-api';

// Same mocks as tabs test
vi.mock('../../../lib/unified-workouts', () => ({
  fetchAllWorkouts: vi.fn().mockResolvedValue({ workouts: [], errors: [] }),
}));
vi.mock('../../../lib/workout-api', () => ({
  getUserTags: vi.fn().mockResolvedValue(['strength', 'upper-body', 'push']),
  toggleWorkoutFavorite: vi.fn(),
  updateWorkoutTags: vi.fn(),
  saveWorkoutToAPI: vi.fn(),
}));
vi.mock('../../../lib/completions-api', () => ({
  fetchWorkoutCompletions: vi.fn().mockResolvedValue({ completions: [], total: 0 }),
}));

const defaultProps = {
  profileId: 'user-1',
  onEditWorkout: vi.fn(),
  onLoadWorkout: vi.fn(),
  onDeleteWorkout: vi.fn(),
};

describe('Library tag strip', () => {
  it('renders All tag and available user tags', async () => {
    render(<WorkoutList {...defaultProps} />);
    expect(await screen.findByRole('button', { name: /^all$/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /strength/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upper-body/i })).toBeInTheDocument();
  });

  it('does NOT render source/platform/category/sync dropdowns', async () => {
    render(<WorkoutList {...defaultProps} />);
    await screen.findByRole('tab', { name: /library/i });
    expect(screen.queryByTestId('source-filter')).not.toBeInTheDocument();
    expect(screen.queryByTestId('platform-filter')).not.toBeInTheDocument();
    expect(screen.queryByTestId('category-filter')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sync-filter')).not.toBeInTheDocument();
  });

  it('clicking a tag button sets it as active', async () => {
    render(<WorkoutList {...defaultProps} />);
    const strengthBtn = await screen.findByRole('button', { name: /strength/i });
    await userEvent.click(strengthBtn);
    expect(strengthBtn).toHaveClass('bg-primary'); // or whatever active class used
  });
});
```

**Step 2: Run to verify it fails**
```
npm run test -- WorkoutList.tagstrip.test --run
```

**Step 3: Replace filter dropdowns with tag strip in Library tab**

In `WorkoutList.tsx`, inside the Library `<TabsContent>`, replace the filter `<div>` block with:
```tsx
{/* Tag strip */}
<div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
  <Button
    size="sm"
    variant={tagFilter === null ? 'default' : 'outline'}
    onClick={() => setTagFilter(null)}
    className="shrink-0"
  >
    All
  </Button>
  {availableTags.map(tag => (
    <Button
      key={tag}
      size="sm"
      variant={tagFilter === tag ? 'default' : 'outline'}
      onClick={() => setTagFilter(tag)}
      className="shrink-0"
    >
      {tag}
    </Button>
  ))}
</div>
```

Add `data-testid` attributes to any dropdowns being removed (if they don't have them) before removing, so the negative assertions in tests work. Then delete the source, platform, category, and sync filter dropdowns and their state setters from the render.
Keep: search input, sort dropdown, view mode toggle.

**Step 4: Run tests**
```
npm run test -- WorkoutList.tagstrip.test --run
npm run test:run
```

**Step 5: Commit**
```
git add src/components/Workouts/WorkoutList.tsx src/components/Workouts/__tests__/WorkoutList.tagstrip.test.tsx
git commit -m "feat(library): replace filter dropdowns with tag strip"
```

**Acceptance criteria:**
- [ ] Horizontal scrollable tag strip appears in Library tab
- [ ] Tags shown are the user's actual tags (from getUserTags API)
- [ ] "All" tag shown first, deselects any active filter
- [ ] Clicking a tag filters the workout list to that tag
- [ ] Source / Platform / Category / Sync dropdowns are gone
- [ ] Search and Sort dropdown remain

---

## Task 4: Library cards — completion badge and sync status

**Linear ticket:** AMA-TBD
**Branch:** `feat/ama-NNN-library-card-badges`
**Files:**
- Modify: `src/components/Workouts/WorkoutList.tsx` (card rendering sections)
- Modify: `src/components/Workouts/UnifiedWorkoutCard.tsx` (if cards are rendered there)

**What to do:**
On every workout card in the Library tab, show two pieces of data that are already available:
1. **Completion count + last date:** `Done 4× · Last Mon 3 Mar` — derived from completions data
2. **Sync status:** `Garmin ✓` or `Not synced` — derived from workout's `syncStatus` field

The completions data is already fetched in `useWorkoutList` via `fetchWorkoutCompletions`. Match completions to workouts by workout ID and compute count + last date.

**Step 1: Write the failing test**

Create `src/components/Workouts/__tests__/WorkoutList.badges.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WorkoutList } from '../WorkoutList';

const mockWorkout = {
  id: 'w1',
  type: 'history' as const,
  _original: {
    id: 'w1',
    type: 'history' as const,
    title: 'Upper Body Strength',
    created_at: new Date().toISOString(),
    syncStatus: { garmin: { synced: true, status: 'synced' } },
  },
  title: 'Upper Body Strength',
  tags: [],
  isFavorite: false,
  source: 'manual' as const,
  createdAt: new Date(),
};

vi.mock('../../../lib/unified-workouts', () => ({
  fetchAllWorkouts: vi.fn().mockResolvedValue({ workouts: [mockWorkout], errors: [] }),
}));
vi.mock('../../../lib/workout-api', () => ({
  getUserTags: vi.fn().mockResolvedValue([]),
  toggleWorkoutFavorite: vi.fn(),
  updateWorkoutTags: vi.fn(),
  saveWorkoutToAPI: vi.fn(),
}));
vi.mock('../../../lib/completions-api', () => ({
  fetchWorkoutCompletions: vi.fn().mockResolvedValue({
    completions: [
      { workout_id: 'w1', completed_at: '2026-03-03T09:00:00Z' },
      { workout_id: 'w1', completed_at: '2026-02-20T09:00:00Z' },
    ],
    total: 2,
  }),
}));

describe('Library card badges', () => {
  it('shows completion count on a workout card', async () => {
    render(<WorkoutList profileId="u1" onEditWorkout={vi.fn()} onLoadWorkout={vi.fn()} onDeleteWorkout={vi.fn()} />);
    expect(await screen.findByText(/done 2×/i)).toBeInTheDocument();
  });

  it('shows sync status on a workout card', async () => {
    render(<WorkoutList profileId="u1" onEditWorkout={vi.fn()} onLoadWorkout={vi.fn()} onDeleteWorkout={vi.fn()} />);
    expect(await screen.findByText(/garmin/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run to verify it fails**
```
npm run test -- WorkoutList.badges.test --run
```

**Step 3: Add badges to workout cards**

In `WorkoutList.tsx`, in the card rendering section, add below the workout title:
```tsx
{/* Completion badge */}
{(() => {
  const workoutCompletions = completions.filter(c => c.workout_id === workout.id);
  if (workoutCompletions.length === 0) return null;
  const last = new Date(workoutCompletions[0].completed_at);
  return (
    <p className="text-xs text-muted-foreground">
      Done {workoutCompletions.length}× · Last {last.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
    </p>
  );
})()}

{/* Sync status badge */}
{(() => {
  const sync = workout._original?.syncStatus;
  if (!sync) return <span className="text-xs text-muted-foreground">Not synced</span>;
  const synced = Object.entries(sync).find(([, v]) => v.status === 'synced');
  if (synced) return <Badge variant="outline" className="text-xs">{synced[0]} ✓</Badge>;
  return <span className="text-xs text-muted-foreground">Not synced</span>;
})()}
```

**Step 4: Run tests**
```
npm run test -- WorkoutList.badges.test --run
npm run test:run
```

**Step 5: Commit**
```
git add src/components/Workouts/WorkoutList.tsx src/components/Workouts/__tests__/WorkoutList.badges.test.tsx
git commit -m "feat(library): add completion count and sync status badges to cards"
```

**Acceptance criteria:**
- [ ] Every card with completions shows `Done N× · Last [date]`
- [ ] Cards with no completions show nothing (no badge)
- [ ] Cards with a synced device show `[device] ✓`
- [ ] Cards with no sync show `Not synced`

---

## Task 5: Auto-tag workouts on import/save

**Linear ticket:** AMA-TBD
**Branch:** `feat/ama-NNN-auto-tag-on-import`
**Files:**
- Create: `src/lib/auto-tags.ts`
- Modify: `src/lib/workout-api.ts` (call auto-tag in save path)

**What to do:**
Create a pure function `generateAutoTags(workout: WorkoutStructure): string[]` that returns tags based on workout content. Then call it in `saveWorkoutToAPI` so every saved workout gets auto-tagged.

**Step 1: Write the failing test**

Create `src/lib/__tests__/auto-tags.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { generateAutoTags } from '../auto-tags';
import type { WorkoutStructure } from '../../types/workout';

const makeWorkout = (overrides: Partial<WorkoutStructure>): WorkoutStructure => ({
  title: 'Test',
  workout_type: 'strength',
  blocks: [],
  ...overrides,
});

describe('generateAutoTags', () => {
  it('returns strength tag for strength workout', () => {
    const tags = generateAutoTags(makeWorkout({ workout_type: 'strength' }));
    expect(tags).toContain('strength');
  });

  it('returns cardio tag for cardio workout', () => {
    const tags = generateAutoTags(makeWorkout({ workout_type: 'cardio' }));
    expect(tags).toContain('cardio');
  });

  it('returns upper-body tag when blocks contain push/pull/chest/shoulder exercises', () => {
    const tags = generateAutoTags(makeWorkout({
      blocks: [{ label: 'Push', exercises: [{ name: 'Bench Press' }] }],
    }));
    expect(tags).toContain('upper-body');
  });

  it('returns lower-body tag when blocks contain leg/squat exercises', () => {
    const tags = generateAutoTags(makeWorkout({
      blocks: [{ label: 'Legs', exercises: [{ name: 'Back Squat' }] }],
    }));
    expect(tags).toContain('lower-body');
  });

  it('returns quick tag for workouts under 30 minutes', () => {
    const tags = generateAutoTags(makeWorkout({ estimated_duration_min: 20 }));
    expect(tags).toContain('quick');
  });

  it('returns long tag for workouts over 60 minutes', () => {
    const tags = generateAutoTags(makeWorkout({ estimated_duration_min: 75 }));
    expect(tags).toContain('long');
  });

  it('returns no duplicate tags', () => {
    const tags = generateAutoTags(makeWorkout({ workout_type: 'strength' }));
    expect(tags).toEqual([...new Set(tags)]);
  });
});
```

**Step 2: Run to verify it fails**
```
npm run test -- auto-tags.test --run
```

**Step 3: Create `src/lib/auto-tags.ts`**
```ts
import type { WorkoutStructure } from '../types/workout';

const UPPER_BODY_KEYWORDS = ['bench', 'press', 'pull', 'row', 'curl', 'fly', 'shoulder', 'tricep', 'bicep', 'chest', 'lat', 'delt'];
const LOWER_BODY_KEYWORDS = ['squat', 'deadlift', 'lunge', 'leg', 'calf', 'glute', 'hamstring', 'quad', 'hip'];
const CORE_KEYWORDS = ['plank', 'crunch', 'sit-up', 'ab', 'core', 'twist'];

function exerciseNames(workout: WorkoutStructure): string[] {
  return (workout.blocks ?? []).flatMap(b =>
    (b.exercises ?? []).map(e => e.name?.toLowerCase() ?? '')
  );
}

function blockLabels(workout: WorkoutStructure): string[] {
  return (workout.blocks ?? []).map(b => b.label?.toLowerCase() ?? '');
}

export function generateAutoTags(workout: WorkoutStructure): string[] {
  const tags = new Set<string>();
  const names = exerciseNames(workout);
  const labels = blockLabels(workout);
  const allText = [...names, ...labels];

  // Workout type
  if (workout.workout_type) tags.add(workout.workout_type);

  // Muscle groups
  if (allText.some(t => UPPER_BODY_KEYWORDS.some(k => t.includes(k)))) tags.add('upper-body');
  if (allText.some(t => LOWER_BODY_KEYWORDS.some(k => t.includes(k)))) tags.add('lower-body');
  if (allText.some(t => CORE_KEYWORDS.some(k => t.includes(k)))) tags.add('core');

  // Block structure labels
  if (labels.some(l => l.includes('push'))) tags.add('push');
  if (labels.some(l => l.includes('pull'))) tags.add('pull');

  // Duration bucket
  const dur = workout.estimated_duration_min;
  if (dur != null) {
    if (dur < 30) tags.add('quick');
    else if (dur > 60) tags.add('long');
  }

  return [...tags];
}
```

**Step 4: Wire into save path in `src/lib/workout-api.ts`**

Find the `saveWorkoutToAPI` function. After building the workout payload, call `generateAutoTags` and merge with any existing tags before saving:
```ts
import { generateAutoTags } from './auto-tags';

// Inside saveWorkoutToAPI, before the API call:
const autoTags = generateAutoTags(workout);
const mergedTags = [...new Set([...(existingTags ?? []), ...autoTags])];
// Use mergedTags in the payload
```

**Step 5: Run tests**
```
npm run test -- auto-tags.test --run
npm run test:run
```

**Step 6: Commit**
```
git add src/lib/auto-tags.ts src/lib/__tests__/auto-tags.test.ts src/lib/workout-api.ts
git commit -m "feat(tags): auto-generate tags on workout save from type, muscle groups, and duration"
```

**Acceptance criteria:**
- [ ] `generateAutoTags` returns correct tags for strength/cardio/hiit workouts
- [ ] Upper-body / lower-body / core detected from exercise names
- [ ] Push/pull detected from block labels
- [ ] Duration buckets: quick (< 30 min), long (> 60 min)
- [ ] No duplicate tags ever returned
- [ ] Saving a workout via `saveWorkoutToAPI` automatically adds tags to the workout

---

## Task 6: Consolidate export buttons — remove old CSV/FIT dropdown

**Linear ticket:** AMA-TBD
**Branch:** `feat/ama-NNN-consolidate-export`
**Files:**
- Modify: `src/components/Workouts/WorkoutList.tsx`

**What to do:**
Each workout card currently has TWO export buttons: the old "Export" dropdown (Download icon, outputs CSV/FIT/TCX) and the new "Export to Device" (Upload icon, ExportDevicePicker). Remove the old dropdown. Keep only the new `ExportPopoverButton`. Rename its label to `Export ▾` to signal it's the one export action.

**Step 1: Write the failing test**

Create `src/components/Workouts/__tests__/WorkoutList.export.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WorkoutList } from '../WorkoutList';

// Same mocks with one workout
vi.mock('../../../lib/unified-workouts', () => ({
  fetchAllWorkouts: vi.fn().mockResolvedValue({
    workouts: [{
      id: 'w1', type: 'history', _original: { id: 'w1', type: 'history', title: 'Test', created_at: new Date().toISOString() },
      title: 'Test', tags: [], isFavorite: false, source: 'manual', createdAt: new Date(),
    }],
    errors: [],
  }),
}));
vi.mock('../../../lib/workout-api', () => ({ getUserTags: vi.fn().mockResolvedValue([]) }));
vi.mock('../../../lib/completions-api', () => ({
  fetchWorkoutCompletions: vi.fn().mockResolvedValue({ completions: [], total: 0 }),
}));

describe('WorkoutList export buttons', () => {
  it('renders one export button per card, not two', async () => {
    render(<WorkoutList profileId="u1" onEditWorkout={vi.fn()} onLoadWorkout={vi.fn()} onDeleteWorkout={vi.fn()} onExportWorkout={vi.fn()} />);
    await screen.findByText('Test');
    const exportButtons = screen.getAllByRole('button', { name: /export/i });
    // Only one export button per card
    expect(exportButtons).toHaveLength(1);
  });

  it('does NOT render any CSV or FIT download buttons', async () => {
    render(<WorkoutList profileId="u1" onEditWorkout={vi.fn()} onLoadWorkout={vi.fn()} onDeleteWorkout={vi.fn()} onExportWorkout={vi.fn()} />);
    await screen.findByText('Test');
    expect(screen.queryByText(/download csv/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/download fit/i)).not.toBeInTheDocument();
  });
});
```

**Step 2: Run to verify it fails**
```
npm run test -- WorkoutList.export.test --run
```

**Step 3: Remove old export dropdown from card actions**

In `WorkoutList.tsx`, find the `<DropdownMenu>` that renders CSV/FIT/TCX download options (uses the `Download` icon). Delete it entirely. Keep the `<ExportPopoverButton>` — update its label if needed from "Export to Device" to "Export".

**Step 4: Run tests**
```
npm run test -- WorkoutList.export.test --run
npm run test:run
```

**Step 5: Commit**
```
git add src/components/Workouts/WorkoutList.tsx src/components/Workouts/__tests__/WorkoutList.export.test.tsx
git commit -m "feat(library): consolidate to single export button per card, remove CSV/FIT dropdown"
```

**Acceptance criteria:**
- [ ] Each workout card has exactly one export button
- [ ] The old CSV/FIT/TCX download dropdown is gone
- [ ] The ExportDevicePicker popover still works (Garmin, iOS, etc.)
- [ ] Clicking Garmin still opens the Export Page flow

---

## Task 7: "Add to Calendar" button — Library cards and post-import/create flows

**Linear ticket:** AMA-TBD
**Branch:** `feat/ama-NNN-add-to-calendar`
**Files:**
- Modify: `src/components/Workouts/WorkoutList.tsx` (Library card action)
- Modify: `src/components/Import.tsx` or the final step of the import flow
- Modify: `src/components/CreateAIWorkout.tsx` or its completion step

**What to do:**
Add an "Add to Calendar" button that calls `onNavigate('calendar')` (passing the workout ID as context if the calendar supports it, otherwise just navigate). It appears:
1. On every Library workout card (alongside Edit and Export)
2. As an offered action after the import flow completes ("Your workout is saved. Add to Calendar?")
3. As an offered action after AI Create completes

**Step 1: Write the failing test**

Create `src/components/Workouts/__tests__/WorkoutList.calendar.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { WorkoutList } from '../WorkoutList';

const onAddToCalendar = vi.fn();

// Same mocks with one workout
vi.mock('../../../lib/unified-workouts', () => ({
  fetchAllWorkouts: vi.fn().mockResolvedValue({
    workouts: [{
      id: 'w1', type: 'history', _original: { id: 'w1', type: 'history', title: 'Test', created_at: new Date().toISOString() },
      title: 'Test', tags: [], isFavorite: false, source: 'manual', createdAt: new Date(),
    }],
    errors: [],
  }),
}));
vi.mock('../../../lib/workout-api', () => ({ getUserTags: vi.fn().mockResolvedValue([]) }));
vi.mock('../../../lib/completions-api', () => ({
  fetchWorkoutCompletions: vi.fn().mockResolvedValue({ completions: [], total: 0 }),
}));

describe('Add to Calendar', () => {
  it('renders Add to Calendar button on each Library card', async () => {
    render(<WorkoutList profileId="u1" onEditWorkout={vi.fn()} onLoadWorkout={vi.fn()} onDeleteWorkout={vi.fn()} onAddToCalendar={onAddToCalendar} />);
    expect(await screen.findByRole('button', { name: /add to calendar/i })).toBeInTheDocument();
  });

  it('clicking Add to Calendar calls onAddToCalendar with the workout', async () => {
    render(<WorkoutList profileId="u1" onEditWorkout={vi.fn()} onLoadWorkout={vi.fn()} onDeleteWorkout={vi.fn()} onAddToCalendar={onAddToCalendar} />);
    const btn = await screen.findByRole('button', { name: /add to calendar/i });
    await userEvent.click(btn);
    expect(onAddToCalendar).toHaveBeenCalledWith(expect.objectContaining({ id: 'w1' }));
  });
});
```

**Step 2: Run to verify it fails**
```
npm run test -- WorkoutList.calendar.test --run
```

**Step 3: Add `onAddToCalendar` prop and button**

In `WorkoutListProps`, add:
```ts
onAddToCalendar?: (item: WorkoutHistoryItem) => void;
```

In the card action buttons, add:
```tsx
{onAddToCalendar && (
  <Button
    size="sm"
    variant="outline"
    className="gap-1"
    onClick={() => onAddToCalendar(workout._original)}
  >
    <CalendarDays className="w-4 h-4" />
    Add to Calendar
  </Button>
)}
```

In `WorkflowView.tsx`, wire `onAddToCalendar` to navigate to calendar:
```tsx
onAddToCalendar={(item) => {
  // Store the workout ID somewhere the calendar can pick up
  setCurrentView('calendar');
}}
```

**Step 4: Add to end of Import flow**
In the import completion step (wherever "Workout saved successfully" toast fires or the final step renders), add:
```tsx
<Button variant="outline" onClick={() => onNavigate('calendar')}>
  Add to Calendar
</Button>
```

**Step 5: Run tests**
```
npm run test -- WorkoutList.calendar.test --run
npm run test:run
```

**Step 6: Commit**
```
git add src/components/Workouts/WorkoutList.tsx src/app/WorkflowView.tsx src/components/Workouts/__tests__/WorkoutList.calendar.test.tsx
git commit -m "feat(library): add 'Add to Calendar' button to workout cards and import completion"
```

**Acceptance criteria:**
- [ ] "Add to Calendar" appears on every Library card
- [ ] Clicking it navigates to Calendar view
- [ ] Button appears at end of Import flow
- [ ] Button appears at end of AI Create flow

---

## Task 8: Programs tab — "Add to Calendar" as primary action

**Linear ticket:** AMA-TBD
**Branch:** `feat/ama-NNN-programs-add-to-calendar`
**Files:**
- Modify: `src/components/ProgramsList/ProgramCard.tsx`
- Modify: `src/components/ProgramsSection.tsx`

**What to do:**
On each Program card, make "Add to Calendar" the primary (filled) button. "View Plan" becomes secondary (outline). Remove any "Export all" or "Push to watch" actions from Programs cards.

**Step 1: Write the failing test**

Create `src/components/ProgramsList/__tests__/ProgramCard.calendar.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ProgramCard } from '../ProgramCard';

const mockProgram = {
  id: 'p1',
  title: 'Marathon Plan 16wk',
  description: '16 week plan',
  workouts: [],
  tags: ['running'],
};

describe('ProgramCard', () => {
  it('renders Add to Calendar as primary button', () => {
    render(<ProgramCard program={mockProgram} onViewProgram={vi.fn()} onAddToCalendar={vi.fn()} />);
    const addBtn = screen.getByRole('button', { name: /add to calendar/i });
    expect(addBtn).toBeInTheDocument();
    // Primary button should not have outline variant
    expect(addBtn).not.toHaveClass('border');
  });

  it('renders View Plan as secondary button', () => {
    render(<ProgramCard program={mockProgram} onViewProgram={vi.fn()} onAddToCalendar={vi.fn()} />);
    expect(screen.getByRole('button', { name: /view plan/i })).toBeInTheDocument();
  });

  it('clicking Add to Calendar calls onAddToCalendar with program', async () => {
    const onAddToCalendar = vi.fn();
    render(<ProgramCard program={mockProgram} onViewProgram={vi.fn()} onAddToCalendar={onAddToCalendar} />);
    await userEvent.click(screen.getByRole('button', { name: /add to calendar/i }));
    expect(onAddToCalendar).toHaveBeenCalledWith(mockProgram);
  });
});
```

**Step 2: Run to verify it fails**
```
npm run test -- ProgramCard.calendar.test --run
```

**Step 3: Update ProgramCard**

Add `onAddToCalendar` prop. Make it the first, primary button:
```tsx
<Button onClick={() => onAddToCalendar(program)} className="gap-2">
  <CalendarDays className="w-4 h-4" />
  Add to Calendar
</Button>
<Button variant="outline" onClick={() => onViewProgram(program.id)}>
  View Plan
</Button>
```

**Step 4: Wire in ProgramsSection and WorkoutList Programs tab**

Pass `onAddToCalendar` through `ProgramsSection` → `ProgramCard`. In `WorkflowView.tsx`, handle it by navigating to calendar.

**Step 5: Run tests**
```
npm run test -- ProgramCard.calendar.test --run
npm run test:run
```

**Step 6: Commit**
```
git add src/components/ProgramsList/ProgramCard.tsx src/components/ProgramsSection.tsx src/components/ProgramsList/__tests__/ProgramCard.calendar.test.tsx
git commit -m "feat(programs): make Add to Calendar the primary action on program cards"
```

**Acceptance criteria:**
- [ ] "Add to Calendar" is the primary (filled/default) button on program cards
- [ ] "View Plan" is secondary (outline)
- [ ] Clicking "Add to Calendar" navigates to Calendar
- [ ] No "push to watch" or export action on program cards

---

## Dependency Order

```
Task 1 (nav)          → independent
Task 2 (tab shell)    → independent, but do before 3, 4, 6, 7
Task 3 (tag strip)    → after Task 2
Task 4 (badges)       → after Task 2
Task 5 (auto-tag)     → independent (feeds tag strip but can ship separately)
Task 6 (export clean) → after Task 2
Task 7 (calendar btn) → after Task 2
Task 8 (programs)     → independent
```

Recommended Joshua order: 1 → 2 → 8 → 6 → 3 → 4 → 5 → 7
