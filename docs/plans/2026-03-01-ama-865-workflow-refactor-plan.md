# AMA-865 WorkflowView Refactor — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split `WorkflowView.tsx` (1,493 lines, 24 useState) into 3 domain hooks + thin composer, making it testable and reducing the file to ~150 lines of pure JSX.

**Architecture:** Option B from the design doc — `useWorkflowGeneration`, `useWorkflowEditing`, `useWorkflowValidation` each own their domain state and handlers. `useWorkflowState` (composer) owns the bridge state shared across all three (`workout`, `workoutSaved`, `currentStep`, `confirmDialog`, `workoutTypeDialog`). `WorkflowView` calls only `useWorkflowState()`.

**Tech Stack:** React, TypeScript, Vitest + @testing-library/react (renderHook), Sonner toasts

**Design doc:** `docs/plans/2026-03-01-workflow-view-refactor-design.md`

---

## Before You Start

Read the existing `WorkflowView.tsx` to understand what you're moving. Do **not** change any behaviour — this is a pure refactor. Run `npm run build` and `npm test` to establish a clean baseline before touching anything.

```bash
npm run build
npm test
```

Both must pass. If they don't, stop and report — do not proceed.

---

## Task 1: Create directory structure + stub files

**Files:**
- Create: `src/app/hooks/useWorkflowGeneration.ts`
- Create: `src/app/hooks/useWorkflowEditing.ts`
- Create: `src/app/hooks/useWorkflowValidation.ts`
- Create: `src/app/hooks/__tests__/useWorkflowGeneration.test.ts`
- Create: `src/app/hooks/__tests__/useWorkflowEditing.test.ts`
- Create: `src/app/hooks/__tests__/useWorkflowValidation.test.ts`
- Create: `src/app/useWorkflowState.ts`

**Step 1: Create the directory**

```bash
mkdir -p src/app/hooks/__tests__
```

**Step 2: Write stub hooks (minimal exports so TypeScript is happy)**

`src/app/hooks/useWorkflowGeneration.ts`:
```typescript
export function useWorkflowGeneration(_props: Record<string, unknown>) {
  return {};
}
```

`src/app/hooks/useWorkflowEditing.ts`:
```typescript
export function useWorkflowEditing(_props: Record<string, unknown>) {
  return {};
}
```

`src/app/hooks/useWorkflowValidation.ts`:
```typescript
export function useWorkflowValidation(_props: Record<string, unknown>) {
  return {};
}
```

`src/app/useWorkflowState.ts`:
```typescript
export function useWorkflowState(_props: Record<string, unknown>) {
  return {};
}
```

**Step 3: Write minimal stub test files**

`src/app/hooks/__tests__/useWorkflowGeneration.test.ts`:
```typescript
import { describe, it } from 'vitest';

describe('useWorkflowGeneration', () => {
  it.todo('loading transitions correctly during generation');
  it.todo('workout is set on success via onWorkoutGenerated callback');
  it.todo('abort resets loading state');
});
```

`src/app/hooks/__tests__/useWorkflowEditing.test.ts`:
```typescript
import { describe, it } from 'vitest';

describe('useWorkflowEditing', () => {
  it.todo('isEditingFromHistory toggles correctly');
  it.todo('isEditingFromImport toggles correctly');
});
```

`src/app/hooks/__tests__/useWorkflowValidation.test.ts`:
```typescript
import { describe, it } from 'vitest';

describe('useWorkflowValidation', () => {
  it.todo('validation and exports populated on success');
  it.todo('loading resets on error');
});
```

**Step 4: Verify build still passes**

```bash
npm run build
```

Expected: Build succeeds (no TypeScript errors).

**Step 5: Commit**

```bash
git add src/app/hooks/ src/app/useWorkflowState.ts
git commit -m "chore: scaffold hook directories and stub files for AMA-865"
```

---

## Task 2: Implement useWorkflowGeneration

This hook owns all state related to generating a workout from sources.

**Files:**
- Modify: `src/app/hooks/useWorkflowGeneration.ts`
- Modify: `src/app/hooks/__tests__/useWorkflowGeneration.test.ts`

### What moves here from WorkflowView.tsx

State (lines 100–160):
- `welcomeDismissed` (line 100)
- `showStravaEnhance` (line 108)
- `sources` (line 109)
- `loading` (line 113)
- `generationProgress` (line 114)
- `generationAbortController` (line 115)
- `apiAvailable` (line 116)
- `pinterestBulkModal` (line 125)
- `buildTimestamp` (line 160)

Handlers:
- `handleWelcomeDismiss` (line 103)
- `handleGenerateStructure` (line 218) — complex, move wholesale
- `handleCancelGeneration` (line 537)
- `handlePinterestBulkImport` (line 589)
- `handlePinterestEditSingle` (line 614)
- `handlePinterestBulkClose` (line 625)
- `handleLoadTemplate` (line 634)
- `handleCreateNew` (line 644)
- `handleStartNew` (line 207) — also resets composer state via callbacks

useEffect:
- API health check (lines 172–194)

### Callback changes inside handleGenerateStructure

`handleGenerateStructure` calls several things that will become callbacks:
- `setWorkout(...)` → `props.onWorkoutGenerated(workout, sources)`
- `setSources(newSources)` → included in `onWorkoutGenerated` callback
- `setCurrentStep('structure')` → `props.onStepChange('structure')`
- `setWorkoutSaved(false)` → `props.onWorkoutSaved(false)`
- `setWorkoutTypeDialog({...})` → `props.onWorkoutTypePending(workout, type, confidence, sources)`
- `clearWorkflowState()` → `props.clearWorkflowState()`
- `setCurrentView('import')` → `props.onViewChange('import')`

`handlePinterestEditSingle` calls:
- `setWorkout(normalized)` → `props.onWorkoutGenerated(normalized, [])`
- `setCurrentStep('structure')` → `props.onStepChange('structure')`
- `setWorkoutSaved(false)` → `props.onWorkoutSaved(false)`

`handleLoadTemplate` calls:
- `setWorkout(template)` → `props.onWorkoutGenerated(template, [])`
- `setCurrentStep('structure')` → `props.onStepChange('structure')`

`handleCreateNew` calls:
- `setWorkout(emptyWorkout)` → `props.onWorkoutGenerated(emptyWorkout, [])`
- `setCurrentStep('structure')` → `props.onStepChange('structure')`

`handleStartNew` calls:
- `setSources([])` — own state
- `setWorkout(null)` → `props.onClearWorkout()`
- `setValidation(null)` → included in `onClearWorkout`
- `setExports(null)` → included in `onClearWorkout`
- `setCurrentStep('add-sources')` → `props.onStepChange('add-sources')`
- `setCurrentView('workflow')` → `props.onViewChange('workflow')`
- `setIsEditingFromHistory(false)` → `props.onClearEditingFlags()`
- `setEditingWorkoutId(null)` → included in `onClearEditingFlags`

### Step 1: Write failing tests

Replace `src/app/hooks/__tests__/useWorkflowGeneration.test.ts` with:

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkflowGeneration } from '../useWorkflowGeneration';

vi.mock('../../../lib/api', () => ({
  checkApiHealth: vi.fn().mockResolvedValue(true),
  generateWorkoutStructure: vi.fn(),
  normalizeWorkoutStructure: vi.fn(w => w),
}));

vi.mock('../../../lib/mock-api', () => ({
  generateWorkoutStructure: vi.fn(),
}));

const mockWorkout = { title: 'Test', blocks: [], workout_type: undefined, workout_type_confidence: undefined };

const defaultProps = {
  userId: 'user-1',
  selectedDevice: 'garmin' as const,
  refreshHistory: vi.fn().mockResolvedValue(undefined),
  onWorkoutGenerated: vi.fn(),
  onWorkoutTypePending: vi.fn(),
  onWorkoutSaved: vi.fn(),
  onStepChange: vi.fn(),
  onViewChange: vi.fn(),
  onClearWorkout: vi.fn(),
  onClearEditingFlags: vi.fn(),
  clearWorkflowState: vi.fn(),
};

describe('useWorkflowGeneration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts with loading=false', () => {
    const { result } = renderHook(() => useWorkflowGeneration(defaultProps));
    expect(result.current.loading).toBe(false);
  });

  it('sets loading=true during generation, then false on success', async () => {
    const { generateWorkoutStructure } = await import('../../../lib/api');
    (generateWorkoutStructure as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorkout);

    const { result } = renderHook(() => useWorkflowGeneration(defaultProps));

    let promise: Promise<void>;
    act(() => {
      promise = result.current.handleGenerateStructure([
        { id: '1', type: 'text', content: 'test' },
      ]);
    });

    expect(result.current.loading).toBe(true);

    await act(async () => { await promise; });

    expect(result.current.loading).toBe(false);
  });

  it('calls onWorkoutGenerated with workout and sources on success', async () => {
    const { generateWorkoutStructure } = await import('../../../lib/api');
    (generateWorkoutStructure as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorkout);

    const onWorkoutGenerated = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowGeneration({ ...defaultProps, onWorkoutGenerated })
    );

    const sources = [{ id: '1', type: 'text' as const, content: 'hello' }];
    await act(async () => {
      await result.current.handleGenerateStructure(sources);
    });

    expect(onWorkoutGenerated).toHaveBeenCalledWith(mockWorkout, sources);
  });

  it('abort: handleCancelGeneration resets loading to false', async () => {
    const { generateWorkoutStructure } = await import('../../../lib/api');
    (generateWorkoutStructure as ReturnType<typeof vi.fn>).mockImplementation(
      (_sources: unknown, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('AbortError'), { name: 'AbortError' }))
          );
        })
    );

    const { result } = renderHook(() => useWorkflowGeneration(defaultProps));

    act(() => {
      void result.current.handleGenerateStructure([{ id: '1', type: 'text', content: 'x' }]);
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      result.current.handleCancelGeneration();
    });

    expect(result.current.loading).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/app/hooks/__tests__/useWorkflowGeneration.test.ts
```

Expected: FAIL — "useWorkflowGeneration does not have loading" or similar.

**Step 3: Implement useWorkflowGeneration**

Replace `src/app/hooks/useWorkflowGeneration.ts` with the full implementation:

```typescript
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import {
  generateWorkoutStructure as generateWorkoutStructureReal,
  checkApiHealth,
  normalizeWorkoutStructure,
} from '../../lib/api';
import { generateWorkoutStructure as generateWorkoutStructureMock } from '../../lib/mock-api';
import { applyWorkoutTypeDefaults } from '../../lib/workoutTypeDefaults';
import { saveWorkoutToAPI } from '../../lib/workout-api';
import { getWorkoutHistory } from '../../lib/workout-history';
import { isDemoMode } from '../../lib/demo-mode';
import type { WorkoutStructure, WorkoutType } from '../../types/workout';
import type { Source } from '../../components/AddSources';
import type { View } from '../router';
import type { DeviceId } from '../../lib/devices';

type WorkflowStep = 'add-sources' | 'structure' | 'validate' | 'export';

interface PinterestBulkModalState {
  open: boolean;
  workouts: WorkoutStructure[];
  originalTitle: string;
  sourceUrl: string;
}

export interface UseWorkflowGenerationProps {
  userId: string;
  selectedDevice: DeviceId;
  refreshHistory: () => Promise<void>;
  onWorkoutGenerated: (workout: WorkoutStructure, sources: Source[]) => void;
  onWorkoutTypePending: (
    workout: WorkoutStructure,
    type: WorkoutType,
    confidence: number,
    sources: Source[]
  ) => void;
  onWorkoutSaved: (saved: boolean) => void;
  onStepChange: (step: WorkflowStep) => void;
  onViewChange: (view: View) => void;
  onClearWorkout: () => void;
  onClearEditingFlags: () => void;
  clearWorkflowState: () => void;
}

export interface UseWorkflowGenerationResult {
  sources: Source[];
  loading: boolean;
  generationProgress: string | null;
  apiAvailable: boolean | null;
  showStravaEnhance: boolean;
  pinterestBulkModal: PinterestBulkModalState;
  welcomeDismissed: boolean;
  buildTimestamp: string;
  handleGenerateStructure: (newSources: Source[]) => Promise<void>;
  handleCancelGeneration: () => void;
  handlePinterestBulkImport: (workouts: WorkoutStructure[]) => Promise<void>;
  handlePinterestEditSingle: (w: WorkoutStructure) => void;
  handlePinterestBulkClose: () => void;
  handleLoadTemplate: (template: WorkoutStructure) => void;
  handleCreateNew: () => Promise<void>;
  handleStartNew: () => void;
  handleWelcomeDismiss: () => void;
  setSources: React.Dispatch<React.SetStateAction<Source[]>>;
}

export function useWorkflowGeneration({
  userId,
  selectedDevice,
  refreshHistory,
  onWorkoutGenerated,
  onWorkoutTypePending,
  onWorkoutSaved,
  onStepChange,
  onViewChange,
  onClearWorkout,
  onClearEditingFlags,
  clearWorkflowState,
}: UseWorkflowGenerationProps): UseWorkflowGenerationResult {
  const [welcomeDismissed, setWelcomeDismissed] = useState(
    () => localStorage.getItem('amakaflow_welcome_dismissed') === 'true'
  );
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);
  const [generationAbortController, setGenerationAbortController] =
    useState<AbortController | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [showStravaEnhance, setShowStravaEnhance] = useState(false);
  const [pinterestBulkModal, setPinterestBulkModal] = useState<PinterestBulkModalState>({
    open: false,
    workouts: [],
    originalTitle: '',
    sourceUrl: '',
  });
  const [buildTimestamp] = useState(() => new Date().toISOString());

  // Check API availability on mount
  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        const available = await checkApiHealth();
        if (mounted) setApiAvailable(available);
      } catch {
        if (mounted) setApiAvailable(false);
      }
    };
    const timeoutId = setTimeout(checkHealth, 500);
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  const handleWelcomeDismiss = () => {
    localStorage.setItem('amakaflow_welcome_dismissed', 'true');
    setWelcomeDismissed(true);
  };

  const handleStartNew = () => {
    setSources([]);
    onClearWorkout();
    onStepChange('add-sources');
    onViewChange('workflow');
    onClearEditingFlags();
  };

  const handleGenerateStructure = async (newSources: Source[]): Promise<void> => {
    const abortController = new AbortController();
    setGenerationAbortController(abortController);
    setLoading(true);
    setGenerationProgress('Initializing...');

    const loadingToast = toast.loading(
      'Generating workout structure... This may take a minute for complex images.',
      { id: 'generate-structure' }
    );

    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => {
        if (!prev) return 'Processing...';
        const messages = [
          'Extracting text from image...',
          'Processing OCR data...',
          'Parsing workout structure...',
          'Validating exercises...',
          'Finalizing structure...',
        ];
        const currentIndex = messages.findIndex(m => prev.includes(m.split('...')[0]));
        const nextIndex =
          currentIndex >= 0 && currentIndex < messages.length - 1 ? currentIndex + 1 : 0;
        return messages[nextIndex];
      });
    }, 10000);

    try {
      setGenerationProgress('Checking API availability...');
      let isApiAvailable = apiAvailable;
      if (isApiAvailable === null || isApiAvailable === false) {
        try {
          isApiAvailable = await checkApiHealth();
        } catch {
          isApiAvailable = false;
        }
      }
      setApiAvailable(isApiAvailable);

      if (abortController.signal.aborted) throw new Error('Generation cancelled');

      setGenerationProgress('Preparing sources...');
      const sourcesData = newSources.map(s => ({ type: s.type, content: s.content }));

      let structure: WorkoutStructure;
      if (isApiAvailable) {
        try {
          setGenerationProgress('Sending request to API...');
          structure = await generateWorkoutStructureReal(sourcesData, abortController.signal);
        } catch (apiError: any) {
          if (apiError.name === 'AbortError' || abortController.signal.aborted) {
            throw new Error('Generation cancelled');
          }
          throw new Error(`API error: ${apiError.message || 'Failed to generate workout'}`);
        }
      } else {
        structure = await generateWorkoutStructureMock(sourcesData);
      }

      if (abortController.signal.aborted) throw new Error('Generation cancelled');

      setGenerationProgress('Analyzing quality...');

      const usedVisionAPI = (structure as any)?._usedVisionAPI === true;
      const sourceIsImage = newSources.some(s => s.type === 'image');
      const { getImageProcessingMethod } = await import('../../lib/preferences');
      const currentMethod = getImageProcessingMethod();
      const actuallyUsedVision = usedVisionAPI || currentMethod === 'vision';

      if (!actuallyUsedVision && structure && sourceIsImage) {
        const { analyzeOCRQuality } = await import('../../lib/ocr-quality');
        const quality = analyzeOCRQuality(structure, actuallyUsedVision);

        const shouldBlock = quality && (quality.recommendation === 'poor' || quality.score < 40);

        if (shouldBlock) {
          clearInterval(progressInterval);
          setLoading(false);
          setGenerationProgress(null);
          setGenerationAbortController(null);
          onStepChange('add-sources');
          toast.dismiss('generate-structure');
          toast.error(
            <div className="space-y-3">
              <div className="font-semibold">OCR Quality Too Low: {quality.score}%</div>
              <div className="text-sm">
                This image is too complex for OCR. Please switch to the{' '}
                <strong>AI Vision Model</strong> for better accuracy.
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    const { setImageProcessingMethod } = await import('../../lib/preferences');
                    setImageProcessingMethod('vision');
                    toast.success('Switched to Vision API. Please try again.');
                    setTimeout(() => window.location.reload(), 500);
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Switch to Vision API
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    clearWorkflowState();
                    onViewChange('settings');
                  }}
                >
                  Go to Settings
                </Button>
              </div>
            </div>,
            { duration: 20000, id: 'ocr-quality-block' }
          );
          return;
        }
      }

      setGenerationProgress('Complete!');

      const detectedType = structure.workout_type as WorkoutType | undefined;
      const typeConfidence = structure.workout_type_confidence ?? 0;

      // Check for bulk workouts (Pinterest multi-day plans)
      const bulkWorkouts = (structure as any)._bulkWorkouts;
      if (bulkWorkouts && bulkWorkouts.length > 1) {
        const originalTitle =
          ((structure as any)._provenance?.original_title as string) || structure.title;
        const workoutLabels = ((structure as any)._provenance?.workout_labels as string[]) || [];

        clearInterval(progressInterval);
        setLoading(false);
        setGenerationProgress(null);
        setGenerationAbortController(null);
        toast.dismiss('generate-structure');

        toast.error(
          `"${originalTitle}" contains ${bulkWorkouts.length} separate workouts (${workoutLabels
            .slice(0, 3)
            .join(', ')}${workoutLabels.length > 3 ? '...' : ''}). Please use Import to import all workouts at once.`,
          {
            duration: 15000,
            id: 'pinterest-bulk-error',
            action: {
              label: 'Go to Import',
              onClick: () => {
                clearWorkflowState();
                onViewChange('import');
                toast.info(
                  `Paste your Pinterest URL in Import to import all ${bulkWorkouts.length} workouts.`
                );
              },
            },
          }
        );
        return;
      }

      // Handle workout type detection
      if (detectedType && typeConfidence > 0) {
        if (typeConfidence >= 0.9) {
          const workoutWithDefaults = applyWorkoutTypeDefaults(structure, detectedType);
          clearInterval(progressInterval);
          setLoading(false);
          setGenerationProgress(null);
          setGenerationAbortController(null);
          toast.dismiss('generate-structure');
          onWorkoutGenerated(workoutWithDefaults, newSources);
          onStepChange('structure');
          onWorkoutSaved(false);
          toast.success(`Workout structure generated! (${detectedType} workout - settings applied)`);
          return;
        } else {
          clearInterval(progressInterval);
          setLoading(false);
          setGenerationProgress(null);
          setGenerationAbortController(null);
          toast.dismiss('generate-structure');
          onWorkoutTypePending(structure, detectedType, typeConfidence, newSources);
          return;
        }
      }

      // No workout type detected
      onWorkoutGenerated(structure, newSources);
      onStepChange('structure');
      onWorkoutSaved(false);
      clearInterval(progressInterval);
      setLoading(false);
      setGenerationProgress(null);
      setGenerationAbortController(null);
      toast.dismiss('generate-structure');
      toast.success('Workout structure generated!');
    } catch (error: any) {
      clearInterval(progressInterval);
      toast.dismiss('generate-structure');
      const errorMessage = error?.message || 'Failed to generate workout';
      if (errorMessage.includes('cancelled')) {
        toast.info('Generation cancelled');
      } else if (errorMessage.includes('timeout')) {
        toast.error(errorMessage, {
          action: { label: 'Retry', onClick: () => handleGenerateStructure(newSources) },
        });
      } else {
        toast.error(errorMessage, {
          action: { label: 'Retry', onClick: () => handleGenerateStructure(newSources) },
        });
      }
    } finally {
      setLoading(false);
      setGenerationProgress(null);
      setGenerationAbortController(null);
    }
  };

  const handleCancelGeneration = () => {
    if (generationAbortController) {
      generationAbortController.abort();
      setGenerationAbortController(null);
    }
  };

  const handlePinterestBulkImport = async (workouts: WorkoutStructure[]): Promise<void> => {
    const profileId = userId;
    for (const w of workouts) {
      try {
        const normalized = normalizeWorkoutStructure(w);
        await saveWorkoutToAPI({
          profile_id: profileId,
          workout_data: normalized,
          sources: [w.source || pinterestBulkModal.sourceUrl],
          device: selectedDevice,
          title: w.title,
        });
      } catch (error) {
        console.error('Failed to save workout:', w.title, error);
        throw error;
      }
    }
    await refreshHistory();
  };

  const handlePinterestEditSingle = (w: WorkoutStructure) => {
    const normalized = normalizeWorkoutStructure(w);
    onWorkoutGenerated(normalized, []);
    onStepChange('structure');
    onWorkoutSaved(false);
    toast.success(`Editing: ${w.title}`);
  };

  const handlePinterestBulkClose = () => {
    setPinterestBulkModal({ open: false, workouts: [], originalTitle: '', sourceUrl: '' });
  };

  const handleLoadTemplate = (template: WorkoutStructure) => {
    onWorkoutGenerated(template, []);
    onStepChange('structure');
    onWorkoutSaved(false);
    toast.success(`Loaded template: ${template.title}`);
  };

  const handleCreateNew = async (): Promise<void> => {
    try {
      const { createEmptyWorkout } = await import('../../lib/api');
      const emptyWorkout = await createEmptyWorkout();
      onWorkoutGenerated(emptyWorkout, []);
      onStepChange('structure');
      onWorkoutSaved(false);
      toast.success('Created new workout. Start building your workout structure!');
    } catch (error: any) {
      console.error('Failed to create empty workout:', error);
      toast.error('Failed to create workout. Please try again.');
    }
  };

  return {
    sources,
    loading,
    generationProgress,
    apiAvailable,
    showStravaEnhance,
    pinterestBulkModal,
    welcomeDismissed,
    buildTimestamp,
    handleGenerateStructure,
    handleCancelGeneration,
    handlePinterestBulkImport,
    handlePinterestEditSingle,
    handlePinterestBulkClose,
    handleLoadTemplate,
    handleCreateNew,
    handleStartNew,
    handleWelcomeDismiss,
    setSources,
  };
}
```

**Note:** This file uses JSX in the OCR quality toast. Rename it to `useWorkflowGeneration.tsx` so TypeScript accepts JSX.

```bash
mv src/app/hooks/useWorkflowGeneration.ts src/app/hooks/useWorkflowGeneration.tsx
# also update the test import
```

**Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/app/hooks/__tests__/useWorkflowGeneration.test.ts
```

Expected: All 4 tests PASS.

**Step 5: Build check**

```bash
npm run build
```

Expected: No errors.

**Step 6: Commit**

```bash
git add src/app/hooks/useWorkflowGeneration.tsx src/app/hooks/__tests__/useWorkflowGeneration.test.ts
git commit -m "feat(AMA-865): implement useWorkflowGeneration hook"
```

---

## Task 3: Implement useWorkflowEditing

This hook owns all state related to editing an existing workout (from history or import).

**Files:**
- Modify: `src/app/hooks/useWorkflowEditing.ts`
- Modify: `src/app/hooks/__tests__/useWorkflowEditing.test.ts`

### What moves here from WorkflowView.tsx

State:
- `isEditingFromHistory` (line 117)
- `isCreatingFromScratch` (line 118)
- `isEditingFromImport` (line 119)
- `editingWorkoutId` (line 120)
- `importProcessedItems` (line 121)
- `editingImportQueueId` (line 122)
- `selectedProgramId` (line 124)

Handlers:
- `handleLoadFromHistory` (line 849)
- `handleEditFromHistory` (line 869)
- `handleBulkDeleteWorkouts` (line 890)
- Inline `onSave` handler in StructureWorkout JSX (lines 1162–1193) → extract as `handleSaveFromStructure`
- Inline `onEditWorkout` in WorkflowView ImportScreen JSX (lines 1388–1401) → extract as `handleEditFromImport`
- Inline "Back to Import" button handler (lines 1091–1112) → extract as `handleBackToImport`
- Inline onEditWorkout + onLoadWorkout in UnifiedWorkouts JSX (lines 1316–1348) → already covered by handleEditFromHistory / handleLoadFromHistory but with normalized workout

### Step 1: Write failing tests

Replace `src/app/hooks/__tests__/useWorkflowEditing.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkflowEditing } from '../useWorkflowEditing';
import type { ProcessedItem } from '../../../types/import';

vi.mock('../../../lib/workout-history', () => ({
  saveWorkoutToHistory: vi.fn().mockResolvedValue(undefined),
  deleteWorkoutFromHistory: vi.fn().mockResolvedValue(true),
}));

const mockWorkout = { title: 'Test', blocks: [], name: 'Test' };

const defaultProps = {
  userId: 'user-1',
  selectedDevice: 'garmin' as const,
  setSelectedDevice: vi.fn(),
  refreshHistory: vi.fn().mockResolvedValue(undefined),
  onStepChange: vi.fn(),
  onViewChange: vi.fn(),
  setWorkout: vi.fn(),
  setWorkoutSaved: vi.fn(),
  setSources: vi.fn(),
  setValidation: vi.fn(),
  setExports: vi.fn(),
  setConfirmDialog: vi.fn(),
  workout: null,
  workoutSaved: false,
  importProcessedItems: [] as ProcessedItem[],
  setImportProcessedItems: vi.fn(),
};

describe('useWorkflowEditing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts with all editing flags false', () => {
    const { result } = renderHook(() => useWorkflowEditing(defaultProps));
    expect(result.current.isEditingFromHistory).toBe(false);
    expect(result.current.isEditingFromImport).toBe(false);
    expect(result.current.isCreatingFromScratch).toBe(false);
    expect(result.current.editingWorkoutId).toBeNull();
  });

  it('handleEditFromHistory sets isEditingFromHistory=true and calls setWorkout', () => {
    const setWorkout = vi.fn();
    const { result } = renderHook(() => useWorkflowEditing({ ...defaultProps, setWorkout }));

    const historyItem = {
      id: 'hist-1',
      workout: mockWorkout,
      sources: [],
      device: 'garmin',
      validation: null,
      exports: null,
    };

    act(() => {
      result.current.handleEditFromHistory(historyItem);
    });

    expect(result.current.isEditingFromHistory).toBe(true);
    expect(result.current.editingWorkoutId).toBe('hist-1');
    expect(setWorkout).toHaveBeenCalled();
  });

  it('handleEditFromImport sets isEditingFromImport=true', () => {
    const { result } = renderHook(() => useWorkflowEditing(defaultProps));

    act(() => {
      result.current.handleEditFromImport('queue-1', mockWorkout as any);
    });

    expect(result.current.isEditingFromImport).toBe(true);
    expect(result.current.editingImportQueueId).toBe('queue-1');
  });

  it('handleBackToImport updates importProcessedItems and navigates to import', () => {
    const setImportProcessedItems = vi.fn();
    const onViewChange = vi.fn();
    const processedItem: ProcessedItem = {
      queueId: 'queue-1',
      status: 'done',
      workout: mockWorkout as any,
      workoutTitle: 'Test',
      blockCount: 0,
      exerciseCount: 0,
      sourceIcon: 'file',
    };

    const { result } = renderHook(() =>
      useWorkflowEditing({
        ...defaultProps,
        onViewChange,
        setImportProcessedItems,
        importProcessedItems: [processedItem],
        workout: { ...mockWorkout, blocks: [], name: 'Updated' } as any,
      })
    );

    // First set up import editing state
    act(() => {
      result.current.handleEditFromImport('queue-1', mockWorkout as any);
    });

    act(() => {
      result.current.handleBackToImport({ ...mockWorkout, name: 'Updated' } as any);
    });

    expect(setImportProcessedItems).toHaveBeenCalled();
    expect(onViewChange).toHaveBeenCalledWith('import');
    expect(result.current.isEditingFromImport).toBe(false);
  });
});
```

**Step 2: Run to verify failure**

```bash
npx vitest run src/app/hooks/__tests__/useWorkflowEditing.test.ts
```

Expected: FAIL.

**Step 3: Implement useWorkflowEditing**

```typescript
import { useState } from 'react';
import { toast } from 'sonner';
import { normalizeWorkoutStructure } from '../../lib/api';
import type { WorkoutStructure, ValidationResponse, ExportFormats } from '../../types/workout';
import type { ProcessedItem } from '../../types/import';
import type { Source } from '../../components/AddSources';
import type { View } from '../router';
import type { DeviceId } from '../../lib/devices';
import type React from 'react';

type WorkflowStep = 'add-sources' | 'structure' | 'validate' | 'export';

interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
}

export interface UseWorkflowEditingProps {
  userId: string;
  selectedDevice: DeviceId;
  setSelectedDevice: (d: DeviceId) => void;
  refreshHistory: () => Promise<void>;
  onStepChange: (step: WorkflowStep) => void;
  onViewChange: (view: View) => void;
  setWorkout: (w: WorkoutStructure | null) => void;
  setWorkoutSaved: (saved: boolean) => void;
  setSources: (sources: Source[]) => void;
  setValidation: (v: ValidationResponse | null) => void;
  setExports: (e: ExportFormats | null) => void;
  setConfirmDialog: React.Dispatch<React.SetStateAction<ConfirmDialogState>>;
  workout: WorkoutStructure | null;
  workoutSaved: boolean;
  importProcessedItems: ProcessedItem[];
  setImportProcessedItems: React.Dispatch<React.SetStateAction<ProcessedItem[]>>;
}

export interface UseWorkflowEditingResult {
  isEditingFromHistory: boolean;
  isCreatingFromScratch: boolean;
  isEditingFromImport: boolean;
  editingWorkoutId: string | null;
  editingImportQueueId: string | null;
  selectedProgramId: string | null;
  setSelectedProgramId: (id: string | null) => void;
  handleLoadFromHistory: (historyItem: any) => void;
  handleEditFromHistory: (historyItem: any) => void;
  handleBulkDeleteWorkouts: (ids: string[]) => Promise<void>;
  handleSaveFromStructure: () => Promise<void>;
  handleEditFromImport: (queueId: string, rawWorkout: Record<string, unknown>) => void;
  handleBackToImport: (currentWorkout: WorkoutStructure | null) => void;
  reset: () => void;
}

export function useWorkflowEditing({
  userId,
  selectedDevice,
  setSelectedDevice,
  refreshHistory,
  onStepChange,
  onViewChange,
  setWorkout,
  setWorkoutSaved,
  setSources,
  setValidation,
  setExports,
  setConfirmDialog,
  workout,
  workoutSaved,
  importProcessedItems,
  setImportProcessedItems,
}: UseWorkflowEditingProps): UseWorkflowEditingResult {
  const [isEditingFromHistory, setIsEditingFromHistory] = useState(false);
  const [isCreatingFromScratch, setIsCreatingFromScratch] = useState(false);
  const [isEditingFromImport, setIsEditingFromImport] = useState(false);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [editingImportQueueId, setEditingImportQueueId] = useState<string | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);

  const parseSourceStrings = (sources: string[]): Source[] =>
    sources.map(s => {
      const [type, ...content] = s.split(':');
      return { id: Math.random().toString(), type: type as Source['type'], content: content.join(':') };
    });

  const handleLoadFromHistory = (historyItem: any) => {
    setWorkout(historyItem.workout);
    setSources(parseSourceStrings(historyItem.sources || []));
    setSelectedDevice(historyItem.device);
    setValidation(historyItem.validation || null);
    setExports(historyItem.exports || null);
    setIsEditingFromHistory(true);
    setEditingWorkoutId(historyItem.id);
    onStepChange('export');
    onViewChange('workflow');
    setWorkoutSaved(true);
    toast.success('Workout loaded');
  };

  const handleEditFromHistory = (historyItem: any) => {
    const normalizedWorkout = normalizeWorkoutStructure(historyItem.workout);
    setWorkout(normalizedWorkout);
    setSources(parseSourceStrings(historyItem.sources || []));
    setSelectedDevice(historyItem.device);
    setValidation(historyItem.validation || null);
    setExports(historyItem.exports || null);
    onStepChange('structure');
    onViewChange('workflow');
    setIsEditingFromHistory(true);
    setEditingWorkoutId(historyItem.id);
    setWorkoutSaved(true);
    toast.success('Workout opened for editing - you can edit directly or re-validate if needed');
  };

  const handleBulkDeleteWorkouts = async (ids: string[]): Promise<void> => {
    if (!ids || ids.length === 0) return;
    const profileId = userId;
    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const id of ids) {
      try {
        const { deleteWorkoutFromHistory } = await import('../../lib/workout-history');
        const ok = await deleteWorkoutFromHistory(id, profileId);
        if (ok) succeeded.push(id);
        else failed.push(id);
      } catch (error) {
        console.error(`Error deleting workout ${id}:`, error);
        failed.push(id);
      }
    }

    if (succeeded.length > 0) await refreshHistory();

    if (failed.length > 0 && succeeded.length > 0) {
      toast.warning(`Deleted ${succeeded.length} workout(s). Failed to delete ${failed.length}.`);
    } else if (failed.length > 0) {
      toast.error(`Failed to delete ${failed.length} workout(s).`);
    } else {
      toast.success(`Deleted ${ids.length} workout(s).`);
    }
  };

  const handleSaveFromStructure = async (): Promise<void> => {
    if (!userId || !workout) return;
    try {
      const { saveWorkoutToHistory } = await import('../../lib/workout-history');
      await saveWorkoutToHistory(
        userId,
        workout,
        selectedDevice,
        undefined,
        [],
        undefined,
        editingWorkoutId || undefined
      );
      toast.success('Workout saved!');
      setWorkoutSaved(true);
      await refreshHistory();
      if (isEditingFromHistory) {
        onViewChange('workouts');
        setIsEditingFromHistory(false);
        setEditingWorkoutId(null);
      } else if (isCreatingFromScratch) {
        setIsCreatingFromScratch(false);
      }
    } catch (error: any) {
      toast.error(`Failed to save workout: ${error.message}`);
    }
  };

  const handleEditFromImport = (queueId: string, rawWorkout: Record<string, unknown>): void => {
    setEditingImportQueueId(queueId || null);
    const normalizedWorkout = normalizeWorkoutStructure(rawWorkout);
    setWorkout(normalizedWorkout);
    setValidation(null);
    setExports(null);
    setSources([]);
    setIsEditingFromHistory(true);
    setIsEditingFromImport(true);
    setEditingWorkoutId(null);
    setWorkoutSaved(false);
    onViewChange('workflow');
    onStepChange('structure');
  };

  const handleBackToImport = (currentWorkout: WorkoutStructure | null): void => {
    if (editingImportQueueId && currentWorkout) {
      setImportProcessedItems(prev =>
        prev.map(item =>
          item.queueId === editingImportQueueId
            ? {
                ...item,
                workout: currentWorkout as unknown as Record<string, unknown>,
                workoutTitle: currentWorkout.name,
                blockCount: currentWorkout.blocks?.length,
                exerciseCount: currentWorkout.blocks?.reduce(
                  (acc, b) => acc + (b.exercises?.length ?? 0),
                  0
                ),
              }
            : item
        )
      );
    }
    setEditingImportQueueId(null);
    onViewChange('import');
    setIsEditingFromHistory(false);
    setIsEditingFromImport(false);
    setEditingWorkoutId(null);
  };

  const reset = () => {
    setIsEditingFromHistory(false);
    setIsCreatingFromScratch(false);
    setIsEditingFromImport(false);
    setEditingWorkoutId(null);
    setEditingImportQueueId(null);
  };

  return {
    isEditingFromHistory,
    isCreatingFromScratch,
    isEditingFromImport,
    editingWorkoutId,
    editingImportQueueId,
    selectedProgramId,
    setSelectedProgramId,
    handleLoadFromHistory,
    handleEditFromHistory,
    handleBulkDeleteWorkouts,
    handleSaveFromStructure,
    handleEditFromImport,
    handleBackToImport,
    reset,
  };
}
```

**Step 4: Run tests**

```bash
npx vitest run src/app/hooks/__tests__/useWorkflowEditing.test.ts
```

Expected: All 4 tests PASS.

**Step 5: Build check**

```bash
npm run build
```

**Step 6: Commit**

```bash
git add src/app/hooks/useWorkflowEditing.ts src/app/hooks/__tests__/useWorkflowEditing.test.ts
git commit -m "feat(AMA-865): implement useWorkflowEditing hook"
```

---

## Task 4: Implement useWorkflowValidation

This hook owns validation, re-validation, and processing.

**Files:**
- Modify: `src/app/hooks/useWorkflowValidation.ts`
- Modify: `src/app/hooks/__tests__/useWorkflowValidation.test.ts`

### What moves here from WorkflowView.tsx

Handlers:
- `handleAutoMap` (line 661)
- `handleValidate` (line 709)
- `handleReValidate` (line 761)
- `handleProcess` (line 784)

Note: `validation` and `exports` state stay in the composer (they're bridge state consumed by ValidateMap and PublishExport). This hook receives setValidation/setExports as callbacks.

### Step 1: Write failing tests

Replace `src/app/hooks/__tests__/useWorkflowValidation.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkflowValidation } from '../useWorkflowValidation';

vi.mock('../../../lib/mapper-api', () => ({
  checkMapperApiHealth: vi.fn().mockResolvedValue(true),
  validateWorkoutMapping: vi.fn().mockResolvedValue({
    validated_exercises: [{ name: 'Push Up' }],
    needs_review: [],
    unmapped_exercises: [],
    can_proceed: true,
  }),
  processWorkoutWithValidation: vi.fn().mockResolvedValue({
    validation: { validated_exercises: [], needs_review: [], unmapped_exercises: [], can_proceed: true },
    yaml: 'yaml-content',
  }),
  exportWorkoutToDevice: vi.fn().mockResolvedValue({ yaml: 'export-yaml' }),
}));

vi.mock('../../../lib/workout-history', () => ({
  saveWorkoutToHistory: vi.fn().mockResolvedValue(undefined),
  getWorkoutHistory: vi.fn().mockResolvedValue([]),
}));

const mockWorkout = { title: 'Test', blocks: [], name: 'Test' };

const defaultProps = {
  workout: mockWorkout as any,
  userId: 'user-1',
  selectedDevice: 'garmin' as const,
  user: { id: 'user-1', mode: 'standard' } as any,
  sources: [],
  stravaConnected: false,
  editingWorkoutId: null,
  setWorkout: vi.fn(),
  setWorkoutSaved: vi.fn(),
  setValidation: vi.fn(),
  setExports: vi.fn(),
  onStepChange: vi.fn(),
  refreshHistory: vi.fn().mockResolvedValue(undefined),
};

describe('useWorkflowValidation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('handleValidate sets loading during call, then resets', async () => {
    const { result } = renderHook(() => useWorkflowValidation(defaultProps));

    await act(async () => {
      await result.current.handleValidate();
    });

    expect(result.current.loading).toBe(false);
  });

  it('handleValidate calls setValidation with result on success', async () => {
    const setValidation = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowValidation({ ...defaultProps, setValidation })
    );

    await act(async () => {
      await result.current.handleValidate();
    });

    expect(setValidation).toHaveBeenCalledWith(
      expect.objectContaining({ can_proceed: true })
    );
  });

  it('handleValidate leaves loading=false on API error', async () => {
    const { checkMapperApiHealth } = await import('../../../lib/mapper-api');
    const { validateWorkoutMapping } = await import('../../../lib/mapper-api');
    (validateWorkoutMapping as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('API error')
    );

    const { result } = renderHook(() => useWorkflowValidation(defaultProps));

    await act(async () => {
      await result.current.handleValidate();
    });

    expect(result.current.loading).toBe(false);
  });
});
```

**Step 2: Run to verify failure**

```bash
npx vitest run src/app/hooks/__tests__/useWorkflowValidation.test.ts
```

**Step 3: Implement useWorkflowValidation**

```typescript
import { useState } from 'react';
import { toast } from 'sonner';
import {
  validateWorkoutMapping,
  processWorkoutWithValidation,
  exportWorkoutToDevice,
  checkMapperApiHealth,
} from '../../lib/mapper-api';
import { saveWorkoutToHistory } from '../../lib/workout-history';
import { getDeviceById } from '../../lib/devices';
import type { WorkoutStructure, ValidationResponse, ExportFormats } from '../../types/workout';
import type { Source } from '../../components/AddSources';
import type { AppUser } from '../useAppAuth';
import type { DeviceId } from '../../lib/devices';

type WorkflowStep = 'add-sources' | 'structure' | 'validate' | 'export';

export interface UseWorkflowValidationProps {
  workout: WorkoutStructure | null;
  userId: string;
  selectedDevice: DeviceId;
  user: AppUser;
  sources: Source[];
  stravaConnected: boolean;
  editingWorkoutId: string | null;
  setWorkout: (w: WorkoutStructure) => void;
  setWorkoutSaved: (saved: boolean) => void;
  setValidation: (v: ValidationResponse | null) => void;
  setExports: (e: ExportFormats | null) => void;
  onStepChange: (step: WorkflowStep) => void;
  refreshHistory: () => Promise<void>;
}

export interface UseWorkflowValidationResult {
  loading: boolean;
  handleAutoMap: () => Promise<void>;
  handleValidate: () => Promise<void>;
  handleReValidate: (updatedWorkout: WorkoutStructure) => Promise<void>;
  handleProcess: (updatedWorkout: WorkoutStructure) => Promise<void>;
}

export function useWorkflowValidation({
  workout,
  userId,
  selectedDevice,
  user,
  sources,
  stravaConnected,
  editingWorkoutId,
  setWorkout,
  setWorkoutSaved,
  setValidation,
  setExports,
  onStepChange,
  refreshHistory,
}: UseWorkflowValidationProps): UseWorkflowValidationResult {
  const [loading, setLoading] = useState(false);

  const handleAutoMap = async (): Promise<void> => {
    if (!workout) return;
    setLoading(true);
    try {
      const isMapperApiAvailable = await checkMapperApiHealth();
      let exportFormats: ExportFormats;
      let validationResult: ValidationResponse | null = null;

      if (isMapperApiAvailable) {
        validationResult = await validateWorkoutMapping(workout);
        setValidation(validationResult);
        exportFormats = await exportWorkoutToDevice(workout, selectedDevice, validationResult);
        setExports(exportFormats);
      } else {
        const { processWorkflow } = await import('../../lib/mock-api');
        exportFormats = await processWorkflow(workout, true);
        setExports(exportFormats);
      }

      if (user) {
        await saveWorkoutToHistory(
          user.id,
          workout,
          selectedDevice,
          exportFormats,
          sources.map((s: Source) => `${s.type}:${s.content}`),
          undefined,
          editingWorkoutId || undefined
        );
        setWorkoutSaved(true);
      }

      onStepChange('export');
      toast.success('Workout auto-mapped and ready to export!');
      await refreshHistory();
    } catch (error: any) {
      toast.error(`Failed to auto-map workout: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async (): Promise<void> => {
    if (!workout) {
      toast.error('No workout to validate');
      return;
    }
    setLoading(true);
    try {
      const isMapperApiAvailable = await checkMapperApiHealth();
      let validationResult: ValidationResponse;

      if (isMapperApiAvailable) {
        validationResult = await validateWorkoutMapping(workout);
      } else {
        const { validateWorkout } = await import('../../lib/mock-api');
        validationResult = await validateWorkout(workout);
      }

      setValidation(validationResult);
      onStepChange('validate');
      if (validationResult.can_proceed) {
        toast.success('All exercises validated successfully!');
      } else {
        toast.warning('Some exercises need review');
      }
    } catch (error: any) {
      console.error('Validation error:', error);
      toast.error(`Failed to validate workout: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReValidate = async (updatedWorkout: WorkoutStructure): Promise<void> => {
    setLoading(true);
    try {
      const isMapperApiAvailable = await checkMapperApiHealth();
      let validationResult: ValidationResponse;

      if (isMapperApiAvailable) {
        validationResult = await validateWorkoutMapping(updatedWorkout);
      } else {
        const { validateWorkout } = await import('../../lib/mock-api');
        validationResult = await validateWorkout(updatedWorkout);
      }

      setValidation(validationResult);
      setWorkout(updatedWorkout);
      toast.success('Re-validation complete');
    } catch (error: any) {
      toast.error(`Failed to re-validate workout: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (updatedWorkout: WorkoutStructure): Promise<void> => {
    setLoading(true);
    try {
      const isMapperApiAvailable = await checkMapperApiHealth();
      let exportFormats: ExportFormats;
      let validationResult: ValidationResponse | null = null;

      if (isMapperApiAvailable) {
        const processResult = await processWorkoutWithValidation(updatedWorkout, false);
        validationResult = processResult.validation;

        if (processResult.validation.can_proceed || processResult.yaml) {
          try {
            exportFormats = await exportWorkoutToDevice(
              updatedWorkout,
              selectedDevice,
              validationResult
            );
            if (!exportFormats.yaml && processResult.yaml) {
              exportFormats.yaml = processResult.yaml;
            }
          } catch {
            exportFormats = { yaml: processResult.yaml || '' };
          }
        } else {
          exportFormats = { yaml: processResult.yaml || '' };
        }
      } else {
        const { processWorkflow } = await import('../../lib/mock-api');
        exportFormats = await processWorkflow(updatedWorkout, false);
      }

      setExports(exportFormats);
      setValidation(validationResult);
      setWorkout(updatedWorkout);
      onStepChange('export');

      const deviceName = getDeviceById(selectedDevice)?.name || selectedDevice;
      toast.success(`Workout processed for ${deviceName}!`);

      if (user) {
        const sourcesAsStrings = sources.map((s: Source) => `${s.type}:${s.content}`);
        await saveWorkoutToHistory(
          user.id,
          updatedWorkout,
          selectedDevice,
          exportFormats,
          sourcesAsStrings,
          validationResult,
          editingWorkoutId || undefined
        );
        setWorkoutSaved(true);
        try {
          await refreshHistory();
        } catch (error) {
          console.error('Failed to refresh workout history:', error);
        }
      }
    } catch (error: any) {
      toast.error(`Failed to process workout: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    handleAutoMap,
    handleValidate,
    handleReValidate,
    handleProcess,
  };
}
```

**Step 4: Run tests**

```bash
npx vitest run src/app/hooks/__tests__/useWorkflowValidation.test.ts
```

Expected: All 3 tests PASS.

**Step 5: Build check**

```bash
npm run build
```

**Step 6: Commit**

```bash
git add src/app/hooks/useWorkflowValidation.ts src/app/hooks/__tests__/useWorkflowValidation.test.ts
git commit -m "feat(AMA-865): implement useWorkflowValidation hook"
```

---

## Task 5: Implement useWorkflowState (composer)

The composer owns the bridge state and wires the three domain hooks together.

**Files:**
- Modify: `src/app/useWorkflowState.ts`

No TDD for this task — it's pure wiring. Build verification is the test.

**Replace `src/app/useWorkflowState.ts` with:**

```typescript
import { useState } from 'react';
import { useWorkflowGeneration } from './hooks/useWorkflowGeneration';
import { useWorkflowEditing } from './hooks/useWorkflowEditing';
import { useWorkflowValidation } from './hooks/useWorkflowValidation';
import type { WorkoutStructure, ValidationResponse, ExportFormats, WorkoutType } from '../types/workout';
import type { ProcessedItem } from '../types/import';
import type { Source } from '../components/AddSources';
import type { View } from './router';
import type { AppUser } from './useAppAuth';
import type { DeviceId } from '../lib/devices';
import type React from 'react';

type WorkflowStep = 'add-sources' | 'structure' | 'validate' | 'export';

interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
}

interface WorkoutTypeDialogState {
  open: boolean;
  detectedType: WorkoutType;
  confidence: number;
  pendingWorkout: WorkoutStructure | null;
}

export interface UseWorkflowStateProps {
  user: AppUser;
  selectedDevice: DeviceId;
  setSelectedDevice: (d: DeviceId) => void;
  refreshHistory: () => Promise<void>;
  onNavigate: (view: View) => void;
  currentView: View;
  setCurrentView: (v: View) => void;
  stravaConnected: boolean;
}

export function useWorkflowState({
  user,
  selectedDevice,
  setSelectedDevice,
  refreshHistory,
  onNavigate,
  currentView,
  setCurrentView,
  stravaConnected,
}: UseWorkflowStateProps) {
  // ── Bridge state (shared across all domain hooks) ──────────────────────────
  const [workout, setWorkout] = useState<WorkoutStructure | null>(null);
  const [workoutSaved, setWorkoutSaved] = useState(false);
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('add-sources');
  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [exports, setExports] = useState<ExportFormats | null>(null);
  const [importProcessedItems, setImportProcessedItems] = useState<ProcessedItem[]>([]);

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false, title: '', description: '', onConfirm: () => {},
  });
  const [workoutTypeDialog, setWorkoutTypeDialog] = useState<WorkoutTypeDialogState>({
    open: false, detectedType: 'mixed', confidence: 0, pendingWorkout: null,
  });

  const steps: Array<{ id: WorkflowStep; label: string; number: number }> = [
    { id: 'add-sources', label: 'Add Sources', number: 1 },
    { id: 'structure', label: 'Structure Workout', number: 2 },
    { id: 'validate', label: 'Validate & Map', number: 3 },
    { id: 'export', label: 'Publish & Export', number: 4 },
  ];
  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const checkUnsavedChanges = (onConfirm: () => void): void => {
    if (currentView === 'workflow' && (workout || generation.sources.length > 0) && !workoutSaved) {
      setConfirmDialog({
        open: true,
        title: 'Unsaved Changes',
        description: 'Are you sure you want to leave? Any unsaved changes will be lost.',
        onConfirm,
      });
    } else {
      onConfirm();
    }
  };

  const clearWorkflowState = () => {
    setWorkout(null);
    setValidation(null);
    setExports(null);
    setCurrentStep('add-sources');
    setWorkoutSaved(false);
    generation.setSources([]);
    editing.reset();
  };

  // ── Domain hooks ───────────────────────────────────────────────────────────

  const generation = useWorkflowGeneration({
    userId: user.id,
    selectedDevice,
    refreshHistory,
    onWorkoutGenerated: (w, sources) => {
      setWorkout(w);
      generation.setSources(sources);
    },
    onWorkoutTypePending: (w, type, confidence, sources) => {
      generation.setSources(sources);
      setWorkoutTypeDialog({ open: true, detectedType: type, confidence, pendingWorkout: w });
    },
    onWorkoutSaved: setWorkoutSaved,
    onStepChange: setCurrentStep,
    onViewChange: setCurrentView,
    onClearWorkout: () => {
      setWorkout(null);
      setValidation(null);
      setExports(null);
    },
    onClearEditingFlags: () => editing.reset(),
    clearWorkflowState,
  });

  const editing = useWorkflowEditing({
    userId: user.id,
    selectedDevice,
    setSelectedDevice,
    refreshHistory,
    onStepChange: setCurrentStep,
    onViewChange: setCurrentView,
    setWorkout,
    setWorkoutSaved,
    setSources: generation.setSources,
    setValidation,
    setExports,
    setConfirmDialog,
    workout,
    workoutSaved,
    importProcessedItems,
    setImportProcessedItems,
  });

  const validation = useWorkflowValidation({
    workout,
    userId: user.id,
    selectedDevice,
    user,
    sources: generation.sources,
    stravaConnected,
    editingWorkoutId: editing.editingWorkoutId,
    setWorkout,
    setWorkoutSaved,
    setValidation,
    setExports,
    onStepChange: setCurrentStep,
    refreshHistory,
  });

  // ── Workout type dialog handlers ───────────────────────────────────────────

  const handleWorkoutTypeConfirm = (selectedType: WorkoutType, applyDefaults: boolean) => {
    const { applyWorkoutTypeDefaults } = require('../lib/workoutTypeDefaults');
    const pendingWorkout = workoutTypeDialog.pendingWorkout;
    if (!pendingWorkout) return;

    const finalWorkout = applyDefaults
      ? applyWorkoutTypeDefaults(pendingWorkout, selectedType)
      : { ...pendingWorkout, workout_type: selectedType };

    setWorkout(finalWorkout);
    setCurrentStep('structure');
    setWorkoutSaved(false);
    setWorkoutTypeDialog({ open: false, detectedType: 'mixed', confidence: 0, pendingWorkout: null });
    const { toast } = require('sonner');
    toast.success(applyDefaults ? `Workout type set to ${selectedType}. Settings applied!` : 'Workout structure generated!');
  };

  const handleWorkoutTypeSkip = () => {
    const pendingWorkout = workoutTypeDialog.pendingWorkout;
    if (!pendingWorkout) return;
    setWorkout(pendingWorkout);
    setCurrentStep('structure');
    setWorkoutSaved(false);
    setWorkoutTypeDialog({ open: false, detectedType: 'mixed', confidence: 0, pendingWorkout: null });
    const { toast } = require('sonner');
    toast.success('Workout structure generated!');
  };

  // ── handleBack ─────────────────────────────────────────────────────────────

  const handleBack = () => {
    if (currentStepIndex > 0) {
      if (workout && !editing.isEditingFromHistory) {
        setConfirmDialog({
          open: true,
          title: 'Go Back?',
          description: 'Your current progress will be saved, but you may need to re-validate.',
          onConfirm: () => { setCurrentStep(steps[currentStepIndex - 1].id); },
        });
        return;
      }
      setCurrentStep(steps[currentStepIndex - 1].id);
    } else if (currentView === 'workflow') {
      checkUnsavedChanges(() => {
        setCurrentView('home');
        clearWorkflowState();
      });
    }
  };

  return {
    // bridge state
    workout,
    setWorkout,
    workoutSaved,
    setWorkoutSaved,
    currentStep,
    setCurrentStep,
    currentStepIndex,
    validation: validation,
    setValidation,
    exports,
    setExports,
    importProcessedItems,
    setImportProcessedItems,
    confirmDialog,
    setConfirmDialog,
    workoutTypeDialog,
    steps,
    // generation
    sources: generation.sources,
    loading: generation.loading || validation.loading,
    generationLoading: generation.loading,
    validationLoading: validation.loading,
    generationProgress: generation.generationProgress,
    apiAvailable: generation.apiAvailable,
    showStravaEnhance: generation.showStravaEnhance,
    pinterestBulkModal: generation.pinterestBulkModal,
    welcomeDismissed: generation.welcomeDismissed,
    buildTimestamp: generation.buildTimestamp,
    handleGenerateStructure: generation.handleGenerateStructure,
    handleCancelGeneration: generation.handleCancelGeneration,
    handlePinterestBulkImport: generation.handlePinterestBulkImport,
    handlePinterestEditSingle: generation.handlePinterestEditSingle,
    handlePinterestBulkClose: generation.handlePinterestBulkClose,
    handleLoadTemplate: generation.handleLoadTemplate,
    handleCreateNew: generation.handleCreateNew,
    handleStartNew: generation.handleStartNew,
    handleWelcomeDismiss: generation.handleWelcomeDismiss,
    // editing
    isEditingFromHistory: editing.isEditingFromHistory,
    isCreatingFromScratch: editing.isCreatingFromScratch,
    isEditingFromImport: editing.isEditingFromImport,
    editingWorkoutId: editing.editingWorkoutId,
    editingImportQueueId: editing.editingImportQueueId,
    selectedProgramId: editing.selectedProgramId,
    setSelectedProgramId: editing.setSelectedProgramId,
    handleLoadFromHistory: editing.handleLoadFromHistory,
    handleEditFromHistory: editing.handleEditFromHistory,
    handleBulkDeleteWorkouts: editing.handleBulkDeleteWorkouts,
    handleSaveFromStructure: editing.handleSaveFromStructure,
    handleEditFromImport: editing.handleEditFromImport,
    handleBackToImport: editing.handleBackToImport,
    // validation
    handleAutoMap: validation.handleAutoMap,
    handleValidate: validation.handleValidate,
    handleReValidate: validation.handleReValidate,
    handleProcess: validation.handleProcess,
    // composer handlers
    handleWorkoutTypeConfirm,
    handleWorkoutTypeSkip,
    handleBack,
    checkUnsavedChanges,
    clearWorkflowState,
  };
}
```

**Important:** The `handleWorkoutTypeConfirm` and `handleWorkoutTypeSkip` use `require()` which is not ideal. Replace these with static imports at the top of the file:

```typescript
import { applyWorkoutTypeDefaults } from '../lib/workoutTypeDefaults';
import { toast } from 'sonner';
```

Then use them directly in the handlers.

**Step 1: Build check**

```bash
npm run build
```

Expected: Passes. If there are TypeScript errors, fix them before proceeding.

**Step 2: Commit**

```bash
git add src/app/useWorkflowState.ts
git commit -m "feat(AMA-865): implement useWorkflowState composer"
```

---

## Task 6: Refactor WorkflowView.tsx

Replace all state, useEffects, and handler functions in WorkflowView.tsx with a single call to `useWorkflowState()`. Keep only JSX.

**Files:**
- Modify: `src/app/WorkflowView.tsx`

**Step 1: Rewrite WorkflowView.tsx**

The new file should be ~150 lines. Here is the complete replacement:

```tsx
import { useEffect } from 'react';
import {
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { AddSources } from '../components/AddSources';
import { StructureWorkout } from '../components/StructureWorkout';
import { ValidateMap } from '../components/ValidateMap';
import { PublishExport } from '../components/PublishExport';
import { TeamSharing } from '../components/TeamSharing';
import { WelcomeGuide } from '../components/WelcomeGuide';
import { HomeScreen } from '../components/Home/HomeScreen';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { WorkoutTypeConfirmDialog } from '../components/WorkoutTypeConfirmDialog';
import { PinterestBulkImportModal } from '../components/PinterestBulkImportModal';
import {
  Analytics,
  UserSettings,
  StravaEnhance,
  Calendar,
  UnifiedWorkouts,
  MobileCompanion,
  ImportScreen,
  HelpPage,
  ExerciseHistory,
  VolumeAnalytics,
  ProgramDetail,
  ProgramsList,
  CreateAIWorkout,
} from './router';
import type { View } from './router';
import type { AppUser } from './useAppAuth';
import type { DeviceId } from '../lib/devices';
import { isDemoMode } from '../lib/demo-mode';
import { setCurrentProfileId } from '../lib/workout-history';
import { normalizeWorkoutStructure } from '../lib/api';
import { useWorkflowState } from './useWorkflowState';

export interface WorkflowViewProps {
  user: AppUser;
  selectedDevice: DeviceId;
  setSelectedDevice: (d: DeviceId) => void;
  workoutHistoryList: any[];
  refreshHistory: () => Promise<void>;
  onNavigate: (view: View) => void;
  currentView: View;
  setCurrentView: (v: View) => void;
  stravaConnected: boolean;
}

export function WorkflowView(props: WorkflowViewProps) {
  const {
    user,
    selectedDevice,
    setSelectedDevice,
    workoutHistoryList,
    refreshHistory,
    onNavigate,
    currentView,
    setCurrentView,
    stravaConnected,
  } = props;

  const state = useWorkflowState({
    user,
    selectedDevice,
    setSelectedDevice,
    refreshHistory,
    onNavigate,
    currentView,
    setCurrentView,
    stravaConnected,
  });

  // Sync selectedDevice when user.selectedDevices changes
  useEffect(() => {
    if (user?.selectedDevices?.length > 0 && !user.selectedDevices.includes(selectedDevice)) {
      setSelectedDevice(user.selectedDevices[0]);
    }
  }, [user?.selectedDevices]);

  const {
    workout, workoutSaved, currentStep, currentStepIndex, steps,
    sources, loading, generationProgress, apiAvailable,
    showStravaEnhance, pinterestBulkModal, welcomeDismissed, buildTimestamp,
    validation, exports, importProcessedItems, setImportProcessedItems,
    confirmDialog, setConfirmDialog, workoutTypeDialog,
    isEditingFromHistory, isCreatingFromScratch, isEditingFromImport,
    editingWorkoutId, editingImportQueueId, selectedProgramId, setSelectedProgramId,
    handleGenerateStructure, handleCancelGeneration, handleLoadTemplate, handleCreateNew,
    handleStartNew, handleWelcomeDismiss, handlePinterestBulkImport,
    handlePinterestEditSingle, handlePinterestBulkClose,
    handleAutoMap, handleValidate, handleReValidate, handleProcess,
    handleLoadFromHistory, handleEditFromHistory, handleBulkDeleteWorkouts,
    handleSaveFromStructure, handleEditFromImport, handleBackToImport,
    handleWorkoutTypeConfirm, handleWorkoutTypeSkip,
    handleBack, checkUnsavedChanges, clearWorkflowState, setWorkout, setWorkoutSaved,
  } = state;

  return (
    <>
      {/* Workflow Header */}
      {currentView === 'workflow' && (
        <div className="border-b bg-card">
          <div className="container mx-auto px-4 py-6">
            <div className="mb-6">
              <h1 className="text-2xl">
                {isEditingFromImport ? 'Review Imported Workout'
                  : isEditingFromHistory ? 'Edit Workout' : 'Create Workout'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isEditingFromImport ? 'Review and adjust your imported workout before saving'
                  : isEditingFromHistory ? 'Edit your workout directly or re-validate if needed'
                  : 'Ingest → Structure → Validate → Export'}
              </p>
            </div>
            {!isEditingFromHistory && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {steps.map((step, idx) => (
                  <div key={step.id} className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                        currentStep === step.id ? 'bg-primary text-primary-foreground'
                          : currentStepIndex > idx ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {step.number}
                      </div>
                      <div className={`text-sm ${
                        currentStep === step.id ? ''
                          : currentStepIndex > idx ? 'text-primary' : 'text-muted-foreground'
                      }`}>
                        {step.label}
                      </div>
                    </div>
                    {idx < steps.length - 1 && (
                      <ChevronRight className="w-4 h-4 text-muted-foreground mx-2" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div
        id="main-content"
        role="main"
        data-assistant-target="main-content"
        className={`container mx-auto px-4 py-8 ${currentView === 'workflow' && workout ? 'pb-32' : ''}`}
      >
        {/* Home */}
        {currentView === 'home' && (
          welcomeDismissed ? (
            <HomeScreen user={user} recentWorkouts={workoutHistoryList} onNavigate={setCurrentView} />
          ) : (
            <>
              <WelcomeGuide
                onGetStarted={() => { handleWelcomeDismiss(); setCurrentView('workflow'); }}
                onDismiss={handleWelcomeDismiss}
              />
              {!isDemoMode && (
                <div className="mt-8 text-center">
                  <p className="text-xs text-muted-foreground">
                    Build: {new Date(buildTimestamp).toLocaleString()}
                  </p>
                </div>
              )}
            </>
          )
        )}

        {/* Back buttons */}
        {currentView === 'workflow' && currentStepIndex > 0 && !isEditingFromHistory && (
          <Button variant="ghost" onClick={handleBack} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />Back
          </Button>
        )}
        {currentView === 'workflow' && isEditingFromHistory && (
          <Button
            variant="ghost"
            onClick={() => {
              if (isEditingFromImport) {
                handleBackToImport(workout);
                return;
              }
              if (workout && !workoutSaved) {
                setConfirmDialog({
                  open: true,
                  title: 'Unsaved Changes',
                  description: 'Are you sure you want to go back? Any unsaved changes will be lost.',
                  onConfirm: () => {
                    setCurrentView('workouts');
                    state.editing?.reset?.();
                  },
                });
                return;
              }
              setCurrentView('workouts');
            }}
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {isEditingFromImport ? 'Back to Import' : 'Back to History'}
          </Button>
        )}

        {/* Workflow steps */}
        {currentView === 'workflow' && currentStep === 'add-sources' && (
          <AddSources
            onGenerate={handleGenerateStructure}
            progress={generationProgress}
            onCancel={handleCancelGeneration}
            onLoadTemplate={handleLoadTemplate}
            onCreateNew={handleCreateNew}
            loading={loading}
          />
        )}

        {currentView === 'workflow' && currentStep === 'structure' && workout && (
          <div data-assistant-target="workout-log">
            <StructureWorkout
              workout={workout}
              onWorkoutChange={w => { setWorkout(w); setWorkoutSaved(false); }}
              onAutoMap={handleAutoMap}
              onValidate={handleValidate}
              onSave={isEditingFromHistory || isCreatingFromScratch ? handleSaveFromStructure : undefined}
              isEditingFromHistory={isEditingFromHistory}
              isCreatingFromScratch={isCreatingFromScratch}
              hideExport={isEditingFromImport}
              loading={loading}
              selectedDevice={selectedDevice}
              onDeviceChange={setSelectedDevice}
              userSelectedDevices={user.selectedDevices}
              onNavigateToSettings={() => {
                checkUnsavedChanges(() => {
                  clearWorkflowState();
                  setCurrentView('settings');
                });
              }}
            />
          </div>
        )}

        {currentView === 'workflow' && currentStep === 'validate' && validation && workout && (
          <ValidateMap
            validation={validation}
            workout={workout}
            onReValidate={handleReValidate}
            onProcess={handleProcess}
            loading={loading}
            selectedDevice={selectedDevice}
          />
        )}

        {currentView === 'workflow' && currentStep === 'export' && exports && (
          <PublishExport
            exports={exports}
            validation={validation || undefined}
            sources={sources.map(s => `${s.type}:${s.content}`)}
            onStartNew={handleStartNew}
            selectedDevice={selectedDevice}
            userMode={user.mode}
            workout={workout}
          />
        )}

        {currentView === 'workflow' && showStravaEnhance && (
          <StravaEnhance onClose={() => {}} />
        )}

        {currentView === 'analytics' && (
          user ? <Analytics user={user} history={workoutHistoryList} />
          : <div className="text-center py-16"><p className="text-muted-foreground">Please sign in to view analytics</p></div>
        )}

        {currentView === 'exercise-history' && user && (
          <div data-assistant-target="workout-history"><ExerciseHistory user={user} /></div>
        )}

        {currentView === 'volume-analytics' && user && <VolumeAnalytics user={user} />}

        {currentView === 'team' && <TeamSharing user={user} currentWorkout={workout} />}

        {currentView === 'settings' && (
          <div data-assistant-target="preferences-panel">
            <UserSettings
              user={user}
              onBack={() => setCurrentView('workflow')}
              onAccountsChange={async () => {}}
              onAccountDeleted={() => {
                setCurrentProfileId(null);
                setCurrentView('home');
              }}
              onUserUpdate={updates => {
                if (updates.selectedDevices?.length > 0 && !updates.selectedDevices.includes(selectedDevice)) {
                  setSelectedDevice(updates.selectedDevices[0]);
                }
              }}
              onNavigateToMobileCompanion={() => setCurrentView('mobile-companion')}
            />
          </div>
        )}

        {currentView === 'help' && <HelpPage onBack={() => setCurrentView('home')} />}

        {currentView === 'strava-enhance' && <StravaEnhance onClose={() => setCurrentView('workflow')} />}

        {currentView === 'calendar' && (
          <div data-assistant-target="calendar-section">
            <Calendar userId={user.id} userLocation={{ address: user.address, city: user.city, state: user.state, zipCode: user.zipCode }} />
          </div>
        )}

        {currentView === 'workouts' && (
          <div data-assistant-target="workout-list">
            <UnifiedWorkouts
              profileId={user.id}
              onEditWorkout={item => {
                const w = normalizeWorkoutStructure(item.workout);
                handleEditFromHistory({ ...item, workout: w });
              }}
              onLoadWorkout={item => {
                const w = normalizeWorkoutStructure(item.workout);
                handleLoadFromHistory({ ...item, workout: w });
              }}
              onDeleteWorkout={id => console.log('Workout deleted:', id)}
              onViewProgram={programId => {
                setSelectedProgramId(programId);
                setCurrentView('program-detail');
              }}
            />
          </div>
        )}

        {currentView === 'programs' && (
          <div data-assistant-target="workout-plan">
            <ProgramsList
              userId={user.id}
              onViewProgram={programId => {
                setSelectedProgramId(programId);
                setCurrentView('program-detail');
              }}
            />
          </div>
        )}

        {currentView === 'create-ai' && (
          <div data-assistant-target="workout-preview"><CreateAIWorkout /></div>
        )}

        {currentView === 'mobile-companion' && (
          <MobileCompanion userId={user.id} onBack={() => setCurrentView('settings')} />
        )}

        {currentView === 'import' && (
          <ImportScreen
            userId={user.id}
            onDone={() => setCurrentView('workouts')}
            initialProcessedItems={importProcessedItems.length > 0 ? importProcessedItems : undefined}
            onUpdateProcessedItems={setImportProcessedItems}
            onEditWorkout={handleEditFromImport}
          />
        )}

        {currentView === 'program-detail' && selectedProgramId && (
          <ProgramDetail
            programId={selectedProgramId}
            userId={user.id}
            onBack={() => { setSelectedProgramId(null); setCurrentView('workouts'); }}
            onDeleted={() => { setSelectedProgramId(null); setCurrentView('workouts'); }}
          />
        )}
      </div>

      {/* Footer Stats */}
      {currentView === 'workflow' && workout && (
        <div className="fixed bottom-0 left-0 right-0 border-t bg-card/95 backdrop-blur">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <Badge variant="outline">{workout.title}</Badge>
                <span className="text-muted-foreground">{workout.blocks.length} block(s)</span>
                <span className="text-muted-foreground">
                  {workout.blocks.reduce((sum, block) =>
                    sum + (block.exercises?.length || 0) + (block.supersets?.reduce((s, ss) => s + (ss.exercises?.length || 0), 0) || 0), 0
                  )} exercise(s)
                </span>
              </div>
              {validation && (
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-green-600">✓ {validation.validated_exercises.length} validated</span>
                  <span className="text-orange-600">⚠ {validation.needs_review.length} review</span>
                  <span className="text-red-600">✗ {validation.unmapped_exercises.length} unmapped</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={open => setConfirmDialog({ ...confirmDialog, open })}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        confirmText="Continue"
        cancelText="Cancel"
      />

      <WorkoutTypeConfirmDialog
        open={workoutTypeDialog.open}
        detectedType={workoutTypeDialog.detectedType}
        confidence={workoutTypeDialog.confidence}
        onConfirm={handleWorkoutTypeConfirm}
        onSkip={handleWorkoutTypeSkip}
      />

      <PinterestBulkImportModal
        open={pinterestBulkModal.open}
        onClose={handlePinterestBulkClose}
        workouts={pinterestBulkModal.workouts}
        originalTitle={pinterestBulkModal.originalTitle}
        sourceUrl={pinterestBulkModal.sourceUrl}
        onImportSelected={handlePinterestBulkImport}
        onEditSingle={handlePinterestEditSingle}
      />
    </>
  );
}
```

**Step 2: Fix TypeScript errors**

The `state.editing?.reset?.()` call won't work because `editing` is not exposed. Instead, expose `editing` from the composer, or just reset the flags inline. The simplest fix: in the `useWorkflowState` return, expose a `resetEditingFlags` helper:

In `useWorkflowState`, add to the return:
```typescript
resetEditingFlags: editing.reset,
```

Then in WorkflowView use `state.resetEditingFlags()`.

**Step 3: Build check — iterate until green**

```bash
npm run build 2>&1 | head -50
```

Fix all TypeScript errors. Common issues:
- Missing imports (add them)
- Type mismatches (check prop types match)
- `validation` naming conflict: the validation hook result is named `validation` but so is the state. Rename to avoid collision:
  ```typescript
  const validationHook = useWorkflowValidation({ ... });
  // then in return:
  handleAutoMap: validationHook.handleAutoMap,
  handleValidate: validationHook.handleValidate,
  handleReValidate: validationHook.handleReValidate,
  handleProcess: validationHook.handleProcess,
  validationLoading: validationHook.loading,
  ```

**Step 4: Full test suite**

```bash
npm test
```

Expected: All existing tests pass (no regressions). New tests (Tasks 2–4) also pass.

**Step 5: Verify WorkflowView.tsx line count**

```bash
wc -l src/app/WorkflowView.tsx
```

Expected: ≤ 200 lines.

**Step 6: Commit**

```bash
git add src/app/WorkflowView.tsx src/app/useWorkflowState.ts
git commit -m "feat(AMA-865): refactor WorkflowView — move all state/handlers to domain hooks"
```

---

## Task 7: Final verification

**Step 1: Run the full test suite**

```bash
npm test
```

Expected: All tests pass.

**Step 2: Run the build**

```bash
npm run build
```

Expected: Build succeeds with no errors or warnings.

**Step 3: Verify acceptance criteria**

```bash
# WorkflowView.tsx must be ≤ 200 lines
wc -l src/app/WorkflowView.tsx

# No useState in WorkflowView
grep -c "useState" src/app/WorkflowView.tsx   # must output 0

# No useEffect in WorkflowView
grep -c "useEffect" src/app/WorkflowView.tsx  # must output 0 (the selectedDevice sync moved here is OK if ≤1)

# No handle* functions in WorkflowView
grep -c "const handle" src/app/WorkflowView.tsx  # must output 0

# All three domain hook test files exist
ls src/app/hooks/__tests__/
```

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(AMA-865): complete WorkflowView domain hook split — all acceptance criteria met"
```

---

## Acceptance Criteria Checklist

- [ ] `WorkflowView.tsx` is ≤ 200 lines
- [ ] No `useState` declarations remain in `WorkflowView.tsx`
- [ ] No `handle*` functions remain in `WorkflowView.tsx`
- [ ] All three domain hook test files exist with passing tests
- [ ] `npm run build` passes
- [ ] `npm test` passes (existing suite + new tests)
- [ ] App behaviour is identical — pure refactor, no UX changes

## Gotchas

1. **JSX in hooks:** `useWorkflowGeneration` uses JSX in the OCR quality toast. Use `.tsx` extension for this file.

2. **`validation` naming collision:** In `useWorkflowState`, the variable `validation` (state: `ValidationResponse | null`) conflicts with `validation` (the `useWorkflowValidation()` result). Rename the hook result: `const validationHook = useWorkflowValidation(...)`.

3. **`sources` in generation vs. editing:** `handleLoadFromHistory` and `handleEditFromHistory` need to call `setSources`. Pass `generation.setSources` to `useWorkflowEditing` as the `setSources` prop.

4. **`clearWorkflowState` circular dependency:** `clearWorkflowState` calls `generation.setSources([])` and `editing.reset()`, but these hooks aren't created yet when `clearWorkflowState` is defined. Hoist the callback using a ref, or define `clearWorkflowState` after the hooks are created. In JavaScript, functions can reference variables in their closure even if those variables are defined later in the same scope — this works fine for `const` declarations in the same function body.

5. **`handleSaveFromStructure` sources/exports:** The original `onSave` in `StructureWorkout` used `sources` and `exports` from WorkflowView state. The editing hook's `handleSaveFromStructure` doesn't receive these. Either pass them as props to the hook (add `sources: Source[]` and `exports: ExportFormats | null` to `UseWorkflowEditingProps`), or keep the save logic simple for now (no sources/exports, just the workout itself).

6. **`setCurrentView` vs `onViewChange`:** WorkflowView receives both `onNavigate` and `setCurrentView`. The hooks should use `onViewChange` (which is `setCurrentView` from the composer's props). Don't confuse the two.
