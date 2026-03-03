# Workout Sources Registry Design

**Date:** 2026-03-03
**Status:** Approved

## Problem

The calendar sidebar and workout filter bar hardcode workout source definitions in multiple places (`Calendar.tsx` `BASE_WORKOUT_FILTERS`, `WorkoutFilterBar.tsx`). Mock workouts all use `source: 'demo'`, so the UI shows arbitrary labels ("Social Media", "Fitness Classes (Gym)") that don't correspond to real AmakaFlow integrations. When real data replaces mock data, there is no guaranteed mapping between source field values and display metadata.

## Goal

A single source registry that:
- Is the only place source metadata (label, color, icon, category) is defined
- Is used by the calendar sidebar, workout library filter bar, and mock data alike
- Works correctly when mock data is replaced with real API data — no changes needed in consumers
- Is trivially extensible: adding a new source requires one object in one file

## Architecture

### 1. Source Registry — `src/lib/sources.ts`

A plain exported array of `WorkoutSource` objects. This is the only file that knows what sources exist.

```typescript
export interface WorkoutSource {
  id: string;                    // canonical key used everywhere
  label: string;                 // display name
  color: string;                 // Tailwind bg-* class for sidebar dot
  icon: string;                  // emoji
  category: 'device' | 'video' | 'creation' | 'calendar';
  requiresConnection: boolean;   // true = Strava, Runna, Apple/Google Calendar
  matchesSources: string[];      // raw source field values this entry covers
}
```

**The 12 initial sources:**

| id | label | icon | category | requiresConnection | matchesSources |
|----|-------|------|----------|--------------------|----------------|
| `garmin` | Garmin | 🟠 | device | false | `['garmin']` |
| `strava` | Strava | 🟧 | device | true | `['strava']` |
| `apple` | Apple Watch | ⌚ | device | false | `['apple', 'ios_companion']` |
| `android` | Android | 🤖 | device | false | `['android', 'android_companion']` |
| `youtube` | YouTube | ▶️ | video | false | `['youtube']` |
| `instagram` | Instagram | 📸 | video | false | `['instagram']` |
| `tiktok` | TikTok | 🎵 | video | false | `['tiktok']` |
| `ai` | AI Generated | ✨ | creation | false | `['ai', 'amaka', 'ai_generated']` |
| `manual` | Manual Entry | ✏️ | creation | false | `['manual', 'gym_class', 'gym_manual_sync']` |
| `runna` | Runna | 🏃 | calendar | true | `['runna', 'connected_calendar']` |
| `apple-calendar` | Apple Calendar | 📅 | calendar | true | `['apple_calendar', 'connected_calendar']` |
| `google-calendar` | Google Calendar | 📆 | calendar | true | `['google_calendar', 'connected_calendar']` |

**Adding a new source:** add one entry to this array. Nothing else changes.

### 2. Hook — `src/hooks/useWorkoutSources.ts`

The single data-access layer for source state. Merges the registry with live connection status.

```typescript
export interface WorkoutSourceStatus extends WorkoutSource {
  isConnected: boolean;
  connectionId?: string;   // for connected calendars
  workoutCount?: number;   // badge count
}

export function useWorkoutSources(): WorkoutSourceStatus[]
```

**Resolution logic:**
1. Loads full registry
2. **Demo mode** (`isDemoMode`): returns hardcoded mock status — Garmin, Strava, Apple Watch, YouTube, Instagram, Runna, Apple Calendar all `isConnected: true` with realistic workout counts
3. **Real mode**: calls connected-services API, merges result with registry

**Unconnected source display rules:**
- `requiresConnection: true` + `isConnected: false` → show with "Connect" affordance, no count badge
- `requiresConnection: false` + `isConnected: false` → show as active (video/creation sources are always available)

### 3. Calendar Sidebar — `src/components/Calendar.tsx`

Replace `BASE_WORKOUT_FILTERS` and the dynamic connected-calendar merging with a single call to `useWorkoutSources()`. The component renders whatever the hook returns.

**Before:**
```typescript
const BASE_WORKOUT_FILTERS = [
  { id: 'amaka', label: 'AmakaFlow', color: 'bg-purple-500', sources: ['amaka'], ... },
  { id: 'class', label: 'Fitness Classes (Gym)', ... },
  // ...hardcoded
]
```

**After:**
```typescript
const sources = useWorkoutSources();
// render sources directly — no local filter list
```

### 4. Workout Filter Bar — `src/components/Workouts/WorkoutFilterBar.tsx`

Same pattern — replace any hardcoded source option lists with `useWorkoutSources()` filtered by `category`.

### 5. Mock Data — `src/lib/mock-data/workouts.ts`

Replace all `source: 'demo'` values with real registry IDs. Each mock workout gets a realistic source:

| Workout | New source value |
|---------|-----------------|
| Hyrox Session | `'garmin'` |
| Upper Body Strength | `'ai'` |
| Lower Body Power | `'garmin'` |
| Morning Run | `'strava'` |
| (remaining) | mix of `'youtube'`, `'instagram'`, `'manual'`, `'apple'` |

The `matchesSources` field on each registry entry ensures the filter logic still works if raw values vary in real API responses.

## Data Flow

```
WORKOUT_SOURCES (registry array)
       ↓
useWorkoutSources()          ← merges with API / demo mock
       ↓
Calendar sidebar             WorkoutFilterBar
(renders filter list)        (renders source options)
       ↓
filter predicate uses matchesSources to match workout.source field
```

## What Does NOT Change

- The `source` field shape on `WorkoutStructure` — still a plain string
- Connected calendar API calls — the hook wraps them, consumers don't change
- `WorkoutFilterBar` prop interface — still accepts the same filter shape, just populated from the hook

## Extensibility

To add a new source (e.g. Polar, Wahoo, Peloton):
1. Add one `WorkoutSource` object to the array in `src/lib/sources.ts`
2. Done — calendar sidebar and filter bar pick it up automatically
