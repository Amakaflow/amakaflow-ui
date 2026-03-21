# Daily Work Plan — 2026-03-04

## Joshua Status
**IDLE** — 0 open PRs. AMA-894 (Add to Calendar, assigned Joshua, In Progress) has no PR — verify status.

## Stale Linear States (10 min admin)
Mark Done: AMA-912, AMA-913, AMA-918 + children (919-924), AMA-925 + children (926-932), AMA-933

## David's Focus (Claude Code)

### Unblock Joshua (do these first)
- [ ] **Linear cleanup** — Mark AMA-912, AMA-913, AMA-918 series, AMA-925 series, AMA-933 series as Done
- [ ] **AMA-894 status** — Check with Joshua: In Progress but no PR. Reassign or unblock.
- [ ] **Decide AMA-896-901 Analytics** — Keep for David or hand to Joshua? Plan doc has full code.

### David's Own Work
- [ ] **AMA-917** — Open StructureWorkout after AI generation [High] — Repo: amakaflow-ui

## Joshua's Queue (Antfarm)

### Ready NOW (assign immediately)
- [ ] **AMA-853** — DemoNav cannot be closed by DEMO button [High] | Spec: ✅ Linear | Repo: `supergeri/amakaflow-ui` | Branch from: `develop`
- [ ] **AMA-903** — Make device optional in SaveWorkoutRequest [High] | Spec: ✅ Linear | Repo: `supergeri/amakaflow-ui` | Branch from: `develop` | Files: workout-api.ts, useWorkflowGeneration.tsx
- [ ] **AMA-905** — Add select mode infrastructure to useWorkoutList [High] | Spec: ✅ Linear | Repo: `supergeri/amakaflow-ui` | Branch from: `develop` | Files: useWorkoutList.ts, WorkoutList.tsx
- [ ] **AMA-917** — Open StructureWorkout after AI gen [High] *(if David defers)* | Spec: ✅ Linear | Repo: `supergeri/amakaflow-ui`
- [ ] **AMA-855** — Analytics "This Week: 0" demo dates stale [Medium] | Spec: ✅ Linear | Repo: `supergeri/amakaflow-ui`

### Unblocking Soon (after AMA-903 and AMA-905 merge)
- [ ] **AMA-904** — Remove device badge, add Export History [High] | Blocked by: AMA-903 | Files: UnifiedWorkoutCard.tsx, ViewWorkout.tsx
- [ ] **AMA-906** — Select toggle + checkbox overlay [High] | Blocked by: AMA-905 | Files: WorkoutList.tsx
- [ ] **AMA-907** — SelectActionBar [High] | Blocked by: AMA-905 | Files: SelectActionBar.tsx (new), WorkoutList.tsx
- [ ] **AMA-908** — Batch export ExportPage [High] | Blocked by: AMA-907 | Files: ExportPage.tsx, WorkflowView.tsx
- [ ] **AMA-909** — Merge flow BlockPicker [High] | Blocked by: AMA-905, AMA-906, AMA-907
- [ ] **AMA-910** — Delete MixWizard [High] | Blocked by: AMA-909 | Files: MixWizard/ directory + refs

### If David defers Analytics (AMA-896-901)
All 6 are specced in docs/plans/2026-03-02-analytics-redesign-plan.md:
- [ ] **AMA-896** — Analytics stats utility [High] | Sequential first
- [ ] **AMA-897** — AnalyticsHub shell [High]
- [ ] **AMA-898** — OverviewTab [High]
- [ ] **AMA-899** — Router + WorkflowView [High]
- [ ] **AMA-900** — NavBar cleanup [High]
- [ ] **AMA-901** — 8-week frequency chart [High]

## Dependency Chain
AMA-903 → AMA-904
AMA-905 → AMA-906, AMA-907 → AMA-908, AMA-909 → AMA-910
AMA-896 → AMA-897 → AMA-898 → AMA-899 → AMA-900 → AMA-901
