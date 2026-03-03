# Analytics Redesign — Design Document

## Goal

Consolidate the current Analytics, VolumeAnalytics, and ExerciseHistory pages into a single, unified Analytics hub with three tabs. Serve casual users with an at-a-glance Overview while giving intermediates and pros the depth they need without overwhelming the default experience.

## Context & Constraints

- **Use what exists.** VolumeAnalytics, ExerciseHistory, and the current Analytics page all stay as the foundation. This is a reorganisation and enhancement, not a rewrite.
- **Hybrid athlete gap is the opportunity.** Most apps track strength OR cardio. AmakaFlow imports both. The Analytics page should reflect combined training load — this is a genuine differentiator.
- **Data available now vs later.** Heart rate zones, HRV, and VO2 max require the Garmin developer account (not yet live). Design for now; leave hooks for later.
- **Customisation via pinning, not a widget system.** A full drag-and-drop dashboard is over-engineered for now. A simple "pin your top stats" sheet covers 80% of the need.

---

## Research Findings

Athletes from beginners to pros want:

| Level | Key stats |
|---|---|
| Beginner | Total workout time, basic progress charts, session history, 1RM estimates |
| Intermediate | Volume per muscle group, frequency, rest times, RPE, heart rate zones |
| Pro | VO2 max, HRV, detailed HR graphs, complex periodisation tracking |

**Universal gap:** Poor customisation for advanced users, no hybrid athlete tools (strength + cardio combined), difficult data export. AmakaFlow is positioned to address all three.

---

## 1. Navigation

**Before:** Analytics + Volume + Exercise History as separate nav items (or buried inside My Workouts)

**After:** Single `Analytics` nav item, three tabs inside

```
[ Overview ]  [ Volume ]  [ Exercise ]
```

---

## 2. Overview Tab — The Highlights Reel

Default view. Curated to show what matters at a glance. Casual users never leave here.

```
┌─────────────────────────────────────────────────────────┐
│  This week                                  [Pin stats] │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ 4h 20m   │  │ 4        │  │ 🔥 12d   │  │ ↑ +40m │  │
│  │ training │  │ sessions │  │ streak   │  │ vs last│  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
│                                                          │
│  Training split        (4-week rolling avg)             │
│  Strength ████████░░  3h 10m                            │
│  Cardio   ████░░░░░░  1h 10m                            │
│                                                          │
│  Weekly activity            [sessions | hours]          │
│  [bar chart: Mon–Sun, coloured by type]                 │
│                                                          │
│  Averages                                                │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐  │
│  │ Avg workout   │  │ Avg rest      │  │ Monthly hrs │  │
│  │    52 min     │  │    2m 10s     │  │   18h 30m   │  │
│  └───────────────┘  └───────────────┘  └─────────────┘  │
│                                                          │
│  Recent PRs                                              │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Bench Press   100kg · 2 days ago · 3RM            │  │
│  │ Pull-Up       +2 reps · Last week                 │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Key decisions:**

- **Total hours this week** is the headline stat — first position, largest. This is the number coaches and athletes track. Week-over-week delta (`+40m vs last week`) shown alongside it.
- **Training split bar** — strength vs cardio hours, derived from workout tags. 4-week rolling average so one bad week doesn't distort the picture. Coloured by type in the bar chart too. This is the hybrid athlete view no other app does well.
- **Weekly chart toggle** — same chart, sessions or hours view. Hours is the meaningful metric; sessions is for people just starting out.
- **Averages row** — avg workout duration + avg rest time + monthly total hours. Rest time is a metric intermediates care about; monthly hours is what athletes and coaches report.
- **Recent PRs** — auto-surfaced, no manual logging. A PR = new max weight or max reps for any exercise in a session. Pulled from Exercise History data.
- **[Pin stats] button** — opens a sheet where users can swap any of the 4 stat cards for another metric from a fixed list (e.g. calories, total volume this month, PRs this month). Simple personalisation without a full widget system.
- **Removed from current Analytics:** Device distribution pie chart (not decision-useful), "total workouts ever" lifetime stat (replaced by weekly/monthly framing).

---

## 3. Volume Tab

Current VolumeAnalytics with two additions:

- **Frequency chart** — workouts per week over the last 8–12 weeks, not just "this week". Trend matters more than a single number.
- **Muscle group sparklines** — alongside the existing period comparison bars, add an 8-week trend sparkline per muscle group so you can see if a group is being consistently trained or neglected.

Everything else (period selector, stacked bar chart, exercise drill-down, VolumeSummaryCards) stays unchanged.

---

## 4. Exercise Tab

Current ExerciseHistory unchanged:
- Exercise selector dropdown
- 1RM trend chart
- Session history table (weight, reps, date)
- All-Time Best 1RM, Max Weight, Total Sessions stats

This is where intermediates and pros live. No changes needed now.

**Phase 2 hooks (when Garmin developer account is live):**
- HR zones graph per session
- HRV trend line
- Estimated 1RM from wearable load data

---

## 5. What This Removes / Cleans Up

| Current | After |
|---|---|
| Analytics as standalone nav page | Becomes Overview tab inside Analytics |
| Volume as standalone nav item | Becomes Volume tab inside Analytics |
| Exercise History as standalone nav item | Becomes Exercise tab inside Analytics |
| Device distribution pie chart | Removed — not decision-useful |
| "Total workouts ever" lifetime stat | Replaced by weekly/monthly framing |

---

## 6. Data Available Now vs Later

| Metric | Available now | Requires Garmin dev account |
|---|---|---|
| Total hours/week | ✅ | — |
| Sessions / frequency | ✅ | — |
| Volume per muscle group | ✅ | — |
| 1RM estimates | ✅ | — |
| Avg rest time | ✅ | — |
| Strength vs cardio split | ✅ (from tags) | — |
| Monthly total hours | ✅ | — |
| Heart rate zones post-workout | ❌ | ✅ |
| HRV trend | ❌ | ✅ |
| VO2 max | ❌ | ✅ |
| RPE tracking | ❌ | Needs capture on session log |

---

## 7. Long-term Alignment

When Garmin developer account is live:
1. Exercise tab gets HR zones and HRV — no structural change needed
2. Overview could surface a "Recovery" card (HRV-based) — fits naturally in the stat cards row
3. The pin stats system means users can surface new metrics without a redesign
