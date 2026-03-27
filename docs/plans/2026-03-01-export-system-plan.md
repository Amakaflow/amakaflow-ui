# Export System Rewrite — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 4-step Ingest → Structure → Validate → Export workflow with a two-path export system: one-tap background export for simple devices, and a guided 3-column Export Page for mapping-required devices.

**Architecture:** New `useExportFlow` hook manages queue, destination, mappings, and conflicts. `ExportDevicePicker` popover handles inline quick-export from the workout list. `ExportPage` (`src/components/Export/ExportPage.tsx`) provides the guided 3-column layout for complex exports. `ValidateMap.tsx` and `PublishExport.tsx` are deleted at the end.

**Tech Stack:** React + TypeScript, Vitest + @testing-library/react (hook tests), Playwright (smoke tests), shadcn/ui (Card, Popover, Tabs, Select, Badge, Button), sonner (toasts), existing `mapper-api.ts` for mapping + export calls, existing `devices.ts` for device config.

**Design doc:** `docs/plans/2026-03-01-export-system-design.md`

---

## Context for all tasks

- UI repo: `amakaflow-ui/` (React + Vite + shadcn + Tailwind)
- Never push to `develop` directly — all changes go on a feature branch as a PR
- Branch name: `feat/ama-export-system-rewrite`
- Run tests: `npm run test:run` (Vitest unit tests), `npm run test:playwright:smoke` (Playwright)
- Dev server: `npm run dev -- --port 5175` (or any free port)
- Key existing files:
  - `src/lib/devices.ts` — `DeviceId`, `Device`, `requiresMapping`, `exportMethod`
  - `src/lib/mapper-api.ts` — `validateWorkoutMapping`, `exportWorkoutToDevice`, `saveUserMapping`, `checkMapperApiHealth`
  - `src/lib/workout-history.ts` — `saveWorkoutToHistory`
  - `src/types/workout.ts` — `WorkoutStructure`, `WorkoutStructureType`, `ValidationResponse`, `ExportFormats`
  - `src/app/router.ts` — `View` type union + lazy imports
  - `src/app/WorkflowView.tsx` — renders each view; add `'export-page'` case here
  - `src/app/useWorkflowState.ts` — orchestrates workflow; remove validate/export steps
  - `src/components/Workouts/WorkoutList.tsx` — add `onExportWorkout` prop and `ExportDevicePicker`
  - `src/components/StructureWorkout/StructureWorkout.tsx` — replace autoMap/validate with export routing
- "Complex workout" warning triggers for blocks with `structure` in: `'emom' | 'amrap' | 'for-time' | 'tabata'`

---

## Task 1: Provider types and `useExportFlow` hook (with unit tests)

**Files:**
- Create: `src/hooks/useExportFlow.ts`
- Create: `src/hooks/__tests__/useExportFlow.test.ts`

This hook is the entire state machine for the export flow — both inline and page-based. Build it test-first.

### Step 1: Write the failing unit test

Create `src/hooks/__tests__/useExportFlow.test.ts`:

```typescript
/**
 * Unit tests for useExportFlow hook
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExportWorkoutToDevice, mockSaveWorkoutToHistory, mockCheckMapperApiHealth } = vi.hoisted(() => ({
  mockExportWorkoutToDevice: vi.fn().mockResolvedValue({ yaml: 'export-result' }),
  mockSaveWorkoutToHistory: vi.fn().mockResolvedValue(undefined),
  mockCheckMapperApiHealth: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../lib/mapper-api', () => ({
  exportWorkoutToDevice: mockExportWorkoutToDevice,
  checkMapperApiHealth: mockCheckMapperApiHealth,
  saveUserMapping: vi.fn().mockResolvedValue({ message: 'ok' }),
  validateWorkoutMapping: vi.fn().mockResolvedValue({
    validated_exercises: [],
    needs_review: [],
    unmapped_exercises: [],
    can_proceed: true,
  }),
}));

vi.mock('../../lib/workout-history', () => ({
  saveWorkoutToHistory: mockSaveWorkoutToHistory,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { useExportFlow } from '../useExportFlow';
import type { WorkoutStructure } from '../../types/workout';

const MOCK_USER_ID = 'user-123';

const SIMPLE_WORKOUT: WorkoutStructure = {
  title: 'Test Workout',
  blocks: [
    {
      label: 'Main',
      structure: 'regular',
      exercises: [{ id: 'e1', name: 'Squat', sets: 3, reps: 10, reps_range: null, duration_sec: null, rest_sec: 60, distance_m: null, distance_range: null, type: 'strength' }],
    },
  ],
};

const COMPLEX_WORKOUT: WorkoutStructure = {
  title: 'EMOM Workout',
  blocks: [
    {
      label: 'EMOM Block',
      structure: 'emom',
      exercises: [{ id: 'e2', name: 'Burpees', sets: 1, reps: 10, reps_range: null, duration_sec: 60, rest_sec: null, distance_m: null, distance_range: null, type: 'HIIT' }],
    },
  ],
};

describe('useExportFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initialises with empty queue and default destination', () => {
    const { result } = renderHook(() => useExportFlow({ userId: MOCK_USER_ID }));
    expect(result.current.queue).toHaveLength(0);
    expect(result.current.destination).toBe('garmin');
    expect(result.current.loading).toBe(false);
  });

  it('addToQueue adds a workout with pending status', () => {
    const { result } = renderHook(() => useExportFlow({ userId: MOCK_USER_ID }));
    act(() => { result.current.addToQueue(SIMPLE_WORKOUT); });
    expect(result.current.queue).toHaveLength(1);
    expect(result.current.queue[0].status).toBe('pending');
    expect(result.current.queue[0].workout.title).toBe('Test Workout');
  });

  it('removeFromQueue removes by workoutId', () => {
    const { result } = renderHook(() => useExportFlow({ userId: MOCK_USER_ID }));
    act(() => { result.current.addToQueue(SIMPLE_WORKOUT); });
    const id = result.current.queue[0].workoutId;
    act(() => { result.current.removeFromQueue(id); });
    expect(result.current.queue).toHaveLength(0);
  });

  it('setDestination updates destination', () => {
    const { result } = renderHook(() => useExportFlow({ userId: MOCK_USER_ID }));
    act(() => { result.current.setDestination('apple'); });
    expect(result.current.destination).toBe('apple');
  });

  it('detectConflicts returns empty array for simple workout on Garmin', () => {
    const { result } = renderHook(() => useExportFlow({ userId: MOCK_USER_ID }));
    const conflicts = result.current.detectConflicts(SIMPLE_WORKOUT, 'garmin');
    expect(conflicts).toHaveLength(0);
  });

  it('detectConflicts returns conflict for EMOM block on Garmin', () => {
    const { result } = renderHook(() => useExportFlow({ userId: MOCK_USER_ID }));
    const conflicts = result.current.detectConflicts(COMPLEX_WORKOUT, 'garmin');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].structure).toBe('emom');
    expect(conflicts[0].blockLabel).toBe('EMOM Block');
  });

  it('detectConflicts returns empty for no-mapping device (apple)', () => {
    const { result } = renderHook(() => useExportFlow({ userId: MOCK_USER_ID }));
    // Apple doesn't require mapping → no conflict warning needed
    const conflicts = result.current.detectConflicts(COMPLEX_WORKOUT, 'apple');
    expect(conflicts).toHaveLength(0);
  });

  it('exportInline calls export + save + toast', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useExportFlow({ userId: MOCK_USER_ID }));

    await act(async () => {
      await result.current.exportInline(SIMPLE_WORKOUT, 'apple', MOCK_USER_ID);
    });

    expect(mockExportWorkoutToDevice).toHaveBeenCalledWith(SIMPLE_WORKOUT, 'apple', null);
    expect(mockSaveWorkoutToHistory).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it('resolveMapping stores the mapping', () => {
    const { result } = renderHook(() => useExportFlow({ userId: MOCK_USER_ID }));
    act(() => { result.current.resolveMapping('Squat', 'Squat (Barbell)'); });
    expect(result.current.mappings['Squat']).toBe('Squat (Barbell)');
  });
});
```

### Step 2: Run tests — confirm they fail

```bash
cd /Users/davidandrews/dev/AmakaFlow/amakaflow-ui
npm run test:run -- src/hooks/__tests__/useExportFlow.test.ts
```

Expected: FAIL — `useExportFlow` doesn't exist yet.

### Step 3: Implement `useExportFlow`

Create `src/hooks/useExportFlow.ts`:

```typescript
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  exportWorkoutToDevice,
  saveUserMapping as apiSaveUserMapping,
} from '../lib/mapper-api';
import { saveWorkoutToHistory } from '../lib/workout-history';
import { getDeviceById } from '../lib/devices';
import type { WorkoutStructure, WorkoutStructureType } from '../types/workout';
import type { DeviceId } from '../lib/devices';

export interface ExportQueueItem {
  workoutId: string;
  workout: WorkoutStructure;
  status: 'pending' | 'exporting' | 'done' | 'error';
  error?: string;
}

export interface ConflictItem {
  blockLabel: string;
  structure: WorkoutStructureType;
  description: string;
  deviceWarning: string;
}

interface UseExportFlowProps {
  userId: string;
}

export interface UseExportFlowReturn {
  queue: ExportQueueItem[];
  destination: DeviceId;
  mappings: Record<string, string>;
  loading: boolean;
  addToQueue: (workout: WorkoutStructure) => void;
  removeFromQueue: (workoutId: string) => void;
  setDestination: (device: DeviceId) => void;
  resolveMapping: (exerciseName: string, garminName: string) => void;
  detectConflicts: (workout: WorkoutStructure, device: DeviceId) => ConflictItem[];
  exportInline: (workout: WorkoutStructure, device: DeviceId, userId: string) => Promise<void>;
  exportAll: () => Promise<void>;
}

// Structures that may not render correctly on native watch apps
const COMPLEX_STRUCTURES: WorkoutStructureType[] = ['emom', 'amrap', 'for-time', 'tabata'];

const STRUCTURE_WARNINGS: Record<string, { description: string; deviceWarning: string }> = {
  emom: {
    description: 'Every Minute On the Minute',
    deviceWarning: 'Will be represented as timed intervals. Some formatting may differ on the watch face.',
  },
  amrap: {
    description: 'As Many Rounds As Possible',
    deviceWarning: 'Will be exported as a timed block. Round counting may not be supported by the device.',
  },
  'for-time': {
    description: 'For Time',
    deviceWarning: 'Will be exported as a timed block without built-in completion tracking.',
  },
  tabata: {
    description: 'Tabata intervals',
    deviceWarning: 'Will be exported as alternating work/rest intervals.',
  },
};

function generateWorkoutId(workout: WorkoutStructure): string {
  return `${workout.title}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useExportFlow({ userId }: UseExportFlowProps): UseExportFlowReturn {
  const [queue, setQueue] = useState<ExportQueueItem[]>([]);
  const [destination, setDestinationState] = useState<DeviceId>('garmin');
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const addToQueue = useCallback((workout: WorkoutStructure) => {
    setQueue(prev => [
      ...prev,
      { workoutId: generateWorkoutId(workout), workout, status: 'pending' },
    ]);
  }, []);

  const removeFromQueue = useCallback((workoutId: string) => {
    setQueue(prev => prev.filter(item => item.workoutId !== workoutId));
  }, []);

  const setDestination = useCallback((device: DeviceId) => {
    setDestinationState(device);
  }, []);

  const resolveMapping = useCallback((exerciseName: string, garminName: string) => {
    setMappings(prev => ({ ...prev, [exerciseName]: garminName }));
    // Persist to backend (fire and forget — mapping is saved globally)
    apiSaveUserMapping(exerciseName, garminName).catch(() => {
      // Non-critical — the mapping is already in local state
    });
  }, []);

  const detectConflicts = useCallback(
    (workout: WorkoutStructure, device: DeviceId): ConflictItem[] => {
      const deviceConfig = getDeviceById(device);
      // Only warn for mapping-required devices (native watch apps)
      if (!deviceConfig?.requiresMapping) return [];

      const conflicts: ConflictItem[] = [];
      for (const block of workout.blocks || []) {
        if (block.structure && COMPLEX_STRUCTURES.includes(block.structure as WorkoutStructureType)) {
          const warning = STRUCTURE_WARNINGS[block.structure as string];
          if (warning) {
            conflicts.push({
              blockLabel: block.label,
              structure: block.structure as WorkoutStructureType,
              description: warning.description,
              deviceWarning: warning.deviceWarning,
            });
          }
        }
      }
      return conflicts;
    },
    []
  );

  const exportInline = useCallback(
    async (workout: WorkoutStructure, device: DeviceId, uid: string) => {
      setLoading(true);
      try {
        const exportFormats = await exportWorkoutToDevice(workout, device, null);
        await saveWorkoutToHistory(uid, workout, device, exportFormats, [], undefined, undefined);
        toast.success(`Exported to ${getDeviceById(device)?.name ?? device}!`);
      } catch (err: any) {
        toast.error(`Export failed: ${err.message ?? 'Unknown error'}`);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const exportAll = useCallback(async () => {
    setLoading(true);
    const pending = queue.filter(item => item.status === 'pending');
    for (const item of pending) {
      setQueue(prev =>
        prev.map(q => (q.workoutId === item.workoutId ? { ...q, status: 'exporting' } : q))
      );
      try {
        const exportFormats = await exportWorkoutToDevice(item.workout, destination, null);
        await saveWorkoutToHistory(
          userId,
          item.workout,
          destination,
          exportFormats,
          [],
          undefined,
          undefined
        );
        setQueue(prev =>
          prev.map(q => (q.workoutId === item.workoutId ? { ...q, status: 'done' } : q))
        );
      } catch (err: any) {
        setQueue(prev =>
          prev.map(q =>
            q.workoutId === item.workoutId
              ? { ...q, status: 'error', error: err.message ?? 'Export failed' }
              : q
          )
        );
      }
    }
    setLoading(false);
    const failed = queue.filter(q => q.status === 'error').length;
    if (failed > 0) {
      toast.error(`${failed} workout(s) failed to export`);
    } else {
      toast.success(`All workouts exported to ${getDeviceById(destination)?.name ?? destination}!`);
    }
  }, [queue, destination, userId]);

  return {
    queue,
    destination,
    mappings,
    loading,
    addToQueue,
    removeFromQueue,
    setDestination,
    resolveMapping,
    detectConflicts,
    exportInline,
    exportAll,
  };
}
```

### Step 4: Run tests — confirm they pass

```bash
npm run test:run -- src/hooks/__tests__/useExportFlow.test.ts
```

Expected: 9 tests PASS.

### Step 5: Commit

```bash
git add src/hooks/useExportFlow.ts src/hooks/__tests__/useExportFlow.test.ts
git commit -m "feat: add useExportFlow hook with unit tests"
```

---

## Task 2: `ExportDevicePicker` popover

**Files:**
- Create: `src/components/Export/ExportDevicePicker.tsx`

The popover shown when clicking "Export" from a workout card. Lists available devices. No-mapping devices trigger inline export immediately; mapping-required devices navigate to ExportPage.

### Step 1: Create the component

Create `src/components/Export/ExportDevicePicker.tsx`:

```tsx
import { useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { Badge } from '../ui/badge';
import { getPrimaryExportDestinations, getDeviceById } from '../../lib/devices';
import type { DeviceId } from '../../lib/devices';
import type { WorkoutStructure } from '../../types/workout';

interface ExportDevicePickerProps {
  workout: WorkoutStructure;
  userId: string;
  trigger: React.ReactNode;
  onInlineExport: (workout: WorkoutStructure, device: DeviceId) => Promise<void>;
  onOpenExportPage: (workout: WorkoutStructure, device: DeviceId) => void;
}

export function ExportDevicePicker({
  workout,
  userId: _userId,
  trigger,
  onInlineExport,
  onOpenExportPage,
}: ExportDevicePickerProps) {
  const [open, setOpen] = useState(false);
  const [exportingDevice, setExportingDevice] = useState<DeviceId | null>(null);

  const devices = getPrimaryExportDestinations().filter(
    d => d.exportMethod !== 'coming_soon'
  );

  const handleDeviceClick = async (deviceId: DeviceId) => {
    const device = getDeviceById(deviceId);
    if (!device) return;

    if (device.requiresMapping) {
      // Route to export page for mapping
      setOpen(false);
      onOpenExportPage(workout, deviceId);
    } else {
      // Inline export
      setExportingDevice(deviceId);
      try {
        await onInlineExport(workout, deviceId);
        setOpen(false);
      } finally {
        setExportingDevice(null);
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="end">
        <p className="text-xs text-muted-foreground px-2 pb-2 font-medium uppercase tracking-wide">
          Export to
        </p>
        <div className="space-y-1">
          {devices.map(device => {
            const isExporting = exportingDevice === device.id;
            const requiresPage = device.requiresMapping;
            return (
              <button
                key={device.id}
                data-testid={`export-picker-${device.id}`}
                onClick={() => handleDeviceClick(device.id)}
                disabled={isExporting}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted text-left transition-colors disabled:opacity-50"
              >
                <span className="text-lg">{device.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{device.name}</p>
                  {device.setupInstructions && (
                    <p className="text-xs text-muted-foreground truncate">
                      {device.setupInstructions}
                    </p>
                  )}
                </div>
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : requiresPage ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="outline" className="text-xs px-1">Map</Badge>
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </div>
                ) : (
                  <Badge variant="secondary" className="text-xs shrink-0">1-tap</Badge>
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

### Step 2: Verify TypeScript compiles

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors related to `ExportDevicePicker.tsx`.

### Step 3: Commit

```bash
git add src/components/Export/ExportDevicePicker.tsx
git commit -m "feat: add ExportDevicePicker popover component"
```

---

## Task 3: `ConflictCard` and `MappingResolutionCard`

**Files:**
- Create: `src/components/Export/ConflictCard.tsx`
- Create: `src/components/Export/MappingResolutionCard.tsx`

These are the two sub-cards inside the ExportConfig column.

### Step 1: Create `ConflictCard`

Create `src/components/Export/ConflictCard.tsx`:

```tsx
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import type { ConflictItem } from '../../hooks/useExportFlow';

interface ConflictCardProps {
  conflict: ConflictItem;
  onShowPreview: () => void;
}

export function ConflictCard({ conflict, onShowPreview }: ConflictCardProps) {
  return (
    <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
      <AlertTriangle className="h-4 w-4 text-orange-500" />
      <AlertDescription className="space-y-2">
        <div>
          <p className="font-medium text-sm">
            <span className="font-bold">{conflict.blockLabel}</span> — {conflict.description}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{conflict.deviceWarning}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onShowPreview}
          className="h-7 text-xs"
        >
          Preview on device
        </Button>
      </AlertDescription>
    </Alert>
  );
}
```

### Step 2: Create `MappingResolutionCard`

Create `src/components/Export/MappingResolutionCard.tsx`:

```tsx
import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible';
import type { ValidationResult } from '../../types/workout';

interface MappingResolutionCardProps {
  exercise: ValidationResult;
  onResolve: (original: string, mapped: string) => void;
}

export function MappingResolutionCard({ exercise, onResolve }: MappingResolutionCardProps) {
  const [open, setOpen] = useState(false);
  const [resolved, setResolved] = useState(false);

  const topSuggestion = exercise.suggestions?.[0];

  const handleAccept = (suggestion: string) => {
    onResolve(exercise.original_name, suggestion);
    setResolved(true);
    setOpen(false);
  };

  if (resolved) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 text-sm">
        <Check className="w-4 h-4 text-green-500 shrink-0" />
        <span className="flex-1 truncate text-muted-foreground">{exercise.original_name}</span>
        <Badge variant="outline" className="text-xs shrink-0">mapped</Badge>
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors">
          <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
          <span className="flex-1 text-sm truncate">{exercise.original_name}</span>
          {topSuggestion && (
            <span className="text-xs text-muted-foreground truncate max-w-28">
              → {topSuggestion.garmin_name}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 py-2 border-x border-b rounded-b-md space-y-1">
        {exercise.suggestions?.slice(0, 4).map(s => (
          <button
            key={s.garmin_name}
            onClick={() => handleAccept(s.garmin_name)}
            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm text-left"
          >
            <span>{s.garmin_name}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {Math.round(s.confidence * 100)}%
            </span>
          </button>
        ))}
        {(!exercise.suggestions || exercise.suggestions.length === 0) && (
          <p className="text-xs text-muted-foreground py-1">No suggestions available</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
```

### Step 3: Verify TypeScript compiles

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No new errors.

### Step 4: Commit

```bash
git add src/components/Export/ConflictCard.tsx src/components/Export/MappingResolutionCard.tsx
git commit -m "feat: add ConflictCard and MappingResolutionCard components"
```

---

## Task 4: `ExportQueue` component

**Files:**
- Create: `src/components/Export/ExportQueue.tsx`

Left column of the Export Page. Shows queued workouts with status icons. Allows adding/removing.

### Step 1: Create `ExportQueue`

Create `src/components/Export/ExportQueue.tsx`:

```tsx
import { CheckCircle2, Loader2, AlertCircle, Clock, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { ExportQueueItem } from '../../hooks/useExportFlow';

interface ExportQueueProps {
  queue: ExportQueueItem[];
  onRemove: (workoutId: string) => void;
}

const STATUS_CONFIG = {
  pending: { icon: Clock, className: 'text-muted-foreground', label: 'Pending' },
  exporting: { icon: Loader2, className: 'text-blue-500 animate-spin', label: 'Exporting…' },
  done: { icon: CheckCircle2, className: 'text-green-500', label: 'Done' },
  error: { icon: AlertCircle, className: 'text-red-500', label: 'Error' },
} as const;

export function ExportQueue({ queue, onRemove }: ExportQueueProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Queue</CardTitle>
          <Badge variant="outline">{queue.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {queue.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No workouts queued
          </p>
        ) : (
          queue.map(item => {
            const { icon: Icon, className, label } = STATUS_CONFIG[item.status];
            return (
              <div
                key={item.workoutId}
                data-testid={`export-queue-item-${item.workoutId}`}
                className="flex items-center gap-2 p-2 rounded-md border"
              >
                <Icon className={`w-4 h-4 shrink-0 ${className}`} title={label} />
                <span className="flex-1 text-sm truncate">{item.workout.title}</span>
                {item.error && (
                  <span className="text-xs text-red-500 truncate max-w-20" title={item.error}>
                    {item.error}
                  </span>
                )}
                {item.status === 'pending' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => onRemove(item.workoutId)}
                    aria-label="Remove from queue"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
```

### Step 2: Verify TypeScript compiles

```bash
npx tsc --noEmit 2>&1 | head -20
```

### Step 3: Commit

```bash
git add src/components/Export/ExportQueue.tsx
git commit -m "feat: add ExportQueue component"
```

---

## Task 5: `ExportPreview` component (3-tab preview)

**Files:**
- Create: `src/components/Export/ExportPreview.tsx`

Right column. Structural / Device / Format tabs.

### Step 1: Create `ExportPreview`

Create `src/components/Export/ExportPreview.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { getDeviceById } from '../../lib/devices';
import type { DeviceId } from '../../lib/devices';
import type { WorkoutStructure } from '../../types/workout';

interface ExportPreviewProps {
  workout: WorkoutStructure | null;
  destination: DeviceId;
  defaultTab?: 'structural' | 'device' | 'format';
}

function StructuralPreview({ workout }: { workout: WorkoutStructure }) {
  return (
    <div className="space-y-3 text-sm">
      {(workout.blocks || []).map((block, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{block.label}</span>
            {block.structure && (
              <Badge variant="outline" className="text-xs">{block.structure}</Badge>
            )}
          </div>
          <div className="pl-3 space-y-0.5">
            {(block.exercises || []).map((ex, j) => (
              <p key={j} className="text-muted-foreground text-xs">
                {ex.name}
                {ex.sets ? ` · ${ex.sets} sets` : ''}
                {ex.reps ? ` × ${ex.reps}` : ''}
                {ex.reps_range ? ` × ${ex.reps_range}` : ''}
                {ex.duration_sec ? ` · ${ex.duration_sec}s` : ''}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DevicePreview({ workout, destination }: { workout: WorkoutStructure; destination: DeviceId }) {
  const device = getDeviceById(destination);
  return (
    <div className="space-y-3">
      <div className="rounded-lg border-2 border-muted p-3 bg-muted/20 font-mono text-xs space-y-2">
        <div className="flex items-center justify-between border-b border-muted pb-1">
          <span className="font-bold text-sm">{workout.title}</span>
          <span className="text-muted-foreground">{device?.icon} {device?.name}</span>
        </div>
        {(workout.blocks || []).map((block, i) => (
          <div key={i}>
            <p className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
              {block.label} {block.structure ? `[${block.structure.toUpperCase()}]` : ''}
            </p>
            {(block.exercises || []).map((ex, j) => (
              <p key={j} className="pl-2 text-xs">
                {ex.sets ? `${ex.sets}×` : ''}{ex.reps ? `${ex.reps} ` : ''}{ex.reps_range ? `${ex.reps_range} ` : ''}{ex.name}
              </p>
            ))}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Simulated {device?.name ?? destination} display
      </p>
    </div>
  );
}

function FormatPreview({ workout, destination }: { workout: WorkoutStructure; destination: DeviceId }) {
  const device = getDeviceById(destination);
  const format = device?.format ?? 'JSON';
  const preview = JSON.stringify(
    {
      title: workout.title,
      format,
      blocks: (workout.blocks || []).map(b => ({
        label: b.label,
        structure: b.structure,
        exercises: (b.exercises || []).map(e => e.name),
      })),
    },
    null,
    2
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{format}</Badge>
        <span className="text-xs text-muted-foreground">Preview (first 30 lines)</span>
      </div>
      <pre className="text-xs bg-muted rounded-md p-3 overflow-auto max-h-64 font-mono">
        {preview}
      </pre>
    </div>
  );
}

export function ExportPreview({ workout, destination, defaultTab = 'device' }: ExportPreviewProps) {
  if (!workout) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-40">
          <p className="text-sm text-muted-foreground">Select a workout to preview</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full" data-testid="export-preview">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultTab}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="structural">Structural</TabsTrigger>
            <TabsTrigger value="device">Device</TabsTrigger>
            <TabsTrigger value="format">Format</TabsTrigger>
          </TabsList>
          <TabsContent value="structural">
            <StructuralPreview workout={workout} />
          </TabsContent>
          <TabsContent value="device">
            <DevicePreview workout={workout} destination={destination} />
          </TabsContent>
          <TabsContent value="format">
            <FormatPreview workout={workout} destination={destination} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
```

### Step 2: Verify TypeScript compiles

```bash
npx tsc --noEmit 2>&1 | head -20
```

### Step 3: Commit

```bash
git add src/components/Export/ExportPreview.tsx
git commit -m "feat: add ExportPreview 3-tab preview component"
```

---

## Task 6: `ExportConfig` component (middle column)

**Files:**
- Create: `src/components/Export/ExportConfig.tsx`

Middle column: destination selector, conflict cards, mapping resolution list, Export All button.

### Step 1: Create `ExportConfig`

Create `src/components/Export/ExportConfig.tsx`:

```tsx
import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { ConflictCard } from './ConflictCard';
import { MappingResolutionCard } from './MappingResolutionCard';
import { getPrimaryExportDestinations } from '../../lib/devices';
import type { DeviceId } from '../../lib/devices';
import type { ConflictItem } from '../../hooks/useExportFlow';
import type { ValidationResult } from '../../types/workout';

interface ExportConfigProps {
  destination: DeviceId;
  onDestinationChange: (device: DeviceId) => void;
  conflicts: ConflictItem[];
  unresolvedMappings: ValidationResult[];
  onResolveMapping: (original: string, mapped: string) => void;
  onExportAll: () => Promise<void>;
  loading: boolean;
  queueSize: number;
  onShowPreview: () => void;
}

export function ExportConfig({
  destination,
  onDestinationChange,
  conflicts,
  unresolvedMappings,
  onResolveMapping,
  onExportAll,
  loading,
  queueSize,
  onShowPreview,
}: ExportConfigProps) {
  const devices = getPrimaryExportDestinations().filter(d => d.exportMethod !== 'coming_soon');
  const canExport = queueSize > 0 && !loading;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Destination selector */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Destination</Label>
          <Select
            value={destination}
            onValueChange={v => onDestinationChange(v as DeviceId)}
          >
            <SelectTrigger data-testid="export-destination-select">
              <SelectValue placeholder="Choose destination" />
            </SelectTrigger>
            <SelectContent>
              {devices.map(d => (
                <SelectItem key={d.id} value={d.id}>
                  <div className="flex items-center gap-2">
                    <span>{d.icon}</span>
                    <span>{d.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Conflict warnings */}
        {conflicts.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-orange-600">
              Structure Warnings
            </Label>
            {conflicts.map((c, i) => (
              <ConflictCard key={i} conflict={c} onShowPreview={onShowPreview} />
            ))}
          </div>
        )}

        {/* Unresolved mappings */}
        {unresolvedMappings.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-medium">
              Exercise Mapping ({unresolvedMappings.length} to resolve)
            </Label>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {unresolvedMappings.map((ex, i) => (
                <MappingResolutionCard
                  key={i}
                  exercise={ex}
                  onResolve={onResolveMapping}
                />
              ))}
            </div>
          </div>
        )}

        {/* Export button */}
        <Button
          onClick={onExportAll}
          disabled={!canExport}
          className="w-full gap-2"
          data-testid="export-all-button"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Exporting…</>
          ) : (
            `Export ${queueSize > 1 ? `${queueSize} Workouts` : 'Workout'}`
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
```

### Step 2: Verify TypeScript compiles

```bash
npx tsc --noEmit 2>&1 | head -20
```

### Step 3: Commit

```bash
git add src/components/Export/ExportConfig.tsx
git commit -m "feat: add ExportConfig middle column component"
```

---

## Task 7: `ExportPage` — 3-column layout

**Files:**
- Create: `src/components/Export/ExportPage.tsx`
- Create: `src/components/Export/index.ts`

Main page component. Takes an initial workout + device from navigation state. Ties together Queue, Config, Preview.

### Step 1: Create `ExportPage`

Create `src/components/Export/ExportPage.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { ExportQueue } from './ExportQueue';
import { ExportConfig } from './ExportConfig';
import { ExportPreview } from './ExportPreview';
import { useExportFlow } from '../../hooks/useExportFlow';
import { validateWorkoutMapping, checkMapperApiHealth } from '../../lib/mapper-api';
import type { DeviceId } from '../../lib/devices';
import type { WorkoutStructure } from '../../types/workout';
import type { AppUser } from '../../app/useAppAuth';

interface ExportPageProps {
  user: AppUser;
  initialWorkout: WorkoutStructure;
  initialDevice: DeviceId;
  onBack: () => void;
}

export function ExportPage({ user, initialWorkout, initialDevice, onBack }: ExportPageProps) {
  const {
    queue,
    destination,
    mappings: _mappings,
    loading,
    addToQueue,
    removeFromQueue,
    setDestination,
    resolveMapping,
    detectConflicts,
    exportAll,
  } = useExportFlow({ userId: user.id });

  // Track loaded state so we only add initial workout once
  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    addToQueue(initialWorkout);
    if (initialDevice !== 'garmin') setDestination(initialDevice);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive conflicts for the first queued workout
  const firstWorkout = queue[0]?.workout ?? initialWorkout;
  const conflicts = detectConflicts(firstWorkout, destination);

  // Fetch unresolved mappings (simplified: use needs_review from validation)
  // In a full implementation this would be stored in hook state from validateWorkoutMapping
  // For now we surface a placeholder until Task 8 (validation integration) is done
  const unresolvedMappings = [] as any[];

  const handlePreviewTab = () => {
    // Scroll to / focus the Device tab in ExportPreview
    // Preview component handles its own tab state via defaultValue
  };

  return (
    <div className="space-y-4" data-testid="export-page">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="w-4 h-4" />
        Back
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Left: Queue */}
        <ExportQueue queue={queue} onRemove={removeFromQueue} />

        {/* Middle: Config */}
        <ExportConfig
          destination={destination}
          onDestinationChange={setDestination}
          conflicts={conflicts}
          unresolvedMappings={unresolvedMappings}
          onResolveMapping={resolveMapping}
          onExportAll={exportAll}
          loading={loading}
          queueSize={queue.length}
          onShowPreview={handlePreviewTab}
        />

        {/* Right: Preview */}
        <ExportPreview
          workout={firstWorkout}
          destination={destination}
          defaultTab="device"
        />
      </div>
    </div>
  );
}
```

### Step 2: Create barrel export

Create `src/components/Export/index.ts`:

```typescript
export { ExportPage } from './ExportPage';
export { ExportDevicePicker } from './ExportDevicePicker';
export { ExportQueue } from './ExportQueue';
export { ExportConfig } from './ExportConfig';
export { ExportPreview } from './ExportPreview';
export { ConflictCard } from './ConflictCard';
export { MappingResolutionCard } from './MappingResolutionCard';
```

### Step 3: Verify TypeScript compiles

```bash
npx tsc --noEmit 2>&1 | head -30
```

### Step 4: Commit

```bash
git add src/components/Export/
git commit -m "feat: add ExportPage 3-column layout"
```

---

## Task 8: Wire `ExportPage` into router and `WorkflowView`

**Files:**
- Modify: `src/app/router.tsx` — add `'export-page'` to `View` type, lazy-import `ExportPage`
- Modify: `src/app/WorkflowView.tsx` — render ExportPage for `currentView === 'export-page'`
- Modify: `src/app/WorkflowView.tsx` — pass `onExportWorkout` + `exportWorkout` state down

### Step 1: Update `router.tsx`

In `src/app/router.tsx`, add `'export-page'` to the `View` union and add the lazy export:

```typescript
// Add 'export-page' to the View type union after 'create-ai'
export type View =
  | 'home'
  | 'workflow'
  | 'profile'
  | 'analytics'
  | 'team'
  | 'settings'
  | 'strava-enhance'
  | 'calendar'
  | 'workouts'
  | 'mobile-companion'
  | 'import'
  | 'help'
  | 'exercise-history'
  | 'volume-analytics'
  | 'program-detail'
  | 'programs'
  | 'create-ai'
  | 'export-page';  // ← add this

// Add lazy import at the bottom of router.tsx
export const ExportPage = lazy(() =>
  import('../components/Export').then(m => ({ default: m.ExportPage }))
);
```

### Step 2: Update `WorkflowView.tsx` — add export routing state + ExportPage render

At the top of `WorkflowView`, add two new state pieces and the import:

```tsx
// Add to imports at top of WorkflowView.tsx
import { ExportPage } from './router'; // will be added to router above
import { useExportFlow } from '../hooks/useExportFlow';

// Add inside WorkflowView function, after the useWorkflowState destructure:
const [exportingWorkout, setExportingWorkout] = useState<WorkoutStructure | null>(null);
const [exportingDevice, setExportingDevice] = useState<DeviceId>(selectedDevice);

const { exportInline } = useExportFlow({ userId: user.id });

const handleOpenExportPage = (w: WorkoutStructure, device: DeviceId) => {
  setExportingWorkout(w);
  setExportingDevice(device);
  setCurrentView('export-page');
};

const handleInlineExport = async (w: WorkoutStructure, device: DeviceId) => {
  await exportInline(w, device, user.id);
};
```

Then add the render case inside the main content `<div>` (after the `workouts` view block):

```tsx
{currentView === 'export-page' && exportingWorkout && (
  <ExportPage
    user={user}
    initialWorkout={exportingWorkout}
    initialDevice={exportingDevice}
    onBack={() => setCurrentView('workouts')}
  />
)}
```

### Step 3: Pass `onExportWorkout` to WorkoutList in WorkflowView

In WorkflowView, find the `WorkoutList` render block (around line 364) and add `onExportWorkout`:

```tsx
<WorkoutList
  profileId={user.id}
  onEditWorkout={item => { ... }}
  onLoadWorkout={item => { ... }}
  onDeleteWorkout={id => { ... }}
  onViewProgram={programId => { ... }}
  onExportWorkout={(workout, device) => {            // ← add this
    if (getDeviceById(device)?.requiresMapping) {
      handleOpenExportPage(workout, device);
    } else {
      handleInlineExport(workout, device);
    }
  }}
/>
```

(Add `import { getDeviceById } from '../lib/devices';` to WorkflowView if not already present.)

### Step 4: Verify TypeScript compiles

```bash
npx tsc --noEmit 2>&1 | head -30
```

### Step 5: Commit

```bash
git add src/app/router.tsx src/app/WorkflowView.tsx
git commit -m "feat: wire ExportPage into router and WorkflowView"
```

---

## Task 9: Update `WorkoutList` to show `ExportDevicePicker`

**Files:**
- Modify: `src/components/Workouts/WorkoutList.tsx`

Add `onExportWorkout` prop. Add an Export button to both the cards and compact view that opens `ExportDevicePicker`.

### Step 1: Add prop to WorkoutList interface

In `src/components/Workouts/WorkoutList.tsx`, find the props interface (around line 85–105):

```typescript
// Add to the interface:
onExportWorkout?: (workout: WorkoutStructure, device: DeviceId) => void;
```

And import ExportDevicePicker + Button at the top:

```tsx
import { ExportDevicePicker } from '../Export/ExportDevicePicker';
import { Upload } from 'lucide-react'; // for the Export button icon
import type { DeviceId } from '../../lib/devices';
```

### Step 2: Add Export button to the card view

In the cards view section (around the existing `data-testid="workout-edit-{id}"` button), add after the edit button:

```tsx
{onExportWorkout && (
  <ExportDevicePicker
    workout={workout.workout as WorkoutStructure}
    userId={profileId}
    trigger={
      <Button
        variant="ghost"
        size="sm"
        data-testid={`workout-export-${workout.id}`}
        title="Export workout"
      >
        <Upload className="w-4 h-4" />
      </Button>
    }
    onInlineExport={async (w, device) => {
      await onExportWorkout(w, device);
    }}
    onOpenExportPage={(w, device) => {
      onExportWorkout(w, device);
    }}
  />
)}
```

Apply the same pattern to the compact view row.

### Step 3: Verify TypeScript compiles

```bash
npx tsc --noEmit 2>&1 | head -30
```

### Step 4: Verify dev server renders without console errors

```bash
npm run dev -- --port 5175 &
sleep 5
# Open http://localhost:5175 → navigate to My Workouts → should see Export buttons on cards
```

### Step 5: Commit

```bash
git add src/components/Workouts/WorkoutList.tsx
git commit -m "feat: add Export button and ExportDevicePicker to WorkoutList"
```

---

## Task 10: Update `StructureWorkout` — replace autoMap/validate with Export routing

**Files:**
- Modify: `src/components/StructureWorkout/StructureWorkout.tsx`
- Modify: `src/app/WorkflowView.tsx` — update StructureWorkout props

The Structure step currently shows "Auto-Map & Export" and "Validate & Review" buttons. Replace them with a single "Export" button that routes through the new system.

### Step 1: Update StructureWorkout props

In `src/components/StructureWorkout/StructureWorkout.tsx`, replace the `onAutoMap` and `onValidate` props with `onExport`:

```typescript
export interface StructureWorkoutProps {
  workout: WorkoutStructure;
  onWorkoutChange: (workout: WorkoutStructure) => void;
  onExport: (workout: WorkoutStructure) => void;  // ← replaces onAutoMap + onValidate
  onSave?: () => void | Promise<void>;
  isEditingFromHistory?: boolean;
  isCreatingFromScratch?: boolean;
  hideExport?: boolean;
  loading: boolean;
  selectedDevice: DeviceId;
  onDeviceChange: (device: DeviceId) => void;
  userSelectedDevices: DeviceId[];
  onNavigateToSettings?: () => void;
}
```

In the action buttons area (inside the `!hideExport` card, around line 238), replace the `needsMapping` branching with:

```tsx
// Replace the complex ternary buttons block with:
{isEditingFromHistory && (
  onSave && <Button onClick={onSave} disabled={loading} className="gap-2">
    <Save className="w-4 h-4" />Save Changes
  </Button>
)}
{!isEditingFromHistory && (
  <>
    {onSave && (
      <Button onClick={onSave} disabled={loading} variant="ghost" className="gap-2">
        <Save className="w-4 h-4" />Save Draft
      </Button>
    )}
    <Button
      onClick={() => onExport(workout)}
      disabled={loading}
      className="gap-2"
      data-testid="structure-export-button"
    >
      <Send className="w-4 h-4" />Export
    </Button>
  </>
)}
```

Remove the Export Destination `<Select>` section entirely from StructureWorkout (destination selection now lives in ExportDevicePicker / ExportConfig).

Remove `onAutoMap`, `onValidate` from destructured props. Remove `Send`, `Download`, `Wand2`, `ShieldCheck`, `Clock` imports if no longer used.

### Step 2: Update WorkflowView — fix StructureWorkout props

In `src/app/WorkflowView.tsx`, find the StructureWorkout render (around line 238):

```tsx
<StructureWorkout
  workout={workout}
  onWorkoutChange={updatedWorkout => { setWorkout(updatedWorkout); setWorkoutSaved(false); }}
  onExport={(w) => {                                    // ← replaces onAutoMap + onValidate
    handleOpenExportPage(w, selectedDevice);
  }}
  onSave={
    isEditingFromHistory || isCreatingFromScratch
      ? () => handleSaveFromStructure(exports, sources, validation)
      : undefined
  }
  isEditingFromHistory={isEditingFromHistory}
  isCreatingFromScratch={isCreatingFromScratch}
  hideExport={isEditingFromImport}
  loading={loading}
  selectedDevice={selectedDevice}
  onDeviceChange={setSelectedDevice}
  userSelectedDevices={user.selectedDevices}
  onNavigateToSettings={() => { checkUnsavedChanges(() => { clearWorkflowState(); setCurrentView('settings'); }); }}
/>
```

Remove `onAutoMap={handleAutoMap}` and `onValidate={handleValidate}` from the JSX.

### Step 3: Run unit tests

```bash
npm run test:run
```

Expected: All passing. If useWorkflowState tests reference `handleAutoMap`/`handleValidate` in the returned object, update those tests to remove those assertions.

### Step 4: Verify TypeScript compiles

```bash
npx tsc --noEmit 2>&1 | head -30
```

### Step 5: Commit

```bash
git add src/components/StructureWorkout/StructureWorkout.tsx src/app/WorkflowView.tsx
git commit -m "feat: replace autoMap/validate with Export routing in StructureWorkout"
```

---

## Task 11: Simplify `useWorkflowState` — remove validate/export steps

**Files:**
- Modify: `src/app/useWorkflowState.ts`
- Modify: `src/app/WorkflowView.tsx` — remove validate/export step header entries

The workflow now has 2 steps: Add Sources → Structure. The `validate` and `export` steps are removed from the steps array and from the router logic.

### Step 1: Update `useWorkflowState.ts` steps array

Find the `steps` array (around line 55):

```typescript
// Replace with:
const steps: Array<{ id: WorkflowStep; label: string; number: number }> = [
  { id: 'add-sources', label: 'Add Sources', number: 1 },
  { id: 'structure', label: 'Structure Workout', number: 2 },
];
```

Update the `WorkflowStep` type at the top of the file:

```typescript
type WorkflowStep = 'add-sources' | 'structure';
```

Remove or stub any `setCurrentStep('validate')` and `setCurrentStep('export')` calls in the hook — they should now just navigate to 'structure' or trigger export directly.

In `useWorkflowValidation.ts`, `handleAutoMap` calls `onStepChange('export')` — this code path is now unused (StructureWorkout no longer calls handleAutoMap). Do not delete the hook file yet (Task 12 cleans up), just ensure it doesn't break.

### Step 2: Run unit tests

```bash
npm run test:run -- src/app/__tests__/useWorkflowState.test.ts
```

Expected: All passing. If any test asserts `steps.length === 4` or expects `validate`/`export` steps, update those assertions to match the new 2-step structure.

### Step 3: Check the WorkflowView step header still renders correctly

Open the dev server and navigate to the workflow view. The step progress bar should show 2 steps (Add Sources, Structure Workout) not 4.

### Step 4: Commit

```bash
git add src/app/useWorkflowState.ts
git commit -m "refactor: simplify workflow to 2 steps, remove validate/export steps"
```

---

## Task 12: Delete `ValidateMap.tsx` and `PublishExport.tsx`

**Files:**
- Delete: `src/components/ValidateMap.tsx`
- Delete: `src/components/PublishExport.tsx`
- Delete: `src/components/PublishExport.tsx.bak` (and all .bak variants)
- Delete: `src/stories/screens/ValidateMap.stories.tsx`
- Delete: `src/stories/screens/PublishExport.stories.tsx`
- Modify: `src/app/WorkflowView.tsx` — remove ValidateMap/PublishExport imports and render blocks

### Step 1: Remove imports from WorkflowView

In `src/app/WorkflowView.tsx`, remove:
```tsx
import { ValidateMap } from '../components/ValidateMap';
import { PublishExport } from '../components/PublishExport';
```

Remove the render blocks:
- `{currentView === 'workflow' && currentStep === 'validate' && ...}` — delete entire block
- `{currentView === 'workflow' && currentStep === 'export' && ...}` — delete entire block

### Step 2: Delete the files

```bash
rm /Users/davidandrews/dev/AmakaFlow/amakaflow-ui/src/components/ValidateMap.tsx
rm /Users/davidandrews/dev/AmakaFlow/amakaflow-ui/src/components/PublishExport.tsx
rm /Users/davidandrews/dev/AmakaFlow/amakaflow-ui/src/components/PublishExport.tsx.bak*
rm /Users/davidandrews/dev/AmakaFlow/amakaflow-ui/src/stories/screens/ValidateMap.stories.tsx
rm /Users/davidandrews/dev/AmakaFlow/amakaflow-ui/src/stories/screens/PublishExport.stories.tsx
```

### Step 3: Verify TypeScript compiles clean

```bash
npx tsc --noEmit 2>&1
```

Expected: No errors. If there are any remaining references to ValidateMap or PublishExport, fix them before committing.

### Step 4: Run all unit tests

```bash
npm run test:run
```

Expected: All tests pass.

### Step 5: Commit

```bash
git add -A
git commit -m "refactor: delete ValidateMap and PublishExport (replaced by Export system)"
```

---

## Task 13: Playwright smoke tests for the new export system

**Files:**
- Create: `src/test/playwright/export-system.smoke.spec.ts`
- Modify: `src/test/playwright/pages/WorkoutsPage.ts` — add `getExportButton()` helper

These tests are the final validation that the new system works end-to-end against the demo server.

### Step 1: Add `getExportButton` to `WorkoutsPage.ts`

In `src/test/playwright/pages/WorkoutsPage.ts`, add after `getEditButton`:

```typescript
/**
 * Get the export button for a specific workout
 */
getExportButton(workoutId: string): Locator {
  return this.page.locator(`[data-testid="workout-export-${workoutId}"]`);
}

/**
 * Click the export button for a specific workout (opens ExportDevicePicker)
 */
async clickExportButton(workoutId: string) {
  await this.getExportButton(workoutId).click();
}
```

### Step 2: Write the smoke spec

Create `src/test/playwright/export-system.smoke.spec.ts`:

```typescript
/**
 * Export System Smoke Tests
 *
 * Verifies the new 2-path export system:
 *   - Export button appears on workout cards
 *   - ExportDevicePicker popover opens with device list
 *   - No-mapping devices show "1-tap" badge
 *   - Mapping-required devices navigate to ExportPage
 *   - ExportPage renders Queue, Config, Preview columns
 *
 * Tags: @smoke
 *
 * Usage:
 *   npx playwright test export-system.smoke.spec.ts --project=smoke
 */
import { test, expect } from '@playwright/test';
import { WorkoutsPage } from './pages/WorkoutsPage';

test.describe('Export System Smoke Tests @smoke', () => {
  let workoutsPage: WorkoutsPage;

  test.beforeEach(async ({ page }) => {
    workoutsPage = new WorkoutsPage(page);
    await workoutsPage.goto('/');
    await workoutsPage.waitForWorkoutsLoad();
  });

  // -----------------------------------------------------------------------
  // EXPSM-1: Export button visible on workout cards
  // -----------------------------------------------------------------------
  test('EXPSM-1: export button appears on each workout card', async ({ page }) => {
    const ids = await workoutsPage.getWorkoutIds();
    expect(ids.length, 'Need at least one workout').toBeGreaterThan(0);

    // Export button should be visible on the first workout card
    const exportBtn = workoutsPage.getExportButton(ids[0]);
    await expect(exportBtn).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // EXPSM-2: ExportDevicePicker popover opens
  // -----------------------------------------------------------------------
  test('EXPSM-2: clicking export opens device picker popover', async ({ page }) => {
    const ids = await workoutsPage.getWorkoutIds();
    await workoutsPage.clickExportButton(ids[0]);

    // Popover should list at least one device
    const firstDevice = page.locator('[data-testid^="export-picker-"]').first();
    await expect(firstDevice).toBeVisible({ timeout: 5_000 });
  });

  // -----------------------------------------------------------------------
  // EXPSM-3: iOS Companion shows "1-tap" badge (no mapping required)
  // -----------------------------------------------------------------------
  test('EXPSM-3: iOS Companion shows 1-tap badge in picker', async ({ page }) => {
    const ids = await workoutsPage.getWorkoutIds();
    await workoutsPage.clickExportButton(ids[0]);

    // The apple device picker entry should show the "1-tap" badge
    const appleEntry = page.locator('[data-testid="export-picker-apple"]');
    await expect(appleEntry).toBeVisible({ timeout: 5_000 });
    await expect(appleEntry.getByText('1-tap')).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // EXPSM-4: Garmin shows "Map" badge (requires mapping)
  // -----------------------------------------------------------------------
  test('EXPSM-4: Garmin shows Map badge in picker', async ({ page }) => {
    const ids = await workoutsPage.getWorkoutIds();
    await workoutsPage.clickExportButton(ids[0]);

    const garminEntry = page.locator('[data-testid="export-picker-garmin"]');
    await expect(garminEntry).toBeVisible({ timeout: 5_000 });
    await expect(garminEntry.getByText('Map')).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // EXPSM-5: Clicking Garmin navigates to ExportPage
  // -----------------------------------------------------------------------
  test('EXPSM-5: clicking Garmin in picker opens ExportPage', async ({ page }) => {
    const ids = await workoutsPage.getWorkoutIds();
    await workoutsPage.clickExportButton(ids[0]);

    const garminEntry = page.locator('[data-testid="export-picker-garmin"]');
    await garminEntry.waitFor({ state: 'visible', timeout: 5_000 });
    await garminEntry.click();

    // ExportPage should be visible
    await expect(page.locator('[data-testid="export-page"]')).toBeVisible({ timeout: 10_000 });

    // Should have Back button
    await expect(page.getByRole('button', { name: /Back/i })).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // EXPSM-6: ExportPage shows 3 columns (queue, config, preview)
  // -----------------------------------------------------------------------
  test('EXPSM-6: ExportPage shows queue, config, and preview', async ({ page }) => {
    const ids = await workoutsPage.getWorkoutIds();
    await workoutsPage.clickExportButton(ids[0]);

    const garminEntry = page.locator('[data-testid="export-picker-garmin"]');
    await garminEntry.waitFor({ state: 'visible', timeout: 5_000 });
    await garminEntry.click();

    await page.locator('[data-testid="export-page"]').waitFor({ state: 'visible', timeout: 10_000 });

    // Queue: at least one item
    await expect(page.locator('[data-testid^="export-queue-item-"]').first()).toBeVisible();

    // Config: destination select should be visible
    await expect(page.locator('[data-testid="export-destination-select"]')).toBeVisible();

    // Preview: preview panel visible
    await expect(page.locator('[data-testid="export-preview"]')).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // EXPSM-7: Workflow still shows 2 steps (not 4)
  // -----------------------------------------------------------------------
  test('EXPSM-7: workflow progress shows Add Sources and Structure Workout only', async ({ page }) => {
    // Navigate to the workflow view (Create Workout)
    await page.locator('[data-assistant-target="nav-create"]').click().catch(() => {
      // nav-create may not exist — try clicking via URL or other nav
    });

    // If no nav target, try navigating via URL
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for the step indicators
    // Step "Add Sources" should be visible, "Validate & Map" should NOT
    await expect(page.getByText('Add Sources')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Structure Workout')).toBeVisible();
    await expect(page.getByText('Validate & Map')).not.toBeVisible();
    await expect(page.getByText('Publish & Export')).not.toBeVisible();
  });
});
```

### Step 3: Run the smoke tests

Start the dev server and run:

```bash
npm run dev -- --port 5175 &
sleep 8
npx playwright test export-system.smoke.spec.ts --project=smoke
```

Expected: 7 tests pass. If any fail, diagnose by running with `--headed` to see what's happening:

```bash
npx playwright test export-system.smoke.spec.ts --project=smoke --headed
```

### Step 4: Commit

```bash
git add src/test/playwright/export-system.smoke.spec.ts src/test/playwright/pages/WorkoutsPage.ts
git commit -m "test: add export system Playwright smoke tests"
```

---

## Task 14: Final cleanup and PR

**Files:**
- Modify: `src/app/useWorkflowState.ts` — ensure `handleAutoMap`, `handleValidate`, `handleReValidate`, `handleProcess` are removed from return value (they were exported but nothing calls them anymore)
- Modify: `src/app/WorkflowView.tsx` — remove `handleAutoMap`, `handleValidate`, `handleReValidate`, `handleProcess` from the destructured return

### Step 1: Remove dead exports from useWorkflowState

In `useWorkflowState.ts`, find the return object and remove:
- `handleAutoMap`
- `handleValidate`
- `handleReValidate`
- `handleProcess`

These are now dead code — no component calls them.

Also remove `validation` and `exports` state from the return if nothing else uses them (check carefully — `handleSaveFromStructure` may still reference `exports`).

### Step 2: Run all tests

```bash
npm run test:run
npx playwright test --project=smoke
```

Expected: All pass.

### Step 3: Verify TypeScript is clean

```bash
npx tsc --noEmit 2>&1
```

Expected: Zero errors.

### Step 4: Final commit and PR

```bash
git add -A
git commit -m "refactor: remove dead validation/export state from useWorkflowState"

git push -u origin feat/ama-export-system-rewrite
gh pr create --title "feat: Export system rewrite — 2-path export with ExportPage" --body "$(cat <<'EOF'
## Summary
- Replaces 4-step Validate → Export wizard with a 2-path system
- Inline (1-tap) export for no-mapping devices (iOS Companion, CSV, Strava, Zwift) directly from workout list
- Guided ExportPage for mapping-required devices (Garmin, COROS) with 3-column layout
- MCP provider abstraction ready (standard vs mcp provider type in useExportFlow)
- Global mapping persistence via saveUserMapping (mapped once = never prompted again)
- Complex workout warnings for EMOM/AMRAP/TABATA/FOR-TIME blocks on native watch apps
- Deletes ValidateMap.tsx (745 lines) and PublishExport.tsx (1273 lines)

## Test Plan
- [ ] `npm run test:run` — all unit tests pass
- [ ] `npx playwright test --project=smoke` — all 15 + 7 new smoke tests pass
- [ ] Navigate to My Workouts → Export button visible on cards
- [ ] Click iOS Companion → exports inline, toast confirms
- [ ] Click Garmin → navigates to ExportPage, 3 columns visible
- [ ] ExportPage Preview: Device tab shows simulated Garmin display
- [ ] Workflow wizard shows 2 steps, not 4

Resolves: AMA-export-system-rewrite

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Quick Reference

| Task | What | Test |
|------|------|------|
| 1 | `useExportFlow` hook | Vitest: 9 unit tests |
| 2 | `ExportDevicePicker` popover | tsc |
| 3 | `ConflictCard` + `MappingResolutionCard` | tsc |
| 4 | `ExportQueue` | tsc |
| 5 | `ExportPreview` (3 tabs) | tsc |
| 6 | `ExportConfig` | tsc |
| 7 | `ExportPage` + barrel export | tsc |
| 8 | Wire into router + WorkflowView | tsc |
| 9 | WorkoutList export button | tsc + visual check |
| 10 | StructureWorkout → onExport | unit tests |
| 11 | Simplify workflow steps | unit tests |
| 12 | Delete ValidateMap + PublishExport | tsc + unit tests |
| 13 | Playwright smoke tests (7 new) | playwright |
| 14 | Final cleanup + PR | all tests green |
