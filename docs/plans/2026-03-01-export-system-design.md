# Export System Redesign — Design Document

**Date:** 2026-03-01
**Status:** Approved — ready for implementation planning

---

## Product North Star

> "We convert your data so you can use it where you want it."

Every design decision should evaluate: does it make the data flow easier or harder?

---

## 1. Architecture Overview

### What We're Building

A new two-path export system that replaces the current multi-step Validate → PublishExport workflow with something that is automatic for simple cases and guided for complex ones.

### Core Approach

**Path 1 — Inline (simple):** Devices that don't require exercise mapping (AmakaFlow app, CSV, Strava, Zwift, Google Sheets, Notion) get a one-tap export from the workout list. No page navigation. The job runs in the background; a toast confirms completion.

**Path 2 — Export Page (complex):** Devices that require exercise mapping (Garmin, COROS) or when the user manually selects "Export" from the workout list overflow menu, go to a dedicated `/export` route. The user sees a 3-column layout: queue, configuration, and live preview.

### What Gets Retired

- `src/components/ValidateMap.tsx` — deleted entirely
- `src/app/WorkflowView.tsx` `validate` step — removed from the step router
- `src/components/PublishExport.tsx` — deleted entirely
- `src/app/WorkflowView.tsx` `export` step — removed

The new system is fully decoupled from the workflow wizard steps. Export is triggered from the workout list or from the Structure step's Save/Export action.

### Provider Abstraction

Every destination is represented by one of two provider types:

- **`standard`** — mapper-api backend handles the export (Garmin, COROS, CSV, Strava, etc.)
- **`mcp`** — an MCP server handles the entire flow (Notion, Google Sheets — and eventually Garmin Connect IQ via a Garmin MCP if that becomes available)

This abstraction exists from day 1. Adding new destinations means adding a provider config, not rewriting the export system.

---

## 2. Entry Points

### Workout List → Quick Export (Inline Path)

Each workout card in the list gets an **Export** button (or overflow menu item). Clicking it opens a small `ExportDevicePicker` popover anchored to the button.

The popover lists the user's configured devices. Devices without mapping requirements are marked as "one-tap" and trigger an immediate background job on click. Devices that require mapping route to the Export Page.

**Routing rule:**
```
device.requiresMapping === false  →  background job + toast
device.requiresMapping === true   →  navigate to /export?workoutId=<id>&device=<id>
user selects "Choose destination"  →  navigate to /export?workoutId=<id>
```

### Structure Step → Save & Export

The StructureWorkout component's action area gets a new `Export` button alongside `Save`. The same routing rule applies: no-mapping = inline, mapping-required = Export Page.

The existing `onValidate` / `onAutoMap` wiring is removed. `onExport` replaces them with the routing logic above.

---

## 3. Export Page Layout

Route: `/export` (or rendered as a view inside `WorkflowView` like the current `export` step)

Three-column layout (desktop) / tabbed layout (mobile):

```
┌─────────────────┬──────────────────────┬────────────────────┐
│  QUEUE          │  CONFIGURATION        │  PREVIEW           │
│                 │                       │                    │
│  [Workout A] ✓  │  Destination: Garmin  │  [Tabs]            │
│  [Workout B] …  │  Device: Forerunner   │  Structural        │
│  [Workout C]    │                       │  Device            │ ← default
│                 │  Mapping:             │  Format            │
│  + Add more     │  [Squat → Squat ✓]   │                    │
│                 │  [RDL   → ?   ⚠]    │  [Preview content] │
│                 │  [EMOM block ⚠]      │                    │
│                 │                       │                    │
│                 │  [Export All]         │                    │
└─────────────────┴──────────────────────┴────────────────────┘
```

**Queue column:** Supports batch export. Users can add multiple workouts. Status icons show pending, in-progress, complete, or failed.

**Configuration column:** Destination selector, device model picker (where applicable), and the mapping resolution UI. Unresolved mappings surface here as inline resolution cards — the AI proposes a match, the user confirms or overrides. The user never has to hunt for this; it's in context.

**Complex workout conflict cards:** When a workout contains EMOM, AMRAP, or other structures that a native watch app can't fully represent, a warning card appears in the configuration column:

```
⚠ This workout contains EMOM blocks.
  Garmin will represent them as timed intervals.
  Some formatting may differ on the watch face.
  [Show me] [Export anyway]
```

The user can still export. We warn but don't block.

---

## 4. Preview System

Three preview tabs, always visible on the Export Page:

**A. Structural** — What the workout looks like as-structured in AmakaFlow (blocks, sets, reps). Closest to the StructureWorkout view. Shows the workout as the user designed it.

**B. Device (highest priority / default tab)** — A rendered simulation of how the workout will appear on the target device. For Garmin: something resembling the Garmin workout display. For AmakaFlow app: the in-app workout view. This tab is selected by default because it answers the question the user actually cares about: "what will I see on my device?"

**C. Format** — The raw export format (FIT file structure preview, JSON, CSV preview). For power users and debugging.

All three tabs update live as the user resolves mappings or changes configuration.

---

## 5. Device Behaviour Matrix

| Device | Requires Mapping | Export Path | Provider Type | Complex Workout |
|--------|-----------------|-------------|---------------|-----------------|
| AmakaFlow App | No | Inline (background) | standard | Full support |
| CSV | No | Inline | standard | Full support |
| Strava | No | Inline | standard | Full support |
| Zwift | No | Inline | standard | Full support |
| Google Sheets | No | Inline | **mcp** | Full support |
| Notion | No | Inline | **mcp** | Full support |
| Garmin Connect | Yes | Export Page | standard | Warn + allow |
| COROS | Yes | Export Page | standard | Warn + allow |
| Garmin (MCP) | Yes | Export Page | **mcp** (future) | Warn + allow |

MCP providers use a `McpExportProvider` that hands off the entire export to the configured MCP server. The UI is identical from the user's perspective — the provider type is an implementation detail.

---

## 6. Mapping Persistence

Exercise mappings are saved **globally per user** via `POST /mappings/add`. An exercise mapped once is never prompted again — across all workouts, all sessions. This is the single most important UX improvement over the current system.

The mapping store is:
- Loaded at app startup via the existing `useAppAuth` flow
- Consulted before showing any unresolved mapping
- Updated optimistically on confirmation

Bulk export: when multiple workouts are queued, mappings resolved for the first workout are immediately applied to all others. The queue updates in real time.

---

## 7. Component Structure

### New Files

```
src/components/Export/
  ExportPage.tsx              ← main 3-column layout, route handler
  ExportQueue.tsx             ← left column: workout queue + status
  ExportConfig.tsx            ← middle column: destination, mappings, conflicts
  ExportPreview.tsx           ← right column: 3-tab preview
  ExportDevicePicker.tsx      ← popover for inline quick-export
  ConflictCard.tsx            ← warning card for EMOM/AMRAP on native apps
  MappingResolutionCard.tsx   ← inline AI-proposed match + confirm/override
  DevicePreview.tsx           ← device-specific rendered preview
```

### New Hook

```
src/hooks/useExportFlow.ts

interface UseExportFlowReturn {
  // State
  queue: ExportQueueItem[];
  destination: DeviceId;
  mappings: MappingState;
  conflicts: ConflictItem[];
  preview: PreviewData;

  // Actions
  addToQueue: (workoutId: string) => void;
  removeFromQueue: (workoutId: string) => void;
  setDestination: (device: DeviceId) => void;
  resolveMapping: (exerciseId: string, mappedId: string) => void;
  exportAll: () => Promise<void>;
  exportInline: (workoutId: string, device: DeviceId) => Promise<void>;
}
```

### Deleted Files

- `src/components/ValidateMap.tsx`
- `src/components/PublishExport.tsx`
- (Step wiring in WorkflowView.tsx for `validate` and `export` steps)

### Provider Interface

```typescript
interface ExportProvider {
  type: 'standard' | 'mcp';
  deviceId: DeviceId;
  export(payload: ExportPayload): Promise<ExportResult>;
}

// MCP variant
interface McpExportProvider extends ExportProvider {
  type: 'mcp';
  serverName: string;  // e.g. 'notion', 'google-sheets'
}
```

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Complex workouts on native apps | Warn + allow | Blocking exports is worse than showing imperfect data on the watch |
| Mapping persistence | Global per-user | Mapping once should last forever — this is table stakes |
| MCP abstraction | Ready from day 1 | Notion/Sheets MCP servers exist today; Garmin MCP is plausible; infrastructure now = no rewrite later |
| Inline vs page routing | By `requiresMapping` flag | Simple = fast; complex = guided |
| Preview default tab | Device | Answers the user's real question: "what will I see?" |
| Validate step | Remove entirely | AI mapping makes manual validation unnecessary for most cases |

---

## Out of Scope (This Version)

- Garmin MCP server (investigate separately — does one exist?)
- Offline export queue (retry on reconnect)
- Export history / audit log
- Per-workout mapping overrides (global is sufficient for now)
