/**
 * Integration tests for useWorkflowState composer (AMA-865)
 *
 * These are integration tests — we mock only external APIs (lib/api, lib/mapper-api, etc.)
 * and let the three domain hooks (useWorkflowGeneration, useWorkflowEditing,
 * useWorkflowValidation) run for real. This verifies the callback plumbing works end-to-end.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Stable mock references (hoisted so vi.mock factories can use them) ───────
// Paths in vi.mock are relative to the TEST FILE: src/app/__tests__/ → ../../lib/
const {
  mockGenerateWorkoutStructure,
  mockCheckApiHealth,
  mockValidateWorkoutMapping,
  mockCheckMapperApiHealth,
} = vi.hoisted(() => ({
  mockGenerateWorkoutStructure: vi.fn(),
  mockCheckApiHealth: vi.fn().mockResolvedValue(true),
  mockValidateWorkoutMapping: vi.fn().mockResolvedValue({
    validated_exercises: [{ name: 'Push Up' }],
    needs_review: [],
    unmapped_exercises: [],
    can_proceed: true,
  }),
  mockCheckMapperApiHealth: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../lib/api', () => ({
  checkApiHealth: mockCheckApiHealth,
  generateWorkoutStructure: mockGenerateWorkoutStructure,
  normalizeWorkoutStructure: vi.fn((w: unknown) => w),
}));

vi.mock('../../lib/mapper-api', () => ({
  checkMapperApiHealth: mockCheckMapperApiHealth,
  validateWorkoutMapping: mockValidateWorkoutMapping,
  processWorkoutWithValidation: vi.fn().mockResolvedValue({
    validation: { validated_exercises: [], needs_review: [], unmapped_exercises: [], can_proceed: true },
    yaml: 'yaml',
  }),
  exportWorkoutToDevice: vi.fn().mockResolvedValue({ yaml: 'export' }),
}));

vi.mock('../../lib/mock-api', () => ({
  generateWorkoutStructure: vi.fn(),
}));

vi.mock('../../lib/workout-history', () => ({
  saveWorkoutToHistory: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/workoutTypeDefaults', () => ({
  applyWorkoutTypeDefaults: vi.fn((workout: unknown, _type: unknown) => ({
    ...(workout as object),
    _defaultsApplied: true,
  })),
}));

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(),
    dismiss: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock the dynamically-imported libs used by useWorkflowGeneration
vi.mock('../../lib/preferences', () => ({
  getImageProcessingMethod: vi.fn().mockReturnValue('ocr'),
  setImageProcessingMethod: vi.fn(),
}));

vi.mock('../../lib/ocr-quality', () => ({
  analyzeOCRQuality: vi.fn().mockReturnValue(null),
}));

vi.mock('../../lib/devices', () => ({
  getDeviceById: vi.fn().mockReturnValue({ id: 'garmin', name: 'Garmin' }),
}));

// ── Import the composer (after all mocks are declared) ────────────────────────
import { useWorkflowState } from '../useWorkflowState';

// ── Shared test fixtures ─────────────────────────────────────────────────────
const mockWorkout = {
  title: 'Test Workout',
  name: 'Test Workout',
  source: '',
  blocks: [{ id: 'b1', label: 'Block 1', exercises: [{ name: 'Push Up' }] }],
  workout_type: undefined as any,
  workout_type_confidence: undefined as any,
};

function makeProps(overrides: Partial<Parameters<typeof useWorkflowState>[0]> = {}) {
  return {
    user: { id: 'user-1', mode: 'standard', selectedDevices: ['garmin'] } as any,
    selectedDevice: 'garmin' as const,
    setSelectedDevice: vi.fn(),
    refreshHistory: vi.fn().mockResolvedValue(undefined),
    currentView: 'workflow' as const,
    setCurrentView: vi.fn(),
    ...overrides,
  };
}

// Sources to trigger generation with
const testSources = [{ id: 's1', type: 'text' as const, content: 'do 3 sets of push ups' }];

/**
 * Helper: render the hook and run generation to completion.
 * apiAvailable starts as null in the hook. handleGenerateStructure re-checks inline
 * when apiAvailable===null, so no need to advance timers for the mount effect.
 */
async function renderAndGenerate(propsOverride = {}) {
  const props = makeProps(propsOverride);
  const { result } = renderHook(() => useWorkflowState(props));

  await act(async () => {
    await result.current.handleGenerateStructure(testSources);
  });

  return { result, props };
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('useWorkflowState (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckApiHealth.mockResolvedValue(true);
    mockCheckMapperApiHealth.mockResolvedValue(true);
    mockValidateWorkoutMapping.mockResolvedValue({
      validated_exercises: [{ name: 'Push Up' }],
      needs_review: [],
      unmapped_exercises: [],
      can_proceed: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── 1. Initial state ───────────────────────────────────────────────────────
  describe('initial state', () => {
    it('workout is null', () => {
      const { result } = renderHook(() => useWorkflowState(makeProps()));
      expect(result.current.workout).toBeNull();
    });

    it('currentStep is "add-sources"', () => {
      const { result } = renderHook(() => useWorkflowState(makeProps()));
      expect(result.current.currentStep).toBe('add-sources');
    });

    it('workoutSaved is false', () => {
      const { result } = renderHook(() => useWorkflowState(makeProps()));
      expect(result.current.workoutSaved).toBe(false);
    });

    it('isEditingFromHistory is false', () => {
      const { result } = renderHook(() => useWorkflowState(makeProps()));
      expect(result.current.isEditingFromHistory).toBe(false);
    });
  });

  // ── 2. onWorkoutGenerated callback — workout is set in bridge state ─────────
  describe('onWorkoutGenerated callback wiring', () => {
    it('sets workout in bridge state when handleGenerateStructure succeeds (no type detected)', async () => {
      mockGenerateWorkoutStructure.mockResolvedValueOnce(mockWorkout);
      const { result } = await renderAndGenerate();

      expect(result.current.workout).not.toBeNull();
      expect(result.current.workout?.title).toBe('Test Workout');
    });
  });

  // ── 3. onStepChange wiring — currentStep changes to 'structure' ────────────
  describe('onStepChange wiring', () => {
    it('currentStep becomes "structure" after successful generation', async () => {
      mockGenerateWorkoutStructure.mockResolvedValueOnce(mockWorkout);
      const { result } = await renderAndGenerate();

      expect(result.current.currentStep).toBe('structure');
    });
  });

  // ── 4. clearWorkflowState — resets state ──────────────────────────────────
  describe('clearWorkflowState', () => {
    it('resets workout to null, currentStep to "add-sources", workoutSaved to false', async () => {
      mockGenerateWorkoutStructure.mockResolvedValueOnce(mockWorkout);
      const { result } = await renderAndGenerate();

      expect(result.current.workout).not.toBeNull();
      expect(result.current.currentStep).toBe('structure');

      act(() => {
        result.current.clearWorkflowState();
      });

      expect(result.current.workout).toBeNull();
      expect(result.current.currentStep).toBe('add-sources');
      expect(result.current.workoutSaved).toBe(false);
    });
  });

  // ── 5. Workout type dialog — opens when detected type and confidence < 0.9 ─
  describe('workout type dialog wiring', () => {
    it('workoutTypeDialog.open becomes true when confidence < 0.9', async () => {
      const lowConfidenceWorkout = {
        ...mockWorkout,
        workout_type: 'strength',
        workout_type_confidence: 0.7, // < 0.9 → triggers dialog
      };
      mockGenerateWorkoutStructure.mockResolvedValueOnce(lowConfidenceWorkout);

      const { result } = renderHook(() => useWorkflowState(makeProps()));

      await act(async () => {
        await result.current.handleGenerateStructure(testSources);
      });

      expect(result.current.workoutTypeDialog.open).toBe(true);
      expect(result.current.workoutTypeDialog.detectedType).toBe('strength');
      expect(result.current.workoutTypeDialog.confidence).toBe(0.7);
      expect(result.current.workoutTypeDialog.pendingWorkout).not.toBeNull();
    });

    it('workoutTypeDialog stays closed when confidence >= 0.9', async () => {
      const highConfidenceWorkout = {
        ...mockWorkout,
        workout_type: 'strength',
        workout_type_confidence: 0.95, // >= 0.9 → no dialog, auto-applies defaults
      };
      mockGenerateWorkoutStructure.mockResolvedValueOnce(highConfidenceWorkout);

      const { result } = renderHook(() => useWorkflowState(makeProps()));

      await act(async () => {
        await result.current.handleGenerateStructure(testSources);
      });

      expect(result.current.workoutTypeDialog.open).toBe(false);
      // Should have gone straight to structure step
      expect(result.current.currentStep).toBe('structure');
    });
  });

  // ── 6. handleWorkoutTypeConfirm ─────────────────────────────────────────────
  describe('handleWorkoutTypeConfirm', () => {
    async function openTypeDialog() {
      const pendingWorkout = {
        ...mockWorkout,
        workout_type: 'strength',
        workout_type_confidence: 0.7,
      };
      mockGenerateWorkoutStructure.mockResolvedValueOnce(pendingWorkout);

      const { result } = renderHook(() => useWorkflowState(makeProps()));

      await act(async () => {
        await result.current.handleGenerateStructure(testSources);
      });

      return { result };
    }

    it('sets workout (with defaults applied), closes dialog, and sets currentStep to "structure"', async () => {
      const { result } = await openTypeDialog();

      expect(result.current.workoutTypeDialog.open).toBe(true);

      act(() => {
        result.current.handleWorkoutTypeConfirm('strength', true);
      });

      expect(result.current.workout).not.toBeNull();
      expect((result.current.workout as any)._defaultsApplied).toBe(true);
      expect(result.current.workoutTypeDialog.open).toBe(false);
      expect(result.current.currentStep).toBe('structure');
    });

    it('sets workout with selected type (no defaults) when applyDefaults=false', async () => {
      const { result } = await openTypeDialog();

      expect(result.current.workoutTypeDialog.open).toBe(true);

      act(() => {
        result.current.handleWorkoutTypeConfirm('strength', false);
      });

      expect(result.current.workout?.workout_type).toBe('strength');
      expect((result.current.workout as any)._defaultsApplied).toBeUndefined();
      expect(result.current.workoutTypeDialog.open).toBe(false);
      expect(result.current.currentStep).toBe('structure');
    });
  });

  // ── 7. handleWorkoutTypeSkip ────────────────────────────────────────────────
  describe('handleWorkoutTypeSkip', () => {
    it('sets workout to the pending workout and closes the dialog', async () => {
      const pendingWorkout = {
        ...mockWorkout,
        workout_type: 'circuit',
        workout_type_confidence: 0.5,
      };
      mockGenerateWorkoutStructure.mockResolvedValueOnce(pendingWorkout);

      const { result } = renderHook(() => useWorkflowState(makeProps()));

      await act(async () => {
        await result.current.handleGenerateStructure(testSources);
      });

      expect(result.current.workoutTypeDialog.open).toBe(true);

      act(() => {
        result.current.handleWorkoutTypeSkip();
      });

      expect(result.current.workout).not.toBeNull();
      expect(result.current.workout?.title).toBe('Test Workout');
      expect(result.current.workoutTypeDialog.open).toBe(false);
      expect(result.current.currentStep).toBe('structure');
    });
  });

  // ── 8. handleBack from step 0 ──────────────────────────────────────────────
  describe('handleBack from step 0', () => {
    it('calls setCurrentView("home") directly when no unsaved changes and currentView is "workflow"', () => {
      const setCurrentView = vi.fn();
      const { result } = renderHook(() =>
        useWorkflowState(makeProps({ setCurrentView }))
      );

      // On step 0 (add-sources), no workout loaded, no sources → no unsaved changes
      act(() => {
        result.current.handleBack();
      });

      // checkUnsavedChanges: no workout + no sources → calls onConfirm immediately → setCurrentView('home')
      expect(setCurrentView).toHaveBeenCalledWith('home');
    });

    it('opens confirmDialog instead of navigating when workout exists and is unsaved', async () => {
      mockGenerateWorkoutStructure.mockResolvedValueOnce(mockWorkout);

      const setCurrentView = vi.fn();
      const { result } = renderHook(() =>
        useWorkflowState(makeProps({ setCurrentView }))
      );

      // Generate a workout (now on step 'structure', workoutSaved=false)
      await act(async () => {
        await result.current.handleGenerateStructure(testSources);
      });

      // Move back to step 0 so handleBack triggers checkUnsavedChanges
      act(() => {
        result.current.setCurrentStep('add-sources');
      });

      setCurrentView.mockClear();

      act(() => {
        result.current.handleBack();
      });

      // Workout present + unsaved → opens confirmDialog, does NOT navigate directly
      expect(result.current.confirmDialog.open).toBe(true);
      expect(setCurrentView).not.toHaveBeenCalledWith('home');
    });
  });

  // ── 9. handleEditFromImport → handleBackToImport flow ─────────────────────
  describe('handleEditFromImport → handleBackToImport flow', () => {
    it('sets isEditingFromImport=true after handleEditFromImport', () => {
      const rawWorkout = { ...mockWorkout };
      const { result } = renderHook(() => useWorkflowState(makeProps()));

      act(() => {
        result.current.handleEditFromImport('q1', rawWorkout as any);
      });

      expect(result.current.isEditingFromImport).toBe(true);
    });

    it('resets isEditingFromImport=false after handleBackToImport', () => {
      const rawWorkout = { ...mockWorkout };
      const { result } = renderHook(() => useWorkflowState(makeProps()));

      act(() => {
        result.current.handleEditFromImport('q1', rawWorkout as any);
      });

      expect(result.current.isEditingFromImport).toBe(true);

      act(() => {
        // handleBackToImport resets the import editing state regardless of queueId match
        result.current.handleBackToImport(mockWorkout as any);
      });

      expect(result.current.isEditingFromImport).toBe(false);
    });
  });

  // ── 10. handleValidate → setValidation wiring ─────────────────────────────
  describe('handleValidate → validation state', () => {
    it('validation state is set with the API result after handleValidate', async () => {
      mockGenerateWorkoutStructure.mockResolvedValueOnce(mockWorkout);
      const { result } = await renderAndGenerate();

      expect(result.current.workout).not.toBeNull();

      await act(async () => {
        await result.current.handleValidate();
      });

      await waitFor(() => {
        expect(result.current.validation).not.toBeNull();
      });

      expect(result.current.validation?.can_proceed).toBe(true);
      expect(result.current.validation?.validated_exercises).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'Push Up' })])
      );
    });

    it('currentStep becomes "validate" after handleValidate succeeds', async () => {
      mockGenerateWorkoutStructure.mockResolvedValueOnce(mockWorkout);
      const { result } = await renderAndGenerate();

      await act(async () => {
        await result.current.handleValidate();
      });

      expect(result.current.currentStep).toBe('validate');
    });
  });
});
