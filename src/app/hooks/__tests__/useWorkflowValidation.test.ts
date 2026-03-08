import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkflowValidation } from '../useWorkflowValidation';

const { mockValidateWorkoutMapping, mockProcessWorkoutWithValidation, mockExportWorkoutToDevice } = vi.hoisted(() => ({
  mockValidateWorkoutMapping: vi.fn(),
  mockProcessWorkoutWithValidation: vi.fn(),
  mockExportWorkoutToDevice: vi.fn(),
}));

vi.mock('../../../lib/mapper-api', () => ({
  validateWorkoutMapping: mockValidateWorkoutMapping,
  processWorkoutWithValidation: mockProcessWorkoutWithValidation,
  exportWorkoutToDevice: mockExportWorkoutToDevice,
  autoMapWorkout: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

const mockWorkout = {
  title: 'Test Workout',
  blocks: [{ id: 'b1', label: 'Block 1', exercises: [{ name: 'Push Up' }] }],
};

const defaultProps = {
  workout: null,
  userId: 'user-1',
  selectedDevice: 'garmin' as const,
  setWorkout: vi.fn(),
  onStepChange: vi.fn(),
  setValidation: vi.fn(),
  setExports: vi.fn(),
  stravaConnected: false,
};

describe('useWorkflowValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts with exportingWorkout=null', () => {
      const { result } = renderHook(() => useWorkflowValidation(defaultProps));
      expect(result.current.exportingWorkout).toBeNull();
    });

    it('starts with exportingWorkouts=[]', () => {
      const { result } = renderHook(() => useWorkflowValidation(defaultProps));
      expect(result.current.exportingWorkouts).toEqual([]);
    });

    it('starts with exportingDevice=null', () => {
      const { result } = renderHook(() => useWorkflowValidation(defaultProps));
      expect(result.current.exportingDevice).toBeNull();
    });

    it('starts with validation=null', () => {
      const { result } = renderHook(() => useWorkflowValidation(defaultProps));
      expect(result.current.validation).toBeNull();
    });

    it('starts with exports=null', () => {
      const { result } = renderHook(() => useWorkflowValidation(defaultProps));
      expect(result.current.exports).toBeNull();
    });
  });

  describe('handleOpenExportPage', () => {
    it('sets exportingWorkout and exportingDevice', () => {
      const { result } = renderHook(() => useWorkflowValidation(defaultProps));

      act(() => {
        result.current.handleOpenExportPage(mockWorkout as any, { id: 'garmin', name: 'Garmin', requiresMapping: false });
      });

      expect(result.current.exportingWorkout).toEqual(mockWorkout);
      expect(result.current.exportingDevice).toBe('garmin');
    });
  });

  describe('handleInlineExport', () => {
    it('calls exportWorkoutToDevice and shows success toast', async () => {
      mockExportWorkoutToDevice.mockResolvedValue({});

      const { toast } = await import('sonner');
      const { result } = renderHook(() => useWorkflowValidation(defaultProps));

      await act(async () => {
        await result.current.handleInlineExport(mockWorkout as any, { id: 'garmin', name: 'Garmin', requiresMapping: false });
      });

      expect(mockExportWorkoutToDevice).toHaveBeenCalledWith(mockWorkout, 'garmin');
      expect(toast.success).toHaveBeenCalledWith('Exported to Garmin!');
    });

    it('shows error toast when export fails', async () => {
      mockExportWorkoutToDevice.mockRejectedValue(new Error('Network error'));

      const { toast } = await import('sonner');
      const { result } = renderHook(() => useWorkflowValidation(defaultProps));

      await act(async () => {
        await result.current.handleInlineExport(mockWorkout as any, { id: 'garmin', name: 'Garmin', requiresMapping: false });
      });

      expect(toast.error).toHaveBeenCalledWith('Network error');
    });
  });

  describe('handleValidate', () => {
    it('calls validateWorkoutMapping and sets validation result', async () => {
      const validationResult = { can_proceed: true, validated_exercises: [], needs_review: [], unmapped_exercises: [] };
      mockValidateWorkoutMapping.mockResolvedValue(validationResult);

      const setValidationState = vi.fn();
      const { toast } = await import('sonner');
      const { result } = renderHook(() =>
        useWorkflowValidation({ ...defaultProps, workout: mockWorkout as any, setValidation: setValidationState })
      );

      await act(async () => {
        await result.current.handleValidate();
      });

      expect(mockValidateWorkoutMapping).toHaveBeenCalledWith(mockWorkout, 'garmin');
      expect(setValidationState).toHaveBeenCalledWith(validationResult);
      expect(toast.success).toHaveBeenCalledWith('Validation passed!');
    });

    it('shows warning toast when validation has issues', async () => {
      const validationResult = { can_proceed: false, validated_exercises: [], needs_review: ['Push Up'], unmapped_exercises: [] };
      mockValidateWorkoutMapping.mockResolvedValue(validationResult);

      const { toast } = await import('sonner');
      const { result } = renderHook(() =>
        useWorkflowValidation({ ...defaultProps, workout: mockWorkout as any })
      );

      await act(async () => {
        await result.current.handleValidate();
      });

      expect(toast.warning).toHaveBeenCalledWith('Validation completed with issues. Please review.');
    });
  });

  describe('handleProcess', () => {
    it('calls processWorkoutWithValidation and sets validation and exports', async () => {
      const processResult = {
        validation: { can_proceed: true, validated_exercises: [], needs_review: [], unmapped_exercises: [] },
        yaml: 'yaml-content',
      };
      mockProcessWorkoutWithValidation.mockResolvedValue(processResult);

      const setValidation = vi.fn();
      const setExports = vi.fn();
      const { toast } = await import('sonner');
      const { result } = renderHook(() =>
        useWorkflowValidation({ ...defaultProps, setValidation, setExports })
      );

      await act(async () => {
        await result.current.handleProcess(mockWorkout as any);
      });

      expect(mockProcessWorkoutWithValidation).toHaveBeenCalledWith(mockWorkout, 'garmin');
      expect(setValidation).toHaveBeenCalledWith(processResult.validation);
      expect(setExports).toHaveBeenCalledWith({ yaml: 'yaml-content' });
      expect(toast.success).toHaveBeenCalledWith('Workout processed successfully!');
    });

    it('shows error toast when processing fails', async () => {
      mockProcessWorkoutWithValidation.mockRejectedValue(new Error('Processing error'));

      const { toast } = await import('sonner');
      const { result } = renderHook(() => useWorkflowValidation(defaultProps));

      await act(async () => {
        await result.current.handleProcess(mockWorkout as any);
      });

      expect(toast.error).toHaveBeenCalledWith('Processing error');
    });
  });

  describe('state setters', () => {
    it('setExportingWorkout clears the exporting workout', () => {
      const { result } = renderHook(() => useWorkflowValidation(defaultProps));

      act(() => {
        result.current.handleOpenExportPage(mockWorkout as any, { id: 'garmin', name: 'Garmin', requiresMapping: false });
      });

      expect(result.current.exportingWorkout).not.toBeNull();

      act(() => {
        result.current.setExportingWorkout(null);
      });

      expect(result.current.exportingWorkout).toBeNull();
    });

    it('setExportingWorkouts updates multiple workouts', () => {
      const { result } = renderHook(() => useWorkflowValidation(defaultProps));

      act(() => {
        result.current.setExportingWorkouts([mockWorkout as any, mockWorkout as any]);
      });

      expect(result.current.exportingWorkouts).toHaveLength(2);
    });

    it('setExportingDevice updates the device', () => {
      const { result } = renderHook(() => useWorkflowValidation(defaultProps));

      act(() => {
        result.current.setExportingDevice('wahoo');
      });

      expect(result.current.exportingDevice).toBe('wahoo');
    });
  });
});
