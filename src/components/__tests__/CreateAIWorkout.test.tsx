/**
 * Tests for AMA-914, AMA-915, AMA-916 features in CreateAIWorkout.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateAIWorkout } from '../CreateAIWorkout';

// Mock the streaming pipeline hook
vi.mock('../../hooks/useStreamingPipeline', () => ({
  useStreamingPipeline: () => ({
    isStreaming: false,
    currentStage: null,
    completedStages: [],
    preview: null,
    error: null,
    start: vi.fn(),
  }),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Mock demo-mode — set to true so we get the mock workflow
vi.mock('../../lib/demo-mode', () => ({
  isDemoMode: true,
}));

describe('CreateAIWorkout', () => {
  let onWorkoutGenerated: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onWorkoutGenerated = vi.fn();
  });

  // AMA-916: Editable workout title
  describe('AMA-916: Editable workout title', () => {
    it('renders the title input field', () => {
      render(<CreateAIWorkout onWorkoutGenerated={onWorkoutGenerated} />);
      const titleInput = screen.getByTestId('ai-workout-title');
      expect(titleInput).toBeInTheDocument();
      expect(titleInput).toHaveAttribute('placeholder', 'AI will suggest a title, or type your own');
    });

    it('allows editing the title', () => {
      render(<CreateAIWorkout onWorkoutGenerated={onWorkoutGenerated} />);
      const titleInput = screen.getByTestId('ai-workout-title');
      fireEvent.change(titleInput, { target: { value: 'My Custom Title' } });
      expect(titleInput).toHaveValue('My Custom Title');
    });
  });

  // AMA-915: Quick preset prompts
  describe('AMA-915: Quick preset prompts', () => {
    it('renders all 5 preset prompt buttons', () => {
      render(<CreateAIWorkout onWorkoutGenerated={onWorkoutGenerated} />);
      const presets = screen.getByTestId('preset-prompts');
      expect(presets).toBeInTheDocument();

      expect(screen.getByText('Upper body strength')).toBeInTheDocument();
      expect(screen.getByText('HIIT circuit')).toBeInTheDocument();
      expect(screen.getByText('Leg day')).toBeInTheDocument();
      expect(screen.getByText('Full body')).toBeInTheDocument();
      expect(screen.getByText('Core workout')).toBeInTheDocument();
    });

    it('clicking a preset fills the description field', () => {
      render(<CreateAIWorkout onWorkoutGenerated={onWorkoutGenerated} />);
      fireEvent.click(screen.getByText('Upper body strength'));
      const descriptionField = screen.getByTestId('ai-workout-description') as HTMLTextAreaElement;
      expect(descriptionField.value).toContain('chest');
      expect(descriptionField.value).toContain('shoulders');
    });

    it('clicking a different preset replaces the description', () => {
      render(<CreateAIWorkout onWorkoutGenerated={onWorkoutGenerated} />);
      fireEvent.click(screen.getByText('Leg day'));
      const descriptionField = screen.getByTestId('ai-workout-description') as HTMLTextAreaElement;
      expect(descriptionField.value).toContain('squats');
      expect(descriptionField.value).toContain('lunges');
    });
  });

  // AMA-914: Demo mode mock workout
  describe('AMA-914: Demo mode mock workout', () => {
    it('generates a mock workout in demo mode', async () => {
      render(<CreateAIWorkout onWorkoutGenerated={onWorkoutGenerated} />);

      // Fill in a description
      const descriptionField = screen.getByTestId('ai-workout-description');
      fireEvent.change(descriptionField, { target: { value: 'Full body strength workout' } });

      // Click Generate
      const generateBtn = screen.getByTestId('generate-workout-btn');
      fireEvent.click(generateBtn);

      // Wait for the mock delay (1500ms)
      await waitFor(() => {
        expect(onWorkoutGenerated).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Verify the generated workout structure
      const workout = onWorkoutGenerated.mock.calls[0][0];
      expect(workout.source).toBe('ai-generated');
      expect(workout.blocks.length).toBeGreaterThanOrEqual(2);
      // Should have warm-up and cooldown blocks
      expect(workout.blocks.some((b: any) => b.structure === 'warmup')).toBe(true);
      expect(workout.blocks.some((b: any) => b.structure === 'cooldown')).toBe(true);
    });

    it('uses custom title in generated workout', async () => {
      render(<CreateAIWorkout onWorkoutGenerated={onWorkoutGenerated} />);

      // Set custom title
      const titleInput = screen.getByTestId('ai-workout-title');
      fireEvent.change(titleInput, { target: { value: 'My Custom Workout' } });

      // Fill description and generate
      const descriptionField = screen.getByTestId('ai-workout-description');
      fireEvent.change(descriptionField, { target: { value: 'Some workout description' } });
      fireEvent.click(screen.getByTestId('generate-workout-btn'));

      await waitFor(() => {
        expect(onWorkoutGenerated).toHaveBeenCalled();
      }, { timeout: 3000 });

      const workout = onWorkoutGenerated.mock.calls[0][0];
      expect(workout.title).toBe('My Custom Workout');
    });
  });
});
