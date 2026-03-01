# Unified Import Flow Design

**Date:** 2026-02-28
**Author:** David Andrews
**Status:** Approved — ready for implementation planning

---

## Problem

AmakaFlow has two separate import paths — "Single Import" (4-step workflow: Add Sources → Structure → Validate → Export) and "Bulk Import" (5-step flow: Detect → Map → Match → Preview → Import) — that feel like different products. Users must decide upfront which path to take before they know what they have. The Frankenstein use case (building one workout from blocks across multiple sources) fits neither path cleanly. The existing pages are visually cluttered with options that belong to other flows (device export, rest type formatting, mapping).

---

## Design Principles

**Progressive Disclosure** — each screen shows only what is needed at that exact step. Export options, device settings, rest type formatting, and exercise mapping are not visible during import.

**Dieter Rams: "Less, but better"** — every element on the import screen must serve the import task. Anything that doesn't is removed, not hidden behind a toggle.

---

## Goals

- One import entry point replacing both "Single Import" and "Bulk Import" nav items
- Paste one URL or twenty — the system handles both without the user choosing a path upfront
- File-based imports (Excel, CSV, JSON, PDF) share the same results screen as URL-based imports
- Integration-based imports (Notion, Strava, Garmin, FIT files) available via a third tab — mocked for now
- Building one workout from multiple sources (Frankenstein) is a first-class option at the results screen
- No export or device mapping steps in the import flow — those are a separate future flow
- Rest durations remain as workout data; rest type formatting and device-specific behaviour move to the export/device flow

---

## What Is Removed

| Removed | Reason |
|---------|--------|
| "Single Import" nav item | Replaced by unified "Import" |
| "Bulk Import" nav item | Replaced by unified "Import" |
| BulkImport 5-step flow (Detect → Map → Match → Preview → Import) | Retired; column mapping from MapStep preserved for File tab |
| MixWizard modal | Retired; replaced by block picker in new flow |
| Structure → Validate → Export as mandatory import steps | Export is a future separate flow |
| Device-specific rest type options in StructureWorkout (during import) | Moves to export/device mapping flow |

---

## Architecture

### Entry Point

Single **"Import"** button in the nav bar. Opens the Import screen.

The Import screen has three tabs:

| Tab | Inputs | Notes |
|-----|--------|-------|
| **URLs & Media** | Video URLs (YouTube, TikTok, Instagram, Pinterest), images (screenshots, photos), PDFs, text paste | Images and PDFs go through OCR/vision extraction |
| **File** | Excel, CSV, JSON | Column matching runs before the results screen |
| **Integrations** | Notion, Strava, Garmin Connect, FIT files, and future sources (browser extension clip queue, MCP-connected tools) | Mocked for initial release; real connections built in subsequent tickets |

**Future compatibility:** The browser extension (planned, not in this ticket) will inject URLs directly into the URLs & Media queue. The queue is designed to receive items from external sources, not just manual paste.

### Queue Area

Below the URL input / file drop zone, a **queue area** shows each item as it is added — one row per URL, image, or file. The user can add multiple items before hitting Import. Each row shows the source URL or filename and a remove button. This is the same area where integration-pulled items and future browser-extension items will appear.

### Processing View

After hitting Import, each queued item transitions through statuses in-place:

```
detecting → extracting → done
                       → failed (reason + retry)
```

Items complete as they go — results are visible as they finish rather than waiting for the full batch.

### Results / Summary Screen

The same screen for all three tabs (File tab arrives here after column matching).

Each detected workout is shown as a **card** containing:
- Workout name
- Block count and total exercise count
- Source thumbnail or icon (YouTube logo, image thumbnail, PDF icon, integration icon)
- **Edit** — opens StructureWorkout editor for that workout individually
- **Remove** — drops it before saving

**Two primary actions at the top:**

1. **Save all to library** — commits all shown workouts as individual library entries
2. **Build one workout from these** — opens the block picker (hidden when only one item is present)

---

## Block Picker (Frankenstein Flow)

Triggered from "Build one workout from these" on the results screen.

**Layout:**
- **Left column:** all source workouts, each expanded to show their blocks. Tapping a block selects it (checkmark + highlight).
- **Right column:** live preview of the workout being assembled, in order. Blocks can be reordered via drag-and-drop (`@dnd-kit`, same implementation as StructureWorkout).

**Use case example:** User imports five Instagram Reels, each containing one good squat variation. They select the squat block from each, reorder to their preference, and build a single leg workout.

After selecting blocks, **"Edit this workout"** opens StructureWorkout editor — full drag-and-drop reorder, add/delete exercises, rename blocks. This is identical to the single-workout edit experience.

After saving from the editor, the user lands on a final summary showing what was saved (the combined workout plus any individually-imported workouts not included in the mix).

---

## Workout Data vs Device Data

| Stays in import / library | Moves to export / device flow |
|--------------------------|-------------------------------|
| Rest duration (e.g. 60 seconds between sets) | Rest *type* (Garmin timer screen, Apple Watch active rest, etc.) |
| Warm-up and cooldown blocks (actual exercise content) | Device-specific rendering of warm-up/cooldown |
| Exercise names, sets, reps, weights | Exercise-to-device mapping (Garmin exercise IDs, Apple WorkoutKit types) |
| Block structure and ordering | Device memory management (which workouts are pushed to which device) |

Workouts in the library are device-agnostic. Device-specific behaviour is resolved when the user later chooses to push a workout to Garmin, Apple Watch, or another target.

---

## What Is NOT Changing (In This Ticket)

- StructureWorkout editor internals (already migrated to `@dnd-kit` in AMA-805)
- AI workout creation flow — stays separate
- Strava / Garmin sync flows — stays separate (these are platform sync, not import)
- Export to device — future ticket / Linear epic

---

## Future Compatibility Notes

- **Browser extension:** When built, it clips a URL and adds it to the URLs & Media queue. No new UI needed — the queue already accepts items from external sources.
- **Agent-driven import:** The same backend endpoints power both the human UI and future agent-driven imports. The import pipeline is API-first; agents call the same APIs the UI calls.
- **Perplexity-style AI assistant:** Noted as long-term direction — the agent layer eventually handles import orchestration autonomously. The human UI is one surface over the same API, not the only surface.
- **More integrations:** The Integrations tab is the extension point. Adding Notion, FIT files, or any new MCP-connected source means adding a tile to that tab and connecting its output to the existing results screen — no new screens needed.

---

## Success Criteria

- [ ] "Single Import" and "Bulk Import" nav items removed; single "Import" replaces both
- [ ] URLs & Media tab accepts URLs (all current platforms), images, PDFs, and text paste
- [ ] File tab accepts Excel, CSV, JSON with column matching before results screen
- [ ] Integrations tab exists and is clearly marked as "coming soon"
- [ ] Processing view shows per-item progress (not a single spinner for the whole batch)
- [ ] Results screen shows each workout as a summary card with Edit and Remove actions
- [ ] "Save all to library" saves all results as individual workouts
- [ ] "Build one workout from these" (shown only when 2+ results) opens block picker
- [ ] Block picker supports drag-and-drop reordering of selected blocks
- [ ] Block picker leads to full StructureWorkout editor
- [ ] No export, device mapping, or device-specific rest options visible anywhere in the import flow
- [ ] Import screen follows Progressive Disclosure — only import-relevant UI is present
