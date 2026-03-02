# My Workouts Hub Redesign — Design Document

## Goal

Reorganise the "My Workouts" section and nav bar into a clean, navigable hub. Fix the current mess of duplicate sections, hidden toggles, and too many top-level nav items. Build toward a future where agents and the calendar handle scheduling and device sync automatically — this page becomes a review-and-confirm surface, not a manual control panel.

## Context & Constraints

- **Use what exists.** WorkoutList, ProgramsList, ActivityHistory, TagPill, WorkoutEditSheet, ExportPage, etc. all stay. This is a reorganisation, not a rewrite.
- **Short-term reality:** Garmin developer account not yet live. Manual batch push to watch is the export path today.
- **Long-term vision:** Calendar-driven auto-sync (like Runna). Agents schedule workouts; the right workout appears on the watch on the right day. Manual export becomes a power-user edge case.
- **This page is a hub.** Not optimised for one job — it serves browsing, scheduling, exporting, and reviewing completions.

---

## 1. Navigation Bar

**Before:** 9+ items — Import, Create with AI, Calendar, My Workouts, Programs, Analytics, History, Volume, Team

**After:** 6 items

```
Import  |  Create with AI  |  Calendar  |  My Workouts  |  Analytics  |  Settings
```

**What moved:**
- **Programs** → inside My Workouts (Programs tab). Removed from top nav.
- **History / Exercise History** → inside My Workouts (History tab). Removed from top nav.
- **Volume Analytics / Exercise History** → consolidated under Analytics nav item.
- **Team** → moved into Settings (it's configuration, not a daily destination).

---

## 2. My Workouts — Three Tabs

```
┌─────────────────────────────────────────────────────────┐
│  My Workouts                                            │
│  ─────────────────────────────────────────────────────  │
│  [ Library ]  [ Programs ]  [ History ]                 │
└─────────────────────────────────────────────────────────┘
```

---

### 2a. Library Tab

The individual workout library. Everything from the current WorkoutList, cleaned up.

```
┌─────────────────────────────────────────────────────────┐
│  Library                          [+ Import]  [⊞] [☰]  │
│                                                          │
│  🔍 Search workouts...                                   │
│                                                          │
│  Tags: [All] [strength] [upper-body] [push] [hiit] [+]  │
│  Sort: Recent ▾                                          │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Upper Body Strength          [upper-body] [push]    │ │
│  │ Done 4×  ·  Last Monday  ·  Garmin ✓               │ │
│  │ [Edit]  [Export ▾]  [Add to Calendar]               │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Key decisions:**

- **Tags are the primary filter.** Horizontal scrollable tag strip replaces the current source/platform/category/sync dropdown stack. Tags are user-defined — the filter surface evolves with how users think about their workouts, not how we pre-categorised them.
- **Completion data always visible on card.** `Done 4× · Last Monday` — no drilling in required.
- **Sync status on card.** `Garmin ✓` or `Not synced` — at a glance.
- **Batch export.** Checkbox appears in select mode. Select multiple workouts → one "Push to watch" action. This is the manual stopgap until calendar sync is live.
- **"Add to Calendar" on every card.** Scheduling is always one tap away regardless of where you are in the app.
- **Old Export dropdown** (CSV/FIT/TCX) collapses into `Export ▾` — still available for power users, not the hero action.
- **Filters removed:** Source, Platform, Category, Sync dropdowns are gone. Tags + search replace all of them.

---

### 2b. Programs Tab

Multi-week training plans. Distinct from individual workouts.

```
┌─────────────────────────────────────────────────────────┐
│  Programs                              [+ New Program]  │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Marathon Plan 16wk          [running] [endurance]   │ │
│  │ Week 3 of 16  ·  4 workouts/week                    │ │
│  │ Next: Long Run · Saturday                           │ │
│  │ [View Plan]  [Add to Calendar]                      │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 5-Day Strength Split        [strength] [hypertrophy]│ │
│  │ 5 workouts · Not scheduled                          │ │
│  │ [View Plan]  [Add to Calendar]                      │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Key decisions:**

- **Primary action is "Add to Calendar"** — not export. You pick a program, schedule it; the calendar (and eventually the agent) handles getting the right workout to your watch on the right day.
- Active programs show current week + next scheduled workout at a glance.
- Programs have tags too, auto-generated from their constituent workouts.
- No "push all to watch" from here — batch export is a Library action for one-offs. Programs go through the calendar.
- ProgramDetail page stays unchanged — "View Plan" opens it.
- Replaces the current separate Programs nav item entirely.

---

### 2c. History Tab

Chronological completion log. What you've actually done.

```
┌─────────────────────────────────────────────────────────┐
│  History                                                 │
│                                                          │
│  March 2026                                              │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Mon 3     Upper Body Strength                       │ │
│  │           Done in 52 min  ·  4th time               │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Sat 1     Morning Run 5K                            │ │
│  │           Done in 28 min  ·  First time             │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  February 2026                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Thu 27    Pull Day                                  │ │
│  │           Done in 45 min  ·  2nd time               │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Key decisions:**

- Chronological, grouped by month — familiar pattern (Strava, Runna).
- `4th time` / `First time` directly answers "how many times have I done this?"
- Tapping an entry opens the workout → from there you can redo it, export it, or add it to the calendar.
- The `Done 4× · Last Monday` badge on Library cards pulls from this same data — one source of truth.
- Replaces the current ActivityHistory toggle buried in the WorkoutList header.

---

## 3. Tags — Auto-generation on Import

Tags become first-class citizens. Auto-generated on every import so the filter strip is useful from day one without any manual tagging.

**Auto-tag candidates:**

| Source | Example tags |
|--------|-------------|
| Workout type | `strength` `cardio` `hiit` `run` `cycling` `yoga` |
| Muscle focus (AI-inferred) | `upper-body` `lower-body` `push` `pull` `legs` `core` |
| Import source | `garmin` `strava` `youtube` `ai-generated` `manual` |
| Duration bucket | `quick` (< 30 min) `medium` (30–60 min) `long` (60 min+) |
| Program membership | `marathon-plan` `week-1` etc. |

Users can add, remove, and rename tags freely. The tag strip in Library reflects whatever tags exist in the user's library — fully dynamic, not a fixed menu.

---

## 4. "Add to Calendar" — Available Everywhere

Scheduling should be one tap away regardless of where you are:

- Library card → "Add to Calendar"
- Programs tab → "Add to Calendar"
- End of Import flow → "Add to Calendar" (before closing)
- End of AI Create flow → "Add to Calendar" (before closing)
- History entry detail → "Add to Calendar" (do it again)

This sets up the long-term agent-driven vision: once you've scheduled something, you don't need to think about it again.

---

## 5. What This Removes / Cleans Up

| Current | After |
|---------|-------|
| Programs as top-nav item | Gone — Programs tab inside My Workouts |
| ProgramsSection inside WorkoutList | Gone — replaced by Programs tab |
| ActivityHistory hidden toggle | Gone — History tab |
| 5 filter dropdowns (source, platform, category, sync, sort) | Gone — tag strip + search + sort only |
| Exercise History nav item | Moved to Analytics |
| Volume nav item | Moved to Analytics |
| Team nav item | Moved to Settings |
| Two export buttons per card (old CSV dropdown + new Upload) | Consolidated to `Export ▾` |

---

## 6. Long-term Alignment

This design is intentionally transitional. When calendar-based auto-sync ships:

1. The Library tab gets a "Scheduled" filter tag — workouts on the calendar show a calendar badge
2. The Programs tab "Add to Calendar" action already exists — no change needed
3. The manual batch export in Library becomes a power-user action, not the default
4. A "Today" card can be added at the top of the hub (above the tabs) showing today's scheduled workout and its sync status — without restructuring the rest

The hub becomes a place to glance and confirm, not a place to manually operate.
