/**
 * Tests for StreamingWorkflow component and SubProgressIndicator.
 * Verifies rendering of stages, error states, workout previews, sub-progress,
 * and the exported program stage configurations.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  StreamingWorkflow,
  PROGRAM_DESIGN_STAGES,
  PROGRAM_GENERATE_STAGES,
} from '../StreamingWorkflow';

describe('StreamingWorkflow', () => {
  it('renders nothing when not streaming', () => {
    const { container } = render(
      <StreamingWorkflow
        currentStage={null}
        completedStages={[]}
        preview={null}
        isStreaming={false}
        error={null}
      />,
    );

    // No error, no preview, no stage indicator visible
    expect(screen.queryByTestId('pipeline-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('workout-preview-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stage-indicator')).not.toBeInTheDocument();
    // Container should only have the empty wrapper div
    expect(container.firstElementChild?.children.length).toBe(0);
  });

  it('renders error with retry button', () => {
    const onRetry = vi.fn();

    render(
      <StreamingWorkflow
        currentStage={null}
        completedStages={[]}
        preview={null}
        isStreaming={false}
        error="Unsupported URL format"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByTestId('pipeline-error')).toBeInTheDocument();
    expect(screen.getByText('Unsupported URL format')).toBeInTheDocument();

    const retryButton = screen.getByTestId('pipeline-error-retry');
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders workout preview card', () => {
    const preview = {
      preview_id: 'p-1',
      workout: {
        name: 'Full Body Blast',
        exercises: [
          { name: 'Squats', sets: 4, reps: 10, muscle_group: 'Legs' },
          { name: 'Bench Press', sets: 3, reps: 8 },
          { name: 'Deadlifts', sets: 3, reps: 5, muscle_group: 'Back' },
        ],
      },
    };

    render(
      <StreamingWorkflow
        currentStage={null}
        completedStages={['analyzing', 'creating']}
        preview={preview}
        isStreaming={false}
        error={null}
      />,
    );

    expect(screen.getByTestId('workout-preview-card')).toBeInTheDocument();
    expect(screen.getByTestId('preview-workout-name')).toHaveTextContent('Full Body Blast');
    expect(screen.getByTestId('preview-exercise-0')).toBeInTheDocument();
    expect(screen.getByTestId('preview-exercise-1')).toBeInTheDocument();
    expect(screen.getByTestId('preview-exercise-2')).toBeInTheDocument();
    expect(screen.getByText('Squats')).toBeInTheDocument();
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText('Deadlifts')).toBeInTheDocument();
  });

  it('renders sub-progress during batched generation', () => {
    const subProgress = { current: 2, total: 4 };

    render(
      <StreamingWorkflow
        currentStage={{ stage: 'generating', message: 'Generating Week 2 of 4' }}
        completedStages={[]}
        preview={null}
        isStreaming={true}
        error={null}
        subProgress={subProgress}
        stageConfig={{
          generating: { icon: () => null, label: 'Generating workouts' } as any,
          mapping: { icon: () => null, label: 'Matching exercises' } as any,
          complete: { icon: () => null, label: 'Complete' } as any,
        }}
        stages={['generating', 'mapping']}
      />,
    );

    expect(screen.getByTestId('sub-progress')).toBeInTheDocument();
    // 4 week items rendered
    expect(screen.getByTestId('sub-progress-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('sub-progress-item-2')).toBeInTheDocument();
    expect(screen.getByTestId('sub-progress-item-3')).toBeInTheDocument();
    expect(screen.getByTestId('sub-progress-item-4')).toBeInTheDocument();
  });

  it('save button calls onSave', () => {
    const onSave = vi.fn();
    const preview = {
      preview_id: 'p-2',
      workout: {
        name: 'Quick HIIT',
        exercises: [{ name: 'Burpees', sets: 3, reps: 10 }],
      },
    };

    render(
      <StreamingWorkflow
        currentStage={null}
        completedStages={['analyzing', 'creating']}
        preview={preview}
        isStreaming={false}
        error={null}
        onSave={onSave}
      />,
    );

    const saveButton = screen.getByTestId('preview-save-btn');
    expect(saveButton).toBeInTheDocument();

    fireEvent.click(saveButton);
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('PROGRAM_DESIGN_STAGES equals ["designing"]', () => {
    expect(PROGRAM_DESIGN_STAGES).toEqual(['designing']);
  });

  it('PROGRAM_GENERATE_STAGES equals ["generating", "mapping"]', () => {
    expect(PROGRAM_GENERATE_STAGES).toEqual(['generating', 'mapping']);
  });
});
